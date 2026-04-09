import type { Character, CharacterCreate } from '../types';
import { api } from './client';

export const charactersApi = {
  getAll: (universeId: number): Promise<Character[]> => api.get(`/universes/${universeId}/characters`).then((r) => r.data),
  getById: (universeId: number, id: number): Promise<Character> => api.get(`/universes/${universeId}/characters/${id}`).then((r) => r.data),
  create: (universeId: number, data: CharacterCreate) =>
    api.post<Character>(`/universes/${universeId}/characters`, { ...data, universe_id: universeId }).then((r) => r.data),
  update: (universeId: number, id: number, data: Partial<CharacterCreate>) =>
    api.put<Character>(`/universes/${universeId}/characters/${id}`, data).then((r) => r.data),
  delete: (universeId: number, id: number) => api.delete(`/universes/${universeId}/characters/${id}`).then((r) => r.data),
  autofill: (universeId: number, characterId: number): Promise<Record<string, string>> =>
    api.post(`/universes/${universeId}/characters/${characterId}/autofill`).then((r) => r.data),
  /** Генерация одного поля (короткий ответ, без сцен). Для полей: nationality, birth_place, gender, profession, role, birth_date, death_date. */
  generateField: (universeId: number, characterId: number, field: string): Promise<{ value: string }> =>
    api.post(`/universes/${universeId}/characters/${characterId}/generate-field`, { field }).then((r) => r.data),
  getKnowledgeStats: (
    universeId: number,
    characterId: number,
    beforeUniverseYear?: number,
    beforeUniverseDay?: number
  ): Promise<{ known_characters_count: number; known_events_count: number; before_universe_year?: number; before_universe_day?: number }> => {
    const params = new URLSearchParams();
    if (beforeUniverseYear !== undefined) params.append('before_universe_year', beforeUniverseYear.toString());
    if (beforeUniverseDay !== undefined) params.append('before_universe_day', beforeUniverseDay.toString());
    const query = params.toString();
    return api.get(`/universes/${universeId}/characters/${characterId}/knowledge-stats${query ? `?${query}` : ''}`).then((r) => r.data);
  },
  uploadPortrait: (universeId: number, characterId: number, file: File): Promise<Character> => {
    const form = new FormData();
    form.append('file', file);
    return api.post<Character>(`/universes/${universeId}/characters/${characterId}/portrait`, form, { headers: { 'Content-Type': 'multipart/form-data' } }).then((r) => r.data);
  },
  deletePortrait: (universeId: number, characterId: number): Promise<Character> =>
    api.delete<Character>(`/universes/${universeId}/characters/${characterId}/portrait`).then((r) => r.data),
  generatePortrait: (universeId: number, characterId: number, prompt?: string, sourceImage?: File): Promise<Character> => {
    const form = new FormData();
    form.append('prompt', prompt ?? '');
    if (sourceImage) form.append('source_image', sourceImage);
    return api.post<Character>(`/universes/${universeId}/characters/${characterId}/portrait/generate`, form, { headers: { 'Content-Type': 'multipart/form-data' } }).then((r) => r.data);
  },
  createContextual: (universeId: number): Promise<Character> =>
    api.post<Character>(`/universes/${universeId}/characters/contextual`).then((r) => r.data),
};
