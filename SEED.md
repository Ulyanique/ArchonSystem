# SEED

> **Только пользователь.** Агенты **только читают** этот файл — не правят, не архивируют, не копируют, не переименовывают.
> Язык: отчёты агентов — русский; код, slug и идентификаторы — EN (kebab-case).

Единственный источник истины от автора: цель, ограничения, исключить. Оперативное состояние — в `MANIFEST.md`, `state/roadmap.md`, `backlog/`; meta синхронизирует их с SEED на каждом цикле, если вы что-то изменили.

## Цель

Развивать **ArchonSystem** — fullstack-приложение для **управления вымышленными вселенными** (worldbuilding для писателей-фантастов): персонажи, локации, главы, таймлайны, фракции, космос, wiki, граф знаний, RAG-чат с персонажами, AI-критик и генерация контента.

**Конечное состояние продукта:**

1. **Стабильное приложение** — фаза 0 (`docs/roadmap/stabilization.md`) закрыта: все заявленные функции работают без критических багов; backend + frontend запускаются через `setup.ps1` / `start.ps1`.
2. **Чистая архитектура** — слои API → Services → Repositories → Models; монолитные страницы/сервисы разбиты по `docs/roadmap/modularity.md` без регрессий.
3. **Изоляция вселенных** — Master DB + отдельная SQLite на вселенную + ChromaDB RAG per `universe_id`; бэкап/восстановление/экспорт надёжны.
4. **LLM как помощник** — Ollama local-first, облако опционально; AI генерирует, **автор утверждает**; RAG с уровнями знаний персонажей (`CharacterKnowledge`).
5. **Тесты и документация** — новый код с pytest/vitest; `docs/` актуальны относительно кода.

**Конечное состояние системы:**

- Специализированные агенты (meta создаёт на первом старте) ведут backend, frontend, AI, тесты, миграции, стабилизацию.
- Meta и universal координируют циклы, эволюционируют систему, читают отчёты друг друга; неэффективных агентов уплотняют или удаляют.
- Скрипты — только рутина (lint, migrate, test runner); **крупный рефакторинг — только через задачи с DoD и тестами**.

## Ограничения

**Платформа и инструменты:**

- Workspace: корень `ArchonSystem/` — `backend/` (FastAPI), `frontend/` (React+Vite), `docs/`, агентный слой в корне.
- Backend: Python 3.10+ (рекомендуется 3.11–3.12), FastAPI, SQLAlchemy 2 async, Alembic, Pydantic v2, ChromaDB, httpx.
- Frontend: React 18, TypeScript, Vite 5, TanStack Query, Zustand, Tailwind 3, Vitest.
- БД: SQLite (master + per-universe); миграции только через Alembic в `backend/migrations/`.
- LLM: Ollama (локально), OpenRouter, DeepSeek, RouterAI — через `LLMService`; ключи в `.env`, не в коде.
- ОС разработки: Windows 11; запуск — PowerShell-скрипты в корне.

**Данные и вселенные:**

- Каждая вселенная — отдельный файл `backend/data/universes/{id}/universe.db` + векторный индекс ChromaDB.
- **Автор — источник истины контента** вселенной: AI предлагает, пользователь сохраняет/редактирует в UI; агенты не «канонизируют» лор без явной задачи и DoD.
- Согласованность — через `AICritic`, связи (`links`), coverage, graph; не через внешний Obsidian-vault.
- Миграции схемы — Alembic; не править `universe.db` вручную без миграции и отчёта.

**Агенты:**

- Meta создаёт специализированных помощников на первом старте (список в `MANIFEST.md` → «Роли первого старта»).
- Universal берёт роли по задачам из backlog; meta/universal читают отчёты друг друга.
- Один агент — один набор owned paths; два агента не пишут в один файл.
- Имена агентов и файлов — **kebab-case**, **без номеров в начале**.

**Цикл:**

- Запуск через промпт Jules из `README.md` → `AGENTS.md`.
- Плотная сессия за итерацию; anti-micro (MANIFEST).

## Исключить

- **Массовый рефакторинг без тестов** — переписывание модулей «целиком» без DoD и прогона pytest/vitest.
- **Ломать публичный API** без миграции данных и обновления frontend api-клиента.
- **Коммит/push в git** без явной просьбы пользователя.
- **Правка `SEED.md` агентами** — только пользователь.
- **6+ новых агентов без обоснования** в reasoning meta.
- **Пустые заглушки** — скрипты без DoD, endpoints без схем/тестов, страницы «скоро».
- **Хранение секретов в коде** — API keys только в `.env`.
- **Смешение вселенных** — операции всегда scoped по `universe_id`.
- **Дублирование документации** — править `docs/` или код, не оба с расхождением.
- **Literary vault-паттерн** — не переносить Obsidian Codex/Legacy/Book из Desktop AgentSystem; ArchonSystem — приложение с БД, не markdown-vault.
- **Чтение всего backend/frontend целиком** за одну итерацию — только целевой модуль или область по backlog.

