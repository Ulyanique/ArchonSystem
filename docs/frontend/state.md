# Состояние приложения

Состояние управляется **Zustand** — лёгкой альтернативой Redux.

## Главный store (`store.ts`)

```typescript
interface AppState {
  // Текущая выбранная вселенная
  selectedUniverse: Universe | null;
  setSelectedUniverse: (universe: Universe | null) => void;

  // Состояние сайдбара
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (collapsed: boolean) => void;

  // Вид списка вселенных
  universesPageView: 'grid' | 'terminal';
  setUniversesPageView: (view: 'grid' | 'terminal') => void;
}
```

### Использование

```typescript
const { selectedUniverse, sidebarOpen } = useAppStore();
```

## Store фоновых задач (`store/jobQueue.ts`)

```typescript
interface JobQueueState {
  jobs: Job[];
  addJob: (job: Job) => void;
  updateJob: (id: string, updates: Partial<Job>) => void;
  removeJob: (id: string) => void;
  // ... прогресс, ошибки, статус
}
```

Отслеживает фоновые задачи (AI-генерация, индексация RAG и т.д.).

## Store генерации чата (`store/chatGeneration.ts`)

```typescript
interface ChatGenerationState {
  isGenerating: boolean;
  currentResponse: string;
  abortController: AbortController | null;
  // ... управление streaming
}
```

Управляет состоянием streaming-генерации в чате.

## Архитектурный принцип

- **Zustand** — только для **глобального UI-состояния** (выбор вселенной, сайдбар, тема)
- **TanStack Query** — для **серверного состояния** (данные API, кэширование)
- **Локальный state** (`useState`) — для состояния отдельных компонентов

Это предотвращает перегрузку Zustand и обеспечивает автоматическое кэширование серверных данных.

---

← [Назад к API-клиенту](api-client.md) | [Типы →](types.md)
