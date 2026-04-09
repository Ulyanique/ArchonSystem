# Компоненты

Компоненты расположены в `frontend/src/components/`. Они переиспользуются между страницами.

## Основные компоненты

| Компонент | Файл | Строк | Описание |
|-----------|------|------:|----------|
| Layout | `Layout.tsx` | 460 | Основной лейаут: сайдбар, навигация, header |
| KnowledgeGraph | `KnowledgeGraph.tsx` | 138 | Граф знаний (React Flow) |
| CommandPalette | `CommandPalette.tsx` | 424 | Палитра команд (Ctrl+K) |
| AICriticPanel | `AICriticPanel.tsx` | 341 | Панель AI-анализа |
| AIGenerateButton | `AIGenerateButton.tsx` | 183 | Кнопка AI-генерации |
| JobsPanel | `JobsPanel.tsx` | 578 | Панель фоновых задач |
| BackgroundAudioPlayer | `BackgroundAudioPlayer.tsx` | 328 | Фоновая музыка вселенной |
| UniverseClock | `UniverseClock.tsx` | 107 | Часы вселенной |
| PromptSettingsEditor | `PromptSettingsEditor.tsx` | 270 | Редактор промптов |
| RAGContextDisplay | `RAGContextDisplay.tsx` | 65 | Отображение RAG-контекста |
| SlashCommandMenu | `SlashCommandMenu.tsx` | 99 | Меню slash-команд |
| ContentWithInlineComments | `ContentWithInlineComments.tsx` | 181 | Текст с инлайн-комментариями |
| ErrorBoundary | `ErrorBoundary.tsx` | 88 | Catch-all обработка ошибок |
| ToastContainer | `ToastContainer.tsx` | 72 | Контейнер уведомлений |
| ThemeController | `ThemeController.tsx` | 24 | Управление темой |
| QuoteCard | `QuoteCard.tsx` | 73 | Карточка цитаты |
| EmptyState | `EmptyState.tsx` | 53 | Заглушка пустого состояния |
| LoadingSkeleton | `LoadingSkeleton.tsx` | 52 | Скелетон загрузки |

## Компоненты персонажей (`characters/`)

| Компонент | Файл | Строк | Описание |
|-----------|------|------:|----------|
| CharacterForm | `CharacterForm.tsx` | 589 | Форма персонажа (P2 — разбить) |
| CharacterFormFields | `CharacterFormFields.tsx` | 110 | Поля формы |
| CharacterCard | `CharacterCard.tsx` | 153 | Карточка персонажа |
| CharacterPortrait | `CharacterPortrait.tsx` | 94 | Портрет с загрузкой |
| CharacterQuotesTab | `CharacterQuotesTab.tsx` | 63 | Вкладка цитат |

## Компоненты чата (`chat/`)

| Компонент | Файл | Строк | Описание |
|-----------|------|------:|----------|
| ChatMessageItem | `ChatMessageItem.tsx` | 261 | Отдельное сообщение |
| ChatHeader | `ChatHeader.tsx` | 240 | Шапка чата |
| TimePickerModal | `TimePickerModal.tsx` | 208 | Выбор времени в диалоге |
| ChatMessageList | `ChatMessageList.tsx` | 168 | Список сообщений |
| ChatSettings | `ChatSettings.tsx` | 167 | Настройки чата |
| ChatInput | `ChatInput.tsx` | 108 | Поле ввода |
| ChatSidebar | `ChatSidebar.tsx` | 49 | Боковая панель |

## Приоритеты рефакторинга компонентов

### P2 — Требуют разделения
- **JobsPanel.tsx** (578) → извлечь JobItem, ProgressBar, ErrorDisplay
- **Layout.tsx** (460) → извлечь Sidebar, Header, Navigation
- **CommandPalette.tsx** (424) → умеренный, можно разбить
- **CharacterForm.tsx** (589) → разбить на секции (basic, traits, relationships)

### OK — Не требуют разделения
Компоненты <300 строк имеют достаточный размер и не нуждаются в разделении.

---

← [Назад к страницам](pages.md) | [API-клиент →](api-client.md)
