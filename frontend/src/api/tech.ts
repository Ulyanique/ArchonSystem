import { api } from './client';

export const techApi = {
  getTechs: (uId: number) => api.get(`/universes/${uId}/technologies`).then((r) => r.data),
  getArtifacts: (uId: number) => api.get(`/universes/${uId}/artifacts`).then((r) => r.data),
  createTech: (uId: number, data: unknown) => api.post(`/universes/${uId}/technologies`, data).then((r) => r.data),
  updateTech: (uId: number, id: number, data: unknown) =>
    api.put(`/universes/${uId}/technologies/${id}`, data).then((r) => r.data),
  deleteTech: (uId: number, id: number) => api.delete(`/universes/${uId}/technologies/${id}`).then((r) => r.data),
  createArtifact: (uId: number, data: unknown) => api.post(`/universes/${uId}/artifacts`, data).then((r) => r.data),
  updateArtifact: (uId: number, id: number, data: unknown) =>
    api.put(`/universes/${uId}/artifacts/${id}`, data).then((r) => r.data),
  deleteArtifact: (uId: number, id: number) => api.delete(`/universes/${uId}/artifacts/${id}`).then((r) => r.data),
};
