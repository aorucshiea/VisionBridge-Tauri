"""Snapshot of the processes that matter for the selection feature."""
import ctypes
import subprocess
from ctypes import wintypes


def procs(name):
    r = subprocess.run(["tasklist", "/FI", f"IMAGENAME eq {name}", "/FO", "CSV"],
                       capture_output=True, text=True, encoding="gbk", errors="replace")
    rows = []
    for line in (r.stdout or "").splitlines():
        if not line.startswith('"'):
            continue  # header
        parts = line.split('","')
        if len(parts) < 2:
            continue
        try:
            rows.append((parts[0].strip('"'), int(parts[1])))
        except ValueError:
            continue
    return rows


def is_elevated(pid):
    k32 = ctypes.windll.kernel32
    adv = ctypes.windll.advapi32
    PROCESS_QUERY_LIMITED_INFORMATION = 0x1000
    TOKEN_QUERY = 0x0008
    TokenElevation = 20
    h = k32.OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, False, pid)
    if not h:
        return "OpenProcess失败"
    try:
        token = wintypes.HANDLE()
        if not adv.OpenProcessToken(h, TOKEN_QUERY, ctypes.byref(token)):
            return "OpenProcessToken失败"
        try:
            elev = ctypes.c_ulong()
            ret = ctypes.c_ulong()
            if adv.GetTokenInformation(token, TokenElevation, ctypes.byref(elev), 4, ctypes.byref(ret)):
                return "是(管理员)" if elev.value else "否"
            return "GetTokenInformation失败"
        finally:
            k32.CloseHandle(token)
    finally:
        k32.CloseHandle(h)


def main():
    for name in ("vision-bridge.exe", "WorkBuddy.exe", "notepad.exe"):
        rows = procs(name)
        print(f"{name}: {len(rows)} 个进程")
        for n, pid in rows[:5]:
            print(f"    pid={pid:<7} 提权={is_elevated(pid)}")


if __name__ == "__main__":
    main()
