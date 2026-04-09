# Фаза 1: Модульность кода

> Рефакторинг монолитных файлов, разбиение типов, code splitting. Только после завершения **Фазы 0**.

---

## Модуль 1.1: Разбиение типов (frontend)

### 1.1.1: `types.ts` → `types/` директория

Текущий `src/types.ts` (589 строк) разбить на:

```
src/types/
├── index.ts            # Barrel-экспорты
├── universe.ts         # Universe, Book, GraphLayout, SystemSettings
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
├── chat.ts             # ChatMessage, ChatRequest, AIAnalysis
├── ai.ts               # LLMProvider, ImageProvider, CriticFeedback
├── job.ts              # Job, JobStatus
└── api.ts              # ApiError, ApiResponse, PaginatedResponse
```

---

## Модуль 1.2: Разбиение монолитных страниц (frontend)

### 1.2.1: BookEditorPage (2182 строки → 8-12 компонентов)

| Компонент | Ответственность |
|-----------|----------------|
| `TextEditor` | Markdown-редактор текста главы |
| `ChapterNavigation` | Дерево глав, переключение |
| `SceneBeatEditor` | Редактор блоков сцен |
| `MetadataPanel` | Настройки главы (название, синопсис) |
| `EditorToolbar` | Форматирование, AI-кнопки |
| `VersionHistory` | История версий главы |
| `PreviewPane` | Предпросмотр rendered markdown |
| `StructureView` | Визуализация структуры книги |
| `WriteView` | Режим написания |
| `CanvasView` | Canvas-режим |

### 1.2.2: SpacePage (1249 строк → 5-6 компонентов)

| Компонент | Ответственность |
|-----------|----------------|
| `Space3DView` | Three.js сцена (уже есть) |
| `SpaceControls` | Управление камерой, вращение |
| `EntityList` | Список космических объектов |
| `EntityForm` | Форма создания/редактирования |
| `SpaceOverlay` | UI поверх 3D |
| `SpaceInfoPanel` | Детали выбран объекта |

### 1.2.3: ChatPage (991 строка → оркестрация)

| Компонент | Ответственность |
|-----------|----------------|
| Страница только оркестрирует | |
| Вся логика → `components/chat/` | Уже частично есть |
| Добавить `ChatContextProvider` | Контекст чата как provider |

### 1.2.4: UniverseViewPage (943 строки → reader components)

| Компонент | Ответственность |
|-----------|----------------|
| `ReaderNav` | Навигация по тексту |
| `TextRenderer` | Рендер полного текста |
| `ChapterJump` | Быстрый переход к главе |
| `FragmentExpand` | Раскрытие фрагмента |

### 1.2.5: DevelopUniversePage (864 строки → tab components)

| Компонент | Ответственность |
|-----------|----------------|
| `DevelopTabs` | Табы: персонажи, локации, сюжеты |
| `CharacterGenerator` | Генерация персонажей |
| `LocationGenerator` | Генерация локаций |
| `PlotGenerator` | Генерация сюжетов |
| `SuggestionsPanel` | AI-предложения |

### 1.2.6: TimelinePage (853 строки → visualization + form)

| Компонент | Ответственность |
|-----------|----------------|
| `TimelineVisualization` | Хронологическая лента |
| `EventForm` | Форма события |
| `FilterControls` | Фильтры по дате, типу |
| `EventCard` | Карточка события |

### 1.2.7: SettingsPage (815 строк → category tabs)

| Компонент | Ответственность |
|-----------|----------------|
| `SettingsTabs` | Табы: AI, Display, Audio, RAG |
| `LLMSettings` | Настройки LLM-провайдеров |
| `DisplaySettings` | Тема, шрифты |
| `AudioSettings` | Фоновая музыка |
| `RAGSettings` | RAG и контекст |
| `PromptSettings` | Шаблоны промптов |

---

## Модуль 1.3: Разбиение крупных компонентов (frontend)

### 1.3.1: CharacterForm (589 строк)

| Компонент | Ответственность |
|-----------|----------------|
| `BasicInfoSection` | Имя, роль, демография |
| `AppearanceSection` | Внешность, портрет |
| `PersonalitySection` | Характер, мотивация, цели |
| `BackgroundSection` | Предыстория, паттерн речи |
| `RelationshipsSection` | Связи с другими персонажами |

### 1.3.2: JobsPanel (578 строк)

| Компонент | Ответственность |
|-----------|----------------|
| `JobList` | Список задач |
| `JobItem` | Отдельная задача |
| `JobProgressBar` | Прогресс-бар |
| `JobErrorDisplay` | Ошибка задачи |

### 1.3.3: Layout (460 строк)

| Компонент | Ответственность |
|-----------|----------------|
| `Sidebar` | Боковое меню |
| `SidebarItem` | Пункт меню |
| `TopBar` | Верхняя панель |
| `Navigation` | Навигация |

### 1.3.4: CommandPalette (424 строки)

| Компонент | Ответственность |
|-----------|----------------|
| `CommandInput` | Поле ввода |
| `CommandResults` | Результаты поиска |
| `CommandActions` | Быстрые действия |

---

## Модуль 1.4: Code splitting (frontend)

### 1.4.1: Lazy-loading страниц

```typescript
const BookEditorPage = lazy(() => import('./pages/BookEditorPage'));
const SpacePage = lazy(() => import('./pages/SpacePage'));
const ChatPage = lazy(() => import('./pages/ChatPage'));
```

Все страницы, кроме стартовых, загружать через `React.lazy + Suspense`.

### 1.4.2: Vite chunk splitting

Настроить `vite.config.ts` для ручного разделения чанков:

```typescript
build: {
  rollupOptions: {
    output: {
      manualChunks: {
        'react-vendor': ['react', 'react-dom', 'react-router-dom'],
        'three-vendor': ['three', '@react-three/fiber', '@react-three/drei'],
        'd3-vendor': ['d3'],
        'markdown-vendor': ['react-markdown', 'remark-gfm'],
      }
    }
  }
}
```

### 1.4.3: Tree shaking

Убедиться, что неиспользуемые импорты не попадают в бандл.

---

## Модуль 1.5: Рефакторинг бэкенда

### 1.5.1: Централизация LLM-настроек

- **Проблема:** Код загрузки `system_settings` дублируется в 5+ эндпоинтах (chat.py, characters.py, locations.py, ai_critic.py, universe_view.py).
- **Решение:** Создать `services/llm_config.py` с функцией `load_llm_settings()` — единственный источник.

### 1.5.2: Логирование вместо print

- Заменить все `print()` на `logger.info()` / `logger.warning()` / `logger.error()`.
- Настроить结构化 логирование (JSON формат для production).

### 1.5.3: Exception handler middleware

- Создать единый exception handler, который конвертирует все ошибки в консистентный JSON-формат.
- Убрать дублирование `try/except HTTPException` из каждого эндпоинта.

---

## Критерии завершения фазы 1

- [ ] `types.ts` разбит на `types/` директорию
- [ ] BookEditorPage разбит на 8-12 компонентов
- [ ] SpacePage, ChatPage, UniverseViewPage разбиты
- [ ] CharacterForm, JobsPanel, Layout, CommandPalette разбиты
- [ ] Lazy-loading страниц работает
- [ ] Vite chunk splitting настроен
- [ ] Бэкенд: LLM-настройки централизованы
- [ ] Бэкенд: логирование вместо print
- [ ] Бэкенд: exception handler middleware

---

← [Назад к стабилизации](stabilization.md) | [UX и полировка →](ux-polish.md)
