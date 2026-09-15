"""Build the Tauri app with a correctly wired MSVC + SDK environment.

    python tools/build-tauri.py             # cargo build --release (fast check)
    python tools/build-tauri.py --cli       # tauri build --no-bundle  <-- USE THIS
    python tools/build-tauri.py --bundle    # tauri build (also NSIS installer)

`cargo build --release` alone produces an exe that **does not work**: tauri-build
cannot tell it apart from a dev build, so the app navigates to `devUrl`
(http://localhost:1420), finds nothing listening, and shows a WebView2 error
page. Only the Tauri CLI sets the TAURI_ENV_* variables that flip it into
production mode with embedded assets.

Everything runs from one place so the environment is assembled exactly once and
identically for cargo, rustc, tauri-build (which needs `rc.exe`) and the linker.
"""
import argparse
import os
import subprocess
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from importlib import import_module  # noqa: E402

msvc_env = import_module("msvc-env").build_env  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
SRC_TAURI = ROOT / "src-tauri"
# Prefer the toolchain copy inside .rustup; `~/.cargo/bin` is a rustup shim
# directory that has proven fragile (it went missing on this machine while
# .rustup survived, so never hard-depend on it).
CARGO = Path(r"C:\Users\zcxzx\.rustup\toolchains\stable-x86_64-pc-windows-msvc\bin\cargo.exe")
if not CARGO.is_file():
    CARGO = Path(os.path.expanduser("~")) / ".cargo" / "bin" / "cargo.exe"
NODE = Path(r"C:\Users\zcxzx\.workbuddy\binaries\node\versions\22.22.2-3\node.exe")
TAURI_CLI = ROOT / "node_modules" / "@tauri-apps" / "cli" / "tauri.js"


def run(args, env, log_path, cwd):
    print(f"[build] {' '.join(str(a) for a in args)}", flush=True)
    started = time.time()
    with open(log_path, "w", encoding="utf-8") as f:
        rc = subprocess.call([str(a) for a in args], env=env, cwd=str(cwd),
                             stdout=f, stderr=subprocess.STDOUT)
    print(f"[build] exit={rc} in {time.time() - started:.0f}s -> {log_path}", flush=True)
    if rc != 0:
        text = open(log_path, encoding="utf-8", errors="replace").read()
        errors = [l for l in text.splitlines() if l.lower().startswith(("error", "  error"))]
        print("[build] --- errors ---", flush=True)
        for line in errors[:40]:
            print("   ", line[:200], flush=True)
        print("[build] --- tail ---", flush=True)
        print(text[-1500:], flush=True)
    return rc


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--cli", action="store_true", help="use the Tauri CLI (required for a working exe)")
    ap.add_argument("--bundle", action="store_true", help="also build the NSIS installer")
    ap.add_argument("--log", default="cargo-build.log")
    args = ap.parse_args()

    env = msvc_env()
    # The CLI shells out to cargo; make sure it finds the same toolchain.
    env["PATH"] = os.pathsep.join([str(CARGO.parent), env.get("PATH", "")])

    if args.cli or args.bundle:
        cmd = [NODE, TAURI_CLI, "build"]
        if not args.bundle:
            cmd.append("--no-bundle")
        rc = run(cmd, env, ROOT / args.log, ROOT)
    else:
        rc = run([CARGO, "build", "--release"], env, SRC_TAURI / args.log, SRC_TAURI)

    exe = SRC_TAURI / "target" / "release" / "vision-bridge.exe"
    print()
    if exe.is_file():
        print(f"[build] exe: {exe}  ({exe.stat().st_size / 1048576:.2f} MB)", flush=True)
    else:
        print("[build] exe NOT produced", flush=True)

    nsis_dir = SRC_TAURI / "target" / "release" / "bundle" / "nsis"
    if nsis_dir.is_dir():
        for f in sorted(nsis_dir.iterdir()):
            print(f"[build] bundle: {f.name}  ({f.stat().st_size / 1048576:.2f} MB)", flush=True)

    return rc


if __name__ == "__main__":
    sys.exit(main())
