/** З'єднання з CC: /ws/agent/ — готові сповіщення про нові повідомлення.
 *  Пінг кожні 45 с (Cloudflare рве тихі з'єднання за 100 с; сервер заодно перевіряє, що вхід дійсний),
 *  обрив — повтор із наростаючою паузою до 1 хв; код 4001 — вхід закінчився, повторів немає. */
export interface AgentNotice {
  type: 'message';
  id: string;
  title: string;
  subtitle: string;
  body: string;
  client_id: string;
  account_id?: string;
  url: string;
  unread: number | null;
}

export type SocketState = 'connecting' | 'online' | 'offline';

export interface SocketHandlers {
  onNotice: (n: AgentNotice) => void;
  onUnread: (n: number | null) => void;
  onState: (s: SocketState) => void;
  onLoggedOut: () => void;
}

const PING_MS = 45_000;
const MAX_DELAY_MS = 60_000;

export function wsUrl(server: string, token: string) {
  return `${server.replace(/^http/, 'ws').replace(/\/+$/, '')}/ws/agent/?agent_token=${encodeURIComponent(token)}`;
}

/** Пауза перед повтором: 2, 4, 8 … до 60 с */
export function retryDelay(attempt: number) {
  return Math.min(MAX_DELAY_MS, 2000 * 2 ** Math.max(0, attempt));
}

export function connectAgent(server: string, token: string, h: SocketHandlers, WS: typeof WebSocket = WebSocket) {
  let ws: WebSocket | null = null;
  let ping: ReturnType<typeof setInterval> | undefined;
  let retry: ReturnType<typeof setTimeout> | undefined;
  let attempt = 0;
  let stopped = false;

  const open = () => {
    h.onState('connecting');
    ws = new WS(wsUrl(server, token));
    ws.onopen = () => {
      attempt = 0;
      h.onState('online');
      ping = setInterval(() => ws?.readyState === 1 && ws.send(JSON.stringify({ type: 'ping' })), PING_MS);
    };
    ws.onmessage = ev => {
      let data: Omit<Partial<AgentNotice>, 'type'> & { type?: string };
      try { data = JSON.parse(String(ev.data)); } catch { return; }
      if (data.type === 'hello') h.onUnread(data.unread ?? null);
      else if (data.type === 'message') {
        h.onNotice(data as AgentNotice);
        if (data.unread !== undefined) h.onUnread(data.unread ?? null);
      } else if (data.type === 'logout') {
        stopped = true;
        h.onLoggedOut();
      }
    };
    ws.onclose = ev => {
      clearInterval(ping);
      ws = null;
      if (stopped) return;
      if (ev.code === 4001) {
        stopped = true;
        h.onLoggedOut();
        return;
      }
      h.onState('offline');
      retry = setTimeout(open, retryDelay(attempt++));
    };
  };
  open();

  return () => {
    stopped = true;
    clearInterval(ping);
    clearTimeout(retry);
    ws?.close();
  };
}
