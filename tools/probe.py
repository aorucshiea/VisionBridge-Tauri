"""Launch the app with test env vars, then report window titles / screen stats.

Generic on purpose: every remaining question about this port ("are the tabs
wrapping?", "does the overlay dim?") is answerable by starting the app in a
particular mode and reading a number back out.

Usage:
    python tools/probe.py --env VB_DIAG=1 --wait 6
    python tools/probe.py --env VB_OPEN_MASK=1500 --wait 4 --stats overlay
"""
import argparse
import os
import subprocess
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from importlib import import_module  # noqa: E402

grab = import_module("grab-window")
screen_stats = import_module("screen-stats")

ROOT = Path(__file__).resolve().parent.parent
EXE = ROOT / "src-tauri" / "target" / "release" / "vision-bridge.exe"


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--env", action="append", default=[], help="KEY=VALUE (repeatable)")
    ap.add_argument("--wait", type=float, default=6.0)
    ap.add_argument("--stats", default="", help="record screen luminance under this label")
    ap.add_argument("--title", default="", help="also assert the window title")
    ap.add_argument("--shots", action="store_true", help="screenshot every app window")
    args = ap.parse_args()

    subprocess.run(["taskkill", "/IM", "vision-bridge.exe", "/F"],
                   capture_output=True, text=True, encoding="gbk", errors="replace")
    time.sleep(1)

    env = dict(os.environ)
    for pair in args.env:
        k, _, v = pair.partition("=")
        env[k.strip()] = v

    log_path = ROOT / "logs" / f"probe-{args.stats or 'title'}.log"
    log_path.parent.mkdir(exist_ok=True)
    log = open(log_path, "w", encoding="utf-8")
    proc = subprocess.Popen([str(EXE)], cwd=str(EXE.parent), env=env,
                            stdout=log, stderr=subprocess.STDOUT,
                            creationflags=0x00000008 | 0x00000200, close_fds=True)
    print(f"[probe] pid={proc.pid} env={args.env or '(none)'}")

    time.sleep(args.wait)
    wins = grab.find_window_by_pid(proc.pid, min_size=0)
    print(f"[probe] windows owned by pid: {len(wins)}")
    for hwnd, pid, title, x, y, w, h in wins:
        print(f"   title={title!r}")
        print(f"        rect=({x},{y}) {w}x{h}")

    if args.shots:
        out_dir = ROOT / "preview"
        out_dir.mkdir(exist_ok=True)
        for hwnd, pid, title, x, y, w, h in wins:
            grab.user32.SetForegroundWindow(hwnd)
            time.sleep(0.4)
            rgba = grab.capture(x, y, w, h)
            tag = title.split(":")[-1] if title.startswith("VB:") else title.replace(" ", "-")
            out = out_dir / f"win-{tag}-{w}x{h}.png"
            grab.write_png(str(out), rgba, w, h)
            print(f"[probe] saved {out.name} ({out.stat().st_size / 1024:.1f} KB)")

    if args.stats:
        x, y, w, h = grab.virtual_screen_rect()
        rgba = grab.capture(x, y, w, h)
        stats = screen_stats.luma_stats(rgba, w, h)
        print("[probe] screen " + "  ".join(f"{k}={v}" for k, v in stats.items()))
        out = ROOT / "preview" / f"screen-{args.stats}.png"
        grab.write_png(str(out), rgba, w, h)
        print(f"[probe] saved {out}")
        import json
        report_path = ROOT / "logs" / "screen-stats.json"
        report = json.load(open(report_path, encoding="utf-8")) if report_path.is_file() else {}
        report[args.stats] = {"rect": [x, y, w, h], **stats}
        json.dump(report, open(report_path, "w", encoding="utf-8"), indent=2, ensure_ascii=False)

    print()
    print("[probe] app log:")
    print(open(log_path, encoding="utf-8", errors="replace").read()[-800:] or "(empty)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
