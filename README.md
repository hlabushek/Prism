# Prism News AI — Новостной агрегатор с ИИ-аналитикой и Telegram Mini App

Полнофункциональное full-stack приложение новостного агрегатора с ИИ-аналитикой инфоповодов, 5-векторным политическим анализом, защитой от галлюцинаций, предварительной дешевой фильтрацией мусора, SOCKS5-проксированием и ранжированием по весу подтвердивших СМИ.

---

## Ключевые возможности и оптимизации

- **SOCKS5-проксирование**: Глобальная маршрутизация сетевых запросов парсера (`socks5://nnpA9B:8VTTJM@85.195.81.147:10108`) для беспрепятственного сбора данных с заблокированных оппозиционных ресурсов и RSS-лент.
- **Предварительный дешевый LLM-фильтр (`CHEAP_LLM_MODEL`)**: Оценка масштаба инфоповода быстрой моделью (`openai/gpt-4o-mini`) перед запуском тяжелой аналитики. Локальный бытовой мусор и кликбейт отсекаются бинарным фильтром `{"is_important": false}`, экономя бюджет на API.
- **Ограничение на размер кластера**: ИИ-анализ запускается только для событий, освещенных **минимум двумя независимыми изданиями** (`sources_count >= 2`).
- **Устранение галлюцинаций в промпте**: Жесткий запрет на додумывание фактов. Для отсутствующих политических лагерей выставляется `"Нет данных в предоставленных материалах"` и тональность `"нет данных"`. Блок «Слепые зоны» формируется строго на основе отсутствия лагерей в выборке.
- **Ранжирование по весу (`sources_count`)**: Выдача ленты новостей сортируется по количеству подтвердивших независимых источников и свежести публикации.
- **Оптимизированные тайминги**: Сбор каждые 30 минут (`PARSE_INTERVAL_MINUTES=30`), кластеризация и генерация каждый час (`LLM_ANALYSIS_INTERVAL_MINUTES=60`).
- **Расширенный пул источников**: Интегрированы оппозиционные Telegram-каналы (ASTRA, RusNews, SVTV News, SOTA) в дополнение к деловым, официальным и военкорским СМИ.

---

## Стек технологий

- **Бэкенд**: Python 3.11, FastAPI, SQLAlchemy 2.0 (async), PostgreSQL 16 + `pgvector` / SQLite fallback, APScheduler, `httpx[socks]`, `socksio`.
- **ИИ-пайплайн**: RouterAI Gateway (`https://routerai.ru/api/v1`, OpenAI-compatible) с моделями:
  - `EMBEDDING_MODEL`: `openai/text-embedding-3-small`
  - `CHEAP_LLM_MODEL`: `openai/gpt-4o-mini`
  - `LLM_MODEL`: `openai/gpt-5.6-luna`
- **Фронтенд**: React 18, Vite, TypeScript, Tailwind CSS, TanStack React Query, Lucide Icons, Telegram WebApp SDK.

---

## Быстрый запуск

### 1. Переменные окружения (.env)
```env
ROUTERAI_API_KEY=your_routerai_api_key_here
ROUTERAI_BASE_URL=https://routerai.ru/api/v1
EMBEDDING_MODEL=openai/text-embedding-3-small
CHEAP_LLM_MODEL=openai/gpt-4o-mini
LLM_MODEL=openai/gpt-5.6-luna
PROXY_URL=socks5://nnpA9B:8VTTJM@85.195.81.147:10108
PARSE_INTERVAL_MINUTES=30
LLM_ANALYSIS_INTERVAL_MINUTES=60
TELEGRAM_BOT_TOKEN=your_telegram_bot_token_here
```

### 2. Запуск через Docker Compose
```bash
docker compose up -d --build
```

### 3. Локальный запуск без Docker
```bash
# Бэкенд
cd backend
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000

# Фронтенд
cd frontend
npm run dev -- --host 127.0.0.1 --port 3000
```
- **Фронтенд TMA**: `http://127.0.0.1:3000`
- **Swagger API**: `http://127.0.0.1:8000/api/v1/docs`
