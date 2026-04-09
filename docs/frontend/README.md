# Фронтенд ARCHON

Фронтенд построен на **React 18 + TypeScript** с использованием Vite 5 для сборки.

## Структура

```
frontend/src/
├── main.tsx              # Точка входа: QueryClient, BrowserRouter, ErrorBoundary, ThemeController
├── App.tsx               # Роутинг: 30+ страниц
├── types.ts              # Все TypeScript-интерфейсы
├── store.ts              # Zustand store (selectedUniverse, sidebar, view mode)
├── index.css             # Глобальные стили (Tailwind + кастомные анимации)
│
├── api/                  # API-клиенты (27 модулей)
├── pages/                # Страницы (32 файла)
├── components/           # Переиспользуемые компоненты (23+ файлов)
│   ├── characters/       # Компоненты персонажей
│   └── chat/             # Компоненты чата
├── store/                # Дополнительные Zustand stores
├── utils/                # Утилиты
└── test/                 # Тестовый setup
```

## Технологии

| Технология | Назначение |
|------------|-----------|
| **React 18** | UI с хуками и concurrent features |
| **TypeScript** | Типизация компонентов и API |
| **Vite 5** | Сборка, HMR, dev-сервер |
| **React Router v6** | Вложенные маршруты (layout pattern) |
| **TanStack Query v5** | Серверное состояние, кэширование, инвалидация |
| **Zustand** | Глобальное состояние (лёгкая альтернатива Redux) |
| **Tailwind CSS 3** | Утилитарные стили |
| **React Flow** | Визуализация графа знаний |
| **Three.js / @react-three/fiber** | 3D-рендеринг (космос) |
| **Axios** | HTTP-клиент |
| **React Markdown** | Рендеринг markdown |
| **React Hot Toast** | Уведомления |
| **Lucide React** | Иконки |
| **Vitest** | Тестирование |

## Подмодули

| Документ | Описание |
|----------|----------|
| [Страницы](pages.md) | 32 страницы-маршрута |
| [Компоненты](components.md) | Переиспользуемые UI-компоненты |
| [API-клиент](api-client.md) | Типизированный Axios-клиент |
| [Состояние](state.md) | Zustand stores |
| [Типы](types.md) | TypeScript-интерфейсы |

## API-клиент

Axios-инстанс с конфигурацией:

```typescript
// api/client.ts
const api = axios.create({
  baseURL: '/api',
  // Proxy через Vite на localhost:8000
});

// Helper для streaming (SSE)
async function apiFetch(url: string, options: object): AsyncIterableIterator<string>

// Helper для URL файлов
function uploadsUrl(path: string): string
```

### Перехватчики

- **Error interceptor**: network error callback для обработки обрывов соединения
- **Base URL**: `/api` — все запросы идут через Vite proxy на бэкенд

## Маршрутизация

Все маршруты определены в `App.tsx`. Используется **layout pattern**:

```
/                              → redirect → /universes
/universes                     → UniversesPage
/universes/classic             → UniversesPageClassic
/settings                      → SettingsPage (global)
/universes/:universeId         → UniverseDetailPage (layout)
  /characters                  → CharactersPage
  /locations                   → LocationsPage
  /chapters                    → ChaptersPage
  /storylines                  → StorylinesPage
  /coverage                    → CoveragePage
  /outline                     → OutlinePage
  /develop                     → DevelopUniversePage
  /write-book                  → WriteBookWizardPage
  /write                       → WritePage
  /book                        → BookEditorPage
  /notes                       → NotesPage
  /drafts                      → DraftsPage
  /quotes                      → QuotesPage
  /factions                    → FactionsPage
  /technologies                → TechnologiesPage
  /wiki                        → WikiPage
  /concept-art                 → ConceptArtPage
  /space                       → SpacePage
  /knowledge                   → CharacterKnowledgePage
  /graph                       → GraphPage
  /timeline                    → TimelinePage
  /search                      → SearchPage
  /book-view                   → UniverseViewPage
  /settings                    → BookSettingsPage (universe-scoped)
  /chat                        → ChatPage
```

## Точка входа (`main.tsx`)

```typescript
// Инициализация:
// 1. QueryClient (TanStack Query) с настройками кэша
// 2. BrowserRouter (React Router)
// 3. ErrorBoundary (catch-all для ошибок)
// 4. ThemeController (управление темой light/dark)
// 5. Render App
```

---

← [Назад к архитектуре](../architecture.md) | [Страницы →](pages.md)
