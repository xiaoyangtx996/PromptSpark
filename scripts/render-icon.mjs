#!/usr/bin/env node
/**
 * PromptSpark extension icon
 * - Bold amber 4-point spark (+ mini spark)
 * - Fully opaque RGB PNG (Cursor-safe)
 * - Render at 512 then box-filter to 128 for smooth edges
 */
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const MEDIA = path.join(ROOT, "cursor-extension", "media");
const BRAND = path.join(ROOT, "assets", "brand");
const OUT = 128;
const HI = 512;
const SCALE = HI / OUT;

const BG = [15, 17, 21];
const AMBER = [255, 179, 10];
const LIGHT = [255, 220, 140];

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = c & 1 ? (0xedb88320 ^ (c >>> 1)) : c >>> 1;
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, "ascii");
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function writePngRgb(rgbPixels, w, h) {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) {
    const row = y * (w * 3 + 1);
    raw[row] = 0;
    rgbPixels.copy(raw, row + 1, y * w * 3, (y + 1) * w * 3);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function pointInPoly(x, y, pts) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const xi = pts[i][0];
    const yi = pts[i][1];
    const xj = pts[j][0];
    const yj = pts[j][1];
    const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi || 1e-9) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function sparkPoly(cx, cy, tip, waist) {
  return [
    [cx, cy - tip],
    [cx + waist, cy - waist],
    [cx + tip, cy],
    [cx + waist, cy + waist],
    [cx, cy + tip],
    [cx - waist, cy + waist],
    [cx - tip, cy],
    [cx - waist, cy - waist],
  ].map(([x, y]) => [x * SCALE, y * SCALE]);
}

const MAIN = sparkPoly(64, 66, 44, 15);
const CORE = sparkPoly(64, 66, 16, 6);
const MINI = sparkPoly(100, 28, 11, 4);

function sample(x, y) {
  if (pointInPoly(x, y, CORE)) return LIGHT;
  if (pointInPoly(x, y, MAIN) || pointInPoly(x, y, MINI)) return AMBER;
  return BG;
}

const hi = Buffer.alloc(HI * HI * 3);
for (let y = 0; y < HI; y++) {
  for (let x = 0; x < HI; x++) {
    const c = sample(x + 0.5, y + 0.5);
    const i = (y * HI + x) * 3;
    hi[i] = c[0];
    hi[i + 1] = c[1];
    hi[i + 2] = c[2];
  }
}

const rgb = Buffer.alloc(OUT * OUT * 3);
for (let y = 0; y < OUT; y++) {
  for (let x = 0; x < OUT; x++) {
    let r = 0;
    let g = 0;
    let b = 0;
    let n = 0;
    const y0 = Math.floor(y * SCALE);
    const y1 = Math.floor((y + 1) * SCALE);
    const x0 = Math.floor(x * SCALE);
    const x1 = Math.floor((x + 1) * SCALE);
    for (let yy = y0; yy < y1; yy++) {
      for (let xx = x0; xx < x1; xx++) {
        const i = (yy * HI + xx) * 3;
        r += hi[i];
        g += hi[i + 1];
        b += hi[i + 2];
        n += 1;
      }
    }
    const o = (y * OUT + x) * 3;
    rgb[o] = Math.round(r / n);
    rgb[o + 1] = Math.round(g / n);
    rgb[o + 2] = Math.round(b / n);
  }
}

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128" role="img" aria-label="PromptSpark">
  <rect width="128" height="128" fill="#0F1115"/>
  <path fill="#FFB30A" d="M64 22 L79 51 L108 66 L79 81 L64 110 L49 81 L20 66 L49 51 Z"/>
  <path fill="#FFDC8C" d="M64 50 L70 60 L80 66 L70 72 L64 82 L58 72 L48 66 L58 60 Z"/>
  <path fill="#FFB30A" d="M100 17 L104 24 L111 28 L104 32 L100 39 L96 32 L89 28 L96 24 Z"/>
</svg>
`;

fs.mkdirSync(MEDIA, { recursive: true });
fs.mkdirSync(BRAND, { recursive: true });
const png = writePngRgb(rgb, OUT, OUT);
fs.writeFileSync(path.join(MEDIA, "icon.png"), png);
fs.writeFileSync(path.join(MEDIA, "icon.svg"), svg);
fs.writeFileSync(path.join(BRAND, "logo-promptspark.svg"), svg);
fs.writeFileSync(path.join(BRAND, "logo-promptspark.png"), png);
console.log("wrote", path.join(MEDIA, "icon.png"), png.length, "bytes");
