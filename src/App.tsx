import { useEffect, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { enable as enableAutostart } from '@tauri-apps/plugin-autostart';
import { api, ApiError, configureApi, type Me } from './lib/api';
import { createDeduper } from './lib/notices';
import { DEFAULT_SOUND_PREFS, soundFor, type SoundPrefs } from './lib/sounds';
import { connectAgent, type SocketState } from './lib/socket';
import { DEFAULTS, loadSettings, saveSettings, type Settings } from './lib/store';
import { startAutoUpdate } from './lib/updater';
import { LoginScreen } from './components/LoginScreen';
import { MainScreen } from './components/MainScreen';

export function App() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [state, setState] = useState<SocketState>('connecting');
  const [unread, setUnread] = useState<number | null>(null);
  // Звуки — налаштування людини у вебі; тут лише читаємо (і вмикаємо/вимикаємо загалом)
  const [sounds, setSounds] = useState<SoundPrefs>(DEFAULT_SOUND_PREFS);
  const soundsRef = useRef<SoundPrefs>(DEFAULT_SOUND_PREFS);
  const fresh = useRef(createDeduper());

  useEffect(() => {
    loadSettings().then(s => {
      configureApi(s.server, s.token);
      setSettings(s);
    });
    return startAutoUpdate();
  }, []);

  const patch = (p: Partial<Settings>) => {
    setSettings(s => (s ? { ...s, ...p } : s));
    void saveSettings(p);
  };

  const signedOut = async (notice?: string) => {
    configureApi(settings?.server || DEFAULTS.server, null);
    patch({ token: null, userName: null, expiresAt: null });
    setUnread(null);
    void invoke('set_tray_state', { unread: 0, offline: true });
    if (notice) {
      void invoke('notify', { title: 'UNIQO Сповіщення', subtitle: notice, body: 'Увійдіть знову через Telegram-бота', url: '', sound: false });
      void invoke('show_window');
    }
  };

  // Вхід дійсний? Ім'я й термін — з сервера (могли відкликати, поки програма не працювала)
  const token = settings?.token ?? null;
  useEffect(() => {
    if (!token) return;
    api.me().then(me => patch({ userName: me.user.name, expiresAt: me.expires_at }))
      .catch(e => { if (e instanceof ApiError && e.status === 401) void signedOut('Вхід закінчився'); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const applySounds = (p: SoundPrefs) => { soundsRef.current = p; setSounds(p); };
  useEffect(() => {
    if (!token) return;
    const load = () => api.sounds().then(applySounds).catch(() => {});
    void load();
    const t = setInterval(load, 60_000);  // змінили звук у вебі — підхопимо за хвилину
    return () => clearInterval(t);
  }, [token]);

  // З'єднання й сповіщення
  useEffect(() => {
    if (!token || !settings) return;
    return connectAgent(settings.server, token, {
      onState: s => {
        setState(s);
        if (s === 'offline') void invoke('set_tray_state', { unread: 0, offline: true });
      },
      onUnread: n => {
        setUnread(n);
        void invoke('set_tray_state', { unread: n ?? 0, offline: false });
      },
      onNotice: n => {
        if (!fresh.current(n.id)) return;
        const src = soundFor(soundsRef.current, n.account_id);
        const toast = (systemSound: boolean) =>
          invoke('notify', { title: n.title, subtitle: n.subtitle, body: n.body, url: n.url, sound: systemSound });
        if (!src) { void toast(false); return; }
        // Звук каналу як у вебі; не вдалося зіграти — хоч системний звук сповіщення
        new Audio(src).play().then(() => toast(false), () => toast(true));
      },
      onLoggedOut: () => { void signedOut('Вхід закінчився або його відкликали'); },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, settings?.server]);

  if (!settings) return null;

  if (!settings.token) {
    return (
      <LoginScreen onLogin={(t: string, me: Me) => {
        configureApi(settings.server, t);
        patch({ token: t, userName: me.user.name, expiresAt: me.expires_at });
        setUnread(me.unread);
        // Сповіщення мають іти й після перезавантаження ПК
        enableAutostart().catch(() => {});
      }} />
    );
  }

  return (
    <MainScreen
      userName={settings.userName || ''}
      expiresAt={settings.expiresAt}
      state={state}
      unread={unread}
      server={settings.server}
      sound={sounds.enabled}
      onSound={on => {
        applySounds({ ...soundsRef.current, enabled: on });
        api.setSoundsEnabled(on).then(applySounds).catch(() => applySounds({ ...soundsRef.current, enabled: !on }));
      }}
      onLogout={() => { api.logout().catch(() => {}).finally(() => { void signedOut(); }); }}
    />
  );
}
