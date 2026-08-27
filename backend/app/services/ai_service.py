import asyncio
import json
import logging
import re
from typing import List, Dict, Any, Optional, Tuple
import httpx
import numpy as np
from app.core.config import settings
from app.schemas.ai import AIStoryCardResponse, PoliticalVectorItem, QuoteItem

logger = logging.getLogger(__name__)


class AIService:
    def __init__(self):
        url = settings.ROUTERAI_BASE_URL.rstrip("/")
        if url.endswith("/v1") and not url.endswith("/api/v1"):
            url = url.replace("/v1", "/api/v1")
        self.base_url = url
        self.timeout = 60.0

    @property
    def api_key(self) -> str:
        return getattr(settings, "ROUTERAI_API_KEY", "")

    @property
    def embedding_model(self) -> str:
        return getattr(settings, "EMBEDDING_MODEL", "openai/text-embedding-3-small")

    @property
    def cheap_llm_model(self) -> str:
        return getattr(settings, "CHEAP_LLM_MODEL", "deepseek/deepseek-v4-flash-0731")

    @property
    def llm_model(self) -> str:
        return getattr(settings, "LLM_MODEL", "deepseek/deepseek-v4-flash-0731")

    @property
    def fallback_llm_model(self) -> str:
        return getattr(settings, "FALLBACK_LLM_MODEL", "openai/gpt-4o-mini")

    @property
    def headers(self) -> Dict[str, str]:
        return {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }

    def _extract_json_dict(self, raw_text: str) -> Optional[Dict[str, Any]]:
        """Extracts and parses JSON object from model output, stripping code fences or prefix thoughts."""
        if not raw_text:
            return None
        text = raw_text.strip()
        # Remove markdown code block if present
        if "```" in text:
            match = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", text)
            if match:
                text = match.group(1).strip()

        # Find first { and last }
        start = text.find("{")
        end = text.rfind("}")
        if start != -1 and end != -1 and end > start:
            json_str = text[start:end+1]
            try:
                return json.loads(json_str)
            except Exception:
                pass

        try:
            return json.loads(text)
        except Exception:
            return None

    async def record_token_usage(
        self,
        stage: str,
        model_name: str,
        prompt_tokens: int,
        completion_tokens: int
    ):
        total_tokens = prompt_tokens + completion_tokens
        if total_tokens <= 0:
            return

        # Cost formula in RUB (based on ~92 RUB/USD and RouterAI/OpenAI standard per-1k rates)
        if stage == "embedding":
            # $0.00002 / 1k tokens -> ~0.00184 RUB / 1k tokens
            cost_rub = (total_tokens / 1000.0) * 0.00184
        elif stage == "cheap_filter":
            # $0.05 / 1M prompt ($0.00005/1k) + $0.15 / 1M completion ($0.00015/1k)
            cost_rub = (prompt_tokens / 1000.0) * 0.0046 + (completion_tokens / 1000.0) * 0.0138
        else:  # story_synthesis
            # $0.14 / 1M prompt ($0.00014/1k) + $0.28 / 1M completion ($0.00028/1k)
            cost_rub = (prompt_tokens / 1000.0) * 0.0128 + (completion_tokens / 1000.0) * 0.0257

        try:
            from app.core.database import AsyncSessionLocal
            from app.models.ai_usage import AITokenUsage
            async with AsyncSessionLocal() as session:
                entry = AITokenUsage(
                    stage=stage,
                    model_name=model_name,
                    prompt_tokens=prompt_tokens,
                    completion_tokens=completion_tokens,
                    total_tokens=total_tokens,
                    estimated_cost_rub=round(cost_rub, 6)
                )
                session.add(entry)
                await session.commit()
        except Exception as e:
            logger.debug(f"Note recording token usage: {e}")

    async def _call_llm_with_retry_and_fallback(
        self,
        messages: List[Dict[str, str]],
        primary_model: str,
        fallback_model: str,
        temperature: float = 0.1,
        max_retries: int = 3,
        base_delay: float = 2.0,
        stage: str = "story_synthesis"
    ) -> Optional[Dict[str, Any]]:
        """
        Executes LLM request against primary model (e.g. deepseek-v4-flash) with up to 3 retries and delays.
        Switches to fallback model (e.g. openai/gpt-4o-mini) if all 3 attempts fail.
        """
        url = f"{self.base_url}/chat/completions"

        # 1. Try Primary Model up to max_retries with delay
        for attempt in range(1, max_retries + 1):
            try:
                payload = {
                    "model": primary_model,
                    "messages": messages,
                    "response_format": {"type": "json_object"},
                    "temperature": temperature
                }
                async with httpx.AsyncClient(timeout=self.timeout) as client:
                    resp = await client.post(url, json=payload, headers=self.headers)
                    if resp.status_code == 200:
                        res_json = resp.json()
                        usage = res_json.get("usage", {})
                        p_toks = usage.get("prompt_tokens", 0)
                        c_toks = usage.get("completion_tokens", 0)
                        if p_toks > 0 or c_toks > 0:
                            asyncio.create_task(self.record_token_usage(stage, primary_model, p_toks, c_toks))

                        choice = res_json.get("choices", [{}])[0]
                        finish_reason = choice.get("finish_reason")
                        content = choice.get("message", {}).get("content", "")
                        
                        parsed = self._extract_json_dict(content)
                        if parsed and finish_reason != "error":
                            logger.info(f"LLM [{primary_model}] attempt {attempt} succeeded (tokens: prompt={p_toks}, comp={c_toks}).")
                            return parsed
                        else:
                            logger.warning(f"LLM [{primary_model}] attempt {attempt} returned empty/invalid JSON (finish_reason: {finish_reason}).")
                    else:
                        logger.warning(f"LLM [{primary_model}] attempt {attempt} returned HTTP {resp.status_code}: {resp.text[:150]}")
            except Exception as e:
                logger.warning(f"LLM [{primary_model}] attempt {attempt} threw exception: {e}")

            if attempt < max_retries:
                delay = base_delay * attempt
                logger.info(f"Waiting {delay:.1f}s before retry #{attempt + 1} for {primary_model}...")
                await asyncio.sleep(delay)

        # 2. If Primary Model failed 3 times, switch to Fallback Model
        logger.warning(f"Primary model {primary_model} failed after {max_retries} attempts. Switching to fallback model {fallback_model}...")
        try:
            payload_fallback = {
                "model": fallback_model,
                "messages": messages,
                "response_format": {"type": "json_object"},
                "temperature": temperature
            }
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                resp = await client.post(url, json=payload_fallback, headers=self.headers)
                if resp.status_code == 200:
                    res_json = resp.json()
                    usage = res_json.get("usage", {})
                    p_toks = usage.get("prompt_tokens", 0)
                    c_toks = usage.get("completion_tokens", 0)
                    if p_toks > 0 or c_toks > 0:
                        asyncio.create_task(self.record_token_usage(stage, fallback_model, p_toks, c_toks))

                    content = res_json.get("choices", [{}])[0].get("message", {}).get("content", "")
                    parsed = self._extract_json_dict(content)
                    if parsed:
                        logger.info(f"Fallback model [{fallback_model}] succeeded.")
                        return parsed
                logger.error(f"Fallback model [{fallback_model}] failed with HTTP {resp.status_code}: {resp.text[:150]}")
        except Exception as fb_err:
            logger.error(f"Fallback model [{fallback_model}] exception: {fb_err}")

        return None

    async def get_embedding(self, text: str) -> List[float]:
        """
        Generates dense vector embeddings via RouterAI /embeddings endpoint.
        Uses deterministic mock embeddings fallback if no API key is provided.
        """
        if not self.api_key or self.api_key == "mock_key":
            return self._generate_mock_embedding(text)

        url = f"{self.base_url}/embeddings"
        payload = {
            "model": self.embedding_model,
            "input": text[:8000]  # Respect token limits
        }

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.post(url, json=payload, headers=self.headers)
                if response.status_code == 200:
                    data = response.json()
                    usage = data.get("usage", {})
                    p_toks = usage.get("prompt_tokens", len(text.split()))
                    if p_toks > 0:
                        asyncio.create_task(self.record_token_usage("embedding", self.embedding_model, p_toks, 0))
                    embedding = data["data"][0]["embedding"]
                    return embedding
                else:
                    logger.error(f"RouterAI Embeddings error {response.status_code}: {response.text}")
                    return self._generate_mock_embedding(text)
        except Exception as e:
            logger.error(f"Exception calling RouterAI Embeddings: {e}")
            return self._generate_mock_embedding(text)

    async def filter_cluster_importance(
        self,
        articles: List[Dict[str, Any]],
        threshold: Optional[int] = None
    ) -> Tuple[bool, int, str]:
        """
        Preliminary Cheap LLM filter (primary: z-ai/glm-5.3-flash, fallback: openai/gpt-4o-mini).
        Returns (is_important: bool, importance_score: int 1-10, reason: str).
        """
        if not self.api_key or self.api_key == "mock_key":
            return False, 0, "No API key"

        min_threshold = threshold if threshold is not None else getattr(settings, "IMPORTANCE_THRESHOLD", 6)

        titles_summary = "\n".join([
            f"- Заголовок: {a.get('title', '')} (Источник: {a.get('source_name', 'СМИ')})"
            for a in articles[:10]
        ])

        system_prompt = """Ты — строгий главный редактор федеральной аналитической службы новостей Prism.
Твоя задача: беспристрастно, критично и реалистично оценить реальную общественно-политическую и геополитическую значимость инфоповода по шкале от 1 до 10.

КАТЕГОРИЧЕСКОЕ ПРАВИЛО: НЕ ЗАВЫШАЙ ОЦЕНКИ! Большинство рядовых новостей должны получать 2, 3, 4 или 5 баллов. Оценку 7 и выше заслуживают только фундаментальные события!

ШКАЛА ОЦЕНКИ (1-10):
- 9-10 (Событие века / Критическое): Начало/окончание крупной войны, смена власти в ведущих державах (США, РФ, Китай), теракты/катастрофы с сотнями жертв, глобальный финансовый кризис.
- 7-8 (Высокая / Федеральная значимость): Решения Путина/Трампа/Си, ключевые законы, ставка ЦБ/девальвация, ракетные удары по критической инфраструктуре, масштабные санкции.
- 5-6 (Локально-значимая): Назначения министров/губернаторов, крупные корпоративные слияния/суды, региональные ЧП, заявления действующих европейских министров.
- 3-4 (Второстепенная / Шум): Мнения и интервью экс-чиновников (на YouTube/в блогах), споры вокруг земельных участков (например ВСМ/Милти), бытовые происшествия, протокольные пресс-релизы.
- 1-2 (Мусор / Спам): Профессиональный спорт (отказ пожать руку/фото на турнирах, результаты матчей), шоу-бизнес, развлечения, слухи, кликбейт, мода.

ОТВЕТ ДОЛЖЕН БЫТЬ СТРОГО В JSON-ФОРМАТЕ:
{
  "importance_score": 3,
  "reason": "Четкое, критичное обоснование в 1 предложение"
}"""

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": f"Оцени значимость инфоповода по списку публикаций:\n\n{titles_summary}"}
        ]

        parsed = await self._call_llm_with_retry_and_fallback(
            messages=messages,
            primary_model=self.cheap_llm_model,
            fallback_model=self.fallback_llm_model,
            temperature=0.0,
            max_retries=3,
            base_delay=1.5,
            stage="cheap_filter"
        )

        if parsed and "importance_score" in parsed:
            try:
                score = int(parsed["importance_score"])
            except Exception:
                score = 5
            score = max(1, min(10, score))
            reason = str(parsed.get("reason", "")).strip()
            is_important = score >= min_threshold
            logger.info(f"Cheap LLM Importance: score={score}/10 (threshold={min_threshold}, keep={is_important}) | Reason: '{reason}' for '{articles[0].get('title', '')[:50]}...'")
            return is_important, score, reason

        return False, 1, "Failed to parse importance"

    async def generate_story_card(self, articles: List[Dict[str, Any]]) -> AIStoryCardResponse:
        """
        Synthesizes a multi-source news cluster into a structured AI analytical card.
        Primary: z-ai/glm-5.3-flash (up to 3 retries with delay).
        Fallback: openai/gpt-4o-mini.
        """
        system_prompt = """Ты — независимый объективный аналитик новостей и фактчекер высшей квалификации.
Твоя задача: на основе переданного массива публикаций из различных СМИ и каналов по одному общему инфоповоду сгенерировать глубокий, строго нейтральный аналитический дайджест.

КРИТИЧЕСКИЕ ПРАВИЛА И ДИРЕКТИВЫ ПРОТИВ ГАЛЛЮЦИНАЦИЙ:
1. Запрещено додумывать факты, события, участников и позиции! Опирайся исключительно на предоставленные тексты статей.
2. Если в переданных статьях отсутствуют публикации или высказывания конкретного политического лагеря, СТРОГО укажи в поле position значение "Нет данных в предоставленных материалах", а в поле tone — "нет данных". Не пытайся угадывать или выдумывать реакцию лагеря!
3. Блок "blindspots" (Слепые зоны) формируй СТРОГО на основе отсутствия лагерей в текущей выборке (например: "Лагерь 'Военкоры/Z' не представлен в выборке по данному событию", "Официальные СМИ проигнорировали инфоповод") либо явных умолчаний фактов, присутствующих в одних статьях и отсутствующих в других.
4. "verified_facts" должны содержать только факты, подтвержденные как минимум двумя изданиями из предоставленных текстов. Если статьи в выборке происходят только из одного лагеря (например, только официальные госагентства РФ), честно формулируй: «Факт заявлен официальными источниками РФ (РИА, ТАСС), независимого подтверждения от других сторон нет».
5. КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО объединять в один сюжет несколько разных несвязанных событий (например, разные научные открытия, не связанные между собой происшествия в разных регионах) через союз «И». Если в выборку случайно попали статьи о разных событиях, выбери ОДНО главное доминирующее событие и строй карточку строго по нему, полностью игнорируя посторонние статьи!

ОТВЕТ ДОЛЖЕН БЫТЬ СТРОГО В ФОРМАТЕ ВАЛИДНОГО JSON БЕЗ ЛИШНЕГО ТЕКСТА И БЕЗ MARKDOWN-РАЗМЕТКИ.
6. В поле "category" выбери СТРОГО одну из 6 категорий: "Политика", "Экономика", "ВПК", "Технологии", "В мире", "Общество".
7. В поле "sentiment" укажи число от -1.0 до 1.0 (ОЦЕНКА ТОНАЛЬНОСТИ СОБЫТИЯ). Важно: события с жертвами, разрушениями, санкциями, падением рынков, уголовными приговорами имеют тональность от -0.30 до -0.85. События с достижениями, ростом, научными успехами, победами, компенсациями имеют тональность от +0.25 до +0.80. Только чисто процессуальные/рутинные новости имеют тональность около 0.0.
8. В поле "importance_score" укажи строгое число от 1 до 10 (НЕ ЗАВЫШАЙ ОЦЕНКИ: 1-2 спорт/шоубиз, 3-4 быт/мнения экс-чиновников/земельные споры, 5-6 региональные ЧП/назначения, 7-8 федеральные законы/макроэкономика/стратегические удары, 9-10 перелом войны/смена власти в сверхдержавах).
9. В поле "importance_reason" укажи краткое критичное обоснование оценки значимости (1 предложение).

Формат JSON:
{
  "title": "Общий нейтральный заголовок инфоповода",
  "summary": "Нейтральная выжимка фактов без эмоциональных оценок (3-5 предложений)",
  "category": "Политика",
  "sentiment": 0.0,
  "importance_score": 7,
  "importance_reason": "Федеральное решение с прямым влиянием на экономику и правоприменительную практику",
  "political_vectors": [
    {
      "camp": "Официально-лоялистская",
      "position": "Официальная линия госорганов (ТАСС, РИА, РГ, RT, Известия) или провластная таблоидная повестка (Mash). (Или 'Нет данных в предоставленных материалах')",
      "tone": "лояльно / оптимистично / сдержанно / нет данных",
      "percentage": 20
    },
    {
      "camp": "Военкоры/Z",
      "position": "Позиция военных корреспондентов и авторских патриотических ресурсов (Рыбарь, Readovka, WarGonzo, Коц, Осведомитель, Соловьев Live). (Или 'Нет данных в предоставленных материалах')",
      "tone": "тревожно / критично / патриотично / нет данных",
      "percentage": 20
    },
    {
      "camp": "Деловая/Центристская",
      "position": "Экономические, корпоративные и макроэкономические последствия от классической деловой прессы (Коммерсантъ, РБК, Ведомости, Forbes, The Bell, Интерфакс). (Или 'Нет данных в предоставленных материалах')",
      "tone": "сухо / аналитично / нейтрально / нет данных",
      "percentage": 20
    },
    {
      "camp": "Либерально-оппозиционная",
      "position": "Правозащитный фокус, политические суды, социальные резонансы и критика властей (Медиазона, Дождь, Холод, ASTRA, RusNews, SVTV, SOTA, Осторожно новости, Baza). (Или 'Нет данных в предоставленных материалах')",
      "tone": "критично / пессимистично / нет данных",
      "percentage": 20
    },
    {
      "camp": "Проукраинская/Внешняя",
      "position": "Освещение внешними источниками: разграничивай институциональную европейскую/западную позицию (DW) и позицию украинских медиа (РБК-Украина, Суспільне, Инсайдер UA). (Или 'Нет данных в предоставленных материалах')",
      "tone": "враждебно / скептично / внешнеполитически / нет данных",
      "percentage": 20
    }
  ],
  "quotes": [
    {
      "quote": "Прямая значимая цитата из предоставленного текста",
      "speaker_or_source": "Имя спикера или СМИ",
      "source_url": "https://..."
    }
  ],
  "verified_facts": [
    "Факт, подтвержденный минимум 2 независимыми изданиями в предоставленных текстах"
  ],
  "blindspots": [
    "Слепая зона: указание конкретного лагеря, отсутствующего в выборке или умолчавшего о фактах"
  ]
}
Сумма percentage в political_vectors должна составлять 100% (распределяй вес между представленными точками зрения, для лагерей без данных устанавливай 0% или минимальный остаток). Обязательно перечисляй все 5 лагерей."""

        articles_context = []
        for i, art in enumerate(articles, 1):
            source_info = art.get("source_name", "СМИ")
            url = art.get("url", "")
            title = art.get("title", "")
            content = art.get("clean_content", "")[:1200]
            articles_context.append(f"--- [Статья #{i}] Источник: {source_info} | URL: {url} ---\nЗаголовок: {title}\nТекст: {content}\n")

        user_content = "\n".join(articles_context)

        if not self.api_key or self.api_key == "mock_key":
            return self._generate_mock_story_card(articles)

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": f"Проанализируй следующие материалы инфоповода и верни JSON:\n\n{user_content}"}
        ]

        parsed = await self._call_llm_with_retry_and_fallback(
            messages=messages,
            primary_model=self.llm_model,
            fallback_model=self.fallback_llm_model,
            temperature=0.1,
            max_retries=3,
            base_delay=2.0
        )

        if parsed:
            try:
                return AIStoryCardResponse(**parsed)
            except Exception as val_err:
                logger.warning(f"Validation error on AIStoryCardResponse: {val_err}. Trying fallback model directly...")
                fb_parsed = await self._call_llm_with_retry_and_fallback(
                    messages=messages,
                    primary_model=self.fallback_llm_model,
                    fallback_model=self.fallback_llm_model,
                    temperature=0.1,
                    max_retries=1
                )
                if fb_parsed:
                    try:
                        return AIStoryCardResponse(**fb_parsed)
                    except Exception:
                        pass

        logger.error(f"Failed to generate AIStoryCardResponse for '{articles[0].get('title', '')[:60]}...'. Skipping.")
        return None

    def _generate_mock_embedding(self, text: str) -> List[float]:
        """Generates deterministic pseudo-random normalized vector for local testing."""
        np.random.seed(abs(hash(text[:50])) % (2**32))
        vec = np.random.randn(settings.EMBEDDING_DIMENSION).astype(float)
        norm = np.linalg.norm(vec)
        if norm > 0:
            vec = vec / norm
        return vec.tolist()

    def _generate_mock_story_card(self, articles: List[Dict[str, Any]]) -> AIStoryCardResponse:
        """Generates a realistic analytical mock card when LLM is unavailable."""
        main_title = articles[0].get("title", "Главное событие дня") if articles else "Событие дня"
        main_url = articles[0].get("url", "https://example.com") if articles else "https://example.com"
        
        return AIStoryCardResponse(
            title=f"{main_title}",
            summary="Ключевые источники сообщили о развитии событий вокруг данного инфоповода. Произошло согласование основных параметров, однако стороны по-разному интерпретируют долгосрочные последствия для рынка и общества.",
            sentiment=0.15,
            political_vectors=[
                PoliticalVectorItem(
                    camp="Официально-лоялистская",
                    position="Подчеркивается плановый характер решений и стабильность государственных институтов.",
                    tone="лояльно / оптимистично",
                    percentage=40
                ),
                PoliticalVectorItem(
                    camp="Военкоры/Z",
                    position="Нет данных в предоставленных материалах",
                    tone="нет данных",
                    percentage=0
                ),
                PoliticalVectorItem(
                    camp="Деловая/Центристская",
                    position="Оценивают макроэкономический эффект, влияние на курс валют и корпоративную отчетность.",
                    tone="нейтрально / прагматично",
                    percentage=40
                ),
                PoliticalVectorItem(
                    camp="Либерально-оппозиционная",
                    position="Выражают скептицизм относительно заявленных сроков и указывают на регуляторные риски.",
                    tone="критично / настороженно",
                    percentage=20
                ),
                PoliticalVectorItem(
                    camp="Проукраинская/Внешняя",
                    position="Нет данных в предоставленных материалах",
                    tone="нет данных",
                    percentage=0
                )
            ],
            quotes=[
                QuoteItem(
                    quote="«Ситуация находится под постоянным оперативным контролем, все необходимые механизмы задействованы в полном объеме».",
                    speaker_or_source="Представитель профильного ведомства",
                    source_url=main_url
                ),
                QuoteItem(
                    quote="«Рынок уже заложил базовые ожидания в котировки, ключевое значение будет иметь динамика следующих недель».",
                    speaker_or_source="Ведущий финансовый аналитик",
                    source_url=main_url
                )
            ],
            verified_facts=[
                "Официальное подтверждение факта проведения ключевых консультаций и публикации документов.",
                "Отсутствие прямых сбоев в работе инфраструктуры на момент фиксации отчетов."
            ],
            blindspots=[
                "Лагеря 'Военкоры/Z' и 'Проукраинская/Внешняя' полностью не представлены в текущей выборке публикаций по данному событию.",
                "Официальные источники опустили дискуссию о бюджетных ограничениях и росте издержек."
            ]
        )


ai_service = AIService()
