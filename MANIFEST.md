# MANIFEST

> Конституция и оперативная карта проекта **ArchonSystem**. **Meta-agent** может менять любую секцию (кроме инвариантов ниже), чтобы быстрее достичь SEED. Пользователь правит SEED и может править «Цели» / «Запреты» вручную.

- **Версия:** 2
- **Статус:** готов к первому циклу (SEED заполнен)
- **Продукт:** fullstack worldbuilding · FastAPI + React · SQLite per-universe · ChromaDB RAG

## Инварианты (не трогать)

- Файлы `SEED.md`, `AGENTS.md`, `MANIFEST.md`, `agents/meta-agent.md`, `agents/universal-agent.md` существуют.
- `SEED.md` меняет **только пользователь**; агенты не правят, не архивируют, не копируют.
- Meta не подменяет суть главной цели без явного подтверждения пользователя.
- Каждый агент пишет **только** в свои файлы (см. «Владение»).
- **Язык:** `reports/` (включая reasoning), `reports/summary.md`, комментарии в `state/roadmap.md` — **русский**; код и идентификаторы — EN kebab-case.
- **Контент вселенных** — AI предлагает, автор утверждает в UI; агенты не массово переписывают пользовательские данные в `backend/data/` без явной задачи с DoD.

## Цели

### Главная

- **G-001** [активна] — Развивать ArchonSystem: стабильное приложение управления вселенными, чистая архитектура, надёжный RAG/LLM, тесты и актуальная документация.

### Дополнительные

- **G-002** [активна] — Фаза 0: закрыть критические баги и незавершённые функции (`docs/roadmap/stabilization.md`).
- **G-003** [активна] — Фаза 1: модульность кода — разбить монолиты frontend/backend (`docs/roadmap/modularity.md`).
- **G-004** [активна] — Покрытие тестами: pytest backend, vitest frontend (`docs/roadmap/testing.md`).
- **G-005** [активна] — Агентная система: специализированные роли на первом старте; эволюция по отчётам.

### Лог изменений целей

- 2026-05-30 — G-001…G-005 зафиксированы из SEED при внедрении Core-паттерна.

## Подцели и DoD

| # | Подцель | DoD (проверяется без LLM) | Статус |
|---|---------|---------------------------|--------|
| P-001 | Инфраструктура агентов | `state/roadmap.md`, `reports/summary.md`, `reports/changelog.md`, backlog meta/universal с DoD-задачами | **выполнено** |
| P-002 | Роли первого старта | Все файлы из «Роли первого старта» в `agents/` + state/backlog/reports для каждого | **выполнено** |
| P-003 | Протокол согласованности | `docs/consistency-protocol.md` с чек-листом AICritic + links + coverage | **выполнено** |
| P-004 | Стабилизация (фаза 0) | ≥3 пункта из `stabilization.md` закрыты с тестами или ручной проверкой в отчёте | не начато |
| P-005 | Backend health | `pytest` в `backend/tests/` — green; Swagger `/docs` открывается | не начато |
| P-006 | Frontend health | `npm test` + `npm run build` в `frontend/` — green | не начато |

**Прогресс:** 3/6 подцелей.

## Принципы

- **Минимализм** — новый агент/файл только если существующий не покрывает задачу.
- **Постоянная эволюция** — на **каждом** цикле: продукт (код, тесты, docs) **и** агентная система (промпты, роли, backlog, MANIFEST).
- **Author-first** — LLM генерирует, пользователь сохраняет; агенты улучшают **приложение**, не подменяют авторский лор без задачи.
- **Universe isolation** — операции scoped по `universe_id`; не смешивать данные вселенных.
- **Тесты обязательны** — новый код в backend/frontend сопровождается pytest/vitest.
- **Рекомендации автору** — meta **не меняет** `SEED.md`; советует уточнения в отчётах.
- **Периодический full audit** — каждые N итераций (N в `state/meta-agent.md`, по умолчанию 5).
- **Плотность сессии** — один цикл = существенная работа; anti-micro.
- **Комплексный разбор** — модуль/область целиком, не одна строка точечно.
- **Идемпотентность** — read → diff → delta.
- **Русский** — отчёты; slug — kebab-case EN.

## Запреты пользователя (из SEED)

- **C-001** [активен] — Не массовый рефакторинг без тестов и DoD. Причина: регрессии.
- **C-002** [активен] — Не ломать API без Alembic-миграции и обновления frontend api. Причина: целостность данных.
- **C-003** [активен] — Не commit/push без явной просьбы пользователя.
- **C-004** [активен] — Не править `SEED.md`. Причина: только пользователь.
- **C-005** [активен] — Не хранить API keys в коде — только `.env`. Причина: безопасность.
- **C-006** [активен] — Не переносить literary vault (Codex/Legacy/Book) из Desktop AgentSystem. Причина: другой продукт.
- **C-007** [активен] — Не массово менять `backend/data/universes/*` без задачи и бэкапа.

