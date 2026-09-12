//! Minimal Win32 bindings — only what this app needs.
//!
//! Declared by hand instead of pulling in `windows` / `windows-sys`: those
//! crates generate tens of thousands of items and measurably inflate a release
//! binary, which would defeat the point of the Tauri comparison.

#![allow(non_snake_case, non_camel_case_types, dead_code)]

use std::ffi::c_void;

pub type HWND = *mut c_void;
pub type HDC = *mut c_void;
pub type HBITMAP = *mut c_void;
pub type HGDIOBJ = *mut c_void;
pub type HGLOBAL = *mut c_void;
pub type HHOOK = *mut c_void;
pub type BOOL = i32;
pub type WPARAM = usize;
pub type LPARAM = isize;
pub type LRESULT = isize;

pub const SM_XVIRTUALSCREEN: i32 = 76;
pub const SM_YVIRTUALSCREEN: i32 = 77;
pub const SM_CXVIRTUALSCREEN: i32 = 78;
pub const SM_CYVIRTUALSCREEN: i32 = 79;

pub const SRCCOPY: u32 = 0x00CC_0020;
pub const DIB_RGB_COLORS: u32 = 0;
pub const BI_RGB: u32 = 0;

pub const CF_UNICODETEXT: u32 = 13;
pub const GMEM_MOVEABLE: u32 = 0x0002;

pub const INPUT_KEYBOARD: u32 = 1;
pub const KEYEVENTF_KEYUP: u32 = 0x0002;
pub const KEYEVENTF_SCANCODE: u32 = 0x0008;

pub const VK_CONTROL: u16 = 0x11;
pub const VK_C: u16 = 0x43;

pub const WH_MOUSE_LL: i32 = 14;
pub const WM_LBUTTONDOWN: usize = 0x0201;
pub const WM_LBUTTONUP: usize = 0x0202;

/// DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2 — a "handle" of -4.
pub const DPI_PER_MONITOR_V2: isize = -4;

#[repr(C)]
#[derive(Default, Clone, Copy)]
pub struct BITMAPINFOHEADER {
    pub biSize: u32,
    pub biWidth: i32,
    pub biHeight: i32,
    pub biPlanes: u16,
    pub biBitCount: u16,
    pub biCompression: u32,
    pub biSizeImage: u32,
    pub biXPelsPerMeter: i32,
    pub biYPelsPerMeter: i32,
    pub biClrUsed: u32,
    pub biClrImportant: u32,
}

#[repr(C)]
#[derive(Default, Clone, Copy)]
pub struct BITMAPINFO {
    pub bmiHeader: BITMAPINFOHEADER,
    pub bmiColors: [u32; 3],
}

#[repr(C)]
#[derive(Clone, Copy)]
pub struct KEYBDINPUT {
    pub wVk: u16,
    pub wScan: u16,
    pub dwFlags: u32,
    pub time: u32,
    pub dwExtraInfo: usize,
}

#[repr(C)]
#[derive(Clone, Copy)]
pub struct MOUSEINPUT {
    pub dx: i32,
    pub dy: i32,
    pub mouseData: u32,
    pub dwFlags: u32,
    pub time: u32,
    pub dwExtraInfo: usize,
}

#[repr(C)]
pub union INPUT_UNION {
    pub ki: KEYBDINPUT,
    pub mi: MOUSEINPUT,
}

#[repr(C)]
pub struct INPUT {
    pub r#type: u32,
    pub u: INPUT_UNION,
}

#[repr(C)]
#[derive(Clone, Copy)]
pub struct MSLLHOOKSTRUCT {
    pub pt_x: i32,
    pub pt_y: i32,
    pub mouseData: u32,
    pub flags: u32,
    pub time: u32,
    pub dwExtraInfo: usize,
}

