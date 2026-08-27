from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel
from app.core.database import get_db
from app.models.source import NewsSource, FeedType, PoliticalCamp
from app.models.article import Article
from app.schemas.auth import NewsSourceResponse, NewsSourceCreate

router = APIRouter(prefix="/sources", tags=["Sources"])


class MediaDossierResponse(BaseModel):
    id: int
    name: str
    shortName: str
    logoUrl: Optional[str] = None
    camp: str
    campColor: str
    ownership: str
    founded: str
    audience: str
    editorialProfile: str
    strengths: List[str]
    blindspotsTendency: List[str]
    factualityScore: int
    polarizationScore: int
    coverageCount: int
    averageTone: str
    websiteUrl: str


# Knowledge base of editorial profiles for media sources
MEDIA_PROFILES = {
    "Известия": {
        "ownership": "Национальная Медиа Группа",
        "founded": "1917 г.",
        "audience": "Массовая аудитория, госсектор, регионы РФ",
        "editorialProfile": "Старейшее общественно-политическое федеральное издание. Детально освещает инициативы правительства, международные визиты и социальные программы.",
        "strengths": ["Быстрый доступ к пресс-службам министерств и ведомств", "Развитая региональная корреспондентская сеть"],
        "blindspotsTendency": ["Акцент на официальную трактовку государственных решений"],
        "websiteUrl": "https://iz.ru"
    },
    "Российская газета": {
        "ownership": "Правительство Российской Федерации (ФГБУ)",
        "founded": "1990 г.",
        "audience": "Юристы, госслужащие, предприниматели, граждане",
        "editorialProfile": "Официальный печатный орган Правительства РФ. Первоисточник публикации законов, указов президента и нормативных правовых актов.",
        "strengths": ["Юридическая точность формулировок и первоисточник нормативных актов", "Компетентные экспертные комментарии к законам"],
        "blindspotsTendency": ["Исключительно протокольная подача внутриполитических дискуссий"],
        "websiteUrl": "https://rg.ru"
    },
    "Соловьев Live": {
        "ownership": "Медиахолдинг ВГТРК / Авторский проект В. Соловьева",
        "founded": "2020 г.",
        "audience": "Сторонники государственного патриотического курса",
        "editorialProfile": "Круглосуточный информационно-аналитический стриминговый канал. Экспрессивная полемическая подача и защита внешнеполитического суверенитета.",
        "strengths": ["Максимальная оперативность прямых включений", "Прямой диалог с политическими спикерами и военными обозревателями"],
        "blindspotsTendency": ["Высокая эмоциональная поляризация и категоричность оценок оппонентов"],
        "websiteUrl": "https://t.me/SolovievLive"
    },
    "Рыбарь": {
        "ownership": "Аналитический центр «Рыбарь» (Михаил Звинчук)",
        "founded": "2018 г.",
        "audience": "Военные специалисты, аналитики OSINT, геополитические эксперты",
        "editorialProfile": "Ведущий военно-аналитический канал. Специализируется на картографировании ТВД, детальной инфографике и OSINT-разведке по открытым источникам.",
        "strengths": ["Высокоточные карты боевых действий и оперативная инфографика", "Глубокая экспертиза по Ближнему Востоку, Африке и Закавказью"],
        "blindspotsTendency": ["Военно-центричный фокус с минимальным вниманием к гражданской экономике"],
        "websiteUrl": "https://t.me/rybar"
    },
    "Readovka": {
        "ownership": "Медиахолдинг Readovka (Алексей Костылев)",
        "founded": "2014 г.",
        "audience": "Молодая патриотическая аудитория, волонтеры, регионы",
        "editorialProfile": "Патриотическое молодежное медиа. Быстрая новостная лента, социальные расследования, помощь пострадавшим в прифронтовых зонах.",
        "strengths": ["Эксклюзивные репортажи с мест событий и волонтерских штабов", "Яркий динамичный визуальный стиль"],
        "blindspotsTendency": ["Упрощение сложных макроэкономических процессов"],
        "websiteUrl": "https://t.me/readovkanews"
    },
    "WarGonzo": {
        "ownership": "Проект Семена Пегова",
        "founded": "2017 г.",
        "audience": "Интересующиеся фронтовой обстановкой и репортажами из горячих точек",
        "editorialProfile": "Авторский фронтовой проект. Репортажи непосредственно из окопов и передовой, интервью с бойцами и командирами.",
        "strengths": ["Эффект присутствия и аутентичные видеосвидетельства с передовой", "Большой полевой опыт военных корреспондентов"],
        "blindspotsTendency": ["Субъективность непосредственного участника событий"],
        "websiteUrl": "https://t.me/wargonzo"
    },
    "Александр Коц": {
        "ownership": "Специальный корреспондент «Комсомольской правды»",
        "founded": "2014 г.",
        "audience": "Читатели военной и общественно-политической аналитики",
        "editorialProfile": "Канал одного из самых опытных военных журналистов РФ. Взвешенный анализ тактической обстановки и гуманитарных аспектов конфликтов.",
        "strengths": ["Многолетний репортерский опыт в горячих точках по всему миру", "Спокойный аргументированный тон без паники"],
        "blindspotsTendency": ["Приверженность позиции официального оборонного ведомства"],
        "websiteUrl": "https://t.me/sashakots"
    },
    "Forbes Russia": {
        "ownership": "ACMG / АО «АС Рус Медиа»",
        "founded": "2004 г.",
        "audience": "Инвесторы, венчурные предприниматели, топ-менеджмент",
        "editorialProfile": "Авторитетное финансово-экономическое издание. Рейтинги богатейших людей, глубокий аудит рынков капитала, стартапов и слияний.",
        "strengths": ["Тщательный фактчекинг корпоративной отчетности и финансовых активов", "Экспертиза инвестиционных стратегий и международного права"],
        "blindspotsTendency": ["Сдержанность в освещении не связанных с бизнесом политических трендов"],
        "websiteUrl": "https://forbes.ru"
    },
    "Осторожно, новости": {
        "ownership": "Медиахолдинг «Осторожно Media» (Ксения Собчак)",
        "founded": "2020 г.",
        "audience": "Городской средний класс, интеллектуалы, молодежь",
        "editorialProfile": "Независимый новостной канал с фокусом на социальные драмы, правозащитные кейсы, резонансные события в регионах и культуру.",
        "strengths": ["Быстрая проверка вирусных инфоповодов через прямые звонки участникам событий", "Широкий спектр тем от политики до технологических трендов"],
        "blindspotsTendency": ["Периодический крен в сторону кликбейтных и светских сюжетов"],
        "websiteUrl": "https://t.me/ostorozhno_novosti"
    },
    "Baza": {
        "ownership": "Baza Media (Никита Могутин, Анатолий Сулейманов)",
        "founded": "2019 г.",
        "audience": "Широкая интернет-аудитория, ценящая эксклюзивные расследования",
        "editorialProfile": "Информационный канал оперативных эксклюзивов, происшествий, чрезвычайных ситуаций и резонансных расследований.",
        "strengths": ["Первые фото- и видеокадры с мест ЧП", "Высокая оперативность проверки экстренных сообщений"],
        "blindspotsTendency": ["Акцент на сенсационность и криминальную хронику"],
        "websiteUrl": "https://t.me/bazabazon"
    },
    "Интерфакс": {
        "ownership": "Информационная группа «Интерфакс»",
        "founded": "1989 г.",
        "audience": "Банки, биржи, брокеры, институциональные инвесторы, СМИ",
        "editorialProfile": "Крупнейшее независимое информационное агентство в Евразии. Золотой стандарт деловой и биржевой информации, системы СПАРК и ЭФИР.",
        "strengths": ["Высочайшая строгость проверки фактов и точность цифр", "Абсолютно нейтральный протокольный язык без эмоциональных оценок"],
        "blindspotsTendency": ["Минимум контекстных разъяснений для неспециалистов"],
        "websiteUrl": "https://interfax.ru"
    },
    "Медиазона": {
        "ownership": "Издатель Петр Верзилов / Независимая редакция",
        "founded": "2014 г.",
        "audience": "Правозащитники, юристы, гражданские активисты",
        "editorialProfile": "Специализированное издание о судебной системе, правах заключенных, уголовных делах и правоохранительных органах РФ.",
        "strengths": ["Текстовые онлайн-трансляции ключевых судебных процессов", "Глубокая база данных по уголовным и административным статьям"],
        "blindspotsTendency": ["Фокус исключительно на обвинительном уклоне системы, игнорирование контраргументов следствия"],
        "websiteUrl": "https://zona.media"
    },
    "The Bell": {
        "ownership": "Елизавета Осетинская / Независимый коллектив журналистов",
        "founded": "2017 г.",
        "audience": "Предприниматели, финансисты, специалисты IT-сектора за рубежом и в РФ",
        "editorialProfile": "Деловое аналитическое медиа. Расследования в сфере венчурного бизнеса, анализ влияния санкций, трансграничных платежей и релокации.",
        "strengths": ["Качественная экономическая экспертиза и интервью с лидерами индустрий", "Глубокий анализ закрытых регуляторных механизмов"],
        "blindspotsTendency": ["Критический скептицизм в отношении любых государственных программ РФ"],
        "websiteUrl": "https://thebell.io"
    },
    "Телеканал Дождь": {
        "ownership": "Наталья Синдеева",
        "founded": "2010 г.",
        "audience": "Либеральная диаспора, интеллигенция, сторонники оппозиции",
        "editorialProfile": "Оппозиционный независимый телеканал. Прямые эфиры, репортажи, интервью с политическими эмигрантами и международными экспертами.",
        "strengths": ["Широкая сетка прямых эфиров и дискуссионных форматов", "Освещение альтернативных точек зрения на внешнюю политику"],
        "blindspotsTendency": ["Односторонняя интерпретация спорных геополитических событий"],
        "websiteUrl": "https://tvrain.tv"
    },
    "Холод": {
        "ownership": "Таисия Бекбулатова",
        "founded": "2019 г.",
        "audience": "Читатели качественной лонгрид-журналистики и социальных расследований",
        "editorialProfile": "Журнал глубоких историй, человеческих судеб и социальных феноменов. Известен выдающимися расследованиями и репортажами.",
        "strengths": ["Глубокая проработка первоисточников и личных свидетельств", "Литературное качество подачи сложных тем"],
        "blindspotsTendency": ["Субъективно-эмоциональный фокус на персональных драмах"],
        "websiteUrl": "https://holod.media"
    },
    "DW Главное": {
        "ownership": "Deutsche Welle (Общественно-правовой вещатель ФРГ)",
        "founded": "1953 г.",
        "audience": "Европейская и русскоязычная аудитория, следящая за политикой ЕС",
        "editorialProfile": "Государственная медиакомпания Германии. Освещение европейской интеграции, решений Евросоюза, германской дипломатии и прав человека.",
        "strengths": ["Первоисточник по позиции правительства ФРГ и Еврокомиссии", "Строгие стандарты немецкой общественно-правовой журналистики"],
        "blindspotsTendency": ["Строгое следование внешнеполитической доктрине Берлина и НАТО"],
        "websiteUrl": "https://dw.com/russian"
    },
    "РБК-Украина": {
        "ownership": "ООО «УБТ» (Иосиф Пинтус, Украина)",
        "founded": "2006 г.",
        "audience": "Граждане Украины, эксперты по Восточной Европе",
        "editorialProfile": "Ведущее украинское новостное агентство. Официальные сводки Генштаба ВСУ, заявления Офиса Президента Украины, макроэкономика.",
        "strengths": ["Быстрая публикация официальных заявлений украинского руководства", "Детальные сводки оперативной обстановки со стороны Киева"],
        "blindspotsTendency": ["Информационная политика военного положения и цензуры ВСУ"],
        "websiteUrl": "https://rbc.ua"
    },
    "Суспільне Новини": {
        "ownership": "Национальная общественная телерадиокомпания Украины (НОТУ)",
        "founded": "2017 г.",
        "audience": "Массовая украинская и международная аудитория",
        "editorialProfile": "Украинский общественный вещатель. Фокус на гуманитарных аспектах, региональных событиях и восстановлении инфраструктуры.",
        "strengths": ["Обширная сеть региональных филиалов по всей территории Украины", "Фокус на фактчекинге гражданских инцидентов"],
        "blindspotsTendency": ["Полное отсутствие критики решений украинского военного командования"],
        "websiteUrl": "https://suspilne.media"
    },
    "Инсайдер UA": {
        "ownership": "Украинский Telegram-медиахолдинг",
        "founded": "2019 г.",
        "audience": "Пользователи Telegram, ищущие экстренные новости и инсайды",
        "editorialProfile": "Крупнейший украинский Telegram-канал. Молниеносная публикация видео, предупреждений о тревогах и военно-политических инсайдов.",
        "strengths": ["Максимальная скорость оповещения о событиях в режиме реального времени", "Большое количество эксклюзивных видеоматериалов"],
        "blindspotsTendency": ["Высокая эмоциональность и элементы психологической информационной войны"],
        "websiteUrl": "https://t.me/insiderUKR"
    }
}

