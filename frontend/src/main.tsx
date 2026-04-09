import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import { ErrorBoundary } from './components/ErrorBoundary'
import ThemeController from './components/ThemeController'
import ToastContainer from './components/ToastContainer'
import App from './App'
import './index.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      // При быстром переключении пунктов меню показываем кэш и не бомбим сервер
      staleTime: 90 * 1000, // 90 сек — данные считаются свежими, повторный запрос при переходе не уходит
      gcTime: 5 * 60 * 1000, // 5 мин — хранить в кэше для мгновенного отображения при возврате
    },
  },
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        {/* v7_startTransition: false — иначе с тяжёлой страницей «Книга» навигация по меню не срабатывает без перезагрузки */}
        <BrowserRouter future={{ v7_startTransition: false, v7_relativeSplatPath: true }}>
          <ThemeController />
          <App />
          <ToastContainer />
        </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  </React.StrictMode>,
)
