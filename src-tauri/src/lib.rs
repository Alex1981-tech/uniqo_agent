//! UNIQO Сповіщення — агент у треї: сповіщення Windows про нові повідомлення.
//! З'єднання з сервером і вхід — у JS (src/lib/socket.ts); тут трей, сповіщення з кліком і браузер.
use tauri::{
    image::Image,
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Manager, WindowEvent,
};
use tauri_plugin_autostart::MacosLauncher;
#[cfg(windows)]
use tauri_plugin_opener::OpenerExt;

const TRAY_ID: &str = "main";
const ICON: &[u8] = include_bytes!("../icons/tray.png");
const ICON_UNREAD: &[u8] = include_bytes!("../icons/tray-unread.png");

fn show_main_window(app: &AppHandle) {
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.show();
        let _ = w.unminimize();
        let _ = w.set_focus();
    }
}

#[tauri::command]
fn show_window(app: AppHandle) {
    show_main_window(&app);
}

/// Число непрочитаних у треї: іконка з крапкою й підказка; `offline` — немає зв'язку з сервером.
#[tauri::command]
fn set_tray_state(app: AppHandle, unread: u32, offline: bool) {
    let Some(tray) = app.tray_by_id(TRAY_ID) else { return };
    let bytes = if unread > 0 { ICON_UNREAD } else { ICON };
    if let Ok(img) = Image::from_bytes(bytes) {
        let _ = tray.set_icon(Some(img));
    }
    let tip = if offline {
        "UNIQO Сповіщення — немає зв'язку".to_string()
    } else if unread > 0 {
        format!("UNIQO Сповіщення — непрочитаних чатів: {unread}")
    } else {
        "UNIQO Сповіщення".to_string()
    };
    let _ = tray.set_tooltip(Some(tip));
}

/// Сповіщення Windows; клік по ньому відкриває `url` (чат клієнта) у браузері за замовчуванням.
#[tauri::command]
fn notify(app: AppHandle, title: String, subtitle: String, body: String, url: String, sound: bool) -> Result<(), String> {
    #[cfg(windows)]
    {
        use tauri_winrt_notification::{Sound, Toast};
        // Встановлена програма — свій AppUserModelID (ярлик NSIS); збірка з target/ — як у tauri-plugin-notification
        let exe_dir = std::env::current_exe().ok().and_then(|p| p.parent().map(|d| d.display().to_string())).unwrap_or_default();
        let dev = exe_dir.ends_with("\\target\\debug") || exe_dir.ends_with("\\target\\release");
        let app_id = if dev { Toast::POWERSHELL_APP_ID.to_string() } else { app.config().identifier.clone() };
        let handle = app.clone();
        let open_url = url.clone();
        Toast::new(&app_id)
            .title(&title)
            .text1(&subtitle)
            .text2(&body)
            .sound(if sound { Some(Sound::IM) } else { None })
            .on_activated(move |_| {
                if !open_url.is_empty() {
                    let _ = handle.opener().open_url(open_url.clone(), None::<&str>);
                }
                Ok(())
            })
            .show()
            .map_err(|e| e.to_string())
    }
    #[cfg(not(windows))]
    {
        let _ = (app, sound);
        log::info!("notify: {title} · {subtitle} — {body} ({url})");
        Ok(())
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {
            show_main_window(app);
        }))
        .plugin(tauri_plugin_autostart::init(MacosLauncher::LaunchAgent, Some(vec!["--hidden"])))
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_log::Builder::new().build())
        .setup(|app| {
            let open_i = MenuItem::with_id(app, "open", "Відкрити", true, None::<&str>)?;
            let quit_i = MenuItem::with_id(app, "quit", "Закрити програму", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&open_i, &quit_i])?;
            TrayIconBuilder::with_id(TRAY_ID)
                .menu(&menu)
                .show_menu_on_left_click(false)
                .tooltip("UNIQO Сповіщення")
                .icon(Image::from_bytes(ICON)?)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "open" => show_main_window(app),
                    "quit" => app.exit(0),
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click { button: MouseButton::Left, button_state: MouseButtonState::Up, .. } = event {
                        show_main_window(tray.app_handle());
                    }
                })
                .build(app)?;

            // Автозапуск з Windows — з --hidden: сидимо в треї; ручний запуск — показуємо вікно
            if !std::env::args().any(|a| a == "--hidden") {
                show_main_window(app.handle());
            }
            Ok(())
        })
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                // Хрестик ховає вікно — сповіщення мають іти й далі
                let _ = window.hide();
                api.prevent_close();
            }
        })
        .invoke_handler(tauri::generate_handler![show_window, set_tray_state, notify])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
