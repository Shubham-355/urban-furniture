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

/** Save a PDF the API streams back to the user's downloads folder. */
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

/**
 * Open the browser print dialog on a PDF the API streams back.
 *
 * The document is loaded into an offscreen iframe so printing happens in
 * place, without saving a file or leaving the page. If the iframe cannot be
 * printed (some browsers refuse to print an embedded PDF) the document is
 * opened in a new tab instead, so the user still has a way to print it.
 */
export async function printPdf(url: string): Promise<void> {
  const response = await api.get(url, { responseType: 'blob' });
  const blob = new Blob([response.data as Blob], { type: 'application/pdf' });
  const href = URL.createObjectURL(blob);

  const frame = document.createElement('iframe');
  frame.style.position = 'fixed';
  frame.style.right = '0';
  frame.style.bottom = '0';
  frame.style.width = '1px';
  frame.style.height = '1px';
  frame.style.opacity = '0';
  frame.style.border = '0';
  frame.src = href;

  let settled = false;

  const cleanup = () => {
    // The print dialog reads from the frame, so it is only torn down later.
    window.setTimeout(() => {
      frame.remove();
      URL.revokeObjectURL(href);
    }, 60_000);
  };

  const fallback = () => {
    if (settled) return;
    settled = true;
    window.open(href, '_blank', 'noopener');
    cleanup();
  };

  frame.onload = () => {
    if (settled) return;
    settled = true;
    try {
      frame.contentWindow?.focus();
      frame.contentWindow?.print();
      cleanup();
    } catch {
      settled = false;
      fallback();
    }
  };

  frame.onerror = fallback;
  // If the viewer never loads, fall back to a tab rather than doing nothing.
  window.setTimeout(fallback, 5000);

  document.body.appendChild(frame);
}

/** Upload a profile or product image and return its public URL. */
export async function uploadImage(file: File): Promise<string> {
  const form = new FormData();
  form.append('file', file);
  const { data } = await api.post<{ url: string }>('/uploads', form);
  return data.url;
}
