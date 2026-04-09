import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';
import { universesApi } from './api';

vi.mock('axios', () => {
  const mAxios = {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    interceptors: {
      request: { use: vi.fn(), eject: vi.fn() },
      response: { use: vi.fn(), eject: vi.fn() },
    },
    create: vi.fn().mockReturnThis(),
    defaults: { baseURL: '' },
  };
  return {
    default: mAxios,
  };
});

describe('API services', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('universesApi.getAll calls /universes', async () => {
    (axios.get as any).mockResolvedValue({ data: [{ id: 1, title: 'Universe 1' }] });
    const result = await universesApi.getAll();
    expect(axios.get).toHaveBeenCalledWith('/universes');
    expect(result).toEqual([{ id: 1, title: 'Universe 1' }]);
  });

  it('universesApi.create calls POST /universes', async () => {
    const data = { title: 'New Universe' };
    (axios.post as any).mockResolvedValue({ data: { id: 2, ...data } });
    const result = await universesApi.create(data as any);
    expect(axios.post).toHaveBeenCalledWith('/universes', data);
    expect(result.id).toBe(2);
  });
});
