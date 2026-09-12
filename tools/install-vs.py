"""Launch the VS Build Tools bootstrapper with a sanitised environment.

The bootstrapper is a .NET app whose dictionary is case-insensitive, so having
both `HTTP_PROXY` and `http_proxy` in the environment makes it die with
`0x80070057: 已添加项`. We keep exactly one spelling per proxy variable.
"""
import os
import re
import subprocess
import sys

EXE = r"C:\Users\zcxzx\.workbuddy\binaries\vs_BuildTools.exe"
LOG = r"C:\Users\zcxzx\vs-buildtools3.log"

PROXY_KEYS = {"http_proxy", "https_proxy", "all_proxy", "no_proxy"}

env = {}
seen = set()
dropped = []
for k, v in os.environ.items():
    lk = k.lower()
    if lk in PROXY_KEYS:
        if lk in seen:
            dropped.append(k)
            continue
        seen.add(lk)
    env[k] = v

print("[install-vs] dropped duplicate proxy keys:", dropped)
for lk in sorted(PROXY_KEYS):
    for k in env:
        if k.lower() == lk:
            print(f"[install-vs]   {k} = {re.sub(r'//.*@', '//***@', env[k])}")

for lk in PROXY_KEYS:
    if lk not in seen:
        print(f"[install-vs]   {lk} = (absent)")

args = [
    EXE,
    "--quiet",
    "--wait",
    "--norestart",
    "--nocache",
    "--add", "Microsoft.VisualStudio.Workload.VCTools",
    "--includeRecommended",
]

print("[install-vs] launching:", " ".join(args[:6]), "...")
with open(LOG, "w", encoding="utf-8") as f:
    rc = subprocess.call(args, env=env, stdout=f, stderr=subprocess.STDOUT)
print(f"[install-vs] bootstrapper exit code: {rc}")
sys.exit(rc)
