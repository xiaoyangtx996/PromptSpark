"""Remove solid plate backgrounds from brand PNGs (edge flood-fill → alpha)."""
from __future__ import annotations

from collections import deque
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
BRAND = ROOT / "assets" / "brand"
MEDIA = ROOT / "cursor-extension" / "media"

TARGETS = [
    BRAND / "logo-promptspark.png",
    BRAND / "logo-mark.png",
    BRAND / "logo-wordmark.png",
    BRAND / "logo-sheet-source.png",
]


def near_bg(rgb: tuple[int, int, int], bg: tuple[int, int, int], tol: int) -> bool:
    return all(abs(int(a) - int(b)) <= tol for a, b in zip(rgb, bg))


def matte(path: Path, tol: int = 18) -> None:
    im = Image.open(path).convert("RGBA")
    w, h = im.size
    px = im.load()
    # Sample several edge pixels; use median-ish bright plate.
    samples = [
        px[0, 0][:3],
        px[w - 1, 0][:3],
        px[0, h - 1][:3],
        px[w - 1, h - 1][:3],
        px[w // 2, 0][:3],
        px[w // 2, h - 1][:3],
        px[0, h // 2][:3],
        px[w - 1, h // 2][:3],
    ]
    bg = tuple(sorted(samples)[len(samples) // 2])

    visited = [[False] * w for _ in range(h)]
    q: deque[tuple[int, int]] = deque()

    def try_push(x: int, y: int) -> None:
        if x < 0 or y < 0 or x >= w or y >= h or visited[y][x]:
            return
        r, g, b, a = px[x, y]
        if a < 8:
            visited[y][x] = True
            q.append((x, y))
            return
        if near_bg((r, g, b), bg, tol):
            visited[y][x] = True
            q.append((x, y))

    for x in range(w):
        try_push(x, 0)
        try_push(x, h - 1)
    for y in range(h):
        try_push(0, y)
        try_push(w - 1, y)

    while q:
        x, y = q.popleft()
        r, g, b, a = px[x, y]
        if a >= 8 and near_bg((r, g, b), bg, tol):
            px[x, y] = (r, g, b, 0)
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            try_push(nx, ny)

    # Soft fringe: near-bg opaque pixels adjacent to transparent → fade alpha
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a < 8 or not near_bg((r, g, b), bg, tol + 8):
                continue
            touch = False
            for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                if 0 <= nx < w and 0 <= ny < h and px[nx, ny][3] < 8:
                    touch = True
                    break
            if touch:
                dist = max(abs(r - bg[0]), abs(g - bg[1]), abs(b - bg[2]))
                fade = max(0, min(255, int(255 * (dist / max(tol + 8, 1)))))
                px[x, y] = (r, g, b, fade)

    im.save(path)
    print(f"matted {path.name} bg={bg} tol={tol} size={w}x{h}")


def main() -> None:
    for path in TARGETS:
        if path.exists():
            matte(path)
        else:
            print(f"skip missing {path}")

    # Keep extension media icon in sync with mark used in VSIX
    src = BRAND / "logo-promptspark.png"
    if src.exists() and MEDIA.exists():
        out = MEDIA / "icon.png"
        Image.open(src).convert("RGBA").save(out)
        print(f"synced {out.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
