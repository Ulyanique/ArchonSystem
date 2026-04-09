import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { apiFetch, API_BASE_URL, uploadsUrl } from './client';

describe('client', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('apiFetch builds URL with API_BASE_URL for relative path', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue({ ok: true } as Response);

    await apiFetch('/universes/1');

    expect(fetchMock).toHaveBeenCalledWith(
      `${API_BASE_URL}/universes/1`,
      expect.objectContaining({
        headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
      })
    );
  });

  it('apiFetch passes method and body for POST', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue({ ok: true } as Response);

    await apiFetch('/chat/universes/1', {
      method: 'POST',
      body: JSON.stringify({ messages: [] }),
    });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ messages: [] }),
      })
    );
  });

  it('uploadsUrl returns null for empty path', () => {
    expect(uploadsUrl(null)).toBeNull();
    expect(uploadsUrl(undefined)).toBeNull();
    expect(uploadsUrl('')).toBeNull();
  });

  it('uploadsUrl normalizes path and prepends API base', () => {
    expect(uploadsUrl('universes/1/uploads/cover.jpg')).toContain('/api/files/');
    expect(uploadsUrl('universes/1/uploads/cover.jpg')).toContain('universes/1/uploads/cover.jpg');
  });
});
