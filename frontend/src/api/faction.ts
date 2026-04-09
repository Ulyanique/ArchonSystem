import { api } from './client';

export const factionApi = {
  getAll: (universeId: number) => api.get(`/universes/${universeId}/factions`).then((r) => r.data),
  create: (universeId: number, data: unknown) => api.post(`/universes/${universeId}/factions`, data).then((r) => r.data),
  update: (universeId: number, id: number, data: unknown) =>
    api.put(`/universes/${universeId}/factions/${id}`, data).then((r) => r.data),
  delete: (universeId: number, id: number) => api.delete(`/universes/${universeId}/factions/${id}`).then((r) => r.data),
};
