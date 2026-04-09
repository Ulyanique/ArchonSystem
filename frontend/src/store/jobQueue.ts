import { create } from 'zustand';

export type JobType = 'portrait' | 'character' | 'chapter' | 'location' | 'note' | 'other' | 'event';

export interface QueuedJob {
  id: string;
  type: JobType;
  label: string;
  run: () => Promise<void>;
  createdAt: number;
}

export interface LogEntry {
  id: string;
  jobId: string;
  type: JobType;
  label: string;
  status: 'running' | 'done' | 'error';
  message?: string;
  ts: number;
  /** Время выполнения в мс (для done/error) */
  durationMs?: number;
}

const STORAGE_KEY = 'archon-jobs-panel-collapsed';

let idCounter = 0;
const nextId = () => `job-${Date.now()}-${++idCounter}`;

const getStoredCollapsed = (): boolean => {
  if (typeof window === 'undefined') return false;
  const v = localStorage.getItem(STORAGE_KEY);
  return v === 'true';
};

const setStoredCollapsed = (v: boolean) => {
  localStorage.setItem(STORAGE_KEY, String(v));
};

/** Показать уведомление на рабочем столе (если разрешено) */
function notifyDesktop(title: string, body: string) {
  if (typeof window === 'undefined' || typeof Notification === 'undefined') return;
  if (Notification.permission !== 'granted') return;
  try {
    const n = new Notification(title, { body });
    n.onclick = () => {
      window.focus();
      n.close();
    };
  } catch {
    // ignore
  }
}

interface JobQueueState {
  queue: QueuedJob[];
  current: QueuedJob | null;
  log: LogEntry[];
  panelCollapsed: boolean;
  setPanelCollapsed: (v: boolean) => void;
  enqueue: (job: Omit<QueuedJob, 'id' | 'createdAt'>) => void;
  addLogEntry: (entry: Omit<LogEntry, 'id' | 'ts'>) => void;
  /** Записать событие интерфейса (переход, настройки и т.д.) в лог без задачи */
  logEvent: (label: string) => void;
  clearLog: () => void;
  clearDoneLog: () => void;
  removeFromQueue: (id: string) => void;
  _processing: boolean;
  _setProcessing: (v: boolean) => void;
  _setCurrent: (j: QueuedJob | null) => void;
  _setQueue: (q: QueuedJob[]) => void;
}

export const useJobQueueStore = create<JobQueueState>((set, get) => ({
  queue: [],
  current: null,
  log: [],
  panelCollapsed: getStoredCollapsed(),
  _processing: false,

  setPanelCollapsed: (v) => {
    setStoredCollapsed(v);
    set({ panelCollapsed: v });
  },

  addLogEntry: (entry) => {
    const now = Date.now();
    set((s) => ({
      log: [
        ...s.log,
        {
          ...entry,
          id: `log-${now}-${Math.random().toString(36).slice(2, 9)}`,
          ts: now,
          durationMs: entry.durationMs,
        },
      ].slice(-200),
    }));
  },

  logEvent: (label) => {
    const now = Date.now();
    const entry: LogEntry = {
      id: `log-${now}-${Math.random().toString(36).slice(2, 9)}`,
      jobId: `event-${now}`,
      type: 'event',
      label,
      status: 'done',
      ts: now,
    };
    set((s) => ({
      log: [...s.log, entry].slice(-200),
    }));
  },

  clearLog: () => set({ log: [] }),

  /** Удалить из лога только записи со статусом done */
  clearDoneLog: () =>
    set((s) => ({ log: s.log.filter((e) => e.status !== 'done') })),

  removeFromQueue: (id) => {
    set((s) => ({ queue: s.queue.filter((j) => j.id !== id) }));
  },

  _setProcessing: (v) => set({ _processing: v }),
  _setCurrent: (j) => set({ current: j }),
  _setQueue: (q) => set({ queue: q }),

  enqueue: (job) => {
    const fullJob: QueuedJob = {
      ...job,
      id: nextId(),
      createdAt: Date.now(),
    };
    set((s) => ({ queue: [...s.queue, fullJob] }));
    processNext(get);
  },
}));

function processNext(get: () => JobQueueState) {
  const { queue, current, _processing, addLogEntry, _setQueue, _setCurrent, _setProcessing } = get();
  if (_processing || current) return;
  if (queue.length === 0) return;
  const [next, ...rest] = queue;
  _setQueue(rest);
  _setCurrent(next);
  _setProcessing(true);
  addLogEntry({ jobId: next.id, type: next.type, label: next.label, status: 'running' });
  next
    .run()
    .then(() => {
      const runEntry = get().log.find((e) => e.jobId === next.id && e.status === 'running');
      const durationMs = runEntry ? Date.now() - runEntry.ts : undefined;
      get().addLogEntry({ jobId: next.id, type: next.type, label: next.label, status: 'done', durationMs });
      notifyDesktop('Готово', next.label);
    })
    .catch((err) => {
      const message = err?.message || String(err);
      const runEntry = get().log.find((e) => e.jobId === next.id && e.status === 'running');
      const durationMs = runEntry ? Date.now() - runEntry.ts : undefined;
      get().addLogEntry({
        jobId: next.id,
        type: next.type,
        label: next.label,
        status: 'error',
        message,
        durationMs,
      });
      notifyDesktop('Ошибка', `${next.label}: ${message}`);
    })
    .finally(() => {
      get()._setCurrent(null);
      get()._setProcessing(false);
      processNext(get);
    });
}

/** Поставить задачу в очередь (генерация портрета, персонажа, главы и т.д.) */
export function enqueueJob(
  type: JobType,
  label: string,
  run: () => Promise<void>
) {
  useJobQueueStore.getState().enqueue({ type, label, run });
}

/** Записать событие интерфейса в консоль (переход, настройки и т.д.) */
export function logUiEvent(label: string) {
  useJobQueueStore.getState().logEvent(label);
}
