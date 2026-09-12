//! Screen capture via GDI, encoded to a PNG data URL.
//!
//! `desktopCapturer` has no Tauri equivalent, so this is the one piece of the
//! Electron port that had to be written from scratch. GDI `BitBlt` from the
//! desktop DC is exactly what Electron's capturer does under the hood on
//! Windows, and it costs no extra dependencies.

use crate::winmod::*;
use std::ffi::c_void;

/// Capture a rectangle of the virtual desktop at physical resolution.
///
/// Returns a `data:image/png;base64,…` URL — the same shape the renderer
/// expects from Electron's `thumbnail.toDataURL()`. The callers pass a whole
/// monitor rect, so the mask's local coordinates map onto the image 1:1.
pub fn capture_rect(rx: i32, ry: i32, rw: i32, rh: i32) -> Result<String, String> {
    unsafe {
        // Per-monitor DPI awareness so GetSystemMetrics reports physical pixels
        // even on scaled displays (WebView2 usually sets this already; the call
        // is idempotent and harmless when it fails).
        let _ = SetProcessDpiAwarenessContext(DPI_PER_MONITOR_V2);

        let vw = rw;
        let vh = rh;
        if vw <= 0 || vh <= 0 {
            return Err("无效的捕获区域".into());
        }

        let screen_dc = GetDC(std::ptr::null_mut());
        if screen_dc.is_null() {
            return Err("GetDC 失败".into());
        }
        let mem_dc = CreateCompatibleDC(screen_dc);
        let bitmap = CreateCompatibleBitmap(screen_dc, vw, vh);
        if mem_dc.is_null() || bitmap.is_null() {
            ReleaseDC(std::ptr::null_mut(), screen_dc);
            return Err("创建兼容位图失败".into());
        }
        let old = SelectObject(mem_dc, bitmap);

        let blt = BitBlt(mem_dc, 0, 0, vw, vh, screen_dc, rx, ry, SRCCOPY);
        if blt == 0 {
            SelectObject(mem_dc, old);
            DeleteObject(bitmap);
            DeleteDC(mem_dc);
            ReleaseDC(std::ptr::null_mut(), screen_dc);
            return Err("BitBlt 失败".into());
        }

        // Pull the pixels out as top-down BGRA.
        let mut info = BITMAPINFO::default();
        info.bmiHeader.biSize = std::mem::size_of::<BITMAPINFOHEADER>() as u32;
        info.bmiHeader.biWidth = vw;
        info.bmiHeader.biHeight = -vh; // negative → top-down rows
        info.bmiHeader.biPlanes = 1;
        info.bmiHeader.biBitCount = 32;
        info.bmiHeader.biCompression = BI_RGB;

        let mut buf = vec![0u8; (vw as usize) * (vh as usize) * 4];
        let lines = GetDIBits(
            mem_dc,
            bitmap,
            0,
            vh as u32,
            buf.as_mut_ptr() as *mut c_void,
            &mut info,
            DIB_RGB_COLORS,
        );

        SelectObject(mem_dc, old);
        DeleteObject(bitmap);
        DeleteDC(mem_dc);
        ReleaseDC(std::ptr::null_mut(), screen_dc);

        if lines == 0 {
            return Err("GetDIBits 失败".into());
        }

        // BGRA → RGBA in place.
        for px in buf.chunks_exact_mut(4) {
            px.swap(0, 2);
            px[3] = 255;
        }

        let png = encode_png(&buf, vw as u32, vh as u32)?;
        Ok(format!("data:image/png;base64,{}", b64(&png)))
    }
}

fn encode_png(rgba: &[u8], width: u32, height: u32) -> Result<Vec<u8>, String> {
    let mut out = Vec::new();
    {
        let mut encoder = png::Encoder::new(&mut out, width, height);
        encoder.set_color(png::ColorType::Rgba);
        encoder.set_depth(png::BitDepth::Eight);
        // Fast compression: the mask blurs and dims this image anyway, and the
        // renderer only keeps the selected crop.
        encoder.set_compression(png::Compression::Fast);
        let mut writer = encoder.write_header().map_err(|e| e.to_string())?;
        writer.write_image_data(rgba).map_err(|e| e.to_string())?;
    }
    Ok(out)
}

// ---------------------------------------------------------------------------
// base64 (stdlib-only — avoids a dependency for 20 lines of code)
// ---------------------------------------------------------------------------
const TABLE: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

pub fn b64(data: &[u8]) -> String {
    let mut out = String::with_capacity((data.len() + 2) / 3 * 4);
    for chunk in data.chunks(3) {
        let b0 = chunk[0] as u32;
        let b1 = *chunk.get(1).unwrap_or(&0) as u32;
        let b2 = *chunk.get(2).unwrap_or(&0) as u32;
        let n = (b0 << 16) | (b1 << 8) | b2;
        out.push(TABLE[(n >> 18) as usize & 63] as char);
        out.push(TABLE[(n >> 12) as usize & 63] as char);
        out.push(if chunk.len() > 1 { TABLE[(n >> 6) as usize & 63] as char } else { '=' });
        out.push(if chunk.len() > 2 { TABLE[n as usize & 63] as char } else { '=' });
    }
    out
}
