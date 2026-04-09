import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import {
  universesApi,
  charactersApi,
  locationsApi,
  chaptersApi,
  searchApi,
} from '../api';
import CommandPalette from './CommandPalette';

vi.mock('../api', () => ({
  universesApi: { getAll: vi.fn() },
  charactersApi: { getAll: vi.fn() },
  locationsApi: { getAll: vi.fn() },
  chaptersApi: { getAll: vi.fn() },
  searchApi: { quickSearch: vi.fn() },
}));

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

function wrap(ui: React.ReactElement, initialRoute = '/universes/1/characters') {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialRoute]}>
        {ui}
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('CommandPalette', () => {
  beforeEach(() => {
    vi.mocked(universesApi.getAll).mockResolvedValue([]);
    vi.mocked(charactersApi.getAll).mockResolvedValue([]);
    vi.mocked(locationsApi.getAll).mockResolvedValue([]);
    vi.mocked(chaptersApi.getAll).mockResolvedValue([]);
    vi.mocked(searchApi.quickSearch).mockResolvedValue({
      total: 0,
      characters: [],
      locations: [],
      chapters: [],
    });
  });

  it('renders nothing when closed', () => {
    wrap(<CommandPalette isOpen={false} />);
    expect(screen.queryByPlaceholderText(/Поиск команд/i)).not.toBeInTheDocument();
  });

  it('shows input and commands when open', async () => {
    wrap(<CommandPalette isOpen onClose={() => {}} />);
    expect(screen.getByPlaceholderText(/Поиск команд/i)).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText(/Все вселенные/i)).toBeInTheDocument();
    });
  });

  it('shows "Ничего не найдено" when search returns empty', async () => {
    vi.mocked(searchApi.quickSearch).mockResolvedValue({
      total: 0,
      characters: [],
      locations: [],
      chapters: [],
    });
    wrap(<CommandPalette isOpen onClose={() => {}} />);
    const input = screen.getByPlaceholderText(/Поиск команд/i);
    fireEvent.change(input, { target: { value: 'xy' } });
    await waitFor(() => {
      expect(screen.getByText('Ничего не найдено')).toBeInTheDocument();
    });
  });
});
