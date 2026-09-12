"""Install the Tauri build with its own installer and verify the result."""
import os
import subprocess
import sys
import time
import winreg
from pathlib import Path

ROOT = Path(r"C:\Users\zcxzx\VisionBridge-Tauri")
SETUP = ROOT / "src-tauri" / "target" / "release" / "bundle" / "nsis" / "Vision Bridge (Tauri) Setup 0.1.0.exe"
INSTALL_DIR = Path(os.environ["LOCALAPPDATA"]) / "Programs" / "Vision Bridge (Tauri)"
APP_EXE = INSTALL_DIR / "vision-bridge.exe"
UNINST_KEY = r"Software\Microsoft\Windows\CurrentVersion\Uninstall\VisionBridgeTauri"


def main() -> int:
    print("installer:", SETUP.is_file(), f"{SETUP.stat().st_size / 1048576:.2f} MB")
    print("running silent install ...")
    started = time.time()
    rc = subprocess.call([str(SETUP), "/S"])
    print(f"installer exit={rc} in {time.time() - started:.0f}s")

    print()
    print("=== 安装目录 ===")
    print(" ", INSTALL_DIR, INSTALL_DIR.is_dir())
    if INSTALL_DIR.is_dir():
        total = 0
        for f in sorted(INSTALL_DIR.iterdir()):
            total += f.stat().st_size
            print(f"   {f.name:32} {f.stat().st_size / 1048576:.2f} MB")
        print(f"   合计: {total / 1048576:.2f} MB")

    print()
    print("=== 快捷方式 ===")
    for p in (Path(os.environ["APPDATA"]) / "Microsoft" / "Windows" / "Start Menu" / "Programs" / "Vision Bridge (Tauri).lnk",
              Path(os.environ["USERPROFILE"]) / "Desktop" / "Vision Bridge (Tauri).lnk"):
        print(f"  {p.name:36} {p.is_file()}")

    print()
    print("=== 卸载注册表项 ===")
    try:
        k = winreg.OpenKey(winreg.HKEY_CURRENT_USER, UNINST_KEY)
        for name in ("DisplayName", "DisplayVersion", "Publisher", "InstallLocation",
                     "UninstallString", "EstimatedSize"):
            try:
                print(f"  {name:16} {winreg.QueryValueEx(k, name)[0]}")
            except OSError:
                print(f"  {name:16} (未设置)")
    except OSError as e:
        print("  ", e)

    print()
    print("=== 启动验证 ===")
    if APP_EXE.is_file():
        log = open(ROOT / "tauri-installed-run.log", "w", encoding="utf-8")
        flags = 0x00000008 | 0x00000200
        proc = subprocess.Popen([str(APP_EXE)], cwd=str(INSTALL_DIR),
                                stdout=log, stderr=subprocess.STDOUT,
                                creationflags=flags, close_fds=True)
        print("  launched pid", proc.pid)
        time.sleep(6)
        r = subprocess.run(["tasklist", "/FI", "IMAGENAME eq vision-bridge.exe", "/FO", "CSV"],
                           capture_output=True, text=True, encoding="gbk", errors="replace")
        alive = [l for l in (r.stdout or "").splitlines() if l.startswith('"')]
        print("  processes alive:", len(alive))
        print("  log tail:", open(ROOT / "tauri-installed-run.log", encoding="utf-8",
                                 errors="replace").read()[-400:] or "(empty)")
        subprocess.run(["taskkill", "/IM", "vision-bridge.exe", "/F"],
                       capture_output=True, text=True, encoding="gbk", errors="replace")
        return 0 if alive else 1
    print("  app exe missing")
    return 1


if __name__ == "__main__":
    sys.exit(main())
