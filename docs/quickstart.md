# Quickstart — AgentSystem для ArchonSystem

## Что это

Саморазвивающаяся система (паттерн Core) из двух корневых агентов + специализированных ролей:

- **meta-agent** — roadmap, MANIFEST, создание/эволюция агентов, full-audit, seed-sync
- **universal-agent** — исполнение задач, роли builder/analyzer/documenter/reviewer + роли из `agents/*.md`

**Не путать с literary Core** (Desktop AgentSystem): здесь продукт — **приложение** (FastAPI + React + SQLite), не Obsidian vault.

## Структура

```
SEED.md              — цель пользователя (только автор)
AGENTS.md            — алгоритм одного цикла
MANIFEST.md          — конституция, подцели, роли первого старта
agents/              — промпты агентов
state/               — состояние + roadmap.md (meta)
backlog/             — задачи
reports/             — отчёты + summary.md (meta создаёт на init)
```

## Как запустить

1. Заполните/проверьте `SEED.md`
2. Убедитесь, что приложение стартует: `.\setup.ps1`, затем `.\start.ps1`
3. Запускайте **один цикл** промптом Jules из `README.md` (секция «Промпт для Jules»)

Алгоритм цикла — в `AGENTS.md`:

- **Первый старт:** meta → universal → сводка
- **Обычный цикл:** universal → meta → сводка

## Важно

- **Не запускайте два universal-agent одновременно**
- Meta и universal в одном цикле выполняются **последовательно** по AGENTS.md, не параллельно как отдельные процессы
- Все отчёты — на **русском**; код — EN
- Meta **не правит** `SEED.md`
- Пустые `reports/` до первого цикла — норма; meta создаст инфраструктуру на init