#[link(name = "user32")]
extern "system" {
    pub fn GetDC(hwnd: HWND) -> HDC;
    pub fn ReleaseDC(hwnd: HWND, hdc: HDC) -> i32;
    pub fn GetSystemMetrics(index: i32) -> i32;
    pub fn SetProcessDpiAwarenessContext(value: isize) -> BOOL;
    pub fn GetCursorPos(pt: *mut POINT) -> BOOL;
    pub fn SendInput(count: u32, inputs: *const INPUT, size: i32) -> u32;
    pub fn SetWindowsHookExW(id: i32, proc_: HOOKPROC, module: *mut c_void, thread: u32) -> HHOOK;
    pub fn UnhookWindowsHookEx(hook: HHOOK) -> BOOL;
    pub fn CallNextHookEx(hook: HHOOK, code: i32, wparam: WPARAM, lparam: LPARAM) -> LRESULT;
    pub fn GetMessageW(msg: *mut MSG, hwnd: HWND, min: u32, max: u32) -> BOOL;
    pub fn TranslateMessage(msg: *const MSG) -> BOOL;
    pub fn DispatchMessageW(msg: *const MSG) -> LRESULT;
    pub fn PostThreadMessageW(thread: u32, msg: u32, wparam: WPARAM, lparam: LPARAM) -> BOOL;
    pub fn GetWindowThreadProcessId(hwnd: HWND, pid: *mut u32) -> u32;
    pub fn GetForegroundWindow() -> HWND;
    /// High bit set = key currently down.
    pub fn GetAsyncKeyState(vkey: i32) -> i16;
    pub fn OpenClipboard(hwnd: HWND) -> BOOL;
    pub fn CloseClipboard() -> BOOL;
    pub fn EmptyClipboard() -> BOOL;
    pub fn GetClipboardData(format: u32) -> HGLOBAL;
    pub fn SetClipboardData(format: u32, mem: HGLOBAL) -> HGLOBAL;
    pub fn IsClipboardFormatAvailable(format: u32) -> BOOL;
}

#[link(name = "gdi32")]
extern "system" {
    pub fn CreateCompatibleDC(hdc: HDC) -> HDC;
    pub fn CreateCompatibleBitmap(hdc: HDC, cx: i32, cy: i32) -> HBITMAP;
    pub fn SelectObject(hdc: HDC, obj: HGDIOBJ) -> HGDIOBJ;
    pub fn BitBlt(dst: HDC, x: i32, y: i32, w: i32, h: i32, src: HDC, sx: i32, sy: i32, rop: u32) -> BOOL;
    pub fn GetDIBits(hdc: HDC, hbm: HBITMAP, start: u32, lines: u32, bits: *mut c_void, info: *mut BITMAPINFO, usage: u32) -> i32;
    pub fn DeleteObject(obj: HGDIOBJ) -> BOOL;
    pub fn DeleteDC(hdc: HDC) -> BOOL;
}

#[link(name = "kernel32")]
extern "system" {
    pub fn GlobalLock(mem: HGLOBAL) -> *mut c_void;
    pub fn GlobalUnlock(mem: HGLOBAL) -> BOOL;
    pub fn GlobalAlloc(flags: u32, bytes: usize) -> HGLOBAL;
    pub fn GlobalSize(mem: HGLOBAL) -> usize;
    pub fn GetCurrentThreadId() -> u32;
    pub fn CreateMutexW(attrs: *mut c_void, initial: BOOL, name: *const u16) -> *mut c_void;
    pub fn GetLastError() -> u32;
    pub fn OpenProcess(access: u32, inherit: BOOL, pid: u32) -> *mut c_void;
    pub fn CloseHandle(handle: *mut c_void) -> BOOL;
}

#[link(name = "advapi32")]
extern "system" {
    pub fn OpenProcessToken(process: *mut c_void, access: u32, token: *mut *mut c_void) -> BOOL;
    pub fn GetTokenInformation(token: *mut c_void, class: u32, info: *mut c_void, len: u32, ret: *mut u32) -> BOOL;
}

#[repr(C)]
#[derive(Default, Clone, Copy)]
pub struct POINT {
    pub x: i32,
    pub y: i32,
}

#[repr(C)]
#[derive(Default, Clone, Copy)]
pub struct MSG {
    pub hwnd: HWND,
    pub message: u32,
    pub wParam: WPARAM,
    pub lParam: LPARAM,
    pub time: u32,
    pub pt: POINT,
}

pub type HOOKPROC = extern "system" fn(i32, WPARAM, LPARAM) -> LRESULT;

// ---------------------------------------------------------------------------
// Clipboard helpers
// ---------------------------------------------------------------------------

/// Read CF_UNICODETEXT. Returns `None` when the clipboard holds no text.
pub fn clipboard_text() -> Option<String> {
    unsafe {
        if OpenClipboard(std::ptr::null_mut()) == 0 {
            return None;
        }
        let mut out = None;
        if IsClipboardFormatAvailable(CF_UNICODETEXT) != 0 {
            let handle = GetClipboardData(CF_UNICODETEXT);
            if !handle.is_null() {
                let ptr = GlobalLock(handle) as *const u16;
                if !ptr.is_null() {
                    let mut len = 0usize;
                    while *ptr.add(len) != 0 {
                        len += 1;
                    }
                    let slice = std::slice::from_raw_parts(ptr, len);
                    out = Some(String::from_utf16_lossy(slice));
                    GlobalUnlock(handle);
                }
            }
        }
        CloseClipboard();
        out
    }
}

