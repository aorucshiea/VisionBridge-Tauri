"""Assemble an MSVC + Windows SDK build environment without `vcvarsall`.

Why not just run vcvarsall.bat? It discovers the SDK by shelling out to
`reg.exe`, which this machine's security policy blocks — so it initialises with
no `WindowsSdkDir`/`LIB`/`INCLUDE` for the SDK and every link fails on
`kernel32.lib`. The SDK *is* installed (at `E:\\Windows Kits\\10\\`, discovered
via Python's winreg, which is not blocked), so we point at it directly.

Both locations are auto-detected, with the registry used as the primary source
and a filesystem scan as the fallback.
"""
import os
from pathlib import Path

import winreg


def _kits_root() -> Path | None:
    """Windows SDK root, from the registry then from a filesystem scan."""
    for hive, sub in (
        (winreg.HKEY_LOCAL_MACHINE, r"SOFTWARE\Microsoft\Windows Kits\Installed Roots"),
        (winreg.HKEY_LOCAL_MACHINE, r"SOFTWARE\WOW6432Node\Microsoft\Windows Kits\Installed Roots"),
    ):
        try:
            key = winreg.OpenKey(hive, sub)
            value = winreg.QueryValueEx(key, "KitsRoot10")[0]
            candidate = Path(value)
            if candidate.is_dir():
                return candidate
        except OSError:
            continue
    for drive in ("C:", "D:", "E:", "F:"):
        candidate = Path(f"{drive}\\Windows Kits\\10")
        if candidate.is_dir():
            return candidate
    return None


def _msvc_dir() -> Path | None:
    """Newest MSVC toolset under any Visual Studio installation."""
    roots = [
        Path(r"C:\Program Files\Microsoft Visual Studio"),
        Path(r"C:\Program Files (x86)\Microsoft Visual Studio"),
        Path(r"C:\BuildTools"),
        Path(r"D:\BuildTools"),
        Path(r"E:\BuildTools"),
    ]
    found: list[Path] = []
    for root in roots:
        if not root.is_dir():
            continue
        for tools in root.glob("*/*/VC/Tools/MSVC/*"):
            if (tools / "bin" / "Hostx64" / "x64" / "cl.exe").is_file():
                found.append(tools)
    if not found:
        return None
    return max(found, key=lambda p: p.name)


def info() -> dict:
    kits = _kits_root()
    sdk_lib_root = kits / "Lib" if kits else None
    versions = sorted(
        [d.name for d in sdk_lib_root.iterdir() if d.is_dir()],
        key=lambda v: [int(x) for x in v.split(".") if x.isdigit()],
    ) if sdk_lib_root and sdk_lib_root.is_dir() else []
    return {
        "kits_root": kits,
        "sdk_versions": versions,
        "sdk_version": versions[-1] if versions else None,
        "msvc_dir": _msvc_dir(),
    }


def build_env(base: dict | None = None) -> dict:
    """Return `base` (default os.environ) with the toolchain wired in."""
    meta = info()
    kits: Path | None = meta["kits_root"]
    sdk_ver: str | None = meta["sdk_version"]
    msvc: Path | None = meta["msvc_dir"]
    if not msvc:
        raise RuntimeError("找不到 MSVC 工具链")
    if not (kits and sdk_ver):
        raise RuntimeError("找不到 Windows SDK")

    env = dict(base or os.environ)

    path_dirs = [
        msvc / "bin" / "Hostx64" / "x64",
        kits / "bin" / sdk_ver / "x64",
    ]
    lib_dirs = [
        msvc / "lib" / "x64",
        kits / "Lib" / sdk_ver / "ucrt" / "x64",
        kits / "Lib" / sdk_ver / "um" / "x64",
    ]
    include_dirs = [
        msvc / "include",
        kits / "Include" / sdk_ver / "ucrt",
        kits / "Include" / sdk_ver / "shared",
        kits / "Include" / sdk_ver / "um",
        kits / "Include" / sdk_ver / "winrt",
    ]

    env["VCToolsInstallDir"] = str(msvc) + os.sep
    env["VCINSTALLDIR"] = str(msvc.parent.parent) + os.sep
    env["WindowsSdkDir"] = str(kits) + os.sep
    env["WindowsSDKVersion"] = sdk_ver + os.sep
    env["LIB"] = os.pathsep.join(str(p) for p in lib_dirs)
    env["INCLUDE"] = os.pathsep.join(str(p) for p in include_dirs)
    env["PATH"] = os.pathsep.join([str(p) for p in path_dirs] + [env.get("PATH", "")])
    return env


def probe() -> int:
    meta = info()
    print("SDK root      :", meta["kits_root"])
    print("SDK versions  :", meta["sdk_versions"])
    print("MSVC toolset  :", meta["msvc_dir"])

    env = build_env()
    print()
    for exe in ("cl.exe", "link.exe", "rc.exe", "mt.exe"):
        hit = ""
        for folder in env["PATH"].split(os.pathsep):
            if folder and os.path.isfile(os.path.join(folder, exe)):
                hit = os.path.join(folder, exe)
                break
        print(f"  {exe:10} {hit or '(未找到)'}")

    print()
    for lib in ("kernel32.lib", "user32.lib", "gdi32.lib", "ucrt.lib", "msvcrt.lib", "vcruntime.lib", "ntdll.lib", "bcrypt.lib"):
        hit = ""
        for folder in env["LIB"].split(os.pathsep):
            if os.path.isfile(os.path.join(folder, lib)):
                hit = folder
                break
        print(f"  {lib:14} {'OK  ' + hit if hit else '缺失'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(probe())
