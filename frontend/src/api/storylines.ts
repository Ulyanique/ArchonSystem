import type { Storyline, StorylineCreate, StorylineUpdate } from '../types';
import { api } from './client';

export const storylinesApi = {
  getAll: (universeId: number): Promise<Storyline[]> =>
    api.get(`/universes/${universeId}/storylines`).then((r) => r.data),
  getById: (universeId: number, id: number): Promise<Storyline> =>
    api.get(`/universes/${universeId}/storylines/${id}`).then((r) => r.data),
  create: (universeId: number, data: StorylineCreate): Promise<Storyline> =>
    api.post(`/universes/${universeId}/storylines`, data).then((r) => r.data),
  update: (universeId: number, id: number, data: StorylineUpdate): Promise<Storyline> =>
    api.put(`/universes/${universeId}/storylines/${id}`, data).then((r) => r.data),
  delete: (universeId: number, id: number): Promise<void> =>
    api.delete(`/universes/${universeId}/storylines/${id}`).then((r) => r.data),
};
