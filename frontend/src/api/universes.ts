import type { Universe, UniverseCreate, UniverseUpdate } from '../types';
import { api, API_BASE_URL } from './client';

export const universesApi = {
  getAll: (): Promise<Universe[]> => api.get('/universes').then((r) => r.data),
  getById: (id: number): Promise<Universe> => api.get(`/universes/${id}`).then((r) => r.data),
  create: (data: UniverseCreate) => api.post<Universe>('/universes', data).then((r) => r.data),
  update: (id: number, data: UniverseUpdate) => api.put<Universe>(`/universes/${id}`, data).then((r) => r.data),
  delete: (id: number) => api.delete(`/universes/${id}`).then((r) => r.data),
  uploadCover: (universeId: number, file: File): Promise<Universe> => {
    const form = new FormData();
    form.append('file', file);
    return api.post<Universe>(`/universes/${universeId}/cover`, form, { headers: { 'Content-Type': 'multipart/form-data' } }).then((r) => r.data);
  },
  deleteCover: (universeId: number): Promise<Universe> => api.delete<Universe>(`/universes/${universeId}/cover`).then((r) => r.data),
  getClock: (universeId: number): Promise<{ display: string; year: number; day: number; hour: number; minute: number; second: number; epoch: string }> =>
    api.get(`/universes/${universeId}/clock`).then((r) => r.data),
  getBackgroundAudio: (universeId: number): Promise<{ url: string; name: string }[]> =>
    api.get(`/universes/${universeId}/background-audio`).then((r) => r.data),

  /** Скачать бэкап вселенной (zip). */
  downloadBackup: async (universeId: number): Promise<void> => {
    const res = await fetch(`${API_BASE_URL}/universes/${universeId}/backup`, { method: 'GET' });
    if (!res.ok) throw new Error(res.statusText);
    const blob = await res.blob();
    const disposition = res.headers.get('Content-Disposition');
    const nameMatch = disposition?.match(/filename="?([^";]+)"?/);
    const filename = nameMatch ? nameMatch[1].trim() : `universe_${universeId}_backup.zip`;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  },

  /** Восстановить вселенную из zip-архива. */
  restoreBackup: (file: File, title?: string): Promise<{ universe_id: number; title: string; message: string }> => {
    const form = new FormData();
    form.append('file', file);
    if (title?.trim()) form.append('title', title.trim());
    return api.post<{ universe_id: number; title: string; message: string }>('/universes/restore', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then((r) => r.data);
  },
};
