# API-клиент

API-клиенты расположены в `frontend/src/api/`. Каждый модуль — типизированные функции для своей доменной области.

## Клиент (`client.ts`)

Централизованный Axios-инстанс:

```typescript
import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
});

// Error interceptor
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (!navigator.onLine) {
      // Network error callback
    }
    return Promise.reject(error);
  }
);

// Helper для streaming (SSE)
export async function* apiFetch(url: string, options: object): AsyncIterableIterator<string>

// Helper для URL файлов
export function uploadsUrl(path: string): string

export default api;
```

## Модули API

| Файл | Строк | Описание |
|------|------:|----------|
| `chat.ts` | 126 | Чат с ИИ (streaming + non-streaming) |
| `chapters.ts` | 124 | CRUD глав + AI write |
| `universeView.ts` | 121 | Полный текст вселенной |
| `aiCritic.ts` | 51 | AI-анализ |
| `aiGenerator.ts` | 42 | AI-генерация сущностей |
| `characters.ts` | 43 | CRUD персонажей |
| `universes.ts` | 43 | CRUD вселенных |
| `client.ts` | 57 | Axios-инстанс + helpers |
| `coverage.ts` | 39 | Покрытие мира |
| `conceptArt.ts` | 34 | Концепт-арты |
| `links.ts` | 27 | Связи между сущностями |
| `index.ts` | 27 | Barrel-экспорты |
| `locations.ts` | 25 | CRUD локаций |
| `space.ts` | 23 | Космические объекты |
| `outline.ts` | 17 | План повествования |
| `wiki.ts` | 17 | Wiki-статьи |
| `storylines.ts` | 14 | Сюжетные линии |
| `timeline.ts` | 14 | Таймлайн |
| `images.ts` | 14 | Трансформация изображений |
| `tech.ts` | 13 | Технологии и артефакты |
| `notes.ts` | 13 | Заметки |
| `characterKnowledge.ts` | 12 | Знания персонажей |
| `export.ts` | 11 | Экспорт |
| `systemSettings.ts` | 10 | Глобальные настройки |
| `quotes.ts` | 18 | Цитаты |
| `faction.ts` | 8 | Фракции |
| `search.ts` | 8 | Поиск |

## Паттерны использования

### CRUD-функции

```typescript
// Типичный CRUD-модуль
export async function getEntities(universeId: string): Promise<Entity[]>
export async function getEntity(universeId: string, id: string): Promise<Entity>
export async function createEntity(universeId: string, data: EntityCreate): Promise<Entity>
export async function updateEntity(universeId: string, id: string, data: EntityUpdate): Promise<Entity>
export async function deleteEntity(universeId: string, id: string): Promise<void>
```

### Streaming

```typescript
// SSE streaming
async function* streamChat(message: string): AsyncIterableIterator<string> {
  yield* apiFetch('/chat', { method: 'POST', body: JSON.stringify({ message }) });
}
```

### React Query интеграция

Каждый модуль предоставляет функции, которые используются с `useQuery`, `useMutation`:

```typescript
const { data: characters } = useQuery({
  queryKey: ['characters', universeId],
  queryFn: () => getCharacters(universeId),
});

const createMutation = useMutation({
  mutationFn: (data: CharacterCreate) => createCharacter(universeId, data),
  onSuccess: () => queryClient.invalidateQueries({ queryKey: ['characters', universeId] }),
});
```

## Состояние

Все API-модули **чистые** — не хранят состояние, только функции.

---

← [Назад к компонентам](components.md) | [Состояние →](state.md)
