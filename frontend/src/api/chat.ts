import type { ChatMessage, ChatResponse } from '../types';
import { api, apiFetch } from './client';

export interface ChatTimeRequest {
  universe_year: number;
  universe_day: number;
  universe_hour?: number;
  universe_minute?: number;
}

export const chatApi = {
  send: (data: {
    universe_id: number;
    character_id?: number;
    messages: ChatMessage[];
    model?: string;
    provider?: string;
    stream?: boolean;
    chat_time?: ChatTimeRequest | null;
    other_chats_history?: Array<{ character_name: string; character_id: number; messages: ChatMessage[] }>;
    user_role?: string;
    include_note_ids?: number[];
    include_chapter_ids?: number[];
    options?: { show_prompt?: boolean; show_rag_context?: boolean };
  }): Promise<ChatResponse> => api.post(`/chat/universes/${data.universe_id}`, data).then((r) => r.data),
  getContext: (universeId: number): Promise<{ context: string }> =>
    api.get<{ context: string }>(`/chat/universes/${universeId}/context`).then((r) => r.data),
  getSmartContext: (
    universeId: number,
    messages: ChatMessage[],
    characterId?: number,
    userQuery?: string,
    userRole?: string,
    chatTime?: ChatTimeRequest | null
  ): Promise<{ context: string }> =>
    api.post<{ context: string }>(`/chat/universes/${universeId}/smart-context`, {
      messages,
      character_id: characterId,
      user_query: userQuery || '',
      user_role: userRole,
      chat_time: chatTime ?? undefined,
    }).then((r) => r.data),
  getModels: (provider?: string): Promise<{ models: string[] }> => api.get('/chat/models', { params: { provider } }).then((r) => r.data),
  getStatus: (): Promise<{ status: string; provider?: string }> => api.get('/chat/status').then((r) => r.data),
  async *sendStream(
    data: {
      universe_id: number;
      character_id?: number;
      messages: ChatMessage[];
      model?: string;
      provider?: string;
      chat_time?: ChatTimeRequest | null;
      other_chats_history?: Array<{ character_name: string; character_id: number; messages: ChatMessage[] }>;
      user_role?: string;
      include_note_ids?: number[];
      include_chapter_ids?: number[];
      options?: { show_prompt?: boolean; show_rag_context?: boolean; page_context?: Record<string, unknown> };
    },
    signal?: AbortSignal
  ): AsyncGenerator<string | { type: 'prompt'; prompt: string } | { type: 'rag_context'; rag_context: string }, void, unknown> {
    const res = await apiFetch(`/chat/universes/${data.universe_id}`, {
      method: 'POST',
      body: JSON.stringify({ ...data, stream: true }),
      signal,
    });
    if (!res.ok) {
      const error = new Error(res.statusText);
      (error as Error & { statusCode?: number; response?: { status: number; data?: unknown } }).statusCode = res.status;
      (error as Error & { response?: { status: number; data?: unknown } }).response = { status: res.status };
      try {
        const errorData = await res.json();
        (error as Error & { response?: { data?: unknown } }).response = { ...(error as Error & { response?: object }).response!, data: errorData };
        if (errorData.detail) (error as Error).message = errorData.detail;
      } catch {
        // ignore
      }
      throw error;
    }
    if (!res.body) throw new Error('Response body is empty');
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (signal?.aborted) {
        reader.cancel();
        break;
      }
      buffer += decoder.decode(value, { stream: true });
      const messages = buffer.split('\n\n');
      buffer = messages.pop() || '';
      for (const message of messages) {
        for (const line of message.split('\n')) {
          if (line.startsWith('data: ')) {
            try {
              const payload = JSON.parse(line.slice(6));
              if (payload.prompt) yield { type: 'prompt' as const, prompt: payload.prompt };
              if (payload.rag_context) yield { type: 'rag_context' as const, rag_context: payload.rag_context };
              if (payload.content) yield payload.content;
              if (payload.error) {
                const err = new Error(payload.error);
                (err as Error & { statusCode?: number; response?: object }).statusCode = payload.status_code || 500;
                (err as Error & { response?: object }).response = { status: payload.status_code || 500, data: { detail: payload.error } };
                throw err;
              }
            } catch (e) {
              if (e instanceof SyntaxError) continue;
              throw e;
            }
          }
        }
      }
    }
    if (buffer.trim()) {
      for (const line of buffer.split('\n')) {
        if (line.startsWith('data: ')) {
          try {
            const payload = JSON.parse(line.slice(6));
            if (payload.content) yield payload.content;
          } catch {
            // ignore
          }
        }
      }
    }
  },
};
