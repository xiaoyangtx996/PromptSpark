#!/usr/bin/env node
/**
 * Cursor host launcher: ensure local LLM proxy, then start Cursor.exe.
 * Invoked by promptspark-cursor-host.js (WSH) on each Cursor launch.
 */
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { ensureProxyRunning } from "./ensure-proxy.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const configPath = process.argv[2];
const config = configPath && JSON.parse(fs.readFileSync(configPath, "utf8"));
const exe = config?.exe || process.env.PROMPTSPARK_CURSOR_EXE;
if (!exe) throw new Error("PROMPTSPARK_CURSOR_EXE / registry.exe is required");

const proxyJs = config?.proxy
  || process.env.PROMPTSPARK_PROXY_JS
  || path.join(__dirname, "proxy.mjs");

await ensureProxyRunning({ proxyJs, log: null });

const child = spawn(exe, process.argv.slice(3), {
  detached: true,
  stdio: "ignore",
  windowsHide: false,
});
child.unref();
process.exit(0);
