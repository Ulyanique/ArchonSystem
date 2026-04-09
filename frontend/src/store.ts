import { create } from 'zustand';
import { Universe } from './types';

interface AppState {
  selectedUniverse: Universe | null;
  setSelectedUniverse: (book: Universe | null) => void;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  /** Свёрнутое левое меню: только иконки (как панель терминала) */
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (collapsed: boolean) => void;
  universesPageView: 'grid' | 'terminal';
  setUniversesPageView: (view: 'grid' | 'terminal') => void;
}

const STORED_UNIVERSE_KEY = 'archon-selected-universe-id';

const getStoredView = (): 'grid' | 'terminal' => {
  if (typeof window === 'undefined') return 'terminal';
  const stored = localStorage.getItem('archon-universes-view');
  return (stored === 'grid' || stored === 'terminal') ? stored : 'terminal';
};

const SIDEBAR_COLLAPSED_KEY = 'archon-sidebar-collapsed';

const getStoredSidebarCollapsed = (): boolean => {
  if (typeof window === 'undefined') return false;
  const stored = localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
  return stored === 'true';
};

/** ID выбранной вселенной из localStorage (для восстановления после перезагрузки на /settings и т.п.) */
export function getStoredUniverseId(): number | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(STORED_UNIVERSE_KEY);
  if (raw == null) return null;
  const id = parseInt(raw, 10);
  return Number.isNaN(id) ? null : id;
}

export const useAppStore = create<AppState>((set) => ({
  selectedUniverse: null,
  setSelectedUniverse: (book) => {
    if (typeof window !== 'undefined') {
      if (book?.id != null) localStorage.setItem(STORED_UNIVERSE_KEY, String(book.id));
      else localStorage.removeItem(STORED_UNIVERSE_KEY);
    }
    set({ selectedUniverse: book });
  },
  sidebarOpen: true,
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  sidebarCollapsed: getStoredSidebarCollapsed(),
  setSidebarCollapsed: (collapsed) => {
    if (typeof window !== 'undefined') localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(collapsed));
    set({ sidebarCollapsed: collapsed });
  },
  universesPageView: getStoredView(),
  setUniversesPageView: (view) => {
    localStorage.setItem('archon-universes-view', view);
    set({ universesPageView: view });
  },
}));