/// Replace the clipboard contents with `text`.
pub fn set_clipboard_text(text: &str) -> bool {
    let wide: Vec<u16> = text.encode_utf16().chain(std::iter::once(0)).collect();
    let bytes = wide.len() * 2;
    unsafe {
        let mem = GlobalAlloc(GMEM_MOVEABLE, bytes);
        if mem.is_null() {
            return false;
        }
        let dst = GlobalLock(mem) as *mut u16;
        if dst.is_null() {
            return false;
        }
        std::ptr::copy_nonoverlapping(wide.as_ptr(), dst, wide.len());
        GlobalUnlock(mem);

        if OpenClipboard(std::ptr::null_mut()) == 0 {
            return false;
        }
        EmptyClipboard();
        let ok = !SetClipboardData(CF_UNICODETEXT, mem).is_null();
        CloseClipboard();
        ok
    }
}

// ---------------------------------------------------------------------------
// Synthetic Ctrl+C
// ---------------------------------------------------------------------------

fn key_event(vk: u16, up: bool) -> INPUT {
    INPUT {
        r#type: INPUT_KEYBOARD,
        u: INPUT_UNION {
            ki: KEYBDINPUT {
                wVk: vk,
                wScan: 0,
                dwFlags: if up { KEYEVENTF_KEYUP } else { 0 },
                time: 0,
                dwExtraInfo: 0,
            },
        },
    }
}

/// Send Ctrl+C to whatever window currently has focus.
///
/// Used by the text-selection feature: UI Automation for selections is a large
/// amount of COM plumbing, and every mainstream clipboard tool (including the
/// Electron build of this app) uses the same shortcut simulation.
pub fn send_ctrl_c() {
    let events = [
        key_event(VK_CONTROL, false),
        key_event(VK_C, false),
        key_event(VK_C, true),
        key_event(VK_CONTROL, true),
    ];
    unsafe {
        SendInput(
            events.len() as u32,
            events.as_ptr(),
            std::mem::size_of::<INPUT>() as i32,
        );
    }
}

pub fn cursor_pos() -> (i32, i32) {
    unsafe {
        let mut p = POINT::default();
        GetCursorPos(&mut p);
        (p.x, p.y)
    }
}

// ---------------------------------------------------------------------------
// Elevation probe — why a synthetic Ctrl+C may be silently dropped
// ---------------------------------------------------------------------------

const PROCESS_QUERY_LIMITED_INFORMATION: u32 = 0x1000;
const TOKEN_QUERY: u32 = 0x0008;
const TOKEN_ELEVATION: u32 = 20;

/// Is the process that owns `hwnd` running elevated (admin)?
///
/// UIPI silently discards injected input aimed at a *higher* integrity process,
/// which is exactly what happens when we try to Ctrl+C a selection inside an
/// app that was started as administrator. Knowing this turns "划词没反应" into
/// an explainable, fixable situation.
pub fn hwnd_elevated(hwnd: HWND) -> bool {
    unsafe {
        let mut pid: u32 = 0;
        GetWindowThreadProcessId(hwnd, &mut pid);
        if pid == 0 {
            return false;
        }
        let process = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, 0, pid);
        if process.is_null() {
            return false;
        }
        let out = elevation_of_process(process);
        CloseHandle(process);
        out
    }
}

pub fn foreground_window() -> HWND {
    unsafe { GetForegroundWindow() }
}

fn elevation_of_process(process: *mut c_void) -> bool {
    unsafe {
        let mut token: *mut c_void = std::ptr::null_mut();
        if OpenProcessToken(process, TOKEN_QUERY, &mut token) == 0 {
            return false;
        }
        let mut elev: u32 = 0;
        let mut ret: u32 = 0;
        let ok = GetTokenInformation(token, TOKEN_ELEVATION,
                                     &mut elev as *mut u32 as *mut c_void, 4, &mut ret);
        CloseHandle(token);
        ok != 0 && elev != 0
    }
}

/// Single-instance guard. Returns false when another instance already holds
/// the mutex — two instances would both watch the mouse and fight over the
/// clipboard, which reads as flakiness.
pub fn acquire_single_instance(name: &str) -> bool {
    let wide: Vec<u16> = name.encode_utf16().chain(std::iter::once(0)).collect();
    unsafe {
        let mutex = CreateMutexW(std::ptr::null_mut(), 0, wide.as_ptr());
        if mutex.is_null() {
            return true; // couldn't create — don't block the app on a guard
        }
        // ERROR_ALREADY_EXISTS = 183. The handle is deliberately leaked: it must
        // stay held for the process lifetime.
        GetLastError() != 183
    }
}
