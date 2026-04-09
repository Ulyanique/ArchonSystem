import type { Link, LinkCreate, LinkUpdate, LinkSuggestion, GraphNode, GraphLink } from '../types';
import { api } from './client';

export const linksApi = {
  getAll: (universeId: number): Promise<Link[]> => api.get(`/universes/${universeId}/links`).then((r) => r.data),
  getGraph: (universeId: number): Promise<{ nodes: GraphNode[]; links: GraphLink[] }> =>
    api.get(`/universes/${universeId}/links/graph`).then((r) => r.data),
  getGraphSpace: (universeId: number): Promise<{ nodes: GraphNode[]; links: GraphLink[] }> =>
    api.get(`/universes/${universeId}/links/graph/space`).then((r) => r.data),
  getConnectivity: (universeId: number): Promise<unknown> =>
    api.get(`/universes/${universeId}/links/connectivity`).then((r) => r.data),
  getTemporalConsistency: (universeId: number): Promise<unknown> =>
    api.get(`/universes/${universeId}/links/temporal-consistency`).then((r) => r.data),
  getLinkSuggestions: (universeId: number): Promise<unknown[]> =>
    api.get(`/universes/${universeId}/links/link-suggestions`).then((r) => r.data),
  getDevelopmentSuggestions: (universeId: number, connectivityData: unknown): Promise<unknown> =>
    api.post(`/universes/${universeId}/links/development-suggestions`, connectivityData).then((r) => r.data),
  saveLayout: (universeId: number, nodes: { id: string; position: { x: number; y: number } }[]): Promise<void> =>
    api.put(`/universes/${universeId}/links/layout`, { nodes }).then((r) => r.data),
  getSuggestions: (universeId: number, elementType: string, elementId: number): Promise<LinkSuggestion[]> =>
    api.get(`/universes/${universeId}/links/suggestions/${elementType}/${elementId}`).then((r) => r.data),
  create: (universeId: number, data: LinkCreate): Promise<Link> =>
    api.post(`/universes/${universeId}/links`, { ...data, universe_id: universeId }).then((r) => r.data),
  update: (universeId: number, id: number, data: LinkUpdate): Promise<Link> =>
    api.put(`/universes/${universeId}/links/${id}`, data).then((r) => r.data),
  delete: (universeId: number, id: number): Promise<void> =>
    api.delete(`/universes/${universeId}/links/${id}`).then((r) => r.data),
};
