/** Звуки сповіщень — ті самі налаштування людини, що у вебі (/api/messenger/notification-sounds/):
 *  { enabled, channels: { [id акаунта]: '1'..'26' | 'off' } }; немає ключа — стандартний звук.
 *  Файли ті самі, що у вебі, вшиті в агент (public/sounds). */
export interface SoundPrefs { enabled: boolean; channels: Record<string, string> }

export const DEFAULT_SOUND_PREFS: SoundPrefs = { enabled: true, channels: {} };

/** Який файл грати для повідомлення з цього каналу; null — без звуку */
export function soundFor(prefs: SoundPrefs, accountId: string | undefined): string | null {
  if (!prefs.enabled) return null;
  const id = accountId ? prefs.channels[accountId] : undefined;
  if (id === 'off') return null;
  if (id && /^([1-9]|1\d|2[0-6])$/.test(id)) return `/sounds/${id}.mp3`;
  return '/notification.mp3';
}
