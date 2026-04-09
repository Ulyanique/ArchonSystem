import type { WikiArticle, WikiArticleCreate, WikiArticleUpdate } from '../types';
import { api } from './client';

export const wikiApi = {
  getAll: (universeId: number): Promise<WikiArticle[]> => api.get(`/universes/${universeId}/wiki`).then((r) => r.data),
  getBySlug: (universeId: number, slug: string): Promise<WikiArticle> =>
    api.get(`/universes/${universeId}/wiki/slug/${encodeURIComponent(slug)}`).then((r) => r.data),
  getById: (universeId: number, id: number): Promise<WikiArticle> =>
    api.get(`/universes/${universeId}/wiki/${id}`).then((r) => r.data),
  create: (universeId: number, data: WikiArticleCreate): Promise<WikiArticle> =>
    api.post(`/universes/${universeId}/wiki`, data).then((r) => r.data),
  update: (universeId: number, id: number, data: WikiArticleUpdate): Promise<WikiArticle> =>
    api.put(`/universes/${universeId}/wiki/${id}`, data).then((r) => r.data),
  delete: (universeId: number, id: number): Promise<void> =>
    api.delete(`/universes/${universeId}/wiki/${id}`).then((r) => r.data),
  generate: (universeId: number, entityType: 'character' | 'location' | 'event', entityId: number): Promise<WikiArticle> =>
    api.post(`/universes/${universeId}/wiki/generate/${entityType}/${entityId}`).then((r) => r.data),
};
