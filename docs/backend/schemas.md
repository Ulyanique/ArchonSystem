# Pydantic-схемы

Схемы расположены в `backend/app/schemas/`. Они определяют структуры запросзов и ответов API.

## Архитектура

Для каждой доменной сущности есть две схемы:
- **`{Entity}Create`** — поля для создания (без `id`, `created_at`)
- **`{Entity}Update`** — все поля опциональны (PATCH)
- **`{Entity}Response`** — полный ответ с `id`, `created_at`, `updated_at`

## Общие паттерны

### Base schema

```python
class BaseSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)
```

### Response schema

```python
class CharacterResponse(BaseSchema):
    id: UUID
    name: str
    role: str | None
    # ... все поля модели
    created_at: datetime
    updated_at: datetime
```

### Create schema

```python
class CharacterCreate(BaseSchema):
    name: str = Field(..., min_length=1, max_length=200)
    role: str | None = None
    description: str | None = None
    # ... обязательные поля без id/dates
```

### Update schema

```python
class CharacterUpdate(BaseSchema):
    name: str | None = None
    role: str | None = None
    description: str | None = None
    # ... все поля опциональны
```

## Специфичные схемы

### Chat

```python
class ChatRequest(BaseSchema):
    message: str
    universe_id: UUID | None
    character_id: UUID | None
    stream: bool = False
    # ... настройки контекста

class ChatResponse(BaseSchema):
    response: str
    context_used: dict    # Информация об использованном контексте
```

### AI Generation

```python
class GenerateCharacterRequest(BaseSchema):
    description: str
    universe_id: UUID

class GenerateResponse(BaseSchema):
    generated_data: dict  # Сгенерированные поля сущности
```

### AI Critic

```python
class CriticRequest(BaseSchema):
    entity_type: str      # character, location, chapter...
    entity_id: UUID
    analysis_type: str    # consistency, quality, completeness...

class CriticResponse(BaseSchema):
    feedback: str         # Текст анализа
    score: float | None   # Оценка (опционально)
    suggestions: list[str]# Рекомендации
```

### RAG

```python
class RAGSearchRequest(BaseSchema):
    query: str
    n_results: int = 5

class RAGSearchResponse(BaseSchema):
    results: list[dict]   # Найданные чанки с метаданными
```

### Backup/Restore

```python
class BackupResponse(BaseSchema):
    # StreamingFileResponse, не JSON
    pass
```

### Settings

```python
class SystemSettingsUpdate(BaseSchema):
    llm_provider: str | None
    ollama_url: str | None
    # ... все настройки опциональны
    prompt_templates: dict | None
    chat_context_budget: dict | None
```

## Валидация

- `Field(..., min_length=N, max_length=N)` — ограничения строк
- `Field(..., ge=N, le=N)` — ограничения чисел
- `@field_validator` — кастомная валидация
- `@model_validator` — валидация на уровне модели

---

← [Назад к репозиториям](repositories.md) | [Назад к бэкенду](README.md)
