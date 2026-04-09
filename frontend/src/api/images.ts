import { api } from './client';

export const imagesApi = {
  transform: (universeId: number, prompt: string, image: File): Promise<Blob> => {
    const form = new FormData();
    form.append('prompt', prompt);
    form.append('image', image);
    return api
      .post(`/universes/${universeId}/images/transform`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
        responseType: 'blob',
      })
      .then((r) => r.data);
  },
};
