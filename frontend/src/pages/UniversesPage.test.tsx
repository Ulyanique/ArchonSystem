import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { universesApi } from '../api'
import UniversesPage from './UniversesPage'

vi.mock('../api', () => ({
  universesApi: { getAll: vi.fn() },
  uploadsUrl: (path: string | null | undefined) => (path ? `/api/files/${path}` : null),
}))

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false },
  },
})

function wrap(ui: React.ReactElement) {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/universes']}>
        {ui}
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('UniversesPage', () => {
  beforeEach(() => {
    vi.mocked(universesApi.getAll).mockResolvedValue([])
  })

  it('shows heading and new book button', () => {
    wrap(<UniversesPage />)
    expect(screen.getByText(/УПРАВЛЕНИЕ/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /создать/i })).toBeInTheDocument()
  })

  it('shows error and retry when list fetch fails', async () => {
    vi.mocked(universesApi.getAll).mockRejectedValueOnce(new Error('Сеть недоступна'))
    wrap(<UniversesPage />)
    await waitFor(() => {
      expect(screen.getByText(/Ошибка загрузки/i)).toBeInTheDocument()
    })
    expect(screen.getByRole('button', { name: /Повторить/i })).toBeInTheDocument()
  })
})
