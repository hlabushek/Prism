import asyncio
import json
import logging
import re
from typing import List, Dict, Any, Optional
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
        self.api_key = settings.ROUTERAI_API_KEY
        self.embedding_model = settings.EMBEDDING_MODEL
        self.cheap_llm_model = settings.CHEAP_LLM_MODEL
        self.llm_model = settings.LLM_MODEL
        self.fallback_llm_model = getattr(settings, "FALLBACK_LLM_MODEL", "openai/gpt-4o-mini")
        self.timeout = 60.0

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

    async def _call_llm_with_retry_and_fallback(
        self,
        messages: List[Dict[str, str]],
        primary_model: str,
        fallback_model: str,
        temperature: float = 0.1,
        max_retries: int = 3,
        base_delay: float = 2.0
    ) -> Optional[Dict[str, Any]]:
        """
        Executes LLM request against primary model (z-ai/glm-5.3-flash) with up to 3 retries and delays.
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
                        choice = res_json.get("choices", [{}])[0]
                        finish_reason = choice.get("finish_reason")
                        content = choice.get("message", {}).get("content", "")
                        
                        parsed = self._extract_json_dict(content)
                        if parsed and finish_reason != "error":
                            logger.info(f"LLM [{primary_model}] attempt {attempt} succeeded.")
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
                    content = resp.json().get("choices", [{}])[0].get("message", {}).get("content", "")
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
                    embedding = data["data"][0]["embedding"]
                    return embedding
                else:
                    logger.error(f"RouterAI Embeddings error {response.status_code}: {response.text}")
                    return self._generate_mock_embedding(text)
        except Exception as e:
            logger.error(f"Exception calling RouterAI Embeddings: {e}")
            return self._generate_mock_embedding(text)

    async def filter_cluster_importance(self, articles: List[Dict[str, Any]]) -> bool:
        """
        Preliminary Cheap LLM filter (primary: z-ai/glm-5.3-flash, fallback: openai/gpt-4o-mini).
        Returns strictly True (important / keep) or False (unimportant / discard).
        """
        if not self.api_key or self.api_key == "mock_key":
            return True

        titles_summary = "\n".join([
            f"- Заголовок: {a.get('title', '')} (Источник: {a.get('source_name', 'СМИ')})"
            for a in articles[:10]
        ])

        system_prompt = """Ты — профессиональный выпускающий редактор новостной службы.
Твоя задача: быстро и строго оценить общественно-политическую и экономическую значимость кластера новостей.

ОТВЕТ ДОЛЖЕН БЫТЬ СТРОГО В JSON-ФОРМАТЕ:
{"is_important": true} ИЛИ {"is_important": false}

Критерии отбора:
- true (Важно): События федерального, национального, межрегионального или международного масштаба, значимые законодательные, экономические, геополитические, оборонные или ключевые социальные события.
- false (Неважно/Мусор): Локальные бытовые происшествия (мелкие ДТП, локальные кражи, бытовые драки), желтая пресса, слухи о звездах, кликбейт, реклама, спам и незначительные курьезы."""

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
            base_delay=1.5
        )

        if parsed and "is_important" in parsed:
            is_important = bool(parsed["is_important"])
            logger.info(f"Cheap LLM Filter evaluation: is_important={is_important} for '{articles[0].get('title', '')[:60]}...'")
            return is_important

        return True

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
4. "verified_facts" должны содержать только факты, подтвержденные как минимум двумя независимыми изданиями из предоставленных текстов.
5. КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО объединять в один сюжет несколько разных несвязанных событий (например, разные научные открытия, не связанные между собой происшествия в разных регионах) через союз «И». Если в выборку случайно попали статьи о разных событиях, выбери ОДНО главное доминирующее событие и строй карточку строго по нему, полностью игнорируя посторонние статьи!

ОТВЕТ ДОЛЖЕН БЫТЬ СТРОГО В ФОРМАТЕ ВАЛИДНОГО JSON БЕЗ ЛИШНЕГО ТЕКСТА И БЕЗ MARKDOWN-РАЗМЕТКИ.

Формат JSON:
{
  "title": "Общий нейтральный заголовок инфоповода",
  "summary": "Нейтральная выжимка фактов без эмоциональных оценок (3-5 предложений)",
  "category": "Политика", // Выбери СТРОГО одну из 6 категорий: "Политика", "Экономика", "ВПК", "Технологии", "В мире", "Общество"
  "sentiment": 0.0, // Число от -1.0 до 1.0 (ОЦЕНКА ТОНАЛЬНОСТИ СОБЫТИЯ). Важно: события с жертвами, разрушениями, санкциями, падением рынков, уголовными приговорами имеют тональность от -0.30 до -0.85. События с достижениями, ростом, научными успехами, победами, компенсациями имеют тональность от +0.25 до +0.80. Только чисто процессуальные/рутинные новости имеют тональность около 0.0.
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

        return self._generate_mock_story_card(articles)

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
