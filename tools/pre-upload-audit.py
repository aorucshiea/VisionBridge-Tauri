# -*- coding: utf-8 -*-
"""Pre-upload audit: directory sizes + secret scan for VisionBridge-Tauri."""
import os
import re

root = r"C:\Users\zcxzx\VisionBridge-Tauri"

print("=== 根目录 ===")
for n in sorted(os.listdir(root)):
    p = os.path.join(root, n)
    if os.path.isdir(p):
        size = sum(os.path.getsize(os.path.join(dp, f)) for dp, _, fs in os.walk(p) for f in fs)
        print(f"  {n}/  {size / 1048576:.1f} MB")
    else:
        print(f"  {n}  {os.path.getsize(p) / 1024:.0f} KB")

print()
print("=== 敏感信息扫描 ===")
skip_dirs = {"node_modules", "target", "dist", ".git", "_history", "logs"}
pat = re.compile(
    r"(sk-[A-Za-z0-9]{8,}"
    r"|Bearer [A-Za-z0-9_\-\.]{20,}"
    r"|api[_-]?key\s*[:=]\s*['\"][^'\"]{12,}"
    r"|Authorization\s*[:=]\s*['\"][^'\"]{12,})",
    re.I,
)
hits = []
for dp, dn, fn in os.walk(root):
    dn[:] = [d for d in dn if d not in skip_dirs]
    for f in fn:
        if f.endswith((".ts", ".tsx", ".rs", ".json", ".html", ".css", ".py", ".nsi", ".md")):
            p = os.path.join(dp, f)
            try:
                t = open(p, encoding="utf-8", errors="ignore").read()
            except OSError:
                continue
            for m in pat.finditer(t):
                hits.append((os.path.relpath(p, root), m.group(0)[:48]))
for h in hits[:12]:
    print("  WARN", h)
print("共", len(hits), "处可疑")
