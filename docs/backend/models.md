# Модели данных

SQLAlchemy-модели расположены в `backend/app/models/`. Каждая модель — отдельный файл сdeclarative-классом.

## Master Database модели

Эти модели хранятся в **Master DB** (`archon_master.db`), общей для всех вселенных.

### Universe

**Файл:** `universe.py` | **Таблица:** `universes`

Контейнер вселенной с метаданными и настройками.

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | UUID | Первичный ключ |
| `title` | String | Название вселенной |
| `description` | Text | Описание / синопсис |
| `genre` | String | Жанр |
| `cover_path` | String | Путь к обложке |
| `music_path` | String | Путь к фоновой музыке |
| `clock_enabled` | Boolean | Включён ли кастомный календарь |
| `clock_year_name` | String | Название года в календаре вселенной |
| `clock_reference_date` | DateTime | Реальная дата-привязка |
| `clock_time_scale` | Float | Масштаб времени (1.0 = реальное время) |
| `created_at` | DateTime | Дата создания |
| `updated_at` | DateTime | Дата последнего модификации |

### Book

**Файл:** `book.py` | **Таблица:** `books`

Книга/продукт внутри вселенной (обратная совместимость).

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | UUID | Первичный ключ |
| `universe_id` | UUID (FK) | Ссылка на вселенную |
| `title` | String | Название книги |
| `description` | Text | Описание |

### GraphLayout

**Файл:** `graph_layout.py` | **Таблица:** `graph_layout`

Позиции узлов графа знаний для визуализации в React Flow.

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | UUID | Первичный ключ |
| `universe_id` | UUID (FK) | Ссылка на вселенную |
| `node_id` | String | Идентификатор узла (`type:entity_id`) |
| `x` | Float | Позиция X |
| `y` | Float | Позиция Y |

### SystemSettings

**Файл:** `system_settings.py` | **Таблица:** `system_settings`

Глобальные настройки системы.

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | Integer | Первичный ключ (singleton, id=1) |
| `llm_provider` | String | Текущий LLM-провайдер |
| `ollama_url` | String | URL Ollama |
| `ollama_model` | String | Модель Ollama |
| `deepseek_api_key` | String | Ключ DeepSeek |
| `deepseek_model` | String | Модель DeepSeek |
| `openrouter_api_key` | String | Ключ OpenRouter |
| `openrouter_model` | String | Модель OpenRouter |
| `openrouter_image_model` | String | Модель для генерации изображений |
| `routerai_api_key` | String | Ключ RouterAI |
| `routerai_model` | String | Модель RouterAI |
| `theme` | String | Тема UI (light/dark) |
| `prompt_templates` | JSON | Настраиваемые шаблоны промптов |
| `chat_context_budget` | JSON | Лимиты символов для блоков контекста |
| `image_provider` | String | Провайдер генерации изображений |
| `image_prompt_template` | String | Шаблон промпта для изображений |

---

## Universe Database модели

Эти модели хранятся в **Universe DB** — отдельной для каждой вселенной.

### Character

**Файл:** `character.py` | **Таблица:** `characters`

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | UUID | Первичный ключ |
| `name` | String | Имя персонажа |
| `role` | String | Роль в сюжете |
| `description` | Text | Общее описание |
| `appearance` | Text | Внешность |
| `personality` | Text | Характер |
| `background` | Text | Предистория |
| `motivations` | Text | Мотивация |
| `goals` | Text | Цели |
| `speech_pattern` | String | Паттерн речи |
| `portrait_path` | String | Путь к портрету |
| `demographics` | JSON | Демография (возраст, пол, раса) |
| `created_at`, `updated_at` | DateTime | Даты |

### CharacterKnowledge

**Файл:** `character_knowledge.py` | **Таблица:** `character_knowledge`

Уровни доступа персонажа к знаниям.

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | UUID | Первичный ключ |
| `character_id` | UUID (FK) | Ссылка на персонажа |
| `entity_type` | String | Тип сущности (chapter, event, location...) |
| `entity_id` | UUID | Идентификатор сущности |
| `knowledge_level` | Enum | `rumors`, `superficial`, `good`, `complete` |
| `source` | Enum | `participated`, `witnessed`, `heard`, `read`, `learned_from` |

### Location

**Файл:** `location.py` | **Таблица:** `locations`

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | UUID | Первичный ключ |
| `name` | String | Название локации |
| `location_type` | String | Тип (город, лес, здание...) |
| `description` | Text | Описание |
| `atmosphere` | Text | Атмосфера |
| `image_path` | String | Путь к изображению |
| `celestial_body_id` | UUID (FK) | Привязка к небесному телу |

### Chapter

**Файл:** `chapter.py` | **Таблица:** `chapters`

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | UUID | Первичный ключ |
| `title` | String | Название главы |
| `summary` | Text | Синопсис |
| `content` | Text | Полный текст главы (markdown) |
| `reading_order` | Integer | Порядок чтения |
| `storyline_id` | UUID (FK) | Опциональная сюжетная линия |

