"""Screenshot a window by title, straight from the Windows desktop DC.

Used to capture the *running* Tauri build so the port can be compared against
the Electron screenshots. `PrintWindow` returns blank content for WebView2
surfaces, so this grabs the composited desktop pixels at the window rect
instead — which is what the user actually sees.

Usage:  python tools/grab-window.py <title-substring> <out.png> [--delay 3]
"""
import argparse
import ctypes
import ctypes.wintypes as wt
import os
import struct
import sys
import time
import zlib

user32 = ctypes.windll.user32
gdi32 = ctypes.windll.gdi32
user32.SetProcessDPIAware()


class RECT(ctypes.Structure):
    _fields_ = [("left", ctypes.c_long), ("top", ctypes.c_long),
                ("right", ctypes.c_long), ("bottom", ctypes.c_long)]


def find_window(substr: str):
    """Return (hwnd, pid, title, x, y, w, h) for visible top-level windows."""
    return _enumerate(lambda title, _pid: substr.lower() in title.lower())


def find_window_by_pid(pid: int, min_size: int = 80):
    """Match by owning process instead of title.

    Needed because the app rewrites its own window title once the frontend
    reports in ("VB:main"), so a title match made before load stops working
    afterwards. `min_size=0` also catches small popups such as the 280×52
    selection toolbar.
    """
    return _enumerate(lambda _title, owner: owner == pid, min_size)


def _enumerate(predicate, min_size: int = 80):
    result = []

    @ctypes.WINFUNCTYPE(ctypes.c_bool, wt.HWND, wt.LPARAM)
    def cb(hwnd, _lparam):
        if not user32.IsWindowVisible(hwnd):
            return True
        length = user32.GetWindowTextLengthW(hwnd)
        if length == 0:
            return True
        buf = ctypes.create_unicode_buffer(length + 1)
        user32.GetWindowTextW(hwnd, buf, length + 1)
        title = buf.value
        pid = wt.DWORD()
        user32.GetWindowThreadProcessId(hwnd, ctypes.byref(pid))
        if not predicate(title, pid.value):
            return True
        rect = RECT()
        user32.GetWindowRect(hwnd, ctypes.byref(rect))
        w = rect.right - rect.left
        h = rect.bottom - rect.top
        if w > min_size and h > min_size:
            result.append((hwnd, pid.value, title, rect.left, rect.top, w, h))
        return True

    user32.EnumWindows(cb, 0)
    return result


def virtual_screen_rect():
    """(x, y, w, h) of the whole virtual desktop, in physical pixels."""
    SM_X, SM_Y, SM_CX, SM_CY = 76, 77, 78, 79
    return (user32.GetSystemMetrics(SM_X), user32.GetSystemMetrics(SM_Y),
            user32.GetSystemMetrics(SM_CX), user32.GetSystemMetrics(SM_CY))


def capture(x: int, y: int, w: int, h: int) -> bytes:
    hdc_screen = user32.GetDC(None)
    hdc_mem = gdi32.CreateCompatibleDC(hdc_screen)
    hbm = gdi32.CreateCompatibleBitmap(hdc_screen, w, h)
    gdi32.SelectObject(hdc_mem, hbm)
    SRCCOPY = 0x00CC0020
    if not gdi32.BitBlt(hdc_mem, 0, 0, w, h, hdc_screen, x, y, SRCCOPY):
        raise OSError("BitBlt failed")

    class BITMAPINFOHEADER(ctypes.Structure):
        _fields_ = [
            ("biSize", wt.DWORD), ("biWidth", ctypes.c_long), ("biHeight", ctypes.c_long),
            ("biPlanes", wt.WORD), ("biBitCount", wt.WORD), ("biCompression", wt.DWORD),
            ("biSizeImage", wt.DWORD), ("biXPelsPerMeter", ctypes.c_long),
            ("biYPelsPerMeter", ctypes.c_long), ("biClrUsed", wt.DWORD),
            ("biClrImportant", wt.DWORD),
        ]

    class BITMAPINFO(ctypes.Structure):
        _fields_ = [("bmiHeader", BITMAPINFOHEADER), ("bmiColors", wt.DWORD * 3)]

    info = BITMAPINFO()
    info.bmiHeader.biSize = ctypes.sizeof(BITMAPINFOHEADER)
    info.bmiHeader.biWidth = w
    info.bmiHeader.biHeight = -h          # top-down
    info.bmiHeader.biPlanes = 1
    info.bmiHeader.biBitCount = 32
    info.bmiHeader.biCompression = 0      # BI_RGB

    buf = ctypes.create_string_buffer(w * h * 4)
    gdi32.GetDIBits(hdc_mem, hbm, 0, h, buf, ctypes.byref(info), 0)
    gdi32.DeleteObject(hbm)
    gdi32.DeleteDC(hdc_mem)
    user32.ReleaseDC(None, hdc_screen)

    raw = bytearray(buf.raw)
    for i in range(0, len(raw), 4):
        raw[i], raw[i + 2] = raw[i + 2], raw[i]
        raw[i + 3] = 255
    return bytes(raw)


def write_png(path: str, rgba: bytes, w: int, h: int) -> None:
    def chunk(tag: bytes, data: bytes) -> bytes:
        body = tag + data
        return struct.pack(">I", len(data)) + body + struct.pack(">I", zlib.crc32(body) & 0xFFFFFFFF)

    ihdr = struct.pack(">IIBBBBB", w, h, 8, 6, 0, 0, 0)
    rows = b"".join(b"\x00" + rgba[y * w * 4:(y + 1) * w * 4] for y in range(h))
    png = (b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", ihdr)
           + chunk(b"IDAT", zlib.compress(rows, 6)) + chunk(b"IEND", b""))
    with open(path, "wb") as f:
        f.write(png)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("title")
    ap.add_argument("out")
    ap.add_argument("--delay", type=float, default=0.0)
    args = ap.parse_args()

    if args.delay:
        time.sleep(args.delay)

    wins = find_window(args.title)
    if not wins:
        print(f"[grab] no visible window matching {args.title!r}")
        return 1

    # Largest match wins — the app's own window, not a tooltip.
    hwnd, pid, title, x, y, w, h = max(wins, key=lambda r: r[5] * r[6])
    print(f"[grab] hwnd={hwnd} pid={pid} title={title!r} rect=({x},{y},{w}x{h})")

    user32.SetForegroundWindow(hwnd)
    time.sleep(0.5)
    rgba = capture(x, y, w, h)
    os.makedirs(os.path.dirname(os.path.abspath(args.out)), exist_ok=True)
    write_png(args.out, rgba, w, h)
    print(f"[grab] wrote {args.out} ({os.path.getsize(args.out) / 1024:.1f} KB)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
