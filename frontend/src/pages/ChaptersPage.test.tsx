import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import ChaptersPage from './ChaptersPage';

vi.mock('../api', () => ({
  chaptersApi: {
    getAll: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    getSuggestions: vi.fn(),
    writeStream: vi.fn(),
  },
  outlineApi: { getAll: vi.fn() },
  coverageApi: { getStats: vi.fn() },
  aiCriticApi: { analyzeChapter: vi.fn() },
}));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false },
  },
});

function wrap(ui: React.ReactElement) {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/universes/1/chapters']}>
        <Routes>
          <Route path="/universes/:universeId/chapters" element={ui} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('ChaptersPage', () => {
  beforeEach(async () => {
    const { chaptersApi, outlineApi, coverageApi } = await import('../api');
    vi.mocked(chaptersApi.getAll).mockResolvedValue([]);
    vi.mocked(outlineApi.getAll).mockResolvedValue([]);
    vi.mocked(coverageApi.getStats).mockResolvedValue({ chapters: [], characters: [], locations: [] });
  });

  it('shows heading and add button after load', async () => {
    wrap(<ChaptersPage />);
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Главы/i })).toBeInTheDocument();
    });
    const addButtons = screen.getAllByRole('button', { name: /Добавить/i });
    expect(addButtons.length).toBeGreaterThanOrEqual(1);
  });

  it('shows empty state when no chapters', async () => {
    wrap(<ChaptersPage />);
    await waitFor(() => {
      expect(screen.getByText(/Пока нет глав/i)).toBeInTheDocument();
    });
  });
});
