import { useEffect, useRef, useState } from 'react';
import { hostname } from '@tauri-apps/plugin-os';
import { openUrl } from '@tauri-apps/plugin-opener';
import { QRCodeSVG } from 'qrcode.react';
import { api, type Me } from '../lib/api';

type St = { kind: 'loading' } | { kind: 'show'; url: string; token: string; secret: string; until: number }
  | { kind: 'scanned'; token: string; secret: string } | { kind: 'error'; text: string };

/** Вхід лише через бота: QR → у Telegram «Увійти» → агент отримує вхід на 14 днів */
export function LoginScreen({ onLogin }: { onLogin: (token: string, me: Me) => void }) {
  const [st, setSt] = useState<St>({ kind: 'loading' });
  const [now, setNow] = useState(Date.now());
  const device = useRef('Windows');
  const alive = useRef(true);

  const fresh = async () => {
    setSt({ kind: 'loading' });
    try { device.current = (await hostname()) || 'Windows'; } catch { /* лишаємо загальне */ }
    try {
      const r = await api.qrStart(device.current);
      if (alive.current) setSt({ kind: 'show', url: r.url, token: r.token, secret: r.secret, until: Date.now() + r.expires_in * 1000 });
    } catch (e) {
      if (alive.current) setSt({ kind: 'error', text: e instanceof Error ? e.message : 'Немає зв\'язку з сервером' });
    }
  };

  useEffect(() => {
    alive.current = true;
    void fresh();
    return () => { alive.current = false; };
  }, []);

  const pending = st.kind === 'show' || st.kind === 'scanned' ? st : null;
  useEffect(() => {
    if (!pending) return;
    const t = setInterval(async () => {
      setNow(Date.now());
      try {
        const r = await api.qrStatus(pending.token, pending.secret, device.current);
        if (!alive.current) return;
        if (r.status === 'ok') { clearInterval(t); onLogin(r.token, r); return; }
        if (r.status === 'scanned') setSt(s => (s.kind === 'show' ? { kind: 'scanned', token: s.token, secret: s.secret } : s));
        else if (r.status === 'denied') { clearInterval(t); setSt({ kind: 'error', text: r.error || 'Вхід скасовано в Telegram' }); }
        else if (r.status === 'expired') { clearInterval(t); void fresh(); }
      } catch { /* мережа моргнула — спробуємо наступного разу */ }
    }, 2000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending?.token]);

  return (
    <div className="login">
      <img className="logo" src="/uniqo-mark.png" alt="" aria-hidden="true" />
      <h1>UNIQO Сповіщення</h1>
      <p className="muted">Сповіщення про нові повідомлення клієнтів — без відкритого браузера</p>
      {st.kind === 'loading' && <div className="qr qr-skeleton" />}
      {st.kind === 'error' && (
        <div className="qr-box">
          <div className="err">{st.text}</div>
          <button type="button" className="btn" onClick={() => void fresh()}>Новий QR-код</button>
        </div>
      )}
      {st.kind === 'scanned' && (
        <div className="qr-box">
          <div className="check">✓</div>
          <div className="strong">Підтвердіть вхід у Telegram</div>
          <div className="muted">У боті натисніть «Увійти»</div>
        </div>
      )}
      {st.kind === 'show' && (
        <div className="qr-box">
          <div className="qr"><QRCodeSVG value={st.url} size={176} level="M" /></div>
          <ol className="steps">
            <li>Наведіть камеру телефона на код</li>
            <li>У Telegram-боті натисніть «Увійти»</li>
          </ol>
          <div className="muted small">
            Код оновиться через {Math.max(0, Math.round((st.until - now) / 1000))} с ·{' '}
            <button type="button" className="link" onClick={() => void openUrl(st.url)}>відкрити бота</button>
          </div>
        </div>
      )}
    </div>
  );
}
