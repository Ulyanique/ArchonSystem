import type { SearchResponse } from '../types';
import { api } from './client';

export const searchApi = {
  search: (universeId: number, query: string, limit?: number): Promise<SearchResponse> =>
    api.get(`/universes/${universeId}/search`, { params: { q: query, limit } }).then((r) => r.data),
  quickSearch: (universeId: number, query: string): Promise<SearchResponse> =>
    api.get(`/universes/${universeId}/search/quick`, { params: { q: query } }).then((r) => r.data),
};
