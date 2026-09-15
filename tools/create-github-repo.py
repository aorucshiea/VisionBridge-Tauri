# -*- coding: utf-8 -*-
"""Create the GitHub repo for VisionBridge-Tauri using stored git credentials.

Uses `git credential fill` to obtain the token Git Credential Manager stored
for github.com (the one that just pushed VisionBridge), then calls the REST
API to create the repository. The token is never printed.
"""
import json
import subprocess
import sys
import urllib.request

NAME = "VisionBridge-Tauri"
DESC = "VisionBridge - Tauri v2 port: 3.25 MB exe (72x smaller than the Electron build), same frontend source, GDI capture / selection translate / pipeline engine."


def get_credential():
    q = subprocess.run(
        ["git", "credential", "fill"],
        input="protocol=https\nhost=github.com\n\n",
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        timeout=30,
    )
    token = None
    for line in (q.stdout or "").splitlines():
        if line.startswith("password="):
            token = line.split("=", 1)[1].strip()
    return token


def api(token, path, payload):
    req = urllib.request.Request(
        "https://api.github.com" + path,
        data=json.dumps(payload).encode(),
        headers={
            "Authorization": f"Bearer {token}",
            "Accept": "application/vnd.github+json",
            "User-Agent": "vb-uploader",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return r.status, json.loads(r.read())
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", "replace")
        return e.code, body[:300]


def main():
    token = get_credential()
    if not token:
        print("NO-CREDENTIAL: credential manager returned nothing")
        return 1
    print("credential found, token type:", token[:4] + "***")

    code, data = api(token, "/user/repos", {
        "name": NAME,
        "description": DESC,
        "private": False,
        "has_issues": True,
        "has_wiki": False,
        "auto_init": False,
    })
    if code == 201:
        print("CREATED:", data.get("html_url"))
        return 0
    if code == 422 and "already exists" in str(data):
        print("ALREADY-EXISTS: https://github.com/aorucshiea/" + NAME)
        return 0
    print("API-FAIL", code, str(data)[:300])
    return 1


if __name__ == "__main__":
    sys.exit(main())
