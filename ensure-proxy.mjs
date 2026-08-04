#!/usr/bin/env node
/**
 * Ensure PromptSpark local LLM proxy (127.0.0.1:37841) is running.
 * Used by host launchers and the promptspark:// protocol handler.
 */
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROXY_PORT = Number(process.env.CPO_PROXY_PORT || 37841);
const PROXY_JS = process.env.PROMPTSPARK_PROXY_JS
  || path.join(__dirname, "proxy.mjs");

export async function proxyHealthy(timeoutMs = 800) {
  try {
    const res = await fetch(`http://127.0.0.1:${PROXY_PORT}/health`, {
      signal: AbortSignal.timeout(timeoutMs),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function ensureProxyRunning({
  proxyJs = PROXY_JS,
  nodePath = process.execPath,
  log = console.log,
} = {}) {
  if (!fs.existsSync(proxyJs)) {
    log?.(`⚠ 未找到 proxy.mjs: ${proxyJs}`);
    return false;
  }
  if (await proxyHealthy()) return true;

  const child = spawn(nodePath, [proxyJs], {
    cwd: path.dirname(proxyJs),
    detached: true,
    stdio: "ignore",
    windowsHide: true,
  });
  child.unref();

  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 150));
    if (await proxyHealthy()) return true;
  }
  log?.(`⚠ 代理启动超时，可手动运行: node "${proxyJs}"`);
  return false;
}

const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isMain) {
  const ok = await ensureProxyRunning();
  process.exit(ok ? 0 : 1);
}
