import type { ExportOptions } from '../types';

export const exportApi = {
  markdown: (universeId: number, options: ExportOptions): string => {
    const params = new URLSearchParams(options as Record<string, string>);
    return `/api/universes/${universeId}/export/markdown?${params.toString()}`;
  },
  chapter: (universeId: number, chapterId: number): string =>
    `/api/universes/${universeId}/export/markdown/chapter/${chapterId}`,
  characters: (universeId: number): string =>
    `/api/universes/${universeId}/export/markdown/characters`,
};
