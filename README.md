# UNIQO Сповіщення

Маленька програма в треї Windows: системні сповіщення про нові повідомлення клієнтів у UNIQO.
Клік по сповіщенню відкриває чат клієнта в браузері.

- Вхід — QR-кодом через Telegram-бот (кнопка «Увійти»), діє 14 днів.
- Канали — той самий вибір, що «Канали» вгорі списку чатів (синхронізується в обидва боки).

## Розробка

```bash
npm install
npm test
VITE_SERVER_URL=https://<сервер> npm run tauri dev
```

Реліз: підняти версію в `package.json`, `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml` → тег `vX.Y.Z`.
GitHub Actions збирає NSIS-інсталятор і `latest.json` для автооновлення.
Секрети репозиторію: `TAURI_SIGNING_PRIVATE_KEY` (підпис оновлень), `AGENT_SERVER_URL` (адреса сервера).
