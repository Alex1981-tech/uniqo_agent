import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { connectAgent, retryDelay, wsUrl, type SocketHandlers } from '../socket';

class FakeWS {
  static last: FakeWS | null = null;
  readyState = 0;
  sent: string[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((e: { data: string }) => void) | null = null;
  onclose: ((e: { code: number }) => void) | null = null;
  constructor(readonly url: string) { FakeWS.last = this; }
  send(s: string) { this.sent.push(s); }
  close() { this.onclose?.({ code: 1000 }); }
  open() { this.readyState = 1; this.onopen?.(); }
  msg(o: object) { this.onmessage?.({ data: JSON.stringify(o) }); }
}

const handlers = (): SocketHandlers & Record<string, ReturnType<typeof vi.fn>> =>
  ({ onNotice: vi.fn(), onUnread: vi.fn(), onState: vi.fn(), onLoggedOut: vi.fn() });

describe('socket', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('адреса й паузи повтору', () => {
    expect(wsUrl('https://example.com/', 't+1')).toBe('wss://example.com/ws/agent/?agent_token=t%2B1');
    expect(wsUrl('http://10.0.0.5:3000', 'x')).toBe('ws://10.0.0.5:3000/ws/agent/?agent_token=x');
    expect([0, 1, 2, 5, 9].map(retryDelay)).toEqual([2000, 4000, 8000, 60000, 60000]);
  });

  it('сповіщення, число непрочитаних, пінг і повтор після обриву', () => {
    const h = handlers();
    const stop = connectAgent('https://cc', 'tok', h, FakeWS as unknown as typeof WebSocket);
    const first = FakeWS.last!;
    first.open();
    expect(h.onState).toHaveBeenLastCalledWith('online');
    first.msg({ type: 'hello', unread: 4 });
    expect(h.onUnread).toHaveBeenLastCalledWith(4);
    first.msg({ type: 'message', id: 'tg:1', title: 'Олена', unread: 5 });
    expect(h.onNotice).toHaveBeenCalledWith(expect.objectContaining({ id: 'tg:1' }));
    expect(h.onUnread).toHaveBeenLastCalledWith(5);
    vi.advanceTimersByTime(45_000);
    expect(first.sent).toEqual(['{"type":"ping"}']);
    first.onclose?.({ code: 1006 });
    expect(h.onState).toHaveBeenLastCalledWith('offline');
    vi.advanceTimersByTime(2000);
    expect(FakeWS.last).not.toBe(first);  // нове з'єднання
    stop();
  });

  it('код 4001 — вхід закінчився, без повторів', () => {
    const h = handlers();
    connectAgent('https://cc', 'tok', h, FakeWS as unknown as typeof WebSocket);
    const ws = FakeWS.last!;
    ws.onclose?.({ code: 4001 });
    expect(h.onLoggedOut).toHaveBeenCalledOnce();
    vi.advanceTimersByTime(120_000);
    expect(FakeWS.last).toBe(ws);
  });
});
