"""Measure the two builds side by side.

Compares the Electron install (NSIS) against the Tauri build on the three
numbers that actually matter to a user: installer size, on-disk footprint, and
the size of the code payload alone (app.asar vs the Tauri exe).

Usage:  python tools/measure-size.py [--tauri-exe PATH] [--tauri-nsis PATH]
"""
import argparse
import json
import os
import sys

ELECTRON_INSTALL = r"C:\Users\zcxzx\AppData\Local\Programs\Vision Bridge"
ELECTRON_NSIS = r"C:\Users\zcxzx\VisionBridge\dist\Vision Bridge Setup 0.1.0.exe"
ELECTRON_PORTABLE = r"C:\Users\zcxzx\VisionBridge\dist\Vision Bridge 0.1.0.exe"

TAURI_ROOT = r"C:\Users\zcxzx\VisionBridge-Tauri"
TAURI_EXE = os.path.join(TAURI_ROOT, "src-tauri", "target", "release", "vision-bridge.exe")
TAURI_NSIS_DIR = os.path.join(TAURI_ROOT, "src-tauri", "target", "release", "bundle", "nsis")
TAURI_INSTALL = os.path.join(
    os.environ.get("LOCALAPPDATA", r"C:\Users\zcxzx\AppData\Local"),
    "Programs", "Vision Bridge (Tauri)")


def mb(n: int) -> float:
    return n / 1048576


def dir_size(path: str) -> int:
    total = 0
    for dp, _, fn in os.walk(path):
        for f in fn:
            try:
                total += os.path.getsize(os.path.join(dp, f))
            except OSError:
                pass
    return total


def file_size(path: str) -> int:
    return os.path.getsize(path) if os.path.isfile(path) else 0


def newest(directory: str, suffix: str) -> str:
    if not os.path.isdir(directory):
        return ""
    cands = [os.path.join(directory, f) for f in os.listdir(directory) if f.lower().endswith(suffix)]
    if not cands:
        return ""
    return max(cands, key=os.path.getmtime)


def row(label: str, electron: int, tauri: int) -> str:
    if tauri and electron:
        ratio = electron / tauri
        verdict = f"{ratio:.1f}x smaller"
    else:
        verdict = "-"
    return f"| {label} | {mb(electron):.1f} MB | {mb(tauri):.1f} MB | {verdict} |"


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--tauri-exe", default=TAURI_EXE)
    ap.add_argument("--tauri-nsis", default="")
    ap.add_argument("--json", default=os.path.join(TAURI_ROOT, "size-report.json"))
    args = ap.parse_args()

    tauri_nsis = args.tauri_nsis or newest(TAURI_NSIS_DIR, ".exe")

    e_install = dir_size(ELECTRON_INSTALL)
    e_asar = file_size(os.path.join(ELECTRON_INSTALL, "resources", "app.asar"))
    e_nsis = file_size(ELECTRON_NSIS)
    e_portable = file_size(ELECTRON_PORTABLE)

    t_exe = file_size(args.tauri_exe)
    t_bundle = dir_size(os.path.dirname(args.tauri_exe)) if args.tauri_exe else 0
    t_nsis = file_size(tauri_nsis)
    # Prefer the real installed footprint once the installer has been run.
    t_install = dir_size(TAURI_INSTALL) or t_exe
    # Tauri ships no runtime next to the exe — the "install" is just the exe.
    t_webview = "system WebView2 (shared)"

    print("## 体积对比\n")
    print("| 指标 | Electron | Tauri | 结果 |")
    print("|---|---|---|---|")
    print(row("安装包 (setup)", e_nsis, t_nsis))
    print(row("免安装单文件", e_portable, t_exe))
    print(row("安装后磁盘占用", e_install, t_install))
    print(row("程序代码体积", e_asar, t_exe))
    print()
    print(f"- Electron 运行时: 随包分发 Chromium + Node（安装目录 {mb(e_install):.1f} MB）")
    print(f"- Tauri 运行时: {t_webview}")
    if e_install and t_install:
        print(f"- **安装后体积比: {e_install / t_install:.0f}x**")
    if e_nsis and t_nsis:
        print(f"- **安装包体积比: {e_nsis / t_nsis:.0f}x**")
    if e_portable and t_exe:
        print(f"- **单文件体积比: {e_portable / t_exe:.1f}x**")

    report = {
        "electron": {
            "install_dir_bytes": e_install,
            "app_asar_bytes": e_asar,
            "nsis_bytes": e_nsis,
            "portable_bytes": e_portable,
        },
        "tauri": {
            "exe_bytes": t_exe,
            "installed_dir_bytes": t_install,
            "release_dir_bytes": t_bundle,
            "nsis_bytes": t_nsis,
            "nsis_path": tauri_nsis,
        },
    }
    with open(args.json, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2, ensure_ascii=False)
    print(f"\n(已写入 {args.json})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
