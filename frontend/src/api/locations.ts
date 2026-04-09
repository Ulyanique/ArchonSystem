import type { Location, LocationCreate } from '../types';
import { api } from './client';

export const locationsApi = {
  getAll: (universeId: number): Promise<Location[]> => api.get(`/universes/${universeId}/locations`).then((r) => r.data),
  getById: (universeId: number, id: number): Promise<Location> => api.get(`/universes/${universeId}/locations/${id}`).then((r) => r.data),
  create: (universeId: number, data: LocationCreate) =>
    api.post<Location>(`/universes/${universeId}/locations`, { ...data, universe_id: universeId }).then((r) => r.data),
  update: (universeId: number, id: number, data: Partial<LocationCreate>) =>
    api.put<Location>(`/universes/${universeId}/locations/${id}`, data).then((r) => r.data),
  delete: (universeId: number, id: number) => api.delete(`/universes/${universeId}/locations/${id}`).then((r) => r.data),
  autofill: (universeId: number, locationId: number): Promise<Record<string, string>> =>
    api.post(`/universes/${universeId}/locations/${locationId}/autofill`).then((r) => r.data),
  uploadImage: (universeId: number, locationId: number, file: File): Promise<Location> => {
    const form = new FormData();
    form.append('file', file);
    return api.post<Location>(`/universes/${universeId}/locations/${locationId}/image`, form, { headers: { 'Content-Type': 'multipart/form-data' } }).then((r) => r.data);
  },
  deleteImage: (universeId: number, locationId: number): Promise<Location> =>
    api.delete<Location>(`/universes/${universeId}/locations/${locationId}/image`).then((r) => r.data),
  generateImage: (universeId: number, locationId: number, prompt?: string): Promise<Location> => {
    const form = new FormData();
    if (prompt != null) form.append('prompt', prompt);
    return api.post<Location>(`/universes/${universeId}/locations/${locationId}/image/generate`, form, { headers: { 'Content-Type': 'multipart/form-data' } }).then((r) => r.data);
  },
};
