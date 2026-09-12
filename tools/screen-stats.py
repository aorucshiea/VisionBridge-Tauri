"""Measure what the capture overlay actually does to the screen.

`screenshot_mask.tsx` never draws a frozen screenshot — it is a transparent
full-screen window with a 42%-alpha dim. So "the overlay looks like it just
went fullscreen" can mean three very different things, and mean luminance
separates them:

  overlay works        -> screen darkens to ~58% of baseline
  overlay not painting -> luminance unchanged (~100%)
  overlay opaque       -> luminance jumps (paper-white window)

Usage:
    python tools/screen-stats.py --label baseline
    python tools/screen-stats.py --label overlay --save preview/overlay.png
"""
import argparse
import os
import statistics
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from importlib import import_module  # noqa: E402

grab = import_module("grab-window")

REPORT = Path(__file__).resolve().parent.parent / "logs" / "screen-stats.json"


def luma_stats(rgba: bytes, w: int, h: int) -> dict:
    """Rec.709 luminance, sampled on a grid so huge captures stay fast."""
    step = max(1, (w * h) // 120000)
    values = []
    for idx in range(0, w * h, step):
        o = idx * 4
        r, g, b = rgba[o], rgba[o + 1], rgba[o + 2]
        values.append(0.2126 * r + 0.7152 * g + 0.0722 * b)
    return {
        "mean": round(statistics.fmean(values), 2),
        "median": round(statistics.median(values), 2),
        "p10": round(sorted(values)[len(values) // 10], 2),
        "p90": round(sorted(values)[len(values) * 9 // 10], 2),
        "samples": len(values),
    }


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--label", required=True)
    ap.add_argument("--save", default="")
    args = ap.parse_args()

    x, y, w, h = grab.virtual_screen_rect()
    rgba = grab.capture(x, y, w, h)
    stats = luma_stats(rgba, w, h)
    print(f"[stats] {args.label}: {w}x{h}  " + "  ".join(f"{k}={v}" for k, v in stats.items()))

    if args.save:
        os.makedirs(os.path.dirname(os.path.abspath(args.save)), exist_ok=True)
        grab.write_png(args.save, rgba, w, h)
        print(f"[stats] saved {args.save}")

    report = {}
    if REPORT.is_file():
        import json
        report = json.load(open(REPORT, encoding="utf-8"))
    report[args.label] = {"rect": [x, y, w, h], **stats}
    REPORT.parent.mkdir(parents=True, exist_ok=True)
    import json
    json.dump(report, open(REPORT, "w", encoding="utf-8"), indent=2, ensure_ascii=False)

    if "baseline" in report and args.label != "baseline":
        base = report["baseline"]["mean"]
        cur = stats["mean"]
        ratio = cur / base if base else 0
        verdict = ("压暗生效（约 58%）" if 0.45 <= ratio <= 0.72 else
                   "亮度未变化 → 遮罩没有压暗" if 0.9 <= ratio <= 1.1 else
                   "亮度升高 → 遮罩是不透明窗口" if ratio > 1.1 else
                   f"其他（比值 {ratio:.2f}）")
        print(f"[stats] overlay/baseline = {ratio:.3f}  →  {verdict}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
