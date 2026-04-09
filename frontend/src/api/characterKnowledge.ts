import type { CharacterKnowledge, CharacterKnowledgeCreate, CharacterKnowledgeUpdate } from '../types';
import { api } from './client';

export const characterKnowledgeApi = {
  getAll: (universeId: number, characterId: number): Promise<CharacterKnowledge[]> =>
    api.get(`/universes/${universeId}/characters/${characterId}/knowledge`).then((r) => r.data),
  create: (universeId: number, characterId: number, data: CharacterKnowledgeCreate): Promise<CharacterKnowledge> =>
    api.post(`/universes/${universeId}/characters/${characterId}/knowledge`, data).then((r) => r.data),
  update: (universeId: number, characterId: number, id: number, data: CharacterKnowledgeUpdate): Promise<CharacterKnowledge> =>
    api.put(`/universes/${universeId}/characters/${characterId}/knowledge/${id}`, data).then((r) => r.data),
  delete: (universeId: number, characterId: number, id: number): Promise<void> =>
    api.delete(`/universes/${universeId}/characters/${characterId}/knowledge/${id}`).then((r) => r.data),
};
