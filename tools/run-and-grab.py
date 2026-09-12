"""Launch the Tauri build, screenshot its window, report its title.

One script on purpose: this shell reaps child processes when the command that
spawned them exits, so launching the app in one call and grabbing in another
would always photograph an empty desktop.

The window title is the render handshake: the frontend sets `VB:<window>` once
its bundle executes, or `VB-BUNDLE-MISSING` / `VB-ERRORS:<n>` if it did not.
"""
import os
import subprocess
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from importlib import import_module  # noqa: E402

grab = import_module("grab-window")

ROOT = Path(__file__).resolve().parent.parent
EXE = ROOT / "src-tauri" / "target" / "release" / "vision-bridge.exe"
OUT_DIR = ROOT / "preview"


def kill_previous() -> None:
    subprocess.run(["taskkill", "/IM", "vision-bridge.exe", "/F"],
                   capture_output=True, text=True, encoding="gbk", errors="replace")


def main() -> int:
    OUT_DIR.mkdir(exist_ok=True)
    kill_previous()
    time.sleep(1)

    log = open(ROOT / "tauri-run.log", "w", encoding="utf-8")
    env = dict(os.environ)
    # Ask WebView2 for verbose logs; it writes debug.log into the app's
    # user-data folder, which is the only place a failed navigation explains
    # itself.
    env["WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS"] = "--enable-logging --v=1"
    flags = 0x00000008 | 0x00000200  # DETACHED_PROCESS | CREATE_NEW_PROCESS_GROUP
    proc = subprocess.Popen([str(EXE)], cwd=str(EXE.parent), env=env,
                            stdout=log, stderr=subprocess.STDOUT,
                            creationflags=flags, close_fds=True)
    print(f"[run] launched pid={proc.pid}")

    # 6 s: long enough for WebView2 to spin up and for the 3.5 s handshake timer.
    time.sleep(6.0)
    wins = grab.find_window_by_pid(proc.pid)
    if not wins:
        print("[run] no window owned by the app PID; falling back to title search")
        wins = grab.find_window("Vision")
    if not wins:
        print("[run] FAILED: no window found")
        return 1

    hwnd, pid, title, x, y, w, h = max(wins, key=lambda r: r[5] * r[6])
    print(f"[run] window title={title!r} pid={pid} rect=({x},{y},{w}x{h})")

    grab.user32.SetForegroundWindow(hwnd)
    time.sleep(0.6)
    rgba = grab.capture(x, y, w, h)
    out = OUT_DIR / "tauri-main.png"
    grab.write_png(str(out), rgba, w, h)
    print(f"[run] wrote {out} ({out.stat().st_size / 1024:.1f} KB)")

    print()
    print(f"[run] RENDER-HANDSHAKE title = {title!r}")
    if title.startswith("VB:") and "MISSING" not in title:
        print("[run] => frontend bundle executed")
    else:
        print("[run] => frontend did NOT execute cleanly")

    print()
    print("[run] app log:")
    print(open(ROOT / "tauri-run.log", encoding="utf-8", errors="replace").read()[-1500:])
    return 0


if __name__ == "__main__":
    sys.exit(main())
