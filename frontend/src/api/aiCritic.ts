import type { AIAnalysis } from '../types';
import { api, apiFetch } from './client';

export const aiCriticApi = {
  analyzeCharacter: (universeId: number, characterId: number, stream: boolean = true): Promise<AIAnalysis> | AsyncGenerator<string, void, unknown> => {
    if (stream) {
      return (async function* () {
        const response = await apiFetch(`/universes/${universeId}/ai/characters/${characterId}/analyze?stream=true`, { method: 'POST' });
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const reader = response.body?.getReader();
        if (!reader) throw new Error('No reader available');
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
                if (payload.complete && payload.result) return payload.result;
                if (payload.error) throw new Error(payload.error);
              } catch (e) {
                if (e instanceof SyntaxError) continue;
                throw e;
              }
            }
          }
        }
      })();
    }
    return api.post(`/universes/${universeId}/ai/characters/${characterId}/analyze?stream=false`).then((r) => r.data);
  },
  analyzeLocation: (universeId: number, locationId: number): Promise<AIAnalysis> =>
    api.post(`/universes/${universeId}/ai/locations/${locationId}/analyze`).then((r) => r.data),
  analyzeChapter: (universeId: number, chapterId: number): Promise<AIAnalysis> =>
    api.post(`/universes/${universeId}/ai/chapters/${chapterId}/analyze`).then((r) => r.data),
  /** Анализ акта (outline item id типа act) */
  analyzeAct: (universeId: number, actOutlineId: number): Promise<AIAnalysis> =>
    api.post(`/universes/${universeId}/ai/acts/${actOutlineId}/analyze`).then((r) => r.data),
  /** Анализ сцены (scene beat) */
  analyzeBeat: (universeId: number, chapterId: number, beatId: number): Promise<AIAnalysis> =>
    api.post(`/universes/${universeId}/ai/chapters/${chapterId}/beats/${beatId}/analyze`).then((r) => r.data),
  analyzeNote: (universeId: number, noteId: number): Promise<AIAnalysis> =>
    api.post(`/universes/${universeId}/ai/notes/${noteId}/analyze`).then((r) => r.data),
  analyzeConsistency: (universeId: number): Promise<AIAnalysis> =>
    api.post(`/universes/${universeId}/ai/consistency`).then((r) => r.data),
};
