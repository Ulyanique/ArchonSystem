import { api } from './client';

export const spaceApi = {
  getGalaxies: (uId: number) => api.get(`/universes/${uId}/space/galaxies`).then((r) => r.data),
  getSystems: (uId: number, gId: number) => api.get(`/universes/${uId}/space/galaxies/${gId}/systems`).then((r) => r.data),
  getBodies: (uId: number, sId: number) => api.get(`/universes/${uId}/space/systems/${sId}/bodies`).then((r) => r.data),
  createGalaxy: (uId: number, data: { name: string; description?: string; galaxy_type?: string }) =>
    api.post(`/universes/${uId}/space/galaxies`, data).then((r) => r.data),
  createSystem: (uId: number, data: { name: string; galaxy_id: number; description?: string }) =>
    api.post(`/universes/${uId}/space/systems`, data).then((r) => r.data),
  createBody: (
    uId: number,
    data: {
      name: string;
      star_system_id: number;
      description?: string;
      body_type?: string;
      map_width?: number;
      map_height?: number;
    }
  ) => api.post(`/universes/${uId}/space/bodies`, data).then((r) => r.data),
  updateBody: (uId: number, bId: number, data: unknown) =>
    api.put(`/universes/${uId}/space/bodies/${bId}`, data).then((r) => r.data),
};
