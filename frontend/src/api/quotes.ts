import type { Quote, QuoteCreate, QuoteUpdate } from '../types';
import { api } from './client';

export const quotesApi = {
  getAll: (universeId: number, characterId?: number): Promise<Quote[]> => {
    const params = characterId ? { character_id: characterId } : {};
    return api.get(`/universes/${universeId}/quotes`, { params }).then((r) => r.data);
  },
  getById: (universeId: number, id: number): Promise<Quote> =>
    api.get(`/universes/${universeId}/quotes/${id}`).then((r) => r.data),
  getByCharacter: (universeId: number, characterId: number): Promise<Quote[]> =>
    api.get(`/universes/${universeId}/quotes/characters/${characterId}/quotes`).then((r) => r.data),
  create: (universeId: number, data: QuoteCreate) =>
    api.post<Quote>(`/universes/${universeId}/quotes`, data).then((r) => r.data),
  update: (universeId: number, id: number, data: QuoteUpdate) =>
    api.put<Quote>(`/universes/${universeId}/quotes/${id}`, data).then((r) => r.data),
  delete: (universeId: number, id: number) =>
    api.delete(`/universes/${universeId}/quotes/${id}`).then((r) => r.data),
};
