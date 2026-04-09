import { create } from 'zustand';
import type { UserRole } from '../utils/chatHistory';

export interface ChatGenerationState {
  universeId: number | null;
  characterId: number | undefined;
  userRole: UserRole | undefined;
  chatTimeKey: string | null;
  content: string;
  isLoading: boolean;
}

interface ChatGenerationStore extends ChatGenerationState {
  start: (params: {
    universeId: number;
    characterId: number | undefined;
    userRole: UserRole | undefined;
    chatTimeKey: string;
  }) => void;
  appendContent: (chunk: string) => void;
  finish: () => void;
  clear: () => void;
}

const initialState: ChatGenerationState = {
  universeId: null,
  characterId: undefined,
  userRole: undefined,
  chatTimeKey: null,
  content: '',
  isLoading: false,
};

export const useChatGenerationStore = create<ChatGenerationStore>((set) => ({
  ...initialState,

  start: (params) =>
    set({
      universeId: params.universeId,
      characterId: params.characterId,
      userRole: params.userRole,
      chatTimeKey: params.chatTimeKey,
      content: '',
      isLoading: true,
    }),

  appendContent: (chunk) =>
    set((s) => (s.isLoading ? { content: s.content + chunk } : s)),

  finish: () => set(initialState),

  clear: () => set(initialState),
}));

/** Проверка, что активная генерация относится к текущему контексту чата */
export function isGenerationForContext(
  state: ChatGenerationState,
  universeId: number,
  characterId: number | undefined,
  userRole: UserRole | undefined,
  chatTimeKey: string
): boolean {
  return (
    state.isLoading &&
    state.universeId === universeId &&
    state.characterId === characterId &&
    state.userRole === userRole &&
    state.chatTimeKey === chatTimeKey
  );
}
