"""Split assets/brand/logo-sheet-source.png → wordmark + mark (+ extension icon)."""
from PIL import Image
from pathlib import Path

root = Path(__file__).resolve().parents[1]
brand = root / "assets" / "brand"
media = root / "cursor-extension" / "media"
src = brand / "logo-sheet-source.png"
brand.mkdir(parents=True, exist_ok=True)
media.mkdir(parents=True, exist_ok=True)
if not src.exists():
    raise SystemExit(f"missing source sheet: {src}")

im = Image.open(src).convert("RGBA")
w, h = im.size
px = im.load()


def is_ink(r, g, b, a, white_thr=248):
    """Non-near-white opaque pixel (divider + logos on white sheet)."""
    if a < 8:
        return False
    return r < white_thr or g < white_thr or b < white_thr


cols = []
for x in range(w):
    for y in range(h):
        r, g, b, a = px[x, y]
        if is_ink(r, g, b, a):
            cols.append(x)
            break

gaps = []
for i in range(1, len(cols)):
    d = cols[i] - cols[i - 1]
    if d > 30:
        gaps.append((cols[i - 1], cols[i], d))
if not gaps:
    raise SystemExit("no separator gap found between wordmark and mark")
split_a, split_b, _ = max(gaps, key=lambda t: t[2])
print("split gap", split_a, split_b)


def bbox(x0, x1):
    minx, miny, maxx, maxy = x1, h, x0, 0
    found = False
    for y in range(h):
        for x in range(x0, x1):
            r, g, b, a = px[x, y]
            if is_ink(r, g, b, a):
                found = True
                minx = min(minx, x)
                miny = min(miny, y)
                maxx = max(maxx, x)
                maxy = max(maxy, y)
    if not found:
        raise SystemExit(f"no content in [{x0},{x1})")
    return minx, miny, maxx, maxy


def expand(box, pad):
    x0, y0, x1, y1 = box
    return (
        max(0, x0 - pad),
        max(0, y0 - pad),
        min(w - 1, x1 + pad),
        min(h - 1, y1 + pad),
    )


left = expand(bbox(0, split_a + 1), 10)
right = expand(bbox(split_b, w), 6)
print("left", left)
print("right", right)

wordmark = im.crop((left[0], left[1], left[2] + 1, left[3] + 1)).copy()
mark = im.crop((right[0], right[1], right[2] + 1, right[3] + 1)).copy()

mw, mh = mark.size
side = max(mw, mh)
sq = Image.new("RGBA", (side, side), (0, 0, 0, 0))
sq.paste(mark, ((side - mw) // 2, (side - mh) // 2), mark)
icon128 = sq.resize((128, 128), Image.Resampling.LANCZOS)
icon512 = sq.resize((512, 512), Image.Resampling.LANCZOS)

paths = {
    brand / "logo-wordmark.png": wordmark,
    brand / "logo-mark.png": icon512,
    brand / "logo-promptspark.png": icon128,
    media / "icon.png": icon128,
}
for p, img in paths.items():
    img.save(p, "PNG")
    print("wrote", p, img.size)

# Punch sheet plate via edge flood-fill (keeps enclosed bubble whites).
import runpy

runpy.run_path(str(Path(__file__).with_name("matte-brand.py")), run_name="__main__")
