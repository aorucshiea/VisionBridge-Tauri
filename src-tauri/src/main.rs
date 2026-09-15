//! Vision Bridge — Tauri backend.
//!
//! Scope note: this side owns only what a WebView cannot do for itself —
//! windows, tray, global shortcuts, screen capture, clipboard, and the
//! persistent stores. Every model call happens in the renderer over `fetch`,
//! which is why there is no async runtime here at all.

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
// The settings defaults are one large `json!` literal, which nests deeply
// enough to trip the default macro recursion limit.
#![recursion_limit = "512"]

mod capture;
mod settings;
mod winmod;

use serde_json::{json, Value};
use std::sync::atomic::{AtomicBool, AtomicI64, Ordering};
use std::sync::Mutex;
use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, Manager, PhysicalPosition, PhysicalSize, Position, WebviewUrl,
    WebviewWindow, WebviewWindowBuilder,
};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};

// ---------------------------------------------------------------------------
// Shared state
// ---------------------------------------------------------------------------
struct Ctx {
    settings: Mutex<Value>,
    /// Where the currently open mask was launched from.
    mask_target: Mutex<String>,
}

impl Ctx {
    fn settings(&self) -> Value {
        self.settings.lock().unwrap().clone()
    }
}

/// Selection cooldown: a drag fires one selection, not five.
static LAST_SELECTION_MS: AtomicI64 = AtomicI64::new(0);
static TRAY_HINT_SHOWN: AtomicBool = AtomicBool::new(false);

/// Last text handed to the toolbar, with where it was found.
static LAST_SELECTION: Mutex<(String, i32, i32)> = Mutex::new((String::new(), 0, 0));

fn now_ms() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

// ---------------------------------------------------------------------------
// Window management
// ---------------------------------------------------------------------------
const MASK: &str = "mask";
const RESULT: &str = "result";
/// Must match the value App.tsx switches on (`windowType === 'selection-toolbar'`).
/// Calling it `toolbar` made that window fall through to the main-app branch, so
/// the 280×52 popup rendered the entire UI — title bar, tabs and all — with the
/// tab labels squeezed onto two lines.
const TOOLBAR: &str = "selection-toolbar";

fn url_for(_label: &str) -> WebviewUrl {
    // Bare path on purpose. The window's identity travels via the
    // initialisation script, and `index.html?query` was producing a WebView2
    // navigation error (every window showed the browser error page), so the
    // URL is kept to the simplest form that resolves against frontendDist.
    WebviewUrl::App("index.html".into())
}

/// Tell the page which window it is, and record whether the bundle ran at all.
///
/// The title handshake exists because this environment cannot show the model an
/// image: reading the window title from outside is the cheapest way to
/// distinguish "the frontend crashed" from "the screenshot is wrong".
///
/// With `VB_DIAG=1` the handshake also reports layout facts (resolved font
/// stack, viewport width, whether the tab labels overflow their box). That
/// turns "the tabs look wrong" into three numbers.
fn init_script(label: &str) -> String {
    let diag = if std::env::var("VB_DIAG").is_ok() {
        r#"
  try {
    var tl = document.querySelector('[role=tablist]');
    var r = tl ? tl.getBoundingClientRect() : null;
    var btn = tl ? tl.querySelector('button') : null;
    var cs = getComputedStyle(document.body);
    var root = document.getElementById('root');
    var first = root && root.firstElementChild;
    where += "|vw:" + document.documentElement.clientWidth
          + "|ff:" + String(cs.fontFamily).slice(0, 26)
          + "|tl:" + (r ? Math.round(r.width) + "x" + Math.round(r.height) : "-")
          + "|btn:" + (btn ? btn.offsetWidth + "x" + btn.offsetHeight + "/sc" + btn.scrollWidth + "x" + btn.scrollHeight : "-")
          + "|dpr:" + window.devicePixelRatio
          + "|app:" + document.querySelectorAll('[role=application]').length
          + "|bg:" + (first ? String(getComputedStyle(first).backgroundColor) : "-")
          + "|txt:" + String(document.body.innerText || "").replace(/\s+/g, " ").slice(0, 36);
  } catch (e) { where += "|diagERR:" + e.message; }
"#
    } else {
        ""
    };
    let diagflag = if std::env::var("VB_DIAG").is_ok() { "true" } else { "false" };
    // Exercise the GDI capture on its own, before any event is involved: a hang
    // here (rather than a rejection) would silently stall the whole capture
    // chain, which is exactly how it presented.
    let captureprobe = if std::env::var("VB_DIAG").is_ok() && label == "main" {
        r#"
window.setTimeout(function () {
  var t0 = Date.now();
  try {
    window.__TAURI_INTERNALS__.invoke("capture_screen").then(function (s) {
      vbReport("main capture_screen OK len=" + String(s).length + " head=" + String(s).slice(0, 24) + " in " + (Date.now() - t0) + "ms");
    }).catch(function (e) {
      vbReport("main capture_screen REJECTED: " + String(e));
    });
  } catch (e) { vbReport("main capture_screen THREW: " + String(e)); }
}, 800);
"#
    } else {
        ""
    };
    // End-to-end CORS check against a local OpenAI-compatible server. The
    // renderer's fetch used to die on the CORS preflight (WebView2 blocks the
    // actual GET when the server answers OPTIONS without CORS headers), so this
    // probe is the ground truth for "can the Tauri build talk to LM Studio".
    let probeprobe = if std::env::var("VB_PROBE_MODELS").is_ok() && label == "main" {
        r#"
window.setTimeout(function () {
  if (window.__VB_WINDOW__ !== "main") return;
  var tries = 0;
  var iv = setInterval(function () {
    tries++;
    if (window.ipcRenderer && window.ipcRenderer.listModels) {
      clearInterval(iv);
      var t0 = Date.now();
      window.ipcRenderer.listModels({ provider: "lmstudio", apiKey: "", baseUrl: "http://127.0.0.1:1234" })
        .then(function (m) {
          vbReport("PROBE-OK models=" + (m || []).length + " in " + (Date.now() - t0) + "ms head=" + JSON.stringify((m || []).slice(0, 3)));
        })
        .catch(function (e) {
          vbReport("PROBE-FAIL " + String((e && e.message) || e));
        });
    } else if (tries > 24) { clearInterval(iv); vbReport("PROBE-NO-IPC"); }
  }, 250);
}, 1200);
"#
    } else {
        ""
    };
    format!(
        r#"window.__VB_WINDOW__ = "{label}";
window.__VB_ERRORS__ = [];
window.__VB_DIAG__ = {diagflag};
function vbReport(msg) {{
  try {{ window.__TAURI_INTERNALS__.invoke("frontend_report", {{ text: msg }}); }} catch (e) {{}}
}}
window.addEventListener("error", function (e) {{
  var m = "error: " + String(e.message) + " @ " + String(e.filename) + ":" + e.lineno;
  window.__VB_ERRORS__.push(m);
  vbReport("{label} " + m);
}});
window.addEventListener("unhandledrejection", function (e) {{
  var r = e && e.reason;
  var m = "rejection: " + String((r && r.message) || r);
  window.__VB_ERRORS__.push(m);
  vbReport("{label} " + m);
}});
vbReport("{label} init-script ran at " + location.href);
window.setTimeout(function () {{
  var where = window.__VB_BUNDLE_LOADED__ ? "VB:" + (window.__VB_WINDOW__ || "?") : "VB-BUNDLE-MISSING";
  if (window.__VB_ERRORS__ && window.__VB_ERRORS__.length) where += "|ERR:" + window.__VB_ERRORS__.join(" ~ ");
{diag}
  document.title = where;
  vbReport("{label} handshake " + where);
}}, 3500);
{captureprobe}
{probeprobe}
"#
    )
}

