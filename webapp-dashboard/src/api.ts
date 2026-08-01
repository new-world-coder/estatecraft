const API_BASE = import.meta.env.VITE_API_URL || '';

export function apiUrl(path: string): string {
  if (API_BASE) return `${API_BASE.replace(/\/$/, '')}${path}`;
  return path;
}

export async function apiFetch(
  path: string,
  options: RequestInit = {},
  token?: string | null
): Promise<Response> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  return fetch(apiUrl(path), { ...options, headers });
}
