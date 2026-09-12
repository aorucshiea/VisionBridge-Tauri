"""Decode a PNG and report what is actually in it.

This environment cannot display images to the model, so "did the window
render?" is answered numerically instead: unique colour count, dominant
colours, and a check against the design system's known paper/ink values.
"""
import argparse
import collections
import struct
import zlib


def read_png(path: str):
    data = open(path, "rb").read()
    assert data[:8] == b"\x89PNG\r\n\x1a\n", "not a PNG"
    pos = 8
    width = height = bit_depth = color_type = None
    idat = b""
    while pos < len(data):
        length = struct.unpack(">I", data[pos:pos + 4])[0]
        tag = data[pos + 4:pos + 8]
        body = data[pos + 8:pos + 8 + length]
        pos += 12 + length
        if tag == b"IHDR":
            width, height, bit_depth, color_type = struct.unpack(">IIBB", body[:10])
        elif tag == b"IDAT":
            idat += body
        elif tag == b"IEND":
            break

    raw = zlib.decompress(idat)
    channels = {0: 1, 2: 3, 4: 2, 6: 4}[color_type]
    stride = width * channels
    out = bytearray(width * height * channels)
    prev = bytearray(stride)
    i = 0
    for y in range(height):
        filt = raw[i]
        i += 1
        line = bytearray(raw[i:i + stride])
        i += stride
        if filt == 1:
            for x in range(channels, stride):
                line[x] = (line[x] + line[x - channels]) & 0xFF
        elif filt == 2:
            for x in range(stride):
                line[x] = (line[x] + prev[x]) & 0xFF
        elif filt == 3:
            for x in range(stride):
                left = line[x - channels] if x >= channels else 0
                line[x] = (line[x] + ((left + prev[x]) >> 1)) & 0xFF
        elif filt == 4:
            for x in range(stride):
                a = line[x - channels] if x >= channels else 0
                b = prev[x]
                c = prev[x - channels] if x >= channels else 0
                p = a + b - c
                pa, pb, pc = abs(p - a), abs(p - b), abs(p - c)
                pred = a if (pa <= pb and pa <= pc) else (b if pb <= pc else c)
                line[x] = (line[x] + pred) & 0xFF
        out[y * stride:(y + 1) * stride] = line
        prev = line
    return width, height, channels, out


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("png")
    ap.add_argument("--top", type=int, default=8)
    args = ap.parse_args()

    w, h, ch, px = read_png(args.png)
    print(f"{args.png}")
    print(f"  尺寸: {w}x{h}  通道: {ch}")

    counter = collections.Counter()
    step = max(1, (w * h) // 60000)
    for idx in range(0, w * h, step):
        o = idx * ch
        counter[(px[o], px[o + 1], px[o + 2])] += 1

    total = sum(counter.values())
    print(f"  采样点: {total}  不同颜色: {len(counter)}")
    print("  主要颜色:")
    for (r, g, b), n in counter.most_common(args.top):
        pct = n / total * 100
        print(f"    #{r:02X}{g:02X}{b:02X}  rgb({r:3d},{g:3d},{b:3d})  {pct:5.1f}%")

    # Design-system references: paper #FAF8F4, ink #1B1915, marker #C67C1B.
    def near(target, tol=14):
        return sum(n for (r, g, b), n in counter.items()
                   if abs(r - target[0]) <= tol and abs(g - target[1]) <= tol and abs(b - target[2]) <= tol) / total * 100

    print()
    print("  与设计系统比对:")
    for name, rgb in (("纸 #FAF8F4", (250, 248, 244)), ("墨 #1B1915", (27, 25, 21)), ("荧光笔 #C67C1B", (198, 124, 27))):
        print(f"    {name:18} 占比 {near(rgb):5.2f}%")

    blank = len(counter) < 12
    print()
    print(f"  判定: {'空白/未渲染' if blank else '已渲染 UI'}")
    return 0 if not blank else 1


if __name__ == "__main__":
    raise SystemExit(main())
