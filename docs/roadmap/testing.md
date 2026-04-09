# Фаза 3: Тестирование

> Покрытие кода тестами. Только после **Фазы 2**.

---

## Модуль 3.1: Backend-тесты

### 3.1.1: Unit-тесты сервисов

| Сервис | Что тестировать |
|--------|----------------|
| `LLMService` | Fallback между провайдерами, retry, response parsing |
| `RAGService` | Чанкинг, индексация, поиск, переиндексация |
| `ContextManager` | Контекст-билдинг, бюджетирование, knowledge filtering |
| `AIWriter` | Все 3 режима генерации |
| `AICritic` | Все типы анализа |
| `AIGenerator` | Генерация всех типов сущностей |
| `TimeService` | Расчёт внутреннего времени, конвертация дат |
| `Search` | Поиск по всем категориям, ранжирование |
| `Export` | Генерация Markdown и DOCX |

### 3.1.2: Unit-тесты репозиториев

- CRUD-операции для каждой модели
- Фильтрация, сортировка, пагинация
- Обработка ошибок (NoSuchEntity, IntegrityError)
- Транзакционность (rollback при ошибке)

### 3.1.3: Integration-тесты API

| Эндпоинт | Что тестировать |
|----------|----------------|
| Все CRUD | Создание, чтение, обновление, удаление |
| AI-эндпоинты | С моковыми LLM (без реальных запросов) |
| Streaming | SSE events, abort, error recovery |
| Файловые операции | Загрузка, валидация размера, удаление |
| Бэкап/восстановление | Создание zip, восстановление |

### 3.1.4: Mock LLM-провайдеров

```python
# conftest.py
@pytest.fixture
def mock_ollama():
    with patch('app.services.llm.OllamaProvider.chat') as mock:
        mock.return_value = {'response': 'Test response'}
        yield mock
```

---

## Модуль 3.2: Frontend-тесты

### 3.2.1: Unit-тесты компонентов

| Компонент | Что тестировать |
|-----------|----------------|
| `CharacterCard` | Отображение данных, портрет |
| `CharacterForm` | Валидация, отправка формы |
| `ChatMessageItem` | Рендер сообщения, markdown |
| `KnowledgeGraph` | Ноды, рёбра, layout |
| `EmptyState` | Отображение CTA |
| `Layout` | Сайдбар, навигация |
| `CommandPalette` | Поиск, выполнение команд |

### 3.2.2: Unit-тесты API-клиентов

- Правильные URL и методы
- Передача данных
- Обработка ошибок
- Streaming (SSE)

### 3.2.3: Integration-тесты страниц

- Загрузка данных (mock API)
- Отображение loading/error/empty states
- Взаимодействие с пользователем (клик, ввод)
- Мутации (создание, обновление, удаление)

### 3.2.4: E2E-тесты (Playwright)

| Сценарий | Шаги |
|----------|------|
| Создание вселенной | Открыть список → Создать → Проверить появление |
| Создание персонажа | Открыть вселенную → Персонажи → Создать → Проверить |
| AI-чат | Открыть чат → Отправить сообщение → Получить ответ |
| Экспорт | Открыть настройки → Экспорт → Скачать файл |

---

## Модуль 3.3: CI/CD

### 3.3.1: GitHub Actions pipeline

```yaml
name: Tests
on: [push, pull_request]
jobs:
  backend-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
      - run: pip install -r requirements.txt
      - run: pytest backend/tests/
  
  frontend-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - run: npm test
  
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: pre-commit run --all-files
```

### 3.3.2: Coverage thresholds

| Метрика | Backend | Frontend |
|---------|---------|----------|
| Statements | 80% | 70% |
| Branches | 70% | 60% |
| Functions | 80% | 70% |
| Lines | 80% | 70% |

---

## Критерии завершения фазы 3

- [ ] Backend unit tests: >80% coverage сервисов
- [ ] Backend unit tests: >80% coverage репозиториев
- [ ] API integration tests: все эндпоинты покрыты
- [ ] Frontend unit tests: ключевые компоненты
- [ ] Frontend integration tests: основные страницы
- [ ] E2E tests: критические user flows
- [ ] CI/CD pipeline: тесты на push и PR
- [ ] Coverage thresholds достигнуты

---

← [Назад к UX](ux-polish.md) | [Продвинутые AI →](advanced-ai.md)
