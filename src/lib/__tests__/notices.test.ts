import { describe, expect, it } from 'vitest';
import { createDeduper, groupChannels } from '../notices';

describe('notices', () => {
  it('те саме повідомлення — один раз', () => {
    const fresh = createDeduper(2);
    expect([fresh('a'), fresh('a'), fresh('b'), fresh('c'), fresh('a')]).toEqual([true, false, true, true, true]);
    expect(fresh('')).toBe(false);
  });

  it('канали групами в порядку CC', () => {
    const g = groupChannels([{ kind: 'gmail' }, { kind: 'viber' }, { kind: 'telegram' }, { kind: 'viber' }, { kind: 'new' }]);
    expect(g.map(([k, items]) => [k, items.length])).toEqual([['telegram', 1], ['viber', 2], ['gmail', 1], ['new', 1]]);
  });
});
