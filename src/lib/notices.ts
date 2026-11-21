/** Те саме повідомлення не показуємо двічі (повтор після перепідключення, дубль події) */
export function createDeduper(limit = 200) {
  const seen: string[] = [];
  const set = new Set<string>();
  return (id: string): boolean => {
    if (!id || set.has(id)) return false;
    set.add(id);
    seen.push(id);
    if (seen.length > limit) set.delete(seen.shift()!);
    return true;
  };
}

/** Канали групами за видом, у порядку як у CC */
export const KIND_ORDER = ['telegram', 'whatsapp', 'viber', 'telegram_bot', 'messenger', 'instagram', 'gmail', 'sip'];
export const KIND_LABEL: Record<string, string> = {
  telegram: 'Telegram', whatsapp: 'WhatsApp', viber: 'Viber', telegram_bot: 'Боти', messenger: 'Messenger',
  instagram: 'Instagram', gmail: 'Пошта', sip: 'Телефонія', sms: 'SMS',
};

export function groupChannels<T extends { kind: string }>(channels: T[]): [string, T[]][] {
  const map = new Map<string, T[]>();
  for (const c of channels) map.set(c.kind, [...(map.get(c.kind) ?? []), c]);
  const rank = (k: string) => (KIND_ORDER.indexOf(k) + 1 || 99);
  return [...map.entries()].sort(([a], [b]) => rank(a) - rank(b));
}
