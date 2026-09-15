# -*- coding: utf-8 -*-
"""Minimal MinIDump reader: exception code + faulting module.

Answers "which DLL crashed the WebView2 renderer" without needing dbghelp.
"""
import struct
import sys

MAX_ALIGN = 8


class Dump:
    def __init__(self, path):
        self.d = open(path, "rb").read()
        sig, ver, n, dir_off = struct.unpack_from("<IIII", self.d, 0)
        assert sig == 0x504D444D, "not a minidump"  # 'MDMP'
        self.n, self.dir_off = n, dir_off

    def streams(self):
        for i in range(self.n):
            t, _size, rva = struct.unpack_from("<III", self.d, self.dir_off + i * 12)
            yield t, rva

    def find(self, want):
        for t, rva in self.streams():
            if t == want:
                return rva
        return None

    def string(self, rva):
        (ln,) = struct.unpack_from("<I", self.d, rva)
        return self.d[rva + 4:rva + 4 + ln].decode("utf-16-le", "replace")

    def modules(self):
        rva = self.find(4)  # ModuleListStream
        if rva is None:
            return []
        (count,) = struct.unpack_from("<I", self.d, rva)
        out = []
        for i in range(count):
            base = rva + 4 + i * 108
            m_base, size, _c1, _c2, name_rva = struct.unpack_from("<QIIII", self.d, base)
            out.append((m_base, m_base + size, self.string(name_rva)))
        return out

    def exception(self):
        rva = self.find(3)  # ExceptionStream
        if rva is None:
            return None, None, None
        tid, _align = struct.unpack_from("<II", self.d, rva)
        code, _flags, _rec, _addr = struct.unpack_from("<IIQQ", self.d, rva + 8)
        # MINIDUMP_EXCEPTION_STREAM: ThreadId(4) + alignment(4) +
        # MINIDUMP_EXCEPTION(152) + ThreadContext{DataSize(4), Rva(4)}.
        ctx_rva = struct.unpack_from("<I", self.d, rva + 8 + 152 + 4)[0]
        rip = struct.unpack_from("<Q", self.d, ctx_rva + 0xF8)[0]
        return code, rip, tid


def main(path):
    d = Dump(path)
    code, rip, tid = d.exception()
    print("exception code : 0x%08X" % (code or 0))
    print("thread id      :", tid)
    print("rip            : 0x%X" % (rip or 0))
    mods = d.modules()
    print("modules        :", len(mods))
    if rip:
        for lo, hi, name in mods:
            if lo <= rip < hi:
                print("FAULTING MODULE:", name)
                print("  offset in module: 0x%X" % (rip - lo))
                break
        else:
            print("rip not in any module")
    # sanity: show a few interesting modules present
    for lo, hi, name in mods:
        base = name.lower().rsplit("\\", 1)[-1]
        if any(k in base for k in ("msedgewebview2", "tao", "wry", "vision", "chrome_elf", "v8")):
            print("  present:", base)


if __name__ == "__main__":
    main(sys.argv[1])
