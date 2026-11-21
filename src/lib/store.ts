import { load, Store } from '@tauri-apps/plugin-store';

/** Що агент пам'ятає між запусками */
export interface Settings {
  /** Адреса CC; змінюється лише для перевірки на dev */
  server: string;
  token: string | null;
  userName: string | null;
  expiresAt: string | null;
  sound: boolean;
}

export const DEFAULTS: Settings = {
  // Адреса сервера — з секрету збірки (VITE_SERVER_URL), у коді її немає
  server: import.meta.env.VITE_SERVER_URL || '',
  token: null,
  userName: null,
  expiresAt: null,
  sound: true,
};

let store: Store | null = null;
const getStore = async () => (store ??= await load('settings.json', { autoSave: true, defaults: {} }));

export async function loadSettings(): Promise<Settings> {
  const s = await getStore();
  const out: Settings = { ...DEFAULTS };
  for (const key of Object.keys(DEFAULTS) as (keyof Settings)[]) {
    const v = await s.get(key);
    if (v !== undefined && v !== null) (out as unknown as Record<string, unknown>)[key] = v;
  }
  return out;
}

export async function saveSettings(patch: Partial<Settings>): Promise<void> {
  const s = await getStore();
  for (const [k, v] of Object.entries(patch)) await s.set(k, v);
}
