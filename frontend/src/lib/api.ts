import axios from 'axios';
import type { AxiosError } from 'axios';

/**
 * Single axios instance for the whole app. The access token is kept in
 * localStorage and sent as a Bearer header; the server also sets an httpOnly
 * cookie, so either path authenticates a request.
 */

const TOKEN_KEY = 'urban-furniture-token';

export const api = axios.create({
  baseURL: '/api/v1',
  withCredentials: true,
});

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null): void {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    // An expired session drops the user back on the login screen.
    if (error.response?.status === 401 && !error.config?.url?.includes('/auth/login')) {
      setToken(null);
      if (!window.location.pathname.startsWith('/login')) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  },
);

/** Pull the server's message out of an axios error. */
export function errorMessage(error: unknown, fallback = 'Something went wrong'): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as { message?: string } | undefined;
    return data?.message ?? error.message ?? fallback;
  }
  if (error instanceof Error) return error.message;
  return fallback;
}

export interface ListParams {
  search?: string;
  page?: number;
  pageSize?: number;
  status?: string;
  archived?: 'true' | 'false' | 'all';
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
}

/** Download a file the API streams back (PDF print buttons). */
export async function downloadFile(url: string, filename: string): Promise<void> {
  const response = await api.get(url, { responseType: 'blob' });
  const href = URL.createObjectURL(response.data as Blob);
  const link = document.createElement('a');
  link.href = href;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(href);
}

/** Upload a profile or product image and return its public URL. */
export async function uploadImage(file: File): Promise<string> {
  const form = new FormData();
  form.append('file', file);
  const { data } = await api.post<{ url: string }>('/uploads', form);
  return data.url;
}