### SceneBeat

**Файл:** `scene_beat.py` | **Таблица:** `scene_beats`

Блоки сцен внутри глав.

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | UUID | Первичный ключ |
| `chapter_id` | UUID (FK) | Ссылка на главу |
| `order` | Integer | Порядок в главе |
| `description` | Text | Описание сцены |
| `content` | Text | Содержимое сцены |

### Storyline

**Файл:** `storyline.py` | **Таблица:** `storylines`

Параллельные сюжетные линии.

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | UUID | Первичный ключ |
| `name` | String | Название |
| `description` | Text | Описание |

### Note

**Файл:** `note.py` | **Таблица:** `notes`

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | UUID | Первичный ключ |
| `title` | String | Заголовок заметки |
| `content` | Text | Содержимое (markdown) |
| `note_type` | Enum | `idea`, `research`, `draft`, `avoid` |

### Quote

**Файл:** `quote.py` | **Таблица:** `quotes`

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | UUID | Первичный ключ |
| `character_id` | UUID (FK) | Кто произнёс |
| `interlocutor_id` | UUID (FK) | Опционально: с кем говорил |
| `text` | Text | Текст цитаты |
| `context` | Text | Контекст |

### Link

**Файл:** `link.py` | **Таблица:** `links`

Полиморфные связи между сущностями (граф знаний).

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | UUID | Первичный ключ |
| `source_type` | String | Тип источника (`character`, `location`...) |
| `source_id` | UUID | ID источника |
| `target_type` | String | Тип цели |
| `target_id` | UUID | ID цели |
| `description` | String | Описание связи |

### TimelineEvent

**Файл:** `timeline_event.py` | **Таблица:** `timeline_events`

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | UUID | Первичный ключ |
| `title` | String | Название события |
| `description` | Text | Описание |
| `date` | String | Дата во внутреннем календаре |
| `chronology_order` | Integer | Порядок в хронологии |

### OutlineItem

**Файл:** `outline_item.py` | **Таблица:** `outline_items`

План повествования.

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | UUID | Первичный ключ |
| `item_type` | Enum | `act`, `chapter`, `beat` |
| `title` | String | Заголовок |
| `description` | Text | Описание |
| `parent_id` | UUID (FK) | Родительский элемент |
| `order` | Integer | Порядок |

### WikiArticle

**Файл:** `wiki_article.py` | **Таблица:** `wiki_articles`

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | UUID | Первичный ключ |
| `title` | String | Заголовок статьи |
| `content` | Text | Содержимое (markdown, ссылки `[[type:id]]`) |
| `source_type` | String | Автогенерация из сущности |
| `source_id` | UUID | ID сущности-источника |

### Faction

**Файл:** `faction.py` | **Таблица:** `factions`

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | UUID | Первичный ключ |
| `name` | String | Название фракции |
| `description` | Text | Описание |
| `type` | String | Тип организации |

### ConceptArt

**Файл:** `concept_art.py` | **Таблица:** `concept_arts`

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | UUID | Первичный ключ |
| `title` | String | Заголовок |
| `description` | Text | Описание |
| `image_path` | String | Путь к изображению |
| `order` | Integer | Порядок в pinterest-сетке |
| `source_type`, `source_id` | String, UUID | Привязка к сущности |

### Technology

**Файл:** `technology.py` | **Таблица:** `technologies`

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | UUID | Первичный ключ |
| `name` | String | Название технологии |
| `description` | Text | Описание |

### Artifact

**Файл:** `artifact.py` | **Таблица:** `artifacts`

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | UUID | Первичный ключ |
| `name` | String | Название артефакта |
| `description` | Text | Описание |
| `type` | String | Тип предмета |

### Galaxy

**Файл:** `galaxy.py` | **Таблица:** `galaxies`

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | UUID | Первичный ключ |
| `name` | String | Название галактики |
| `description` | Text | Описание |

### StarSystem

**Файл:** `star_system.py` | **Таблица:** `star_systems`

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | UUID | Первичный ключ |
| `galaxy_id` | UUID (FK) | Ссылка на галактику |
| `name` | String | Название системы |
| `coordinates` | JSON | Координаты |

### CelestialBody

**Файл:** `celestial_body.py` | **Таблица:** `celestial_bodies`

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | UUID | Первичный ключ |
| `star_system_id` | UUID (FK) | Ссылка на звёздную систему |
| `name` | String | Название |
| `body_type` | Enum | `planet`, `moon`, `station`, `ship` |
| `description` | Text | Описание |
| `grid_position` | JSON | Позиция на grid map |

### ChapterMention

**Файл:** `chapter_mention.py` | **Таблица:** `chapter_mentions`

Упоминания сущностей в главах (coverage tracking).

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | UUID | Первичный ключ |
| `chapter_id` | UUID (FK) | Ссылка на главу |
| `entity_type` | String | Тип сущности |
| `entity_id` | UUID | ID сущности |

---

← [Назад к API](api.md) | [Сервисы →](services.md)
