# Репозитории

Репозитории расположены в `backend/app/repositories/`. Это data access layer — CRUD-операции над SQLAlchemy-моделями.

## Архитектура

Каждый репозиторий:
- Работает с **асинхронными сессиями** SQLAlchemy (`AsyncSession`)
- Предоставляет стандартные CRUD-методы
- Использует **типизированные** возвращаемые значения
- Обрабатывает ошибки (NoSuchEntity, IntegrityError)

## Стандартный интерфейс

```python
class BaseRepository:
    async def get_all(db: AsyncSession, skip: int = 0, limit: int = 100) -> list[Model]
    async def get_by_id(db: AsyncSession, id: UUID) -> Model | None
    async def create(db: AsyncSession, data: dict) -> Model
    async def update(db: AsyncSession, id: UUID, data: dict) -> Model
    async def delete(db: AsyncSession, id: UUID) -> None
```

## Список репозиториев

| Файл | Модель | Методы |
|------|--------|--------|
| `character.py` | Character | CRUD + поиск по имени |
| `location.py` | Location | CRUD |
| `chapter.py` | Chapter | CRUD + по storyline_id |
| `scene_beat.py` | SceneBeat | CRUD + по chapter_id |
| `storyline.py` | Storyline | CRUD |
| `note.py` | Note | CRUD + по note_type |
| `quote.py` | Quote | CRUD + по character_id |
| `link.py` | Link | CRUD + поиск по source/target |
| `timeline_event.py` | TimelineEvent | CRUD + сортировка по дате |
| `outline_item.py` | OutlineItem | CRUD + иерархическая структура |
| `wiki_article.py` | WikiArticle | CRUD + по source_type/source_id |
| `faction.py` | Faction | CRUD |
| `concept_art.py` | ConceptArt | CRUD + reorder |
| `technology.py` | Technology | CRUD |
| `artifact.py` | Artifact | CRUD |
| `galaxy.py` | Galaxy | CRUD |
| `star_system.py` | StarSystem | CRUD + по galaxy_id |
| `celestial_body.py` | CelestialBody | CRUD + по star_system_id |
| `chapter_mention.py` | ChapterMention | CRUD + coverage stats |
| `character_knowledge.py` | CharacterKnowledge | CRUD + по character_id |
| `universe.py` | Universe | CRUD (Master DB) |
| `system_settings.py` | SystemSettings | Get/Set singleton (Master DB) |
| `graph_layout.py` | GraphLayout | CRUD (Master DB) |

## Транзакционность

Репозитории не управляют транзакциями напрямую. Транзакции контролируются на уровне **сервисов** или **API-эндпоинтов** через контекстный менеджер сессии.

## Зависимости

```
repositories/
├── зависят от: models/ (SQLAlchemy-классы)
├── зависят от: schemas/ (Pydantic-схемы для входных данных)
└── используются: services/ (бизнес-логика)
```

---

← [Назад к сервисам](services.md) | [Схемы →](schemas.md)
