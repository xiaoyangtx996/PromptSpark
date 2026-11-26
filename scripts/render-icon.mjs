#!/usr/bin/env node
/** Sync extension icon from assets/brand/logo-promptspark.png */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const mark128 = path.join(ROOT, "assets", "brand", "logo-promptspark.png");
const mediaIcon = path.join(ROOT, "cursor-extension", "media", "icon.png");

if (!fs.existsSync(mark128)) {
  throw new Error("missing assets/brand/logo-promptspark.png — run: python scripts/split-logo.py");
}

fs.mkdirSync(path.dirname(mediaIcon), { recursive: true });
fs.copyFileSync(mark128, mediaIcon);
console.log("synced", mediaIcon, "from", mark128);
