import { useRef, useEffect, useState, useCallback } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { ChevronRight, ChevronLeft, Terminal, Loader2, CheckCircle2, XCircle, ListOrdered, Trash2, Bell, BellOff, Brain } from 'lucide-react';
import { useJobQueueStore, type LogEntry, type JobType } from '../store/jobQueue';
import { useQuery } from '@tanstack/react-query';
import { chatApi } from '../api';
import type { ChatMessage } from '../types';

const SECTION_LABELS: Record<string, string> = {
  characters: 'Персонажи',
  locations: 'Локации',
  chapters: 'Главы',
  outline: 'План',
  notes: 'Заметки',
  quotes: 'Цитаты',
  'book-view': 'Вселенная целиком (редактор книги)',
  write: 'Писать',
  'write-book': 'Написать книгу',
  develop: 'Анализ вселенной',
  wiki: 'Вики',
  timeline: 'Таймлайн',
  graph: 'Граф знаний',
  search: 'Поиск',
  coverage: 'Покрытие',
  factions: 'Фракции',
  technologies: 'Технологии',
  space: 'Пространство',
  knowledge: 'Знания персонажей',
  'concept-art': 'Концепт-арт',
  settings: 'Настройки вселенной',
  chat: 'Терминал связи',
};

function buildPageContext(pathname: string, _params: Record<string, string | undefined>): Record<string, unknown> | null {
  const match = pathname.match(/\/universes\/(\d+)\/([^/]+)(?:\/(\d+))?/);
  if (!match) return null;
  const [, , section, entityIdStr] = match;
  const ctx: Record<string, unknown> = {
    path: pathname,
    section,
    section_label: SECTION_LABELS[section] || section,
  };
  if (entityIdStr) {
    const id = parseInt(entityIdStr, 10);
    if (section === 'characters') ctx.character_id = id;
    else if (section === 'locations') ctx.location_id = id;
    else if (section === 'chapters') ctx.chapter_id = id;
    else ctx.entity_id = id;
  }
  return ctx;
}

const TYPEWRITER_SPEED_MS = 22;

/** Текст, появляющийся посимвольно (эффект печати в терминале) */
function TypewriterText({
  text,
  speedMs = TYPEWRITER_SPEED_MS,
  startDelayMs = 0,
  onComplete,
  className = '',
  cursor = true,
}: {
  text: string;
  speedMs?: number;
  startDelayMs?: number;
  onComplete?: () => void;
  className?: string;
  cursor?: boolean;
}) {
  const [visibleLength, setVisibleLength] = useState(0);
  const [started, setStarted] = useState(startDelayMs <= 0);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    if (!started) {
      const t = setTimeout(() => setStarted(true), startDelayMs);
      return () => clearTimeout(t);
    }
    if (visibleLength >= text.length) {
      onCompleteRef.current?.();
      return;
    }
    const t = setTimeout(() => setVisibleLength((n) => Math.min(n + 1, text.length)), speedMs);
    return () => clearTimeout(t);
  }, [text.length, speedMs, startDelayMs, started, visibleLength]);

  // при удлинении текста (например, запись обновилась) продолжаем печатать до новой длины
  useEffect(() => {
    if (!started || visibleLength > text.length) setVisibleLength((n) => Math.min(n, text.length));
  }, [text, started, visibleLength]);

  const visible = text.slice(0, visibleLength);
  const isComplete = visibleLength >= text.length;
  return (
    <span className={className}>
      {visible}
      {cursor && !isComplete && (
        <span className="inline-block w-2 h-4 bg-accent align-middle animate-pulse ml-0.5" style={{ animationDuration: '0.6s' }} aria-hidden />
      )}
    </span>
  );
}

function getNotificationPermission(): NotificationPermission | null {
  if (typeof window === 'undefined' || typeof Notification === 'undefined') return null;
  return Notification.permission;
}

const JOB_TYPE_LABELS: Record<JobType, string> = {
  portrait: 'Портрет',
  character: 'Персонаж',
  chapter: 'Глава',
  location: 'Локация',
  note: 'Заметка',
  other: 'Задача',
  event: 'Интерфейс',
};