/// The main window is built here rather than in tauri.conf.json purely so the
/// window-identity initialisation script applies to it too.
///
/// Note `transparent(false)`: only the floating surfaces (mask, result card,
/// selection toolbar) are transparent. The Electron build did the same, and a
/// transparent main window lets the desktop bleed through wherever the app has
/// not painted yet.
fn ensure_main(app: &AppHandle) -> Option<WebviewWindow> {
    if let Some(w) = app.get_webview_window("main") {
        return Some(w);
    }
    WebviewWindowBuilder::new(app, "main", url_for("main"))
        .initialization_script(&init_script("main"))
        .title("Vision Bridge")
        .inner_size(450.0, 650.0)
        .min_inner_size(380.0, 420.0)
        .decorations(false)
        .transparent(false)
        .resizable(true)
        .visible(false)
        .build()
        .ok()
}

fn ensure_result(app: &AppHandle) -> Result<WebviewWindow, String> {
    if let Some(w) = app.get_webview_window(RESULT) {
        return Ok(w);
    }
    WebviewWindowBuilder::new(app, RESULT, url_for(RESULT))
        .initialization_script(&init_script(RESULT))
        .title("Vision Bridge")
        .inner_size(380.0, 280.0)
        .decorations(false)
        .transparent(true)
        .always_on_top(true)
        .skip_taskbar(true)
        .resizable(false)
        .shadow(false)
        .visible(false)
        .focused(true)
        .build()
        .map_err(|e| {
            eprintln!("[result] window create failed: {e}");
            e.to_string()
        })
}

fn ensure_toolbar(app: &AppHandle) -> Option<WebviewWindow> {
    if let Some(w) = app.get_webview_window(TOOLBAR) {
        return Some(w);
    }
    WebviewWindowBuilder::new(app, TOOLBAR, url_for(TOOLBAR))
        .initialization_script(&init_script(TOOLBAR))
        .title("Vision Bridge")
        .inner_size(280.0, 52.0)
        .decorations(false)
        .transparent(true)
        .always_on_top(true)
        .skip_taskbar(true)
        .resizable(false)
        .shadow(false)
        .visible(false)
        .focused(false)
        .build()
        .ok()
}

/// The monitor under the cursor — the mask opens here, like the Electron build.
fn cursor_monitor(app: &AppHandle) -> Option<tauri::Monitor> {
    let (cx, cy) = winmod::cursor_pos();
    app.monitor_from_point(cx as f64, cy as f64)
        .ok()
        .flatten()
        .or_else(|| app.primary_monitor().ok().flatten())
}

fn ensure_mask(app: &AppHandle) -> Option<WebviewWindow> {
    let monitor = cursor_monitor(app)?;
    let pos = monitor.position();
    let size = monitor.size();

    if let Some(w) = app.get_webview_window(MASK) {
        let _ = w.set_position(PhysicalPosition::new(pos.x, pos.y));
        let _ = w.set_size(PhysicalSize::new(size.width, size.height));
        return Some(w);
    }

    let w = WebviewWindowBuilder::new(app, MASK, url_for(MASK))
        .initialization_script(&init_script(MASK))
        .title("Vision Bridge")
        .position(pos.x as f64, pos.y as f64)
        .inner_size(size.width as f64, size.height as f64)
        .decorations(false)
        .transparent(true)
        .always_on_top(true)
        .skip_taskbar(true)
        .resizable(false)
        .shadow(false)
        .visible(false)
        .focused(true)
        .build()
        .ok()?;
    let _ = w.set_position(PhysicalPosition::new(pos.x, pos.y));
    let _ = w.set_size(PhysicalSize::new(size.width, size.height));
    Some(w)
}

