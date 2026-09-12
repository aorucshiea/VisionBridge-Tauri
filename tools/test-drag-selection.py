"""End-to-end test of the drag-selection path using injected mouse input.

The watcher polls `GetAsyncKeyState`, which reflects injected input too, so a
synthetic drag exercises the real code path: detect drag -> Ctrl+C -> read
clipboard -> push selection -> toolbar appears.

Usage: python tools/test-drag-selection.py
"""
import os
import subprocess
import sys
import time
import ctypes
import ctypes.wintypes as wt
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from importlib import import_module  # noqa: E402

grab = import_module("grab-window")
user32 = ctypes.windll.user32
user32.SetProcessDPIAware()

ROOT = Path(__file__).resolve().parent.parent
INSTALLED = Path(os.environ["LOCALAPPDATA"]) / "Programs" / "Vision Bridge (Tauri)" / "vision-bridge.exe"
TEST_TXT = Path(os.environ["TEMP"]) / "vb-drag-test.txt"

# --- SendInput plumbing -----------------------------------------------------
PUL = ctypes.POINTER(ctypes.c_ulong)


class MOUSEINPUT(ctypes.Structure):
    _fields_ = [("dx", ctypes.c_long), ("dy", ctypes.c_long),
                ("mouseData", ctypes.c_ulong), ("dwFlags", ctypes.c_ulong),
                ("time", ctypes.c_ulong), ("dwExtraInfo", PUL)]


class _INPUTUNION(ctypes.Union):
    _fields_ = [("mi", MOUSEINPUT)]


class INPUT(ctypes.Structure):
    _fields_ = [("type", ctypes.c_ulong), ("union", _INPUTUNION)]


MOUSEEVENTF_MOVE = 0x0001
MOUSEEVENTF_LEFTDOWN = 0x0002
MOUSEEVENTF_LEFTUP = 0x0004
MOUSEEVENTF_ABSOLUTE = 0x8000


def mouse_event(flags, dx=0, dy=0):
    inp = INPUT(type=0)
    inp.union.mi = MOUSEINPUT(dx, dy, 0, flags, 0, None)
    user32.SendInput(1, ctypes.byref(inp), ctypes.sizeof(INPUT))


def move_to(x, y):
    """Absolute virtual-screen coordinates -> normalised SendInput space."""
    sx, sy, sw, sh = grab.virtual_screen_rect()
    nx = int((x - sx) * 65535 / max(sw - 1, 1))
    ny = int((y - sy) * 65535 / max(sh - 1, 1))
    mouse_event(MOUSEEVENTF_MOVE | MOUSEEVENTF_ABSOLUTE, nx, ny)


def drag(x1, y1, x2, y2, steps=18):
    move_to(x1, y1)
    time.sleep(0.15)
    mouse_event(MOUSEEVENTF_LEFTDOWN)
    time.sleep(0.12)
    for i in range(1, steps + 1):
        move_to(x1 + (x2 - x1) * i // steps, y1 + (y2 - y1) * i // steps)
        time.sleep(0.035)
    time.sleep(0.15)
    mouse_event(MOUSEEVENTF_LEFTUP)
    print(f"[drag] {x1},{y1} -> {x2},{y2}")


def main() -> int:
    subprocess.run(["taskkill", "/IM", "vision-bridge.exe", "/F"],
                   capture_output=True, text=True, encoding="gbk", errors="replace")
    subprocess.run(["taskkill", "/IM", "notepad.exe", "/F"],
                   capture_output=True, text=True, encoding="gbk", errors="replace")
    time.sleep(1)

    TEST_TXT.write_text(
        "Vision Bridge drag selection test line one. The quick brown fox jumps over the lazy dog.\n"
        "Second line with more words so a horizontal drag always lands on text.\n",
        encoding="utf-8",
    )

    log = open(ROOT / "logs" / "drag-test.log", "w", encoding="utf-8")
    proc = subprocess.Popen([str(INSTALLED)], cwd=str(INSTALLED.parent),
                            stdout=log, stderr=subprocess.STDOUT,
                            creationflags=0x00000008 | 0x00000200, close_fds=True)
    print(f"[test] app pid={proc.pid}")
    time.sleep(4)

    # Notepad with a known text, positioned top-left.
    subprocess.Popen(["notepad.exe", str(TEST_TXT)])
    time.sleep(2.5)
    pads = grab._enumerate(lambda t, p: "notepad" in t.lower() or "记事本" in t, min_size=0)
    if not pads:
        print("[test] FAIL: notepad window not found")
        return 1
    hwnd, _pid, title, nx, ny, nw, nh = max(pads, key=lambda r: r[5] * r[6])
    print(f"[test] notepad: {title!r} rect=({nx},{ny}) {nw}x{nh}")
    user32.SetForegroundWindow(hwnd)
    time.sleep(0.6)

    # Drag across the first text line (inside the client area, below the menu).
    x1, y1 = nx + 40, ny + 95
    x2, y2 = nx + min(nw - 60, 520), ny + 95
    drag(x1, y1, x2, y2)

    time.sleep(2.5)
    tools = [w for w in grab.find_window_by_pid(proc.pid, min_size=0) if 200 < w[5] < 320]
    print(f"[test] toolbar windows: {len(tools)}")
    for hwnd, pid, title, x, y, w, h in tools:
        print(f"   rect=({x},{y}) {w}x{h} title={title!r}")

    print("[test] app log:")
    print(open(ROOT / "logs" / "drag-test.log", encoding="utf-8", errors="replace").read()[-1200:])

    subprocess.run(["taskkill", "/IM", "notepad.exe", "/F"],
                   capture_output=True, text=True, encoding="gbk", errors="replace")
    return 0 if tools else 1


if __name__ == "__main__":
    sys.exit(main())