function formatTime(ts: number) {
  const d = new Date(ts);
  return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms} мс`;
  const sec = (ms / 1000).toFixed(1);
  return `${sec} с`;
}

function TerminalCursor() {
  return (
    <span
      className="inline-block w-2 h-4 bg-accent align-middle terminal-cursor-blink"
      style={{ marginLeft: '1px' }}
      aria-hidden
    />
  );
}

function buildLogLineText(entry: LogEntry): string {
  const typeLabel = JOB_TYPE_LABELS[entry.type] || entry.type;
  const timeStr = formatTime(entry.ts);
  const suffix =
    entry.status === 'done'
      ? (entry.durationMs != null ? ` ${formatDuration(entry.durationMs)} ` : ' ') + 'OK'
      : entry.status === 'error' && entry.durationMs != null
        ? ` ${formatDuration(entry.durationMs)}`
        : '';
  return `${timeStr} [${typeLabel}] ${entry.label}${suffix}`;
}

function LogLine({
  entry,
  state,
  onLineComplete,
}: {
  entry: LogEntry;
  state: 'done' | 'typing' | 'waiting';
  onLineComplete: () => void;
}) {
  const [mainLineDone, setMainLineDone] = useState(false);
  const lineText = buildLogLineText(entry);
  const errorText = entry.status === 'error' ? (entry.message || 'Ошибка') : '';

  const handleMainComplete = () => {
    setMainLineDone(true);
    if (entry.status !== 'error') onLineComplete();
  };

  const handleErrorComplete = () => {
    onLineComplete();
  };

  if (state === 'done') {
    return (
      <div className="text-xs leading-relaxed text-accent group">
        <div className="flex flex-wrap items-baseline gap-x-1 gap-y-0.5">
          <span className="text-accent break-words">{lineText}</span>
        </div>
        {entry.status === 'error' && errorText && (
          <div className="text-red-400 break-words mt-0.5 pl-4">{errorText}</div>
        )}
      </div>
    );
  }

  if (state === 'waiting') {
    return (
      <div className="text-xs leading-relaxed text-accent opacity-0 select-none" aria-hidden>
        <div className="flex flex-wrap items-baseline gap-x-1 gap-y-0.5">
          <span className="break-words">{lineText}</span>
        </div>
        {entry.status === 'error' && errorText && <div className="break-words mt-0.5 pl-4">{errorText}</div>}
      </div>
    );
  }

  // state === 'typing'
  return (
    <div className="text-xs leading-relaxed text-accent group">
      <div className="flex flex-wrap items-baseline gap-x-1 gap-y-0.5">
        <TypewriterText
          text={lineText}
          speedMs={TYPEWRITER_SPEED_MS}
          onComplete={handleMainComplete}
          className="text-accent break-words"
        />
      </div>
      {entry.status === 'error' && (
        <div className="text-red-400 break-words mt-0.5 pl-4">
          {mainLineDone ? (
            <TypewriterText
              text={errorText}
              speedMs={TYPEWRITER_SPEED_MS}
              className="text-red-400"
              cursor={false}
              onComplete={handleErrorComplete}
            />
          ) : (
            <span className="opacity-0">{errorText}</span>
          )}
        </div>
      )}
    </div>
  );
}

const PROVIDERS = [
  { value: 'ollama', label: 'Ollama' },
  { value: 'deepseek', label: 'DeepSeek' },
  { value: 'openrouter', label: 'OpenRouter' },
  { value: 'routerai', label: 'RouterAI' },
];

const AI_TERMINAL_HISTORY_KEY = 'ai-terminal-history';

function getAiHistoryKey(universeId: number): string {
  return `${AI_TERMINAL_HISTORY_KEY}:${universeId}`;
}

function loadAiHistory(universeId: number | null): ChatMessage[] {
  if (universeId == null) return [];
  try {
    const raw = localStorage.getItem(getAiHistoryKey(universeId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveAiHistory(universeId: number | null, messages: ChatMessage[]): void {
  if (universeId == null) return;
  try {
    localStorage.setItem(getAiHistoryKey(universeId), JSON.stringify(messages));
  } catch {
    // ignore
  }
}

export default function JobsPanel({ universeId = null }: { universeId?: number | null }) {
  const location = useLocation();
  const params = useParams();
  const { queue, current, log, panelCollapsed, setPanelCollapsed, clearLog, clearDoneLog, removeFromQueue } = useJobQueueStore();
  const logEndRef = useRef<HTMLDivElement>(null);
  const [notifyPermission, setNotifyPermission] = useState<NotificationPermission | null>(getNotificationPermission());
  const [typingIndex, setTypingIndex] = useState(0);
  const [panelMode, setPanelMode] = useState<'log' | 'ai'>('log');

  const pageContext = buildPageContext(location.pathname, params as Record<string, string | undefined>);

  const [aiMessages, setAiMessages] = useState<ChatMessage[]>(() => loadAiHistory(universeId ?? null));
  const [aiInput, setAiInput] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiStreamingContent, setAiStreamingContent] = useState('');
  const [aiProvider, setAiProvider] = useState(() => localStorage.getItem('chat-provider') || 'ollama');
  const [aiModel, setAiModel] = useState(() => localStorage.getItem('chat-model') || '');
  const aiMessagesEndRef = useRef<HTMLDivElement>(null);

  const { data: aiModelsList = [] } = useQuery({
    queryKey: ['chat-models', aiProvider],
    queryFn: () => chatApi.getModels(aiProvider).then((r) => r.models),
    enabled: panelMode === 'ai' && !!universeId,
  });

  useEffect(() => {
    if (aiProvider && aiModelsList.length > 0 && (!aiModel || !aiModelsList.includes(aiModel))) {
      setAiModel(aiModelsList[0]);
    }
  }, [aiProvider, aiModelsList, aiModel]);

  useEffect(() => {
    aiMessagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [aiMessages, aiStreamingContent]);

  useEffect(() => {
    setAiMessages(loadAiHistory(universeId ?? null));
  }, [universeId]);

  useEffect(() => {
    saveAiHistory(universeId ?? null, aiMessages);
  }, [universeId, aiMessages]);

  const deleteAiMessage = useCallback((index: number) => {
    setAiMessages((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const clearAiHistory = useCallback(() => {
    setAiMessages([]);
  }, []);

  const sendAiMessage = useCallback(async () => {
    if (!universeId || !aiInput.trim() || aiLoading) return;
    const userMsg: ChatMessage = { role: 'user', content: aiInput.trim() };
    setAiMessages((prev) => [...prev, userMsg]);
    setAiInput('');
    setAiLoading(true);
    setAiStreamingContent('');
    try {
      const messages: ChatMessage[] = [...aiMessages, userMsg];
      let fullReply = '';
      for await (const chunk of chatApi.sendStream(
        {
          universe_id: universeId,
          messages,
          provider: aiProvider,
          model: aiModel || undefined,
          user_role: 'author',
          options: pageContext ? { page_context: pageContext } : undefined,
        },
        undefined
      )) {
        if (typeof chunk === 'string') {
          fullReply += chunk;
          setAiStreamingContent(fullReply);
        }
      }
      setAiMessages((prev) => [...prev, { role: 'assistant', content: fullReply }]);
    } catch (e) {
      setAiMessages((prev) => [...prev, { role: 'assistant', content: 'Ошибка: ' + (e as Error).message }]);
    } finally {
      setAiStreamingContent('');
      setAiLoading(false);
    }
  }, [universeId, aiInput, aiLoading, aiMessages, aiProvider, aiModel, pageContext]);

  useEffect(() => {
    if (log.length === 0) setTypingIndex(0);
    else setTypingIndex((i) => Math.min(i, log.length));
  }, [log.length]);

  useEffect(() => {
    const el = logEndRef.current;
    if (el && typeof el.scrollIntoView === 'function') {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  }, [log.length]);

  const handleRequestNotificationPermission = () => {
    if (typeof Notification === 'undefined') return;
    Notification.requestPermission().then((p) => setNotifyPermission(p));
  };

  if (panelCollapsed) {
    return (
      <div
        className="w-10 shrink-0 flex flex-col items-center py-4 border-l border-dark-200 dark:border-dark-700 bg-white dark:bg-dark-800"
        title="Открыть терминал"
      >
        <button
          type="button"
          onClick={() => setPanelCollapsed(false)}
          className="p-2 rounded-lg hover:bg-dark-100 dark:hover:bg-dark-700 text-dark-600 dark:text-dark-400"
        >
          <ChevronLeft size={20} />
        </button>
        <div className="mt-2 flex flex-col items-center gap-1">
          <Terminal size={18} className="text-dark-400" />
          {(queue.length > 0 || current) && (
            <span className="text-xs font-medium text-primary-600 dark:text-primary-400">
              {current ? '1' : '0'}+{queue.length}
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="w-80 shrink-0 flex flex-col border-l border-dark-200 dark:border-dark-700 bg-white dark:bg-dark-800 shadow-lg">
      <div className="jobs-panel-header flex items-center justify-between px-3 py-2 border-b border-dark-200 dark:border-dark-700">
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-dark-200 dark:border-dark-600 p-0.5 bg-dark-100 dark:bg-dark-700">
            <button
              type="button"
              onClick={() => setPanelMode('log')}
              className={`flex items-center gap-1 px-2 py-1 text-xs rounded-md transition-colors ${panelMode === 'log' ? 'bg-white dark:bg-dark-600 shadow text-primary-600 dark:text-primary-400 font-medium' : 'text-dark-600 dark:text-dark-400 hover:text-dark-800'}`}
            >
              <Terminal size={14} />
              Терминал
            </button>
            {universeId != null && (
              <button
                type="button"
                onClick={() => setPanelMode('ai')}
                className={`flex items-center gap-1 px-2 py-1 text-xs rounded-md transition-colors ${panelMode === 'ai' ? 'bg-white dark:bg-dark-600 shadow text-primary-600 dark:text-primary-400 font-medium' : 'text-dark-600 dark:text-dark-400 hover:text-dark-800'}`}
              >
                <Brain size={14} />
                AI
              </button>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1">
          {panelMode === 'log' && typeof Notification !== 'undefined' && (
            <button
              type="button"
              onClick={notifyPermission === 'default' ? handleRequestNotificationPermission : undefined}
              className={`p-1.5 rounded hover:bg-dark-100 dark:hover:bg-dark-700 ${
                notifyPermission === 'granted'
                  ? 'text-green-600 dark:text-green-400'
                  : notifyPermission === 'denied'
                    ? 'text-dark-400 cursor-not-allowed'
                    : 'text-dark-500'
              }`}
              title={
                notifyPermission === 'granted'
                  ? 'Уведомления на рабочем столе включены'
                  : notifyPermission === 'denied'
                    ? 'Уведомления заблокированы в браузере'
                    : 'Включить уведомления на рабочем столе'
              }
            >
              {notifyPermission === 'denied' ? <BellOff size={16} /> : <Bell size={16} />}
            </button>
          )}
          <button
            type="button"
            onClick={() => clearDoneLog()}
            className="p-1.5 rounded hover:bg-dark-100 dark:hover:bg-dark-700 text-dark-500"
            title="Очистить только успешные"
          >
            <CheckCircle2 size={16} />
          </button>
          <button
            type="button"
            onClick={() => clearLog()}
            className="p-1.5 rounded hover:bg-dark-100 dark:hover:bg-dark-700 text-dark-500"
            title="Очистить весь лог"
          >
            <Trash2 size={16} />
          </button>
          <button
            type="button"
            onClick={() => setPanelCollapsed(true)}
            className="p-1.5 rounded hover:bg-dark-100 dark:hover:bg-dark-700 text-dark-500"
            title="Свернуть вправо"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col min-h-0">
        {panelMode === 'log' && (
          <>
            {(current || queue.length > 0) && (
              <div className="border-b border-dark-200 dark:border-dark-700 p-2 space-y-1">
                {current && (
                  <div className="flex gap-2 text-sm py-1.5 px-2 rounded bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                    <Loader2 size={14} className="animate-spin text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                    <span className="flex-1 min-w-0 break-words">{current.label}</span>
                    <span className="text-xs text-dark-500 shrink-0">выполняется</span>
                  </div>
                )}
                {queue.slice(0, 5).map((j) => (
                  <div
                    key={j.id}
                    className="flex gap-2 text-sm py-1 px-2 rounded bg-dark-50 dark:bg-dark-700/50"
                  >
                    <ListOrdered size={12} className="text-dark-400 shrink-0 mt-0.5" />
                    <span className="flex-1 min-w-0 break-words">{j.label}</span>
                    <button
                      type="button"
                      onClick={() => removeFromQueue(j.id)}
                      className="p-0.5 rounded hover:bg-dark-200 dark:hover:bg-dark-600 text-dark-400"
                      title="Убрать из очереди"
                    >
                      <XCircle size={14} />
                    </button>
                  </div>
                ))}
                {queue.length > 5 && (
                  <div className="text-xs text-dark-500 px-2">+{queue.length - 5} в очереди</div>
                )}
              </div>
            )}

            <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-[#0d1117] rounded-b-lg">
              <div className="flex-1 overflow-y-auto min-h-0 font-mono text-xs p-3 text-accent terminal-log sidebar-scrollbar">
                <div className="space-y-1 min-h-full">
                  {log.length === 0 && !current && (
                    <div className="py-4 text-white/40 text-xs">
                      <span className="text-accent">%</span> Ожидание задач...
                    </div>
                  )}
                  {log.map((entry, index) => (
                    <LogLine
                      key={entry.id}
                      entry={entry}
                      state={index < typingIndex ? 'done' : index === typingIndex ? 'typing' : 'waiting'}
                      onLineComplete={() => setTypingIndex((i) => Math.min(i + 1, log.length))}
                    />
                  ))}
                  <div className="flex items-baseline gap-1 pt-0.5" ref={logEndRef}>
                    {typingIndex >= log.length && (
                      <>
                        <span className="text-accent">%</span>
                        <TerminalCursor />
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {panelMode === 'ai' && universeId != null && (
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-[#0d1117] rounded-b-lg">
            <div className="p-2 border-b border-dark-600 flex flex-wrap gap-1.5 items-center">
              <select
                value={aiProvider}
                onChange={(e) => { setAiProvider(e.target.value); localStorage.setItem('chat-provider', e.target.value); }}
                className="bg-dark-700 border border-dark-600 text-accent text-xs rounded px-2 py-1 font-mono"
              >
                {PROVIDERS.map((p) => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
              <select
                value={aiModel}
                onChange={(e) => { setAiModel(e.target.value); localStorage.setItem('chat-model', e.target.value); }}
                className="bg-dark-700 border border-dark-600 text-accent text-xs rounded px-2 py-1 font-mono flex-1 min-w-0 max-w-[140px]"
              >
                {aiModelsList.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
              {aiMessages.length > 0 && (
                <button
                  type="button"
                  onClick={clearAiHistory}
                  className="p-1.5 rounded hover:bg-dark-600 text-white/50 hover:text-red-400"
                  title="Очистить всю историю"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
            <div className="flex-1 overflow-y-auto min-h-0 font-mono text-xs p-3 text-accent terminal-log sidebar-scrollbar flex flex-col gap-2">
              {aiMessages.length === 0 && !aiLoading && (
                <div className="py-4 text-white/40 text-xs">
                  <span className="text-accent">%</span> Помощник по книге. Введите вопрос — ответ с учётом контекста вселенной.
                </div>
              )}
              {aiMessages.map((msg, i) => (
                <div key={i} className={`group flex gap-1 ${msg.role === 'user' ? 'text-green-400' : 'text-accent'}`}>
                  <span className="text-white/50 text-[10px] shrink-0">{msg.role === 'user' ? '>&gt;' : 'AI'}</span>
                  <span className="break-words whitespace-pre-wrap flex-1 min-w-0">{msg.content}</span>
                  <button
                    type="button"
                    onClick={() => deleteAiMessage(i)}
                    className="shrink-0 p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-dark-600 text-white/50 hover:text-red-400 transition-opacity"
                    title="Удалить сообщение"
                    aria-label="Удалить сообщение"
                  >
                    <XCircle size={12} />
                  </button>
                </div>
              ))}
              {aiStreamingContent && (
                <div className="text-accent">
                  <span className="text-white/50 text-[10px]">AI</span>{' '}
                  <span className="break-words whitespace-pre-wrap">{aiStreamingContent}</span>
                  <span className="inline-block w-2 h-4 bg-accent align-middle animate-pulse ml-0.5" aria-hidden />
                </div>
              )}
              <div ref={aiMessagesEndRef} />
            </div>
            <form
              onSubmit={(e) => { e.preventDefault(); sendAiMessage(); }}
              className="p-2 border-t border-dark-600"
            >
              <div className="flex gap-1.5">
                <input
                  type="text"
                  value={aiInput}
                  onChange={(e) => setAiInput(e.target.value)}
                  placeholder="Вопрос по книге..."
                  disabled={aiLoading}
                  className="flex-1 min-w-0 bg-dark-700 border border-dark-600 text-accent placeholder-white/40 text-xs rounded px-2 py-1.5 font-mono focus:outline-none focus:ring-1 focus:ring-accent"
                />
                <button
                  type="submit"
                  disabled={aiLoading || !aiInput.trim()}
                  className="px-2 py-1.5 rounded bg-accent/20 text-accent hover:bg-accent/30 disabled:opacity-50 disabled:cursor-not-allowed text-xs font-mono"
                >
                  {aiLoading ? <Loader2 size={14} className="animate-spin" /> : '→'}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
