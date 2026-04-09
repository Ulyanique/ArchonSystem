import type { Character, CharacterCreate, Location, LocationCreate, Note, GeneratedCharacter, GeneratedLocation, GeneratedNote } from '../types';
import { api } from './client';

export const aiGeneratorApi = {
  characters: (universeId: number, genre?: string, count?: number): Promise<GeneratedCharacter[]> =>
    api.get(`/universes/${universeId}/ai-generate/characters`, { params: { genre, count } }).then((r) => r.data),
  contextualCharacter: (universeId: number): Promise<GeneratedCharacter> =>
    api.post<GeneratedCharacter>(`/universes/${universeId}/ai-generate/characters/contextual`).then((r) => r.data),
  locations: (universeId: number, genre?: string, count?: number): Promise<GeneratedLocation[]> =>
    api.get(`/universes/${universeId}/ai-generate/locations`, { params: { genre, count } }).then((r) => r.data),
  notes: (universeId: number, genre?: string, direction?: string, count?: number): Promise<GeneratedNote[]> =>
    api.get(`/universes/${universeId}/ai-generate/notes`, { params: { genre, direction, count } }).then((r) => r.data),
  timelineEvents: (universeId: number, count?: number): Promise<unknown[]> =>
    api.get(`/universes/${universeId}/ai-generate/timeline-events`, { params: { count } }).then((r) => r.data),
  singleTimelineEvent: (universeId: number): Promise<unknown> =>
    api.post(`/universes/${universeId}/ai-generate/timeline-events/single`).then((r) => r.data),
  factions: (universeId: number, genre?: string, count?: number): Promise<unknown[]> =>
    api.get(`/universes/${universeId}/ai-generate/factions`, { params: { genre, count } }).then((r) => r.data),
  singleFaction: (universeId: number): Promise<unknown> =>
    api.post(`/universes/${universeId}/ai-generate/factions/single`).then((r) => r.data),
  applyCharacter: (universeId: number, character: CharacterCreate) =>
    api.post<Character>(`/universes/${universeId}/ai-generate/characters/apply`, { character }).then((r) => r.data),
  applyLocation: (universeId: number, location: LocationCreate) =>
    api.post<Location>(`/universes/${universeId}/ai-generate/locations/apply`, { location }).then((r) => r.data),
  applyNote: (universeId: number, note: { title: string; content?: string; note_type?: string }) =>
    api.post<Note>(`/universes/${universeId}/ai-generate/notes/apply`, { note }).then((r) => r.data),
  plotTwist: (universeId: number, context?: string) =>
    api.post(`/universes/${universeId}/ai-generate/plot-twist`, { context }).then((r) => r.data),
  chapterSummary: (universeId: number, chapterNumber: number, previousSummary?: string) =>
    api
      .post(`/universes/${universeId}/ai-generate/chapter-summary/${chapterNumber}`, {
        previous_summary: previousSummary,
      })
      .then((r) => r.data),
  name: (universeId: number, characterType?: string) =>
    api.get(`/universes/${universeId}/ai-generate/name`, { params: { character_type: characterType } }).then((r) => r.data),
  description: (universeId: number, subject: string, context?: string, length?: string) =>
    api
      .post(`/universes/${universeId}/ai-generate/description`, null, {
        params: { subject, context, length },
      })
      .then((r) => r.data),
};
