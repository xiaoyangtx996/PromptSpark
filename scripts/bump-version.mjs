#!/usr/bin/env node
/**
 * Bump PromptSpark patch version across repo files.
 * Usage:
 *   node scripts/bump-version.mjs           # repo version +1 (local pack)
 *   node scripts/bump-version.mjs 1.4.11    # set exact (release = online+1)
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

const FILES = [
  "package.json",
  "package-lock.json",
  "cursor-extension/package.json",
  "cursor-extension/proxy-server.cjs",
  "runtime/proxy.mjs",
  "build.mjs",
  "install.mjs",
  "scripts/verify-build.mjs",
];

function readRepoVersion() {
  return JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8")).version;
}

function bumpPatch(v) {
  const parts = String(v).split(".").map((n) => Number(n));
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) {
    throw new Error(`bad version: ${v}`);
  }
  parts[2] += 1;
  return parts.join(".");
}

const arg = process.argv[2];
const from = readRepoVersion();
const to = arg && /^\d+\.\d+\.\d+$/.test(arg) ? arg : bumpPatch(from);
if (from === to) {
  console.log(`version unchanged ${to}`);
  process.exit(0);
}

const fromEscaped = from.replace(/\./g, "\\.");
const toEscaped = to.replace(/\./g, "\\.");
for (const rel of FILES) {
  const p = path.join(ROOT, rel);
  let text = fs.readFileSync(p, "utf8");
  let next = text.split(from).join(to);
  next = next.split(fromEscaped).join(toEscaped);
  // build.mjs / verify-build may lag behind local pack bumps — force-set
  if (rel === "build.mjs") {
    next = next.replace(/const VERSION = "[^"]+";/, `const VERSION = "${to}";`);
  }
  if (rel === "scripts/verify-build.mjs") {
    next = next.replace(
      /SCRIPT_VERSION = "\d+\.\d+\.\d+"/,
      `SCRIPT_VERSION = "${to}"`,
    );
    next = next.replace(
      /SCRIPT_VERSION = "1\\\.\d+\\\.\d+"/,
      `SCRIPT_VERSION = "${to.replace(/\./g, "\\.")}"`,
    );
  }
  if (next === text) {
    console.warn("warn: no version replace in", rel);
  } else {
    fs.writeFileSync(p, next);
    console.log("bumped", rel);
  }
}
console.log(`version ${from} → ${to}`);
