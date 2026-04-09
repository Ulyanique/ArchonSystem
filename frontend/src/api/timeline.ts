import type { TimelineEvent, TimelineCreate, TimelineUpdate } from '../types';
import { api } from './client';

export const timelineApi = {
  getAll: (universeId: number, filterType?: string, filterId?: number): Promise<TimelineEvent[]> =>
    api.get(`/universes/${universeId}/timeline`, { params: { filter_type: filterType, filter_id: filterId } }).then((r) => r.data),
  getStats: (universeId: number): Promise<{ total: number; by_type: Record<string, number> }> =>
    api.get(`/universes/${universeId}/timeline/stats`).then((r) => r.data),
  create: (universeId: number, data: TimelineCreate): Promise<TimelineEvent> =>
    api.post(`/universes/${universeId}/timeline`, { ...data, universe_id: universeId }).then((r) => r.data),
  update: (universeId: number, id: number, data: TimelineUpdate): Promise<TimelineEvent> =>
    api.put(`/universes/${universeId}/timeline/${id}`, data).then((r) => r.data),
  delete: (universeId: number, id: number): Promise<void> =>
    api.delete(`/universes/${universeId}/timeline/${id}`).then((r) => r.data),
};
