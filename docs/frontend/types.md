# TypeScript-типы

Типы определены в `frontend/src/types.ts` (589 строк).

## Структура

Файл содержит все TypeScript-интерфейсы и типы, используемые фронтендом.

## Категории типовов

### Доменные типы

| Тип | Описание |
|-----|----------|
| `Universe` | Вселенная с настройками clock |
| `Character` | Персонаж с детальными полями |
| `Location` | Локация |
| `Chapter` | Глава с текстом |
| `SceneBeat` | Блок сцены |
| `Storyline` | Сюжетная линия |
| `Note` | Заметка |
| `Quote` | Цитата |
| `Faction` | Фракция |
| `TimelineEvent` | Событие таймлайна |
| `OutlineItem` | Элемент плана |
| `WikiArticle` | Wiki-статья |
| `ConceptArt` | Концепт-арт |
| `Technology` | Технология |
| `Artifact` | Артефакт |
| `Galaxy` | Галактика |
| `StarSystem` | Звёздная система |
| `CelestialBody` | Небесное тело |
| `Link` | Связь между сущностями |
| `ChapterMention` | Упоминание в главе |
| `CharacterKnowledge` | Знание персонажа |
| `GraphLayout` | Позиция узла графа |
| `SystemSettings` | Глобальные настройки |
| `Book` | Книга (обратная совместимость) |

### AI-типы

| Тип | Описание |
|-----|----------|
| `ChatMessage` | Сообщение чата |
| `ChatRequest` | Запрос к чату |
| `CriticFeedback` | Ответ от AI-критика |
| `GeneratedEntity` | Сгенерированная AI сущность |
| `LLMProvider` |Enum провайдеров |
| `ImageProvider` |Enum провайдеров изображений |

### UI-типы

| Тип | Описание |
|-----|----------|
| `Job` | Фоновая задача |
| `JobStatus` | Enum статуса задачи |
| `ViewMode` | Режим отображения |
| `ThemeMode` | Тема (light/dark) |
| `SidebarSection` | Секции сайдбара |

### API-типы

| Тип | Описание |
|-----|----------|
| `ApiError` | Формат ошибки API |
| `ApiResponse<T>` | Обёртка ответа API |
| `PaginatedResponse<T>` | Пагинированный ответ |

## Рекомендация по рефакторингу

Файл `types.ts` (589 строк) рекомендуется разбить на директорию `src/types/`:

```
src/types/
├── index.ts            # Barrel-экспорты
├── universe.ts         # Universe, Book, GraphLayout
├── character.ts        # Character, CharacterKnowledge
├── location.ts         # Location
├── chapter.ts          # Chapter, SceneBeat
├── storyline.ts        # Storyline
├── note.ts             # Note
├── quote.ts            # Quote
├── faction.ts          # Faction
├── timeline.ts         # TimelineEvent
├── outline.ts          # OutlineItem
├── wiki.ts             # WikiArticle
├── conceptArt.ts       # ConceptArt
├── technology.ts       # Technology, Artifact
├── space.ts            # Galaxy, StarSystem, CelestialBody
├── link.ts             # Link, ChapterMention
├── chat.ts             # ChatMessage, ChatRequest
├── ai.ts               # CriticFeedback, GeneratedEntity, LLMProvider
├── settings.ts         # SystemSettings
├── job.ts              # Job, JobStatus
└── api.ts              # ApiError, ApiResponse
```

---

← [Назад к состоянию](state.md) | [Назад к фронтенду](README.md)
