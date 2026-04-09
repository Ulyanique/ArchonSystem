# Развёртывание и запуск

## Системные требования

| Компонент | Минимум | Рекомендуется |
|-----------|---------|---------------|
| **Python** | 3.10 | 3.11–3.12 |
| **Node.js** | 18 | 20+ |
| **RAM** | 8 ГБ | 16+ ГБ (32 ГБ для локальных LLM) |
| **Диск** | 2 ГБ | 10+ ГБ (модели LLM, эмбеддинги) |
| **ОС** | Windows, Linux, macOS | — |

---

## Быстрый старт (PowerShell)

### 1. Установка

```powershell
.\setup.ps1
```

Скрипт автоматически:
1. Проверяет Python 3.12+ и Node.js
2. Создаёт venv в `backend/venv/`
3. Устанавливает зависимости (`pip install -r requirements.txt`)
4. Устанавливает зависимости фронтенда (`npm install`)
5. Применяет Alembic-миграции

### 2. Запуск

```powershell
.\start.ps1
```

Скрипт:
1. Проверяет зависимости
2. Запускает бэкенд: `uvicorn app.main:app --reload --port 8000`
3. Запускает фронтенд: `npm run dev --port 5173`
4. Открывает браузер

### 3. Остановка

```powershell
.\stop.ps1
```

Скрипт:
1. Останавливает Python и Node процессы
2. Освобождает порты 8000 и 5173

---

## Ручная установка

### Бэкенд

```bash
cd backend

# Создание виртуального окружения
python -m venv venv
venv\Scripts\activate  # Windows
source venv/bin/activate  # Linux/macOS

# Установка зависимостей
pip install -r requirements.txt
# Для воспроизводимой сборки:
pip install -r requirements-pinned.txt

# Копирование конфигурации
cp .env.example .env
# Отредактируйте .env (ключи API, LLM-провайдер)

# Запуск
uvicorn app.main:app --reload --port 8000
```

### Фронтенд

```bash
cd frontend

# Установка зависимостей
npm install
# Для строгой установки по lockfile:
npm ci

# Запуск
npm run dev
```

---

## Конфигурация (.env)

Скопируйте `backend/.env.example` в `backend/.env` и настройте:

```env
# ═══════════════════════════════════════════
# LLM-провайдеры
# ═══════════════════════════════════════════

# Ollama (локальный)
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=qwen2.5:14b

# DeepSeek (облачный)
DEEPSEEK_API_KEY=sk-...
DEEPSEEK_MODEL=deepseek-chat

# OpenRouter (агрегатор)
OPENROUTER_API_KEY=sk-or-...
OPENROUTER_MODEL=anthropic/claude-sonnet-4-20250514
OPENROUTER_IMAGE_MODEL=google/gemini-2.5-flash-image

# RouterAI (альтернативный)
ROUTERAI_API_KEY=...
ROUTERAI_MODEL=...

# Провайдер по умолчанию
DEFAULT_LLM_PROVIDER=ollama

# ═══════════════════════════════════════════
# Сервер
# ═══════════════════════════════════════════

BACKEND_PORT=8000
DEBUG=false
CORS_ORIGINS=http://localhost:5173,http://localhost:3000

# ═══════════════════════════════════════════
# RAG
# ═══════════════════════════════════════════

RAG_EMBEDDING_MODEL=paraphrase-multilingual-MiniLM-L12-v2
HF_TOKEN=hf_...
```

> **Важно:** Файл `.env` содержит секреты (ключи API). **Не коммитьте его в репозиторий.**

---

## Переменные окружения

### LLM-провайдеры

| Переменная | Описание | По умолчанию |
|------------|----------|-------------|
| `DEFAULT_LLM_PROVIDER` | Провайдер по умолчанию | `ollama` |
| `OLLAMA_BASE_URL` | URL Ollama | `http://localhost:11434` |
| `OLLAMA_MODEL` | Модель Ollama | — |
| `DEEPSEEK_API_KEY` | Ключ DeepSeek | — |
| `DEEPSEEK_MODEL` | Модель DeepSeek | — |
| `OPENROUTER_API_KEY` | Ключ OpenRouter | — |
| `OPENROUTER_MODEL` | Модель OpenRouter | — |
| `OPENROUTER_IMAGE_MODEL` | Модель для изображений | — |
| `ROUTERAI_API_KEY` | Ключ RouterAI | — |
| `ROUTERAI_MODEL` | Модель RouterAI | — |

### Сервер

| Переменная | Описание | По умолчанию |
|------------|----------|-------------|
| `BACKEND_PORT` | Порт бэкенда | `8000` |
| `DEBUG` | Показ traceback в ошибках | `false` |
| `CORS_ORIGINS` | Разрешённые источники | `http://localhost:5173` |

### RAG

| Переменная | Описание | По умолчанию |
|------------|----------|-------------|
| `RAG_EMBEDDING_MODEL` | Модель эмбеддингов | `paraphrase-multilingual-MiniLM-L12-v2` |
| `HF_TOKEN` | Токен HuggingFace | — |

---

## Доступные URL

| Сервис | URL |
|--------|-----|
| **Фронтенд** | http://localhost:5173 |
| **Бэкенд** | http://localhost:8000 |
| **Swagger UI** | http://localhost:8000/docs |
| **ReDoc** | http://localhost:8000/redoc |

---

## Pre-commit хуки

Для автоматической проверки качества кода:

```bash
# Установка
pip install pre-commit
pre-commit install

# Запуск вручную
pre-commit run --all-files
```

Проверяет:
- **Фронтенд:** ESLint, Prettier
- **Бэкенд:** Black, Flake8

---

## Docker (в будущем)

Планируется поддержка Docker для контейнеризации:

```dockerfile
# backend/Dockerfile (планируется)
FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

---

## Production-рекомендации

| Настройка | Рекомендация |
|-----------|-------------|
| **DEBUG** | `false` (не показывать traceback) |
| **CORS_ORIGINS** | Только ваш домен |
| **LLM-провайдер** | Облачный (DeepSeek, OpenRouter) |
| **Бэкапы** | Регулярный бэкап вселенных |
| **Сервер** | Gunicorn + uvicorn workers |
| **БД** | Рассмотреть PostgreSQL для масштабирования |

### Запуск через Gunicorn

```bash
gunicorn app.main:app \
  --workers 4 \
  --worker-class uvicorn.workers.UvicornWorker \
  --bind 0.0.0.0:8000
```

---

## Устранение проблем

### Порт уже занят

```powershell
.\stop.ps1
# Или вручную:
netstat -ano | findstr :8000
taskkill /PID <PID> /F
```

### Ошибка подключения к Ollama

1. Убедитесь, что Ollama запущен
2. Проверьте `OLLAMA_BASE_URL` в `.env`
3. Проверьте доступность модели: `ollama list`

### Ошибка миграций

```bash
cd backend
alembic upgrade head
```

---

← [Назад к базе данных](database.md) | [Дорожная карта →](roadmap/README.md)