## Контекст

### Структура репозитория (относительно корня)

```
ArchonSystem/
├── backend/
│   ├── app/
│   │   ├── api/              # ~30 REST routers
│   │   ├── models/           # 19 SQLAlchemy-моделей
│   │   ├── schemas/          # Pydantic v2
│   │   ├── repositories/     # DAL
│   │   ├── services/         # LLM, RAG, AIWriter, AICritic, Export…
│   │   ├── main.py, config.py, database.py, routes.py
│   ├── migrations/           # Alembic (~15 версий)
│   ├── tests/
│   └── data/                 # archon_master.db, universes/{id}/
├── frontend/
│   └── src/
│       ├── api/              # ~28 клиент-модулей
│       ├── pages/            # ~32 страницы
│       ├── components/
│       └── store/
├── docs/                     # architecture, backend, frontend, roadmap, rag…
├── agents/                   # meta-agent, universal-agent + роли meta
├── state/, backlog/, reports/  # создаёт/ведёт meta на init и циклах
├── setup.ps1, start.ps1, stop.ps1
├── SEED.md, AGENTS.md, MANIFEST.md, README.md
└── backups/                  # бэкапы вселенных (gitignore)
```

### Ключевые доменные сущности (Universe DB)

Characters, Locations, Chapters, SceneBeats, Storylines, TimelineEvents, Notes, Quotes, Links, OutlineItems, WikiArticles, Factions, Technologies, Artifacts, ConceptArts, Galaxies/StarSystems/CelestialBodies, CharacterKnowledge, ChapterMentions.

### Сервисы AI

| Сервис | Назначение |
|--------|------------|
| `LLMService` | 4 LLM + 4 image провайдера, fallback, streaming |
| `RAGService` | ChromaDB, эмбеддинги, reindex |
| `ContextManager` | бюджет контекста чата |
| `AIWriter` | дополнение глав (SSE) |
| `AICritic` | согласованность персонажей/локаций/глав |
| `AIGenerator` | генерация сущностей, plot twist |
| `PromptBuilder` | системные промпты |

### Дорожная карта продукта

| Фаза | Файл | Статус (2026-05-30) |
|------|------|---------------------|
| 0 Стабилизация | `docs/roadmap/stabilization.md` | в процессе |
| 1 Модульность | `docs/roadmap/modularity.md` | ожидает |
| 2 UX | `docs/roadmap/ux-polish.md` | ожидает |
| 3 Тестирование | `docs/roadmap/testing.md` | ожидает |
| 4 Advanced AI | `docs/roadmap/advanced-ai.md` | ожидает |
| 5 Scaling | `docs/roadmap/scaling.md` | ожидает |

### Текущее состояние агентной системы (2026-05-30)

| Область | Статус |
|---------|--------|
| SEED | Заполнен пользователем (этот файл) |
| AGENTS.md, MANIFEST (Core-стиль) | Внедрены |
| meta-agent, universal-agent | Промпты Core-паттерн |
| state/, backlog/ | Частично (index + корневые агенты); roadmap — создаст meta |
| reports/ | Пусто — первый цикл (режим A) |
| Специализированные роли | Список в MANIFEST; файлы создаст meta на init |

### Отличие от Desktop AgentSystem / Core

| Desktop Core (литературный) | ArchonSystem (этот репо) |
|------------------------------|--------------------------|
| Obsidian vault: Codex, Book, Legacy | SQLite + UI + API |
| Canon.md / Corpus.md как конституция | Контент в БД; автор + AICritic |
| Legacy → переработка markdown | Alembic + рефакторинг кода |
| Next.js сайт-вики | React SPA + FastAPI |
| wikilink, frontmatter | relations, links, graph, RAG |

### Агентная система

- **Meta-agent** — roadmap, MANIFEST, создание/эволюция агентов, batching backlog, full-audit, seed-sync.
- **Universal-agent** — исполнение задач, роли из `agents/*.md`.
- Специализированные агенты — см. `MANIFEST.md` → «Роли первого старта»; отчёты в `reports/[имя]/`.
- Протокол согласованности контента: `docs/consistency-protocol.md` (создать meta на первом старте, если отсутствует).

### MCP и инструменты

- Browser DevTools — для проверки UI после изменений frontend.
- Тесты: `cd backend && pytest`, `cd frontend && npm test`.
- Swagger: http://localhost:8000/docs после `start.ps1`.
