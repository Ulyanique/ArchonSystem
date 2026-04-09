# Фаза 5: Масштабирование и продакшен

> Подготовка к production-развёртыванию и мультипользовательской работе. Только после **Фазы 4**.

---

## Модуль 5.1: Контейнеризация

### 5.1.1: Dockerfile бэкенда

```dockerfile
FROM python:3.12-slim
WORKDIR /app
COPY requirements-pinned.txt .
RUN pip install --no-cache-dir -r requirements-pinned.txt
COPY . .
CMD ["gunicorn", "app.main:app", \
     "--workers", "4", \
     "--worker-class", "uvicorn.workers.UvicornWorker", \
     "--bind", "0.0.0.0:8000"]
```

### 5.1.2: Dockerfile фронтенда

```dockerfile
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json .
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
```

### 5.1.3: docker-compose

```yaml
version: '3.9'
services:
  backend:
    build: ./backend
    ports: ["8000:8000"]
    env_file: .env
    volumes:
      - archon-data:/app/data
  frontend:
    build: ./frontend
    ports: ["80:80"]
    depends_on: [backend]
  chromadb:
    image: chromadb/chroma:latest
    volumes:
      - chroma-data:/chroma/chroma
volumes:
  archon-data:
  chroma-data:
```

### 5.1.4: CI/CD pipeline

- GitHub Actions: build → test → lint → deploy
- Автоматический push в container registry
- Deploy на staging и production

---

## Модуль 5.2: Базы данных

### 5.2.1: Поддержка PostgreSQL

- Альтернатива SQLite для production
- Миграции с SQLite на PostgreSQL ( Alembic )
- Connection pooling (asyncpg)

### 5.2.2: Поддержка MySQL

- Дополнительный диалект SQLAlchemy
- Настройка через .env

### 5.2.3: Read replicas

- Запись в primary, чтение из replica
- Для масштабирования при большом числе пользователей

---

## Модуль 5.3: Аутентификация

### 5.3.1: JWT-аутентификация

- Регистрация / логин
- Access + Refresh tokens
- Logout (blacklist токенов)

### 5.3.2: OAuth

- Google OAuth
- GitHub OAuth
- Кнопки «Войти через...»

### 5.3.3: Роли и права

| Роль | Права |
|------|-------|
| `admin` | Полный доступ + управление пользователями |
| `writer` | Создание и редактирование вселенных |
| `reader` | Только просмотр |

### 5.3.4: Isolation данных

- Каждая вселенная привязана к владельцу
- Шаринг с другими пользователями (read/write access)

---

## Модуль 5.4: Мультипользовательность

### 5.4.1: Совместная работа

- Несколько авторов над одной вселенной
- Real-time collaboration через WebSockets
- Conflict resolution ( Operational Transformation / CRDT )

### 5.4.2: Комментарии

- Комментарии к сущностям
- Обсуждение с другими пользователями
- Упоминания (@username)

### 5.4.3: Audit log

- История изменений: кто, что, когда изменил
- Возможность отката к предыдущей версии
- Diff-view для текста

---

## Модуль 5.5: Мониторинг

### 5.5.1: Логирование

- Структурированное логирование (JSON)
- Уровни: DEBUG, INFO, WARNING, ERROR
- Correlation ID для трекинга запросов

### 5.5.2: Метрики

- Prometheus: latency, error rate, request count
- Кастомные метрики: AI-запросы, RAG-поиск, генерация изображений

### 5.5.3: Трейсинг

- OpenTelemetry
- Distributed tracing (frontend → backend → DB)
- Visualization в Jaeger / Grafana

### 5.5.4: Alerting

- Alert при error rate > threshold
- Alert при slow response times
- Alert при недоступности LLM-провайдеров

---

## Критерии завершения фазы 5

- [ ] Docker-образы для backend и frontend
- [ ] docker-compose для локального запуска
- [ ] CI/CD pipeline (build → test → deploy)
- [ ] PostgreSQL поддерживается
- [ ] JWT-аутентификация работает
- [ ] OAuth (Google, GitHub) подключен
- [ ] Роли и права реализованы
- [ ] Совместная работа через WebSockets
- [ ] Audit log ведётся
- [ ] Метрики и мониторинг настроены
- [ ] Alerting работает

---

← [Назад к продвинутым AI](advanced-ai.md) | [Назад к roadmap](README.md)
