# Бэкенд ARCHON

Бэкенд построен на **FastAPI** (Python) и предоставляет REST API для управления вселенными, персонажами, главами, AI-генерации, чата и многого другого.

## Структура

```
backend/app/
├── main.py              # Точка входа FastAPI, lifespan, CORS, static files
├── config.py            # Настройки (Settings из pydantic-settings)
├── database.py          # Master DB + Universe DBs (изоляция данных)
├── routes.py            # Автоматическая регистрация роутеров
│
├── api/                 # API-эндпоинты (30 файлов)
├── models/              # SQLAlchemy-модели (19 файлов)
├── schemas/             # Pydantic-схемы запросов/ответов
├── repositories/        # Data access layer (17 файлов)
├── services/            # Бизнес-логика (18+ файлов + generators/)
└── utils/               # Утилиты
```

## Архитектура слоёв

```
HTTP-запрос
    │
    ▼
┌─────────────┐
│  api/       │  Валидация входных данных (Pydantic), вызов сервисов
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  services/  │  Бизнес-логика: LLM, RAG, генерация, критика, поиск
└──────┬──────┘
       │
       ▼
┌─────────────┐
│repositories/│  CRUD-операции над SQLAlchemy-моделями
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  models/    │  SQLAlchemy-модели (доменные сущности)
└─────────────┘
```

## Подмодули

| Документ | Описание |
|----------|----------|
| [API-эндпоинты](api.md) | Все 30 эндпоинтов с маршрутами и параметрами |
| [Модели данных](models.md) | 19 SQLAlchemy-моделей с полями и связями |
| [Сервисы](services.md) | Бизнес-логика: LLM, RAG, AI-генерация, критика, экспорт |
| [Репозитории](repositories.md) | Data access layer, CRUD-операции |
| [Схемы](schemas.md) | Pydantic-схемы для валидации |

## Точка входа (`main.py`)

```python
# FastAPI application с lifespan-контекстом
# - Инициализация настроек
# - Подключение CORS
# - Раздача статических файлов (портреты, обложки)
# - Автоматическая регистрация роутеров через routes.py
# - Graceful shutdown
```

## Настройки (`config.py`)

`Settings` на базе `pydantic-settings`:
- `BACKEND_PORT` — порт uvicorn (по умолчанию 8000)
- `DEBUG` — показ traceback в ошибках
- `CORS_ORIGINS` — разрешённые источники
- Пути к данным: `data/`, `data/universes/`
- Версия приложения

## База данных (`database.py`)

Два уровня баз данных:
1. **Master DB** — общая для всех вселенных (universes, books, graph_layout, system_settings)
2. **Universe DB** — отдельная на каждую вселенную (все сущности конкретной вселенной)

Асинхронные сессии через `aiosqlite` + `SQLAlchemy 2.0 async`.

## Регистрация роутеров (`routes.py`)

Автоматический импорт всех модулей из `app/api/` и регистрация их роутеров в FastAPI. Каждый файл в `api/` экспортирует `router` — `APIRouter` объект.

---

← [Назад к архитектуре](../architecture.md) | [API-эндпоинты →](api.md)
