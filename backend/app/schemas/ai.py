from typing import List, Optional
from pydantic import BaseModel, Field


class PoliticalVectorItem(BaseModel):
    camp: str = Field(..., description="Название политического лагеря (например: 'Официально-лоялистская', 'Военкоры/Z', 'Деловая/Центристская', 'Либерально-оппозиционная', 'Проукраинская/Внешняя')")
    position: str = Field(..., description="Краткое описание позиции данного лагеря по событию")
    tone: str = Field(..., description="Тональность освещения лагерем: 'положительно', 'нейтрально', 'критично', 'тревожно' и т.д.")
    percentage: Optional[int] = Field(20, description="Примерная доля/вес присутствия этой точки зрения в инфополе (в сумме 100%)")


class QuoteItem(BaseModel):
    quote: str = Field(..., description="Прямая цитата из первоисточника")
    speaker_or_source: str = Field(..., description="Имя спикера или название источника")
    source_url: str = Field(..., description="Оригинальный URL статьи, откуда взята цитата")


class AIStoryCardResponse(BaseModel):
    title: str = Field(..., description="Общий нейтральный и емкий заголовок инфоповода")
    summary: str = Field(..., description="Нейтральная выжимка основных проверенных фактов без оценочных суждений")
    category: str = Field(default="Политика", description="Категория инфоповода: строго одна из 'Политика', 'Экономика', 'ВПК', 'Технологии', 'В мире', 'Общество'")
    sentiment: float = Field(..., ge=-1.0, le=1.0, description="Общая оценка тональности события от -1.0 (крайне негативная/катастрофическая) до 1.0 (крайне позитивная/триумфальная), 0.0 - нейтральная")
    political_vectors: List[PoliticalVectorItem] = Field(..., description="Массив из 5 политических лагерей и их позиций")
    quotes: List[QuoteItem] = Field(default_factory=list, description="Массив прямых цитат с привязкой к оригинальному URL")
    verified_facts: List[str] = Field(default_factory=list, description="Список фактов, упомянутых минимум двумя независимыми лагерями")
    blindspots: List[str] = Field(default_factory=list, description="Указание политических лагерей, полностью проигнорировавших событие или умолчавших о ключевых деталях")

