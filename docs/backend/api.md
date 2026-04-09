# API-эндпоинты

Все эндпоинты расположены в `backend/app/api/`. Каждый файл — отдельная доменная область с собственным `router = APIRouter()`.

## Базовые маршруты

| Файл | Префикс | Методы | Описание |
|------|---------|--------|----------|
| `universes.py` | `/api/universes` | GET, POST, PUT, DELETE | CRUD вселенных, обложки, clock settings, фоновая музыка |
| `books.py` | `/api/books` | GET | Обратная совместимость (алиас на universes) |
| `settings.py` | `/api/system/settings` | GET, PUT | Глобальные настройки системы + prompt validation |
| `backup.py` | `/api/universes` | GET, POST | Бэкап (zip) и восстановление вселенной |

## Сущности вселенной

| Файл | Префикс | Методы | Описание |
|------|---------|--------|----------|
| `characters.py` | `/api/universes/{id}/characters` | GET, POST, PUT, DELETE | CRUD персонажей, портреты (генерация/загрузка), autofill, generate-field, knowledge-stats |
| `locations.py` | `/api/universes/{id}/locations` | GET, POST, PUT, DELETE | CRUD локаций, генерация/загрузка изображений, autofill |
| `chapters.py` | `/api/universes/{id}/chapters` | GET, POST, PUT, DELETE | CRUD глав, AI write (streaming), scene beats CRUD |
| `storylines.py` | `/api/universes/{id}/storylines` | GET, POST, PUT, DELETE | Параллельные сюжетные линии |
| `notes.py` | `/api/universes/{id}/notes` | GET, POST, PUT, DELETE | Заметки CRUD + autofill |
| `quotes.py` | `/api/universes/{id}/quotes` | GET, POST, PUT, DELETE | Цитаты CRUD |
| `factions.py` | `/api/universes/{id}/factions` | GET, POST, PUT, DELETE | Фракции CRUD |
| `technologies.py` | `/api/universes/{id}` | GET, POST, PUT, DELETE | Технологии и артефакты |
| `timeline.py` | `/api/universes/{id}/timeline` | GET, POST, PUT, DELETE | Таймлайн CRUD |
| `outline.py` | `/api/universes/{id}/outline` | GET, POST, PUT, DELETE | План повествования CRUD + generate + apply |
| `wiki.py` | `/api/universes/{id}/wiki` | GET, POST, PUT, DELETE | Wiki-статьи CRUD + автогенерация из сущностей |
| `links.py` | `/api/universes/{id}/links` | GET, POST, DELETE | Связи между сущностями, граф знаний, анализ связанности |

## Космос

| Файл | Префикс | Методы | Описание |
|------|---------|--------|----------|
| `space.py` | `/api/universes/{id}/space` | GET, POST, PUT, DELETE | Галактики, звёздные системы, небесные тела (planets, moons, stations, ships) |

## Концепт-арт

| Файл | Префикс | Методы | Описание |
|------|---------|--------|----------|
| `concept_art.py` | `/api/universes/{id}/concept-art` | GET, POST, PUT, DELETE | Загрузка, генерация (auto + manual), reorder изображений |

## Покрытие и анализ

| Файл | Префикс | Методы | Описание |
|------|---------|--------|----------|
| `coverage.py` | `/api/universes/{id}/coverage` | GET | Покрытие мира по главам (chapter mentions) |
| `search.py` | `/api/universes/{id}/search` | GET | Умный поиск по всем элементам вселенной |
| `export.py` | `/api/universes/{id}/export` | GET | Экспорт в Markdown и DOCX |

## AI-функции

| Файл | Префикс | Методы | Описание |
|------|---------|--------|----------|
| `chat.py` | `/api/chat` | POST | Чат с ИИ (streaming + non-streaming), RAG, smart context, модели |
| `ai_generator.py` | `/api/universes/{id}/ai-generate` | POST | Генерация персонажей, локаций, заметок, фракций, таймлайн-событий, имён, plot twist |
| `ai_critic.py` | `/api/universes/{id}/ai` | POST | AI-анализ персонажей, локаций, глав, актов, битов, заметок, согласованности |
| `rag.py` | `/api/universes/{id}/rag` | POST | Переиндексация RAG (ChromaDB) |

## Вселенная как книга

| Файл | Префикс | Методы | Описание |
|------|---------|--------|----------|
| `universe_view.py` | `/api/universes/{id}/book-view` | GET, POST | Полный текст вселенной, expand/rewrite фрагментов, generate beat |

## Знания персонажей

| Файл | Префикс | Методы | Описание |
|------|---------|--------|----------|
| `character_knowledge.py` | `/api/universes/{id}/characters/{cid}/knowledge` | GET, PUT | CRUD знаний персонажа (уровни доступа к событиям) |

## Изображения

| Файл | Префикс | Методы | Описание |
|------|---------|--------|----------|
| `images.py` | `/api/universes/{id}/images` | POST | Трансформация изображений (Pixazo image-to-image) |

---

## Streaming (SSE)

Эндпоинты AI-генерации и чата поддерживают **Server-Sent Events**:
- `POST /api/chat` — streaming ответов чата
- `POST /api/universes/{id}/chapters/{cid}/ai-write` — streaming написания текста главы

Клиент подключается через `EventSource` и получает токены по мере генерации.

## Файловые операции

Эндпоинты для загрузки изображений используют `UploadFile` (multipart/form-data):
- Портреты персонажей
- Обложки вселенных
- Изображения локаций
- Концепт-арты
- Фоновая музыка

Размер файлов ограничен **10 МБ** (валидация в `utils/upload_limits.py`).

---

← [Назад к бэкенду](README.md) | [Модели данных →](models.md)