## Стек (зафиксированный)

| Слой | Технология |
|------|------------|
| Backend | Python 3.12, FastAPI, SQLAlchemy 2 async, Alembic, Pydantic v2 |
| Frontend | React 18, TypeScript, Vite 5, TanStack Query, Zustand, Tailwind 3 |
| БД | SQLite master + per-universe; ChromaDB RAG |
| LLM | Ollama, OpenRouter, DeepSeek, RouterAI |
| Images | OpenRouter, Cloudflare Workers AI, Pixazo, Whisk |
| 3D / Graph | Three.js, React Flow |
| Тесты | pytest, Vitest |

Детали: `docs/architecture.md`, `README.md`.

## Владение файлами

### Система агентов

| Путь | Запись | Чтение |
|------|--------|--------|
| `SEED.md` | только пользователь | все |
| `AGENTS.md` | meta (эволюция) | все |
| `MANIFEST.md` | meta (+ пользователь: цели/запреты) | все |
| `agents/*.md` | meta | все |
| `state/*`, `backlog/*` | агент по имени | все |
| `reports/[имя]/*` | только этот агент | все |
| `reports/summary.md`, `changelog.md` | meta | все |
| `docs/consistency-protocol.md` | meta, consistency-critic-agent | все |

### Продукт (код)

| Путь | Запись | Чтение |
|------|--------|--------|
| `backend/` | universal-agent в роли backend/ai/tester/optimizer/database-migration/rag | все |
| `frontend/` | universal-agent в роли frontend/optimizer/tester | все |
| `docs/` (кроме consistency-protocol) | universal-agent в роли documenter | все |
| `backend/data/` | **не трогать** без явной задачи + бэкап; миграции — Alembic | все |
| `backups/` | universe-lifecycle-agent по задаче | все |

**Правило:** два агента не пишут в один файл.

## Роли первого старта (meta создаёт на init)

Meta на первой итерации создаёт **промпты-роли** (`agents/[имя].md`) + `state/`, `backlog/`, `reports/` для каждого. Universal может исполнять роли до promote в отдельных агентов.

| Файл агента | Роль (1 строка) |
|-------------|-----------------|
| `backend-developer-agent.md` | API, services, repositories, models; FastAPI + SQLAlchemy |
| `frontend-developer-agent.md` | React pages/components, api-клиент, UX баги фазы 0 |
| `ai-engineer-agent.md` | LLMService, PromptBuilder, AIWriter, AIGenerator, streaming |
| `rag-pipeline-agent.md` | RAGService, ChromaDB reindex, ContextManager, knowledge levels |
| `consistency-critic-agent.md` | AICritic, links, coverage, graph; конфликты → отчёт + backlog |
| `database-migration-agent.md` | Alembic migrations, schema/models sync, data integrity |
| `tester-agent.md` | pytest + vitest; регрессии; E2E smoke по roadmap |
| `optimizer-agent.md` | Производительность, dead code, монолиты → задачи на split |
| `documenter-agent.md` | Актуализация `docs/` vs код; inline docs |
| `stabilization-agent.md` | Закрытие пунктов `docs/roadmap/stabilization.md` с DoD |
| `universe-lifecycle-agent.md` | Backup/restore/export universes; изоляция universe_id |
| `social-content-agent.md` | Посты о развитии проекта — только факты из отчётов/commits |

**Не создавать на init:** дубликаты universal-ролей (analyzer/builder/reviewer остаются в universal).

## Reasoning meta-agent

Перед: первый старт, seed-sync, новый агент, full-audit, system-evolve — reasoning в `reports/meta-agent/reasoning/`.

## Отчёты (обязательные блоки)

**Meta action:** метрики, эволюция системы, что улучшить, рекомендации пользователю, reasoning-ссылка.

**Universal / специализированные:** роль, задача, артефакты, DoD-check, **Pre-flight** (если правка существующего кода), **Тесты** (pytest/vitest результат), предложения.

## Контекст

> Обновляет meta-agent после каждой итерации.

- **Итерация:** 0
- **Статус:** SEED заполнен; ожидает первый цикл (режим A в AGENTS.md)
- **Агенты:** meta-agent, universal-agent (+ 12 ролей к созданию)
- **Прогресс:** 50% (3/6 подцелей)
- **Продукт:** v0.1.0; фаза 0 stabilization в процессе
- **Roadmap:** `state/roadmap.md` (создаст meta); продукт — `docs/roadmap/`
- **Данные:** `backend/data/archon_master.db`, universes в `backend/data/universes/{id}/`

## Дисциплина

| Тема | Где |
|------|-----|
| Порядок цикла | `AGENTS.md` |
| Heartbeat / lock | `state/[имя].md` |
| Плотность / anti-micro | MANIFEST «Принципы» |
| Согласованность контента | `docs/consistency-protocol.md` |
| Продуктовая roadmap | `docs/roadmap/` |
| Запуск приложения | `setup.ps1`, `start.ps1`, `README.md` |