fn show_main(app: &AppHandle) {
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.show();
        let _ = w.set_focus();
    }
}

fn hide_to_tray(app: &AppHandle) {
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.hide();
    }
    if !TRAY_HINT_SHOWN.swap(true, Ordering::SeqCst) {
        let lang = settings::load()
            .get("language")
            .and_then(|v| v.as_str())
            .unwrap_or("zh")
            .to_string();
        let content = if lang == "en" {
            "Still running in the tray. Right-click the icon to quit."
        } else {
            "已最小化到托盘，右键图标可以退出。"
        };
        // Windows balloon notifications need a shell API Tauri does not expose;
        // log instead so the behaviour stays discoverable without extra deps.
        eprintln!("[tray] {content}");
    }
}

/// Shared result-card positioning: keep the card on-screen near a point.
fn show_result_window(app: &AppHandle, x: f64, y: f64, content: String) -> Result<(), String> {
    let win = ensure_result(app)?;
    let size = win.outer_size().unwrap_or(PhysicalSize::new(380, 280));

    // Incoming coordinates are logical (CSS px) from the mask/selection layer.
    let mut fx = x;
    let mut fy = y;
    if let Ok(Some(monitor)) = app.monitor_from_point(x, y) {
        let mp = monitor.position();
        let ms = monitor.size();
        let scale = monitor.scale_factor();
        let (lw, lh) = (size.width as f64 / scale, size.height as f64 / scale);
        let (mx, my) = (mp.x as f64 / scale, mp.y as f64 / scale);
        let (mw, mh) = (ms.width as f64 / scale, ms.height as f64 / scale);
        if fx + lw > mx + mw {
            fx = x - lw - 10.0;
        }
        if fx < mx {
            fx = mx + 10.0;
        }
        if fy + lh > my + mh {
            fy = y - lh - 10.0;
        }
        if fy < my {
            fy = my + 10.0;
        }
    }

    let chars = content.chars().count();
    win.set_position(Position::Logical(tauri::LogicalPosition::new(fx, fy)))
        .map_err(|e| { eprintln!("[result] set_position failed: {e}"); e.to_string() })?;
    win.show()
        .map_err(|e| { eprintln!("[result] show failed: {e}"); e.to_string() })?;
    win.emit("display-content", content)
        .map_err(|e| { eprintln!("[result] emit failed: {e}"); e.to_string() })?;
    eprintln!("[result] shown at ({fx:.0},{fy:.0}) content={chars} chars");
    Ok(())
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------
/// Diagnostic sink for the frontend.
///
/// The initialisation scripts use this to report facts back to stdout. It
/// replaces an earlier `document.title` handshake, which silently does nothing
/// here: Tauri does not mirror `document.title` onto the native window caption.
#[tauri::command]
fn frontend_report(text: String) {
    eprintln!("[frontend] {text}");
}

#[tauri::command]
fn get_settings(state: tauri::State<'_, Ctx>) -> Value {
    state.settings()
}

#[tauri::command]
fn save_settings(app: AppHandle, state: tauri::State<'_, Ctx>, settings: Value) -> Result<(), String> {
    settings::save(&settings)?;
    *state.settings.lock().unwrap() = settings.clone();
    arm_shortcuts(&app, &settings);
    set_selection_hook(&app, &settings);
    Ok(())
}

#[tauri::command]
fn capture_screen(app: AppHandle) -> Result<String, String> {
    // Match the Electron behaviour: capture the display under the cursor, so
    // the mask's local coordinates map onto the image one-to-one.
    let monitor = cursor_monitor(&app).ok_or("找不到显示器")?;
    let pos = monitor.position();
    let size = monitor.size();
    capture::capture_rect(pos.x, pos.y, size.width as i32, size.height as i32)
}

#[tauri::command]
fn process_screenshot(app: AppHandle, state: tauri::State<'_, Ctx>, region: Value, action: String) {
    eprintln!("[mask] process_screenshot action={action} region={region}");
    let payload = json!({ "region": region, "action": action });
    let mut target = state.mask_target.lock().unwrap();

    if *target == "result" {
        *target = "main".into();
        if let Some(r) = app.get_webview_window(RESULT) {
            let _ = r.show();
            let _ = r.emit("append-screenshot", payload);
            return;
        }
    }

    if let Some(r) = app.get_webview_window(RESULT) {
        if r.is_visible().unwrap_or(false) {
            let _ = r.emit("append-screenshot", payload);
            return;
        }
    }

    if let Some(m) = app.get_webview_window("main") {
        let _ = m.emit("process-screenshot", payload);
    }
}

/// `async` on purpose.
///
/// Sync commands run on the main thread, and creating a webview window from
/// there deadlocks: `build()` needs the event loop to make progress while the
/// loop is blocked inside this very command. That is exactly the "Alt+A covers
/// the screen and no result card ever appears" symptom — the card window was
/// never created, it was stuck. Async commands run off the main thread, so the
/// loop stays free.
#[tauri::command]
async fn show_result(app: AppHandle, x: f64, y: f64, content: String) -> Result<(), String> {
    eprintln!("[result] show_result invoked at ({x},{y}) len={}", content.chars().count());
    show_result_window(&app, x, y, content)
}

#[tauri::command]
fn hide_result(app: AppHandle) {
    if let Some(w) = app.get_webview_window(RESULT) {
        let _ = w.hide();
    }
}

#[tauri::command]
async fn open_mask(app: AppHandle, state: tauri::State<'_, Ctx>, target: Option<String>) -> Result<(), String> {
    *state.mask_target.lock().unwrap() = if target.as_deref() == Some("result") {
        "result".into()
    } else {
        "main".into()
    };
    if let Some(w) = ensure_mask(&app) {
        let _ = w.show();
        let _ = w.set_focus();
    }
    Ok(())
}

#[tauri::command]
fn hide_mask(app: AppHandle, state: tauri::State<'_, Ctx>) {
    *state.mask_target.lock().unwrap() = "main".into();
    if let Some(w) = app.get_webview_window(MASK) {
        let _ = w.hide();
    }
}

#[tauri::command]
fn close_mask(app: AppHandle, state: tauri::State<'_, Ctx>) {
    *state.mask_target.lock().unwrap() = "main".into();
    if let Some(w) = app.get_webview_window(MASK) {
        let _ = w.close();
    }
}

#[tauri::command]
async fn selection_toolbar_action(app: AppHandle, state: tauri::State<'_, Ctx>, action: String) -> Result<(), String> {
    if let Some(w) = app.get_webview_window(TOOLBAR) {
        let _ = w.hide();
    }
    if action == "dismiss" {
        return Ok(());
    }
    let (text, x, y) = LAST_SELECTION.lock().unwrap().clone();
    let _ = state;
    if let Some(main) = app.get_webview_window("main") {
        let _ = main.emit(
            "selection-action",
            json!({ "action": action, "text": text, "x": x, "y": y }),
        );
    }
    Ok(())
}

#[tauri::command]
fn window_control(app: AppHandle, window: WebviewWindow, action: String) {
    match action.as_str() {
        "minimize" => {
            let _ = window.minimize();
        }
        "maximize" => {
            if window.is_maximized().unwrap_or(false) {
                let _ = window.unmaximize();
            } else {
                let _ = window.maximize();
            }
        }
        "close" => {
            if window.label() != "main" {
                let _ = window.hide();
                return;
            }
            let close_action = settings::load()
                .get("closeAction")
                .and_then(|v| v.as_str())
                .unwrap_or("tray")
                .to_string();
            if close_action == "quit" {
                app.exit(0);
            } else {
                hide_to_tray(&app);
            }
        }
        _ => {}
    }
}

// ---- chat history ---------------------------------------------------------
fn history_path() -> std::path::PathBuf {
    settings::data_dir().join("chat-history.json")
}

fn read_history() -> Vec<Value> {
    std::fs::read_to_string(history_path())
        .ok()
        .and_then(|t| serde_json::from_str::<Vec<Value>>(&t).ok())
        .unwrap_or_default()
}

#[tauri::command]
fn save_chat_history(entry: Value) -> Result<(), String> {
    let mut history = read_history();
    history.push(entry);
    let text = serde_json::to_string_pretty(&history).map_err(|e| e.to_string())?;
    std::fs::write(history_path(), text).map_err(|e| e.to_string())
}

#[tauri::command]
fn get_chat_history() -> Vec<Value> {
    read_history()
}

#[tauri::command]
fn delete_chat_history(id: i64) -> Value {
    let mut history = read_history();
    let before = history.len();
    history.retain(|e| e.get("id").and_then(|v| v.as_i64()) != Some(id));
    if history.len() != before {
        if let Ok(text) = serde_json::to_string_pretty(&history) {
            let _ = std::fs::write(history_path(), text);
        }
        json!({ "success": true })
    } else {
        json!({ "success": false })
    }
}

// ---- saved configurations -------------------------------------------------
#[tauri::command]
fn save_configuration(state: tauri::State<'_, Ctx>, data: Value) -> Value {
    let mut s = state.settings.lock().unwrap().clone();
    let id = now_ms().to_string();
    let entry = json!({
        "id": id,
        "name": data.get("name").cloned().unwrap_or(json!("")),
        "pipeline": data.get("pipeline").cloned().unwrap_or(json!("VLM")),
        "createdAt": iso_now(),
        "config": data.get("config").cloned().unwrap_or(Value::Null),
        "tags": data.get("tags").cloned().unwrap_or(json!([])),
    });
    if !s.get("savedConfigurations").map(|v| v.is_array()).unwrap_or(false) {
        s["savedConfigurations"] = json!([]);
    }
    s["savedConfigurations"].as_array_mut().unwrap().push(entry);
    let _ = settings::save(&s);
    *state.settings.lock().unwrap() = s;
    json!({ "success": true, "id": id })
}

#[tauri::command]
fn get_saved_configurations(state: tauri::State<'_, Ctx>) -> Value {
    state
        .settings()
        .get("savedConfigurations")
        .cloned()
        .unwrap_or(json!([]))
}

#[tauri::command]
fn delete_configuration(state: tauri::State<'_, Ctx>, id: String) -> Value {
    let mut s = state.settings.lock().unwrap().clone();
    if let Some(list) = s.get_mut("savedConfigurations").and_then(|v| v.as_array_mut()) {
        list.retain(|c| c.get("id").and_then(|v| v.as_str()) != Some(id.as_str()));
        let _ = settings::save(&s);
        *state.settings.lock().unwrap() = s;
        return json!({ "success": true });
    }
    json!({ "success": false })
}

fn iso_now() -> String {
    // Milliseconds are enough; the UI only formats these for display.
    let secs = now_ms() / 1000;
    let days = secs / 86_400;
    let rem = secs % 86_400;
    let (h, mi, s) = (rem / 3600, (rem % 3600) / 60, rem % 60);
    let mut y = 1970i64;
    let mut d = days;
    loop {
        let leap = (y % 4 == 0 && y % 100 != 0) || y % 400 == 0;
        let len = if leap { 366 } else { 365 };
        if d < len {
            break;
        }
        d -= len;
        y += 1;
    }
    let leap = (y % 4 == 0 && y % 100 != 0) || y % 400 == 0;
    let months = [31, if leap { 29 } else { 28 }, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    let mut mo = 0usize;
    while mo < 12 && d >= months[mo] {
        d -= months[mo];
        mo += 1;
    }
    format!("{:04}-{:02}-{:02}T{:02}:{:02}:{:02}.000Z", y, mo + 1, d + 1, h, mi, s)
}

// ---------------------------------------------------------------------------
// Global shortcuts
// ---------------------------------------------------------------------------

/// Open the mask over the cursor's monitor.
fn open_capture(app: &AppHandle) {
    if let Some(state) = app.try_state::<Ctx>() {
        *state.mask_target.lock().unwrap() = "main".into();
    }
    if let Some(w) = ensure_mask(app) {
        let _ = w.show();
        let _ = w.set_focus();
    }
}

/// Alt+T: copy the foreground selection, then let the renderer translate it.
fn trigger_selection(app: &AppHandle) {
    let app = app.clone();
    std::thread::spawn(move || {
        let (text, x, y, elevated) = grab_selection(&app);
        match text {
            Some(text) => {
                sel_log(&format!("Alt+T 捕获选区 {} 字", text.chars().count()));
                push_selection(&app, text, x, y);
            }
            None => {
                let lang = settings::load()
                    .get("language")
                    .and_then(|v| v.as_str())
                    .unwrap_or("zh")
                    .to_string();

                let hint = if elevated {
                    sel_log("Alt+T 未取到选区：目标窗口以管理员身份运行，系统拦截了模拟按键");
                    if lang == "en" {
                        "This app runs as administrator, so Windows blocks the simulated \
                         Ctrl+C. Right-click Vision Bridge and choose \"Run as administrator\", \
                         or copy the text inside that app yourself."
                    } else {
                        "目标窗口以管理员身份运行，系统会拦截模拟按键，无法自动读取选区。\
                         请右键 Vision Bridge → 以管理员身份运行，或在该应用内手动复制。"
                    }
                } else {
                    sel_log("Alt+T 未取到选区：剪贴板为空（目标应用未响应 Ctrl+C）");
                    if lang == "en" {
                        "No selected text detected. Select text first, then press Alt+T."
                    } else {
                        "未检测到选中的文字。请先选中文字，再按 Alt+T。"
                    }
                };

                let _ = app.emit(
                    "selection-action",
                    json!({ "action": "translate", "text": "", "x": x, "y": y, "hint": hint }),
                );
            }
        }
    });
}

fn arm_shortcuts(app: &AppHandle, settings: &Value) {
    let gs = app.global_shortcut();

    // Alt+A — capture. Pointless in text-only mode, so it follows the mode.
    let want_capture = settings.get("mode").and_then(|v| v.as_str()) != Some("TEXT");
    if want_capture && !CAPTURE_ARMED.swap(true, Ordering::SeqCst) {
        let handle = app.clone();
        let sc = Shortcut::new(Some(Modifiers::ALT), Code::KeyA);
        if let Err(e) = gs.on_shortcut(sc, move |_app, _sc, event| {
            if event.state == ShortcutState::Pressed {
                open_capture(&handle);
            }
        }) {
            eprintln!("[shortcut] Alt+A 注册失败: {e}");
            CAPTURE_ARMED.store(false, Ordering::SeqCst);
        }
    } else if !want_capture && CAPTURE_ARMED.swap(false, Ordering::SeqCst) {
        let _ = gs.unregister(Shortcut::new(Some(Modifiers::ALT), Code::KeyA));
    }

    // Alt+T — text selection.
    let want_selection = settings
        .get("enableTextSelection")
        .and_then(|v| v.as_bool())
        .unwrap_or(false);
    if want_selection && !SELECTION_ARMED.swap(true, Ordering::SeqCst) {
        let handle = app.clone();
        let sc = Shortcut::new(Some(Modifiers::ALT), Code::KeyT);
        if let Err(e) = gs.on_shortcut(sc, move |_app, _sc, event| {
            if event.state == ShortcutState::Pressed {
                trigger_selection(&handle);
            }
        }) {
            eprintln!("[shortcut] Alt+T 注册失败: {e}");
            SELECTION_ARMED.store(false, Ordering::SeqCst);
        }
    } else if !want_selection && SELECTION_ARMED.swap(false, Ordering::SeqCst) {
        let _ = gs.unregister(Shortcut::new(Some(Modifiers::ALT), Code::KeyT));
    }
}

static CAPTURE_ARMED: AtomicBool = AtomicBool::new(false);
static SELECTION_ARMED: AtomicBool = AtomicBool::new(false);
/// The "target is elevated" explanation is shown once per session.
static ELEVATION_HINT_SHOWN: AtomicBool = AtomicBool::new(false);

/// Selection-path file log — the one place "划词没反应" can be diagnosed from
/// after the fact, because when the app is started from a shortcut there is no
/// stdout to read.
fn sel_log(msg: &str) {
    use std::io::Write;
    let path = settings::data_dir().join("selection.log");
    if let Ok(mut f) = std::fs::OpenOptions::new().create(true).append(true).open(path) {
        let _ = writeln!(f, "[{}] {}", now_ms(), msg);
    }
}

/// Is the foreground (target) window elevated? UIPI drops injected input aimed
/// at a higher-integrity process, so our simulated Ctrl+C never lands there.
fn foreground_target_elevated() -> bool {
    winmod::hwnd_elevated(unsafe { winmod::GetForegroundWindow() })
}

/// Ctrl+C round-trip: copy the foreground selection, keep the user's clipboard.
///
/// The clipboard is cleared *before* the synthetic copy so an empty result
/// unambiguously means "nothing was selected". Without that, a failed copy is
/// indistinguishable from stale clipboard content and the toolbar pops up with
/// whatever the user copied minutes ago — which reads as "the feature is
/// flaky". The previous contents are always handed back afterwards.
fn grab_selection(app: &AppHandle) -> (Option<String>, i32, i32, bool) {
    let previous = winmod::clipboard_text();
    let elevated = foreground_target_elevated();
    winmod::set_clipboard_text("");
    winmod::send_ctrl_c();
    std::thread::sleep(std::time::Duration::from_millis(320));
    let text = winmod::clipboard_text().unwrap_or_default().trim().to_string();

    if let Some(prev) = previous {
        winmod::set_clipboard_text(&prev);
    }

    let text = if text.is_empty() { None } else { Some(text) };
    let (x, y) = winmod::cursor_pos();
    let _ = app;
    (text, x, y, elevated)
}

fn push_selection(app: &AppHandle, text: String, x: i32, y: i32) {
    *LAST_SELECTION.lock().unwrap() = (text.clone(), x, y);

    // The main window owns the model call; let it know where the text came from.
    if let Some(main) = app.get_webview_window("main") {
        let _ = main.emit("selection-position", json!({ "x": x, "y": y }));
    }

    let settings = settings::load();
    let actions = toolbar_actions(&settings);
    let width = (84 + actions.len() as i32 * 66 + 44).min(560);
    let point = clamp_to_work_area(app, x + 10, y + 12, width, 52);

    if let Some(w) = ensure_toolbar(app) {
        let _ = w.set_position(Position::Logical(tauri::LogicalPosition::new(
            point.0 as f64,
            point.1 as f64,
        )));
        let _ = w.set_size(tauri::LogicalSize::new(width as f64, 52.0));
        let _ = w.emit("selection-text", json!({ "text": text, "actions": actions }));
        let _ = w.show();
    }
}

fn toolbar_actions(settings: &Value) -> Vec<Value> {
    let list: Vec<Value> = settings
        .get("toolbarActions")
        .and_then(|v| v.as_array())
        .map(|a| a.iter().filter(|x| x.get("enabled").and_then(|v| v.as_bool()).unwrap_or(true)).cloned().collect())
        .unwrap_or_default();
    if !list.is_empty() {
        return list
            .into_iter()
            .map(|a| json!({ "id": a.get("id"), "label": a.get("label") }))
            .collect();
    }
    vec![
        json!({ "id": "translate", "label": "翻译" }),
        json!({ "id": "explain", "label": "解释" }),
    ]
}

fn clamp_to_work_area(app: &AppHandle, x: i32, y: i32, width: i32, height: i32) -> (i32, i32) {
    let Ok(Some(monitor)) = app.monitor_from_point(x as f64, y as f64) else {
        return (x, y);
    };
    let scale = monitor.scale_factor();
    let mp = monitor.position();
    let ms = monitor.size();
    let mx = (mp.x as f64 / scale) as i32;
    let my = (mp.y as f64 / scale) as i32;
    let mw = (ms.width as f64 / scale) as i32;
    let mh = (ms.height as f64 / scale) as i32;

    let mut fx = x;
    let mut fy = y;
    if fx + width > mx + mw {
        fx = mx + mw - width - 8;
    }
    if fx < mx {
        fx = mx + 8;
    }
    if fy + height > my + mh {
        fy = y - height - 10;
    }
    if fy < my {
        fy = my + 8;
    }
    (fx, fy)
}

/// Is this point over one of our own visible windows? (Ignore our own text.)
fn point_inside_our_windows(app: &AppHandle, x: i32, y: i32) -> bool {
    for label in ["main", MASK, RESULT, TOOLBAR] {
        let Some(w) = app.get_webview_window(label) else { continue };
        if !w.is_visible().unwrap_or(false) {
            continue;
        }
        let (Ok(pos), Ok(size)) = (w.outer_position(), w.outer_size()) else { continue };
        let scale = w.scale_factor().unwrap_or(1.0);
        let x0 = pos.x as f64 / scale;
        let y0 = pos.y as f64 / scale;
        let ww = size.width as f64 / scale;
        let hh = size.height as f64 / scale;
        if (x as f64) >= x0 && (x as f64) <= x0 + ww && (y as f64) >= y0 && (y as f64) <= y0 + hh {
            return true;
        }
    }
    false
}

// ---------------------------------------------------------------------------
// Mouse hook: auto-trigger the toolbar on drag-select
// ---------------------------------------------------------------------------
static HOOK_ON: AtomicBool = AtomicBool::new(false);

fn set_selection_hook(app: &AppHandle, settings: &Value) {
    let want = settings
        .get("enableTextSelection")
        .and_then(|v| v.as_bool())
        .unwrap_or(false)
        && settings.get("selectionTrigger").and_then(|v| v.as_str()) == Some("auto");

    if want && !HOOK_ON.swap(true, Ordering::SeqCst) {
        let handle = app.clone();
        if let Err(e) = drag_watch::start(handle) {
            eprintln!("[selection] 鼠标钩子启动失败: {e}");
            HOOK_ON.store(false, Ordering::SeqCst);
        } else {
            eprintln!("[selection] 已在划词自动模式下监听");
        }
    } else if !want && HOOK_ON.swap(false, Ordering::SeqCst) {
        // The hook thread exits when it sees the flag cleared.
        eprintln!("[selection] 已停止监听");
    }
}

mod drag_watch {
    use super::*;

    /// Watch for drag-select gestures and offer the toolbar.
    ///
    /// A polling loop rather than a `WH_MOUSE_LL` hook: the gesture we care
    /// about (press → move → release) is trivially detectable from
    /// `GetAsyncKeyState`, and a poller cannot be silently unhooked by Windows
    /// for overrunning `LowLevelHooksTimeout` the way a hook callback can.
    /// 25 ms costs nothing measurable.
    pub fn start(app: AppHandle) -> Result<(), String> {
        std::thread::spawn(move || {
            let (mut down_x, mut down_y) = (0i32, 0i32);
            let mut was_down = false;
            let mut beats: u64 = 0;
            sel_log("拖选轮询线程启动");
            while HOOK_ON.load(Ordering::SeqCst) {
                let (x, y) = winmod::cursor_pos();
                let pressed = unsafe { winmod::GetAsyncKeyState(0x01) } < 0;
                beats += 1;
                if beats == 1 || beats % 200 == 0 {
                    sel_log(&format!("轮询心跳 #{beats} pressed={pressed} was_down={was_down}"));
                }
                if pressed && !was_down {
                    down_x = x;
                    down_y = y;
                    sel_log(&format!("mousedown at {x},{y}"));
                }
                if !pressed && was_down {
                    let moved = (x - down_x).abs() + (y - down_y).abs();
                    let inside = point_inside_our_windows(&app, x, y);
                    sel_log(&format!(
                        "mouseup at {x},{y} moved={moved} inside_ours={inside} cooldown_left={}ms",
                        (700 - (now_ms() - LAST_SELECTION_MS.load(Ordering::SeqCst))).max(0),
                    ));
                    // A 8 px threshold keeps plain clicks out of the copy path.
                    if moved > 8 && !inside {
                        let now = now_ms();
                        if now - LAST_SELECTION_MS.load(Ordering::SeqCst) > 700 {
                            LAST_SELECTION_MS.store(now, Ordering::SeqCst);
                            let (text, sx, sy, elevated) = grab_selection(&app);
                            match text {
                                Some(text) => {
                                    if text.chars().count() <= 5000 {
                                        sel_log(&format!(
                                            "划词捕获 {} 字 (目标{})",
                                            text.chars().count(),
                                            if elevated { "提权" } else { "普通" },
                                        ));
                                        eprintln!("[selection] 捕获选区 {} 字", text.chars().count());
                                        push_selection(&app, text, sx, sy);
                                    } else {
                                        sel_log("划词放弃：选区超过 5000 字");
                                    }
                                }
                                None => {
                                    sel_log(&format!(
                                        "划词未取到文本 (moved={moved}, 目标{})",
                                        if elevated { "提权，按键被系统拦截" } else { "普通，应用未响应 Ctrl+C" },
                                    ));
                                    // An elevated target is invisible to the user
                                    // unless we say so once — otherwise it reads as
                                    // "划词没反应". Once per session keeps it from
                                    // becoming nagging.
                                    if elevated
                                        && !ELEVATION_HINT_SHOWN.swap(true, Ordering::SeqCst)
                                    {
                                        let _ = app.emit(
                                            "selection-action",
                                            json!({
                                                "action": "translate", "text": "",
                                                "x": x, "y": y,
                                                "hint": "该窗口以管理员身份运行，系统会拦截自动取词。\
                                                         右键 Vision Bridge → 以管理员身份运行即可。",
                                            }),
                                        );
                                    }
                                }
                            }
                        }
                    }
                }
                was_down = pressed;
                std::thread::sleep(std::time::Duration::from_millis(25));
            }
        });
        Ok(())
    }
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------
fn main() {
    // Two instances would both watch the mouse and fight over the clipboard,
    // which presents as "selection translate is flaky".
    if !winmod::acquire_single_instance("Local\\VisionBridgeTauriSingleInstance") {
        eprintln!("[single-instance] another instance is already running; exiting");
        return;
    }

    let initial = settings::load();

    tauri::Builder::default()
        // Hotkeys are registered per-shortcut in `arm_shortcuts` via
        // `on_shortcut`. A global `.with_handler` here would fire IN ADDITION to
        // those, so Alt+T ran twice: two clipboard round-trips racing, the
        // second clearing what the first had just captured — one of the reasons
        // selection translate looked flaky.
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        // HTTP stays out of the webview: WebView2 enforces CORS, and local
        // OpenAI-compatible servers (LM Studio, llama.cpp) answer the OPTIONS
        // preflight without CORS headers, so every renderer fetch to
        // 127.0.0.1 died. The plugin's fetch runs through IPC into Rust, which
        // has no origin, so no preflight is ever sent.
        .plugin(tauri_plugin_http::init())
        .manage(Ctx {
            settings: Mutex::new(initial.clone()),
            mask_target: Mutex::new("main".into()),
        })
        .invoke_handler(tauri::generate_handler![
            frontend_report,
            get_settings,
            save_settings,
            capture_screen,
            process_screenshot,
            show_result,
            hide_result,
            open_mask,
            hide_mask,
            close_mask,
            selection_toolbar_action,
            window_control,
            save_chat_history,
            get_chat_history,
            delete_chat_history,
            save_configuration,
            get_saved_configurations,
            delete_configuration,
        ])
        .setup(move |app| {
            let handle = app.handle().clone();

            // Tray: show / hide / quit.
            let show_item = MenuItem::with_id(app, "show", "显示 VisionBridge", true, None::<&str>)?;
            let hide_item = MenuItem::with_id(app, "hide", "隐藏 VisionBridge", true, None::<&str>)?;
            let quit_item = MenuItem::with_id(app, "quit", "退出", true, None::<&str>)?;
            let sep = PredefinedMenuItem::separator(app)?;
            let menu = Menu::with_items(app, &[&show_item, &hide_item, &sep, &quit_item])?;

            let icon = tauri::image::Image::from_bytes(include_bytes!("../icons/tray.png"))?;
            TrayIconBuilder::with_id("tray")
                .icon(icon)
                .tooltip("Vision Bridge")
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show" => show_main(app),
                    "hide" => {
                        if let Some(w) = app.get_webview_window("main") {
                            let _ = w.hide();
                        }
                    }
                    "quit" => app.exit(0),
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click { button: MouseButton::Left, .. } = event {
                        show_main(tray.app_handle());
                    }
                })
                .build(app)?;

            // Create the main window now (it is not declared in tauri.conf.json
            // so that the identity init script can be attached), then reveal it.
            ensure_main(&handle);
            show_main(&handle);

            // Probe what the webview actually navigated to, and whether the
            // frontend reported in. This is the difference between "the asset
            // protocol did not serve the page" and "the page loaded but the
            // bundle threw".
            let probe = handle.clone();
            std::thread::spawn(move || {
                for delay in [1500u64, 5000] {
                    std::thread::sleep(std::time::Duration::from_millis(delay));
                    if let Some(w) = probe.get_webview_window("main") {
                        println!(
                            "[probe] +{delay}ms url={:?} title={:?}",
                            w.url().map(|u| u.to_string()).unwrap_or_else(|e| format!("<err {e}>")),
                            w.title().unwrap_or_else(|_| "<none>".into()),
                        );
                    }
                }
            });

            // Test hook: `VB_FAKE_SELECTION=text` pushes a selection so the
            // translate toolbar can be inspected without a real mouse drag.
            if let Ok(text) = std::env::var("VB_FAKE_SELECTION") {
                let h = handle.clone();
                std::thread::spawn(move || {
                    std::thread::sleep(std::time::Duration::from_millis(2500));
                    let (x, y) = winmod::cursor_pos();
                    push_selection(&h, text, x, y);
                });
            }

            let h = handle.clone();
            let s = initial.clone();
            std::thread::spawn(move || {
                arm_shortcuts(&h, &s);
                set_selection_hook(&h, &s);
            });

            // Test hook: `VB_OPEN_MASK=<ms>` drives the whole capture flow without
            // a real Alt+A — open the overlay, drag a marquee, click the first
            // action. Every step after the first goes through the IPC event
            // channels, so a result window appearing proves the chain end to end.
            if let Ok(ms) = std::env::var("VB_OPEN_MASK") {
                if let Ok(ms) = ms.parse::<u64>() {
                    let h = handle.clone();
                    std::thread::spawn(move || {
                        std::thread::sleep(std::time::Duration::from_millis(ms));
                        open_capture(&h);

                        std::thread::sleep(std::time::Duration::from_millis(900));
                        if let Some(w) = h.get_webview_window(MASK) {
                            // The three mouse events must land in separate ticks:
                            // React batches same-tick updates, so the move/up
                            // handlers would read the pre-mousedown state and the
                            // marquee would come out 0×0.
                            let _ = w.eval(
                                r#"(function(){
  var el = document.querySelector('[role=application]');
  if (!el) { window.__TAURI_INTERNALS__.invoke('frontend_report', {text:'mask drag: no root'}); return; }
  function ev(t, x, y) { el.dispatchEvent(new MouseEvent(t, {clientX:x, clientY:y, bubbles:true})); }
  ev('mousedown', 300, 200);
  setTimeout(function(){ ev('mousemove', 820, 560); }, 80);
  setTimeout(function(){
    ev('mouseup', 820, 560);
    var bar = document.querySelectorAll('div.glass');
    window.__TAURI_INTERNALS__.invoke('frontend_report', {text:'mask drag done, glass bars=' + bar.length});
  }, 200);
})()"#,
                            );
                        }

                        std::thread::sleep(std::time::Duration::from_millis(900));
                        if let Some(w) = h.get_webview_window(MASK) {
                            let _ = w.eval(
                                r#"(function(){
  var bars = document.querySelectorAll('div.glass');
  var report = function(m){ window.__TAURI_INTERNALS__.invoke('frontend_report', {text:'mask ' + m}); };
  if (bars.length < 2) { report('action-bar missing (glass=' + bars.length + ')'); return; }
  var btn = bars[bars.length - 1].querySelector('button');
  if (!btn) { report('action-bar has no button'); return; }
  report('clicking action "' + btn.textContent + '"');
  btn.click();
})()"#,
                            );
                        }

                        std::thread::sleep(std::time::Duration::from_millis(1500));
                        let titles: Vec<String> = ["main", MASK, RESULT, TOOLBAR]
                            .iter()
                            .filter_map(|l| h.get_webview_window(l))
                            .map(|w| format!("{}({})", w.label(), w.title().unwrap_or_default()))
                            .collect();
                        eprintln!("[probe] windows after flow: {}", titles.join(", "));
                    });
                }
            }

            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                if window.label() == "main" {
                    api.prevent_close();
                    let close_action = settings::load()
                        .get("closeAction")
                        .and_then(|v| v.as_str())
                        .unwrap_or("tray")
                        .to_string();
                    if close_action == "quit" {
                        window.app_handle().exit(0);
                    } else {
                        let _ = window.hide();
                    }
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running Vision Bridge");
}
