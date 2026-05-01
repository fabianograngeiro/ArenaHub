export type AppRole = 'superadmin' | 'admin';

export interface AppUser {
  id: string;
  name: string;
  email: string;
  role: AppRole;
  createdAt: string;
}

const TOKEN_KEY = 'arenahub_token';
const API_BASE_URL = String(import.meta.env.VITE_API_URL || '').replace(/\/+$/, '');

function withApiBase(path: string): string {
  if (/^https?:\/\//.test(path)) return path;
  if (!API_BASE_URL) return path;
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE_URL}${normalized}`;
}

function token(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

function setToken(value: string) {
  localStorage.setItem(TOKEN_KEY, value);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

async function request(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers || {});
  if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json');

  const t = token();
  if (t) headers.set('Authorization', `Bearer ${t}`);

  const response = await fetch(withApiBase(path), { ...init, headers });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.error || `Request failed (${response.status})`);
  }
  return payload;
}

export async function getSetupStatus(): Promise<{ needsSetup: boolean }> {
  return request('/api/setup/status', { method: 'GET' });
}

export async function setupSuperadmin(data: { name: string; email: string; password: string }) {
  const payload = await request('/api/setup/superadmin', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  if (payload?.token) setToken(payload.token);
  return payload as { token: string; user: AppUser };
}

export async function setupRestoreBackup(backup: any) {
  return request('/api/setup/restore', {
    method: 'POST',
    body: JSON.stringify({ backup }),
  });
}

export async function login(data: { email: string; password: string }) {
  const payload = await request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  if (payload?.token) setToken(payload.token);
  return payload as { token: string; user: AppUser };
}

export async function register(data: { name: string; email: string; password: string }) {
  const payload = await request('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  if (payload?.token) setToken(payload.token);
  return payload as { token: string; user: AppUser };
}

export async function me() {
  const payload = await request('/api/auth/me', { method: 'GET' });
  return payload as { user: AppUser | null };
}

export async function logout() {
  try {
    await request('/api/auth/logout', { method: 'POST' });
  } finally {
    clearToken();
  }
}

export async function listUsers() {
  const payload = await request('/api/users', { method: 'GET' });
  return payload as { users: AppUser[] };
}

export async function createUser(data: { name: string; email: string; password: string; role: AppRole }) {
  const payload = await request('/api/users', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return payload as { user: AppUser };
}

export async function deleteUser(id: string) {
  return request(`/api/users/${id}`, { method: 'DELETE' });
}

export async function getBackup() {
  const payload = await request('/api/backup', { method: 'GET' });
  return payload as { backup: any };
}

export async function restoreBackup(backup: any) {
  return request('/api/backup/restore', {
    method: 'POST',
    body: JSON.stringify({ backup }),
  });
}

export async function resetAppToFactory() {
  return request('/api/system/reset', {
    method: 'POST',
  });
}
