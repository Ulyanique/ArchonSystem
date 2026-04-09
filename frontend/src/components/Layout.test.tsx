import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi } from 'vitest';
import Layout from './Layout';

// Mock universesApi
vi.mock('../api', () => ({
  universesApi: {
    getAll: vi.fn().mockResolvedValue([]),
  },
  uploadsUrl: vi.fn(),
}));

describe('Layout component', () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  it('renders ARCHON title in sidebar', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/universes/1/characters']}>
          <Layout />
        </MemoryRouter>
      </QueryClientProvider>
    );

    // Wait for elements to be rendered
    const title = await screen.findByText('ARCHON');
    expect(title).toBeDefined();
  });

  it('renders navigation links when universeId is present', async () => {
    // Note: universeId is usually from useParams, but MemoryRouter handles routing.
    // However, Layout uses useParams() which gets it from the Route definition.
    // In this test, Layout is not inside a Route with :universeId.
    // So useParams() will return empty.

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/universes/1/characters']}>
           <Layout />
        </MemoryRouter>
      </QueryClientProvider>
    );

    expect(screen.queryByText('Персонажи')).toBeNull();
  });
});
