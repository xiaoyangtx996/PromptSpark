/**
 * PromptSpark proxy booster — runs in Cursor's Extension Host (Node).
 * Starts the local LLM proxy alongside Cursor; no shortcut wrapping required.
 */
const cp = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");

const PORT = Number(process.env.CPO_PROXY_PORT || 37841);

function loadConfig() {
  const cfgPath = path.join(__dirname, "proxy-config.json");
  try {
    return JSON.parse(fs.readFileSync(cfgPath, "utf8"));
  } catch {
    return {};
  }
}

function looksLikeNode(bin) {
  const base = path.basename(String(bin || "")).toLowerCase();
  return base === "node" || base === "node.exe";
}

function resolveNodePath(config) {
  if (config.node && looksLikeNode(config.node) && fs.existsSync(config.node)) {
    return config.node;
  }
  if (looksLikeNode(process.execPath) && fs.existsSync(process.execPath)) {
    return process.execPath;
  }
  try {
    const out = cp.execFileSync(process.platform === "win32" ? "where" : "which", ["node"], {
      encoding: "utf8",
      windowsHide: true,
    });
    const first = String(out).split(/\r?\n/).map((s) => s.trim()).find(Boolean);
    if (first && fs.existsSync(first) && looksLikeNode(first)) return first;
  } catch {
    /* ignore */
  }
  const helper = path.join(
    path.dirname(process.execPath),
    "resources",
    "app",
    "resources",
    "helpers",
    process.platform === "win32" ? "node.exe" : "node",
  );
  if (fs.existsSync(helper)) return helper;
  return null;
}

function proxyHealthy(timeoutMs = 600) {
  return new Promise((resolve) => {
    const req = http.get(
      { host: "127.0.0.1", port: PORT, path: "/health", timeout: timeoutMs },
      (res) => {
        res.resume();
        resolve(res.statusCode >= 200 && res.statusCode < 300);
      },
    );
    req.on("error", () => resolve(false));
    req.on("timeout", () => {
      req.destroy();
      resolve(false);
    });
  });
}

function spawnEnsure(config) {
  const nodePath = resolveNodePath(config);
  if (!nodePath) {
    console.warn("[PromptSpark] Node.js not found; cannot start local proxy");
    return false;
  }
  const ensureProxy =
    config.ensureProxy ||
    path.join(process.env.LOCALAPPDATA || "", "PromptSpark", "ensure-proxy.mjs");
  const fallbackEnsure = path.join(
    process.env.LOCALAPPDATA || "",
    "PromptSpark",
    "cursor",
    "ensure-proxy.mjs",
  );
  const ensurePath = fs.existsSync(ensureProxy)
    ? ensureProxy
    : fs.existsSync(fallbackEnsure)
      ? fallbackEnsure
      : null;
  if (!ensurePath) {
    console.warn("[PromptSpark] ensure-proxy.mjs missing");
    return false;
  }
  const proxyJs =
    config.proxy ||
    (fs.existsSync(path.join(path.dirname(ensurePath), "proxy.mjs"))
      ? path.join(path.dirname(ensurePath), "proxy.mjs")
      : path.join(process.env.LOCALAPPDATA || "", "PromptSpark", "proxy.mjs"));
  const child = cp.spawn(nodePath, [ensurePath], {
    cwd: path.dirname(ensurePath),
    detached: true,
    stdio: "ignore",
    windowsHide: true,
    env: {
      ...process.env,
      PROMPTSPARK_PROXY_JS: proxyJs,
    },
  });
  child.unref();
  return true;
}

async function ensureProxy(config) {
  if (await proxyHealthy()) return true;
  if (!spawnEnsure(config)) return false;
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 150));
    if (await proxyHealthy()) return true;
  }
  return false;
}

function activate() {
  const config = loadConfig();
  ensureProxy(config).then((ok) => {
    if (ok) console.info("[PromptSpark] local proxy ready on 127.0.0.1:" + PORT);
    else console.warn("[PromptSpark] failed to start local proxy");
  }).catch((error) => {
    console.warn("[PromptSpark] proxy bootstrap error", error?.message || error);
  });
}

function deactivate() {}

module.exports = { activate, deactivate };
