import { describe, expect, it } from 'vitest';
import { soundFor } from '../sounds';

describe('soundFor', () => {
  const prefs = { enabled: true, channels: { a: '7', b: 'off', c: 'junk' } };
  it('звук каналу, вимкнений канал, стандартний', () => {
    expect(soundFor(prefs, 'a')).toBe('/sounds/7.mp3');
    expect(soundFor(prefs, 'b')).toBeNull();
    expect(soundFor(prefs, 'c')).toBe('/notification.mp3');
    expect(soundFor(prefs, 'zzz')).toBe('/notification.mp3');
    expect(soundFor(prefs, undefined)).toBe('/notification.mp3');
  });
  it('звуки вимкнено у вебі — тихо', () => {
    expect(soundFor({ ...prefs, enabled: false }, 'a')).toBeNull();
  });
});
