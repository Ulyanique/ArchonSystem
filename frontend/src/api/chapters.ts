import type { Chapter, ChapterCreate, SceneBeat, SceneBeatCreate, SceneBeatUpdate } from '../types';
import { api, apiFetch } from './client';

export const chaptersApi = {
  getAll: (universeId: number, storylineId?: number): Promise<Chapter[]> =>
    api
      .get(`/universes/${universeId}/chapters`, { params: storylineId != null ? { storyline_id: storylineId } : {} })
      .then((r) => r.data),
  getById: (universeId: number, id: number): Promise<Chapter> => api.get(`/universes/${universeId}/chapters/${id}`).then((r) => r.data),
  create: (universeId: number, data: ChapterCreate) =>
    api.post<Chapter>(`/universes/${universeId}/chapters`, { ...data, universe_id: universeId }).then((r) => r.data),
  update: (universeId: number, id: number, data: Partial<ChapterCreate>) =>
    api.put<Chapter>(`/universes/${universeId}/chapters/${id}`, data).then((r) => r.data),
  delete: (universeId: number, id: number) => api.delete(`/universes/${universeId}/chapters/${id}`).then((r) => r.data),

  getBeats: (universeId: number, chapterId: number): Promise<SceneBeat[]> =>
    api.get(`/universes/${universeId}/chapters/${chapterId}/beats`).then((r) => r.data),
  createBeat: (universeId: number, chapterId: number, data: SceneBeatCreate): Promise<SceneBeat> =>
    api.post(`/universes/${universeId}/chapters/${chapterId}/beats`, data).then((r) => r.data),
  updateBeat: (universeId: number, chapterId: number, beatId: number, data: SceneBeatUpdate): Promise<SceneBeat> =>
    api.put(`/universes/${universeId}/chapters/${chapterId}/beats/${beatId}`, data).then((r) => r.data),
  deleteBeat: (universeId: number, chapterId: number, beatId: number): Promise<void> =>
    api.delete(`/universes/${universeId}/chapters/${chapterId}/beats/${beatId}`).then((r) => r.data),
  reorderBeats: (universeId: number, chapterId: number, beatIds: number[]): Promise<void> =>
    api.patch(`/universes/${universeId}/chapters/${chapterId}/beats/reorder`, { beat_ids: beatIds }).then((r) => r.data),
  moveBeat: (
    universeId: number,
    sourceChapterId: number,
    beatId: number,
    body: { target_chapter_id: number; insert_index?: number }
  ): Promise<SceneBeat> =>
    api
      .patch(`/universes/${universeId}/chapters/${sourceChapterId}/beats/${beatId}/move`, {
        target_chapter_id: body.target_chapter_id,
        insert_index: body.insert_index ?? 0,
      })
      .then((r) => r.data),
  async *writeStream(
    universeId: number,
    chapterId: number,
    params: { mode?: string; prompt_extra?: string }
  ): AsyncGenerator<string, void, unknown> {
    const res = await apiFetch(`/universes/${universeId}/chapters/${chapterId}/ai/write`, {
      method: 'POST',
      body: JSON.stringify({ mode: params.mode || 'from_summary', prompt_extra: params.prompt_extra || null }),
    });
    if (!res.ok) {
      const error = new Error(res.statusText);
      (error as Error & { statusCode?: number }).statusCode = res.status;
      throw error;
    }
    if (!res.body) throw new Error('Response body is empty');
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const payload = JSON.parse(line.slice(6));
            if (payload.content) yield payload.content;
            if (payload.error) throw new Error(payload.error);
          } catch (e) {
            if (e instanceof SyntaxError) continue;
            throw e;
          }
        }
      }
    }
  },
  async *writeBeatStream(
    universeId: number,
    chapterId: number,
    params: { instruction?: string; text_before_cursor?: string }
  ): AsyncGenerator<string, void, unknown> {
    const res = await apiFetch(`/universes/${universeId}/chapters/${chapterId}/ai/write-beat`, {
      method: 'POST',
      body: JSON.stringify({
        instruction: params.instruction ?? '',
        text_before_cursor: params.text_before_cursor ?? undefined,
      }),
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
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const payload = JSON.parse(line.slice(6));
            if (payload.content) yield payload.content;
            if (payload.error) throw new Error(payload.error);
          } catch (e) {
            if (e instanceof SyntaxError) continue;
            throw e;
          }
        }
      }
    }
  },
  getSuggestions: (universeId: number, chapterId: number): Promise<{
    characters?: string[];
    locations?: string[];
    events?: string[];
    style_tips?: string[];
    plot_ideas?: string[];
    warnings?: string[];
    error?: string;
  }> => api.get(`/universes/${universeId}/chapters/${chapterId}/ai/suggestions`).then((r) => r.data),
};
