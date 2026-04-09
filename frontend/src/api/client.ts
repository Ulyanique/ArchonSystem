import axios from 'axios';

export const API_BASE_URL = '/api';

/** Вызывается при сетевой ошибке (нет ответа от сервера). Приложение может подписаться и показать тост. */
let onNetworkError: ((message: string) => void) | null = null;
export function setOnNetworkError(fn: ((message: string) => void) | null): void {
  onNetworkError = fn;
}

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const payload: Record<string, unknown> = {
      url: error.config?.url,
      method: error.config?.method,
      status: error.response?.status,
      data: error.response?.data,
    };
    if (!error.response) {
      payload.message = error.message;
      payload.code = error.code;
      const hint =
        'Нет связи с сервером. Проверьте, что бэкенд запущен (например, start.ps1).';
      payload.hint = hint;
      if (onNetworkError) onNetworkError(hint);
    }
    console.error('API Error:', payload);
    const detail = error.response?.data?.detail;
    if (detail != null) {
      const detailStr = typeof detail === 'string' ? detail : JSON.stringify(detail);
      console.error('API Error detail:', detailStr);
    }
    return Promise.reject(error);
  }
);

/**
 * Выполнить fetch к API (для streaming и других случаев, где нужен ReadableStream).
 * Base URL и в будущем заголовки авторизации задаются в одном месте.
 */
export function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const url = path.startsWith('http') ? path : `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
  return fetch(url, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });
}

/** URL для отображения загруженного файла (обложка, портрет) */
export function uploadsUrl(relativePath: string | null | undefined): string | null {
  if (!relativePath) return null;
  const cleanPath = relativePath.startsWith('/') ? relativePath.slice(1) : relativePath;
  const normalizedPath = cleanPath.startsWith('api/files/') ? cleanPath.slice(10) : cleanPath;
  return `${API_BASE_URL}/files/${normalizedPath}`;
}
