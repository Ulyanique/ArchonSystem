import type { OutlineGenerateResponse, OutlineItem, GeneratedOutlineItem } from '../types';
import { api } from './client';

export const outlineApi = {
  getAll: (universeId: number): Promise<OutlineItem[]> => api.get(`/universes/${universeId}/outline`).then((r) => r.data),
  create: (universeId: number, data: { title: string; summary?: string; outline_type?: string; sort_order?: number; chapter_id?: number | null }): Promise<OutlineItem> =>
    api.post(`/universes/${universeId}/outline`, data).then((r) => r.data),
  update: (universeId: number, id: number, data: Partial<{ title: string; summary: string; outline_type: string; sort_order: number; chapter_id: number | null; enabled: boolean }>): Promise<OutlineItem> =>
    api.put(`/universes/${universeId}/outline/${id}`, data).then((r) => r.data),
  /** Переместить пункт плана после другого (afterItemId = null — в начало). Для переноса глав между актами. */
  move: (universeId: number, itemId: number, afterItemId: number | null): Promise<OutlineItem> =>
    api.patch(`/universes/${universeId}/outline/${itemId}/move`, { after_item_id: afterItemId }).then((r) => r.data),
  delete: (universeId: number, id: number): Promise<void> => api.delete(`/universes/${universeId}/outline/${id}`).then((r) => r.data),
  generate: (universeId: number, params: { direction?: string; genre?: string; num_chapters?: number }): Promise<OutlineGenerateResponse> =>
    api.post(`/universes/${universeId}/outline/generate`, params).then((r) => r.data),
  apply: (universeId: number, items: GeneratedOutlineItem[], create_chapters?: boolean): Promise<void> =>
    api.post(`/universes/${universeId}/outline/apply`, { items, create_chapters: create_chapters !== false }).then((r) => r.data),
};
