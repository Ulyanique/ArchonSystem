import type { Note, NoteCreate } from '../types';
import { api } from './client';

export const notesApi = {
  getAll: (universeId: number) => api.get(`/universes/${universeId}/notes`).then((r) => r.data),
  getById: (universeId: number, id: number) => api.get(`/universes/${universeId}/notes/${id}`).then((r) => r.data),
  create: (universeId: number, data: NoteCreate) =>
    api.post<Note>(`/universes/${universeId}/notes`, { ...data, universe_id: universeId }).then((r) => r.data),
  update: (universeId: number, id: number, data: Partial<NoteCreate>) =>
    api.put<Note>(`/universes/${universeId}/notes/${id}`, data).then((r) => r.data),
  delete: (universeId: number, id: number) => api.delete(`/universes/${universeId}/notes/${id}`).then((r) => r.data),
  autofill: (universeId: number, noteId: number): Promise<Record<string, string>> =>
    api.post(`/universes/${universeId}/notes/${noteId}/autofill`).then((r) => r.data),
};
