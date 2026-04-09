import { api } from './client';

export type ConceptArtAspectRatio = 'landscape' | 'portrait' | 'square';

export interface ConceptArtGenerateBody {
  title: string;
  description: string;
  category?: string;
  tags?: string;
  aspect_ratio?: ConceptArtAspectRatio;
}

export interface ConceptArtGenerateAutoBody {
  aspect_ratio?: ConceptArtAspectRatio;
}

export const conceptArtApi = {
  getAll: (universeId: number): Promise<unknown[]> => api.get(`/universes/${universeId}/concept-art`).then((r) => r.data),
  create: (universeId: number, formData: FormData): Promise<unknown> =>
    api.post(`/universes/${universeId}/concept-art`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }).then((r) => r.data),
  generate: (universeId: number, body: ConceptArtGenerateBody): Promise<unknown> =>
    api.post(`/universes/${universeId}/concept-art/generate`, body).then((r) => r.data),
  generateAuto: (universeId: number, body?: ConceptArtGenerateAutoBody): Promise<unknown> =>
    api.post(`/universes/${universeId}/concept-art/generate-auto`, body ?? {}).then((r) => r.data),
  update: (universeId: number, id: number, data: unknown): Promise<unknown> =>
    api.put(`/universes/${universeId}/concept-art/${id}`, data).then((r) => r.data),
  replaceImage: (universeId: number, artId: number, file: File): Promise<unknown> => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post(`/universes/${universeId}/concept-art/${artId}/image`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then((r) => r.data);
  },
  delete: (universeId: number, id: number): Promise<void> =>
    api.delete(`/universes/${universeId}/concept-art/${id}`).then((r) => r.data),
  reorder: (universeId: number, artIds: number[]): Promise<void> =>
    api.patch(`/universes/${universeId}/concept-art/reorder`, artIds).then((r) => r.data),
};
