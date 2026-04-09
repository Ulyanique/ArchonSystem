# База данных и миграции

ARCHON использует **две уровня баз данных**: Master DB (общая) + Universe DB (отдельная на вселенную).

## Архитектура БД

```
┌─────────────────────────────────────────────┐
│              Master DB                       │  archon_master.db
│  ┌──────────┬──────────┬──────────────────┐ │
│  │universes │  books   │  graph_layout    │ │
│  │          │          │  system_settings │ │
│  └──────────┴──────────┴──────────────────┘ │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│         Universe DB (per universe)           │  data/universes/{id}/universe.db
│  ┌────────────────────────────────────────┐ │
│  │ characters  │ locations   │ chapters   │ │
│  │ storylines  │ notes       │ quotes     │ │
│  │ timeline    │ outline     │ wiki       │ │
│  │ factions    │ concept_art │ space      │ │
│  │ links       │ mentions    │ knowledge  │ │
│  └────────────────────────────────────────┘ │
└─────────────────────────────────────────────┘
```

## Технологии

| Технология | Версия | Назначение |
|------------|--------|-----------|
| **SQLite** | 3.x | Основная БД (async через aiosqlite) |
| **SQLAlchemy** | 2.0 | ORM, async-сессии |
| **Alembic** | latest | Миграции схемы |
| **ChromaDB** | latest | Векторная БД для RAG |

## Master DB

**Расположение:** `backend/data/archon_master.db`

Содержит метаданные, общие для всех вселенных:

| Таблица | Описание |
|---------|----------|
| `universes` | Вселенные (metadata, clock settings) |
| `books` | Книги/продукты (обратная совместимость) |
| `graph_layout` | Позиции узлов графа знаний |
| `system_settings` | Глобальные настройки (singleton, id=1) |

## Universe DB

**Расположение:** `backend/data/universes/{universe_id}/universe.db`

Каждая вселенная — отдельная база данных. Содержит все сущности конкретной вселенной:

| Таблица | Описание |
|---------|----------|
| `characters` | Персонажи |
| `character_knowledge` | Знания персонажей |
| `locations` | Локации |
| `chapters` | Главы |
| `scene_beats` | Блоки сцен |
| `storylines` | Сюжетные линии |
| `notes` | Заметки |
| `quotes` | Цитаты |
| `links` | Связи между сущностями |
| `timeline_events` | События таймлайна |
| `outline_items` | План повествования |
| `wiki_articles` | Wiki-статьи |
| `factions` | Фракции |
| `concept_arts` | Концепт-арты |
| `technologies` | Технологии |
| `artifacts` | Артефакты |
| `galaxies` | Галактики |
| `star_systems` | Звёздные системы |
| `celestial_bodies` | Небесные тела |
| `chapter_mentions` | Упоминания в главах |

## Преимущества Universe-per-Database

| Преимущество | Описание |
|--------------|----------|
| **Изоляция** | Данные вселенных не пересекаются |
| **Портативность** | Вселенную можно скопировать, перенести, заархивировать |
| **Бэкап** | Бэкап = zip с файлом БД + файлами |
| **Удаление** | Удаление вселенной = удаление директории |
| **Масштабируемость** | В будущем — поддержка PostgreSQL/MySQL |

---

## Alembic-миграции

Миграции расположены в `backend/migrations/`.

### Автоматические миграции

Приложение **автоматически проверяет и обновляет** структуру БД при запуске через Alembic. Нет необходимости вручную выполнять SQL-запросы.

### Использование

```bash
cd backend

# Создать новую миграцию
alembic revision --autogenerate -m "description"

# Применить мигра
alembic upgrade head

# Откатить миграцию
alembic downgrade -1
```

### alembic.ini

Конфигурация Alembic:
- `script_location = migrations`
- `sqlalchemy.url = sqlite+aiosqlite:///data/archon_master.db`

### Структура миграций

```
migrations/
├── alembic.ini           # Конфигурация
├── env.py                # Environment setup
├── script.py.mako        # Template для новых миграций
└── versions/             # Файлы миграций
    ├── 001_initial.py
    ├── 002_add_XXX.py
    └── ...
```

---

## Асинхронные сессии

Все операции с БД используют **асинхронные сессии** SQLAlchemy 2.0:

```python
from sqlalchemy.ext.asyncio import AsyncSession

async def get_characters(db: AsyncSession) -> list[Character]:
    result = await db.execute(select(Character))
    return result.scalars().all()
```

### Управление сессиями

- Сессия создаётся на каждый **запрос API**
- Автоматически закрывается после ответа
- Транзакция **коммитится** при успехе, **откатывается** при ошибке

---

## Бэкап и восстановление

### Бэкап

```
GET /api/universes/{id}/backup
```

Возвращает ZIP-архив:
- Файл Universe DB
- Файлы (портреты, обложки, изображения)
- Метаданные

### Восстановление

```
POST /api/universes/restore
```

Тело запроса: ZIP-файл (multipart/form-data `file`).
- Создаётся новая вселенная
- Восстанавливаются все данные
- Опционально: `title` для нового имени

---

## Модели данных

Полное описание моделей см. в [backend/models.md](backend/models.md).

### Ключевые связи

```
Universe 1──* Character
Universe 1──* Location
Universe 1──* Chapter
Chapter 1──* SceneBeat
Universe 1──* Storyline
Storyline 1──* Chapter
Character 1──* Quote
Character 1──* CharacterKnowledge
Universe 1──* TimelineEvent
TimelineEvent *──* Character (через participation type)
Entity 1──* Link 1──* Entity (polymorphic)
```

---

← [Назад к RAG](rag-context.md) | [Развёртывание →](deployment.md)
