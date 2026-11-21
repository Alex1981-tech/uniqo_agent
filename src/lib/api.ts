import { fetch } from '@tauri-apps/plugin-http';

/** Помилка сервера з кодом — 401 означає «вхід закінчився» */
export class ApiError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}

let base = '';
let token: string | null = null;

export function configureApi(server: string, agentToken: string | null) {
  base = server.replace(/\/+$/, '');
  token = agentToken;
}

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers || {});
  if (token) headers.set('Authorization', `Agent ${token}`);
  if (init.body) headers.set('Content-Type', 'application/json');
  const resp = await fetch(`${base}${path}`, { ...init, headers });
  const text = await resp.text();
  let json: unknown = null;
  try { json = JSON.parse(text); } catch { /* не JSON */ }
  if (!resp.ok) {
    const data = json as { detail?: string; error?: string } | null;
    throw new ApiError(data?.detail || data?.error || `Помилка сервера (${resp.status})`, resp.status);
  }
  return json as T;
}

export interface Me { user: { id: number; username: string; name: string }; expires_at: string; unread: number | null }
export interface QrStart { url: string; token: string; secret: string; expires_in: number }
export type QrStatus = { status: 'pending' | 'scanned' | 'denied' | 'expired'; error?: string } | ({ status: 'ok'; token: string } & Me);

/** Канал зі списку «Канали» в чатах CC (той самий список і той самий вибір, що у вебі) */
export interface Channel {
  type: string;
  id: string;
  label: string;
  kind: string;
  active: boolean;
  address: string;
  hidden: boolean;
}
export const channelKey = (c: Pick<Channel, 'type' | 'id'>) => `${c.type}:${c.id}`;

import type { SoundPrefs } from './sounds';

export const api = {
  qrStart: (deviceName: string) => call<QrStart>('/api/agent/auth/qr/start/', { method: 'POST', body: JSON.stringify({ device_name: deviceName }) }),
  qrStatus: (t: string, secret: string, deviceName: string) =>
    call<QrStatus>('/api/agent/auth/qr/status/', { method: 'POST', body: JSON.stringify({ token: t, secret, device_name: deviceName }) }),
  me: () => call<Me>('/api/agent/me/'),
  logout: () => call<{ status: string }>('/api/agent/auth/logout/', { method: 'POST' }),
  channels: () => call<{ channels: Channel[]; hidden: string[] }>('/api/messenger/chat-channels/'),
  sounds: () => call<SoundPrefs>('/api/messenger/notification-sounds/'),
  setSoundsEnabled: (enabled: boolean) =>
    call<SoundPrefs>('/api/messenger/notification-sounds/', { method: 'PUT', body: JSON.stringify({ enabled }) }),
  setHidden: (hidden: string[]) =>
    call<{ channels: Channel[]; hidden: string[] }>('/api/messenger/chat-channels/', { method: 'PUT', body: JSON.stringify({ hidden }) }),
};
