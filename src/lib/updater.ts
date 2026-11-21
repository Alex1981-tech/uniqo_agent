import { check } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';

/** Тихе автооновлення: раз на годину; поставили — перезапуск (стан між запусками зберігається). */
export function startAutoUpdate(onError: (msg: string) => void = () => {}): () => void {
  const run = async () => {
    try {
      const update = await check();
      if (!update) return;
      await update.downloadAndInstall();
      await relaunch();
    } catch (e) {
      onError(e instanceof Error ? e.message : String(e));
    }
  };
  const first = setTimeout(run, 10_000);
  const every = setInterval(run, 60 * 60 * 1000);
  return () => { clearTimeout(first); clearInterval(every); };
}
