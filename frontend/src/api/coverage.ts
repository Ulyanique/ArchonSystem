import { api } from './client';

export type EntityType = 'character' | 'location' | 'technology' | 'artifact' | 'faction';

export interface CoverageChapter {
  id: number;
  title: string;
  chapter_number: number;
  mention_counts: Record<EntityType, number>;
  mentions: { entity_type: string; entity_id: number }[];
}

export interface EntityWithChapters {
  id: number;
  name: string;
  chapter_ids: number[];
}

export interface CoverageStats {
  chapters: CoverageChapter[];
  by_entity: Record<EntityType, EntityWithChapters[]>;
  unused: Record<EntityType, number[]>;
}

export const coverageApi = {
  getStats: (universeId: number): Promise<CoverageStats> =>
    api.get(`/universes/${universeId}/coverage`).then((r) => r.data),

  getChapterMentions: (universeId: number, chapterId: number): Promise<{ entity_type: string; entity_id: number }[]> =>
    api.get(`/universes/${universeId}/coverage/chapters/${chapterId}/mentions`).then((r) => r.data),

  addMention: (universeId: number, chapterId: number, entityType: EntityType, entityId: number): Promise<unknown> =>
    api.post(`/universes/${universeId}/coverage/chapters/${chapterId}/mentions`, {
      entity_type: entityType,
      entity_id: entityId,
    }),

  removeMention: (
    universeId: number,
    chapterId: number,
    entityType: string,
    entityId: number
  ): Promise<unknown> =>
    api.delete(
      `/universes/${universeId}/coverage/chapters/${chapterId}/mentions/${entityType}/${entityId}`
    ),
};
