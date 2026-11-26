#!/usr/bin/env node
/**
 * Sync extension icon from brand mark assets.
 * Does not regenerate the old procedural spark — pack:vsix must keep the new mark.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const BRAND = path.join(ROOT, "assets", "brand");
const MEDIA = path.join(ROOT, "cursor-extension", "media");

const mark128 = path.join(BRAND, "logo-promptspark.png");
const mark512 = path.join(BRAND, "logo-mark.png");
if (!fs.existsSync(mark128)) {
  throw new Error("missing assets/brand/logo-promptspark.png — run scripts/split-logo.py first");
}

fs.mkdirSync(MEDIA, { recursive: true });
fs.copyFileSync(mark128, path.join(MEDIA, "icon.png"));
fs.copyFileSync(mark128, path.join(BRAND, "logo-promptspark.png"));
if (fs.existsSync(mark512)) {
  // keep mark as-is; only ensure 128 icon exists for VSIX
}
console.log("synced", path.join(MEDIA, "icon.png"), "from", mark128);
