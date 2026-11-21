import { useEffect, useMemo, useState } from 'react';
import { getVersion } from '@tauri-apps/api/app';
import { disable, enable, isEnabled } from '@tauri-apps/plugin-autostart';
import { openUrl } from '@tauri-apps/plugin-opener';
import { api, channelKey, type Channel } from '../lib/api';
import { groupChannels, KIND_LABEL } from '../lib/notices';
import type { SocketState } from '../lib/socket';

interface Props {
  userName: string;
  expiresAt: string | null;
  state: SocketState;
  unread: number | null;
  server: string;
  sound: boolean;
  onSound: (on: boolean) => void;
  onLogout: () => void;
}

const STATE_TEXT: Record<SocketState, string> = {
  online: 'Сповіщення працюють',
  connecting: 'Підключаємось…',
  offline: 'Немає зв\'язку — повторюємо',
};

export function MainScreen({ userName, expiresAt, state, unread, server, sound, onSound, onLogout }: Props) {
  const [channels, setChannels] = useState<Channel[] | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [autostart, setAutostart] = useState(false);
  const [version, setVersion] = useState('');

  const loadChannels = () => api.channels().then(r => { setChannels(r.channels); setError(''); })
    .catch(e => setError(e instanceof Error ? e.message : 'Не вдалося отримати канали'));

  useEffect(() => {
    void loadChannels();
    // Вибір каналів спільний з вебом — підтягуємо зміни, зроблені там
    const t = setInterval(() => { void loadChannels(); }, 60_000);
    isEnabled().then(setAutostart).catch(() => {});
    getVersion().then(setVersion).catch(() => {});
    return () => clearInterval(t);
  }, []);

  const groups = useMemo(() => groupChannels(channels ?? []), [channels]);
  const shown = (channels ?? []).filter(c => !c.hidden).length;

  const toggle = async (c: Channel) => {
    if (!channels || saving) return;
    const next = channels.map(x => (channelKey(x) === channelKey(c) ? { ...x, hidden: !x.hidden } : x));
    setChannels(next);
    setSaving(true);
    try {
      const r = await api.setHidden(next.filter(x => x.hidden).map(channelKey));
      setChannels(r.channels);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не вдалося зберегти');
      void loadChannels();
    } finally {
      setSaving(false);
    }
  };

  const setAuto = async (on: boolean) => {
    try { await (on ? enable() : disable()); setAutostart(on); } catch { /* лишаємо як було */ }
  };

  return (
    <div className="main">
      <header className="bar">
        <img className="logo-sm" src="/uniqo-mark.png" alt="" aria-hidden="true" />
        <div className="who">
          <div className="strong ellipsis" title={userName}>{userName}</div>
          <div className={`state state-${state}`}><span className="dot" />{STATE_TEXT[state]}</div>
        </div>
        <button type="button" className="btn-ghost" onClick={onLogout}>Вийти</button>
      </header>

      <button type="button" className="unread" onClick={() => void openUrl(`${server.replace(/\/+$/, '')}/crm/chats`)}>
        <span className="unread-num">{unread ?? '—'}</span>
        <span>непрочитаних чатів · відкрити CC</span>
      </button>

      <section className="section">
        <div className="section-head">
          <span>Канали</span>
          <span className="muted small">{channels ? `${shown} з ${channels.length}` : ''}</span>
        </div>
        <p className="muted small">Той самий вибір, що «Канали» в чатах CC: вимкнений канал не показується в списку чатів і не дає сповіщень</p>
        {error && <div className="err">{error}</div>}
        {!channels && !error && <div className="muted">Завантажуємо…</div>}
        <div className="channels">
          {groups.map(([kind, items]) => (
            <div key={kind} className="group">
              <div className="group-title">{KIND_LABEL[kind] || kind}</div>
              {items.map(c => (
                <label key={channelKey(c)} className="row">
                  <span className="row-text">
                    <span className="ellipsis">{c.label}</span>
                    {c.address && <span className="muted small ellipsis">{c.address}</span>}
                  </span>
                  <input type="checkbox" className="switch" checked={!c.hidden} disabled={saving} onChange={() => void toggle(c)} />
                </label>
              ))}
            </div>
          ))}
        </div>
      </section>

      <section className="section">
        <label className="row">
          <span className="row-text">Звук сповіщень</span>
          <input type="checkbox" className="switch" checked={sound} onChange={e => onSound(e.target.checked)} />
        </label>
        <label className="row">
          <span className="row-text">Запускати разом з Windows</span>
          <input type="checkbox" className="switch" checked={autostart} onChange={e => void setAuto(e.target.checked)} />
        </label>
      </section>

      <footer className="foot muted small">
        {expiresAt && <>Вхід діє до {new Date(expiresAt).toLocaleDateString('uk-UA')} · </>}v{version}
      </footer>
    </div>
  );
}
