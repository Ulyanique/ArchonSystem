import { api, apiFetch } from './client';

export const universeViewApi = {
  getText: (universeId: number, options?: { resolveLinks?: boolean; stripAuthorNotes?: boolean }) => {
    const params: Record<string, boolean> = {};
    if (options?.resolveLinks) params.resolve_links = true;
    if (options?.stripAuthorNotes) params.strip_author_notes = true;
    return api
      .get<{
        fullText: string;
        chapters: {
          id: number;
          title: string;
          chapter_number: number;
          content: string;
          beats?: { id: number; sort_order: number; title: string; content: string }[];
        }[];
      }>(`/universes/${universeId}/book-view/text`, { params: Object.keys(params).length ? params : undefined })
      .then((r) => r.data);
  },
  expand: (universeId: number, fragment: string) =>
    api.post<{ expanded: string }>(`/universes/${universeId}/book-view/expand`, { fragment }).then((r) => r.data),
  rewrite: (
    universeId: number,
    body: { chapter_id: number; start_offset: number; end_offset: number; fragment: string }
  ) =>
    api.post<{ replacement: string }>(`/universes/${universeId}/book-view/rewrite`, body).then((r) => r.data),
  link: (
    universeId: number,
    body: { chapter_id: number; start_offset: number; end_offset: number; entity_type: string; entity_id: number }
  ) =>
    api.post<{ content: string }>(`/universes/${universeId}/book-view/link`, body).then((r) => r.data),
  generateBeat: (
    universeId: number,
    body: {
      chapter_id: number;
      beat_id?: number;
      beat_title?: string;
      beat_description?: string;
      words?: number;
      instructions?: string;
      additional_context?: string;
    }
  ) =>
    api.post<{ text: string }>(`/universes/${universeId}/book-view/generate-beat`, body).then((r) => r.data),
  generateBeatDescription: (
    universeId: number,
    body: { chapter_id: number; beat_id?: number; beat_title?: string }
  ) =>
    api.post<{ description: string }>(`/universes/${universeId}/book-view/generate-beat-description`, body).then((r) => r.data),

  /** Стриминг генерации текста бита. Возвращает async-генератор чанков; при ошибке в потоке — payload.error. */
  async *generateBeatStream(
    universeId: number,
    body: {
      chapter_id: number;
      beat_id?: number;
      beat_title?: string;
      beat_description?: string;
      words?: number;
      instructions?: string;
      additional_context?: string;
    },
    signal?: AbortSignal
  ): AsyncGenerator<string, void, unknown> {
    const res = await apiFetch(`/universes/${universeId}/book-view/generate-beat/stream`, {
      method: 'POST',
      body: JSON.stringify(body),
      signal,
    });
    if (!res.ok) {
      const err = new Error(res.statusText);
      (err as Error & { statusCode?: number }).statusCode = res.status;
      throw err;
    }
    if (!res.body) throw new Error('Response body is empty');
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (signal?.aborted) {
          reader.cancel();
          break;
        }
        buffer += decoder.decode(value, { stream: true });
        const messages = buffer.split('\n\n');
        buffer = messages.pop() ?? '';
        for (const message of messages) {
          for (const line of message.split('\n')) {
            if (line.startsWith('data: ')) {
              try {
                const payload = JSON.parse(line.slice(6)) as { content?: string; error?: string };
                if (payload.error) throw new Error(payload.error);
                if (payload.content) yield payload.content;
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
              const payload = JSON.parse(line.slice(6)) as { content?: string; error?: string };
              if (payload.error) throw new Error(payload.error);
              if (payload.content) yield payload.content;
            } catch {
              // ignore trailing partial
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  },
};
