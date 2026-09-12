"""Compile the hand-written NSIS installer for the Tauri build.

Tauri's own bundler cannot be used here (see tools/README.md, pitfall 4), so the
installer is built with the NSIS 3.0.4.1 that electron-builder already cached.
The NSIS plugin ABI is stable across 3.x, so this is a like-for-like comparison
with the Electron build's own NSIS installer.

    python tools/make-installer.py
"""
import os
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MAKENSIS = Path(os.environ["LOCALAPPDATA"]) / "electron-builder" / "Cache" / "nsis" / "nsis-3.0.4.1" / "Bin" / "makensis.exe"
NSI = ROOT / "tools" / "installer.nsi"
EXE = ROOT / "src-tauri" / "target" / "release" / "vision-bridge.exe"
ICON = ROOT / "src-tauri" / "icons" / "icon.ico"
OUT = ROOT / "src-tauri" / "target" / "release" / "bundle" / "nsis" / "Vision Bridge (Tauri) Setup 0.1.0.exe"


def main() -> int:
    for path, label in ((MAKENSIS, "makensis"), (EXE, "app exe"), (ICON, "icon")):
        if not path.is_file():
            print(f"[installer] missing {label}: {path}")
            return 1
        print(f"[installer] {label:8} {path}")

    # NSIS rejects UTF-8 without a BOM as soon as the script contains non-ASCII.
    text = NSI.read_text(encoding="utf-8-sig")
    NSI.write_text(text, encoding="utf-8-sig", newline="\r\n")

    OUT.parent.mkdir(parents=True, exist_ok=True)
    cmd = [str(MAKENSIS), "/V2",
           f"/DAPP_EXE={EXE}", f"/DOUT_FILE={OUT}", f"/DICON_FILE={ICON}", str(NSI)]
    print("[installer] compiling ...")
    r = subprocess.run(cmd, capture_output=True, text=True, encoding="gbk", errors="replace")
    out = (r.stdout or "") + (r.stderr or "")
    if out.strip():
        print(out.strip()[-1200:])
    print(f"[installer] makensis exit={r.returncode}")
    if OUT.is_file():
        print(f"[installer] {OUT.name}  {OUT.stat().st_size / 1048576:.2f} MB")
        return 0
    return 1


if __name__ == "__main__":
    sys.exit(main())