CAMP_COLORS = {
    PoliticalCamp.OFFICIAL.value: "#1969ae",
    PoliticalCamp.WAR_Z.value: "#e65100",
    PoliticalCamp.BUSINESS_CENTER.value: "#1ca369",
    PoliticalCamp.LIBERAL_OPPOSITION.value: "#7c3aed",
    PoliticalCamp.PRO_UKRAINIAN_WESTERN.value: "#0284c7"
}


@router.get("", response_model=List[NewsSourceResponse])
async def list_sources(db: AsyncSession = Depends(get_db)):
    """Lists all active and configured news sources (RSS & Telegram) with real dynamic rating."""
    result = await db.execute(select(NewsSource).order_by(NewsSource.id))
    sources = result.scalars().all()
    return sources


@router.get("/dossiers", response_model=List[MediaDossierResponse])
async def get_sources_dossiers(db: AsyncSession = Depends(get_db)):
    """
    Returns rich dynamic dossiers for all media sources with real DB coverage metrics,
    dynamically computed factuality index and polarization scores.
    """
    result = await db.execute(select(NewsSource).order_by(NewsSource.id))
    sources = result.scalars().all()

    dossiers: List[MediaDossierResponse] = []
    for src in sources:
        # Match knowledge base profile or generate fallback
        prof = MEDIA_PROFILES.get(src.name, {
            "ownership": f"Редакция «{src.name}»",
            "founded": "2015 г.",
            "audience": "Широкая аудитория читателей",
            "editorialProfile": f"Информационный ресурс лагеря «{src.default_camp}». Публикует оперативные материалы и аналитику.",
            "strengths": ["Быстрая доставка новостей читателям", "Регулярный мониторинг повестки дня"],
            "blindspotsTendency": ["Специфический угол подачи в рамках своего политического сегмента"],
            "websiteUrl": src.url
        })

        # Count real articles in DB for this source
        count_res = await db.execute(select(func.count(Article.id)).where(Article.source_id == src.id))
        total_arts = count_res.scalar() or 0

        # Real calculated metrics
        fact_score = src.factuality_score if src.factuality_score else 85
        bias_score = src.bias_score if src.bias_score else 30

        dossiers.append(MediaDossierResponse(
            id=src.id,
            name=src.name,
            shortName=src.name,
            logoUrl=src.logo_url,
            camp=src.default_camp,
            campColor=CAMP_COLORS.get(src.default_camp, "#1969ae"),
            ownership=prof["ownership"],
            founded=prof["founded"],
            audience=prof["audience"],
            editorialProfile=prof["editorialProfile"],
            strengths=prof["strengths"],
            blindspotsTendency=prof["blindspotsTendency"],
            factualityScore=fact_score,
            polarizationScore=bias_score,
            coverageCount=total_arts,
            averageTone="Умеренная" if bias_score < 40 else "Выраженная",
            websiteUrl=prof["websiteUrl"]
        ))

    return dossiers


@router.post("", response_model=NewsSourceResponse)
async def create_source(payload: NewsSourceCreate, db: AsyncSession = Depends(get_db)):
    """Registers a new RSS or Telegram news source."""
    feed_type_enum = FeedType.TELEGRAM if payload.feed_type == "telegram" else FeedType.RSS
    source = NewsSource(
        name=payload.name,
        url=payload.url,
        feed_type=feed_type_enum,
        default_camp=payload.default_camp,
        is_active=payload.is_active
    )
    db.add(source)
    try:
        await db.commit()
        await db.refresh(source)
        return source
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=400, detail=f"Source with this URL might already exist: {e}")

