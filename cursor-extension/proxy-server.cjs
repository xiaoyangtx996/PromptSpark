/**
 * In-process LLM proxy for PromptSpark (127.0.0.1 only).
 * Used by the Cursor extension host — no external Node spawn.
 * Also persists settings.json so config survives extension updates.
 */
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const PORT = Number(process.env.CPO_PROXY_PORT || 37841);
const HOST = "127.0.0.1";
const VERSION = "1.4.11";

function resolveSettingsPath() {
  if (process.env.CPO_SETTINGS_PATH) return process.env.CPO_SETTINGS_PATH;
  const base =
    process.env.APPDATA ||
    process.env.LOCALAPPDATA ||
    process.env.HOME ||
    process.env.USERPROFILE ||
    ".";
  return path.join(base, "PromptSpark", "settings.json");
}

let server = null;
let settingsPath = resolveSettingsPath();

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function sendJson(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  });
  res.end(body);
}

function humanizeUpstreamError(error) {
  const msg = String(error?.message || error || "").trim();
  const cause = String(error?.cause?.message || error?.cause || "").trim();
  const blob = `${msg} ${cause}`;
  if (/fetch failed|failed to fetch|econnreset|etimedout|enotfound|econnrefused|socket|network|und_err/i.test(blob)) {
    return "上游请求失败（网络抖动），请再试一次；若持续失败请检查 Base URL / API Key / 代理";
  }
  return msg || "proxy error";
}

async function fetchUpstreamWithRetry(target, init, retries = 2) {
  let lastErr;
  for (let i = 0; i <= retries; i++) {
    try {
      return await fetch(target, init);
    } catch (error) {
      lastErr = error;
      if (i < retries) {
        await new Promise((r) => setTimeout(r, 280 * (i + 1)));
      }
    }
  }
  throw lastErr;
}

function readSettingsFile() {
  try {
    if (!fs.existsSync(settingsPath)) return null;
    const raw = fs.readFileSync(settingsPath, "utf8");
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function writeSettingsFile(obj) {
  const dir = path.dirname(settingsPath);
  fs.mkdirSync(dir, { recursive: true });
  const tmp = `${settingsPath}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(obj, null, 2), "utf8");
  fs.renameSync(tmp, settingsPath);
}

function createServer() {
  return http.createServer(async (req, res) => {
    if (req.method === "OPTIONS") {
      res.writeHead(204, {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "*",
        "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      });
      res.end();
      return;
    }

    const url = new URL(req.url || "/", `http://${HOST}:${PORT}`);

    if (req.method === "GET" && (url.pathname === "/health" || url.pathname === "/")) {
      sendJson(res, 200, {
        ok: true,
        service: "promptspark-proxy",
        version: VERSION,
        settingsPath,
      });
      return;
    }

    if (req.method === "GET" && url.pathname === "/settings") {
      const settings = readSettingsFile();
      sendJson(res, 200, { ok: true, settings: settings || null, path: settingsPath });
      return;
    }

    if (req.method === "POST" && url.pathname === "/settings") {
      try {
        const raw = await readBody(req);
        const payload = JSON.parse(raw.toString("utf8") || "{}");
        const settings = payload?.settings;
        if (!settings || typeof settings !== "object") {
          sendJson(res, 400, { ok: false, error: "settings object required" });
          return;
        }
        writeSettingsFile(settings);
        sendJson(res, 200, { ok: true, path: settingsPath });
      } catch (error) {
        sendJson(res, 500, { ok: false, error: error?.message || String(error) || "write failed" });
      }
      return;
    }

    if (req.method === "POST" && url.pathname === "/proxy") {
      try {
        const raw = await readBody(req);
        const payload = JSON.parse(raw.toString("utf8") || "{}");
        const target = String(payload.url || "").trim();
        if (!/^https?:\/\//i.test(target)) {
          sendJson(res, 400, { ok: false, error: "url must be http(s)" });
          return;
        }
        const method = String(payload.method || "POST").toUpperCase();
        const headers = payload.headers && typeof payload.headers === "object" ? { ...payload.headers } : {};
        delete headers.host;
        delete headers["content-length"];
        delete headers.connection;

        const upstream = await fetchUpstreamWithRetry(
          target,
          {
            method,
            headers,
            body: method === "GET" || method === "HEAD" ? undefined : payload.body ?? null,
            signal: AbortSignal.timeout(Number(payload.timeout_ms || 60000)),
          },
          2,
        );
        const text = await upstream.text();
        sendJson(res, 200, {
          ok: upstream.ok,
          status: upstream.status,
          body: text,
        });
      } catch (error) {
        sendJson(res, 502, {
          ok: false,
          error: humanizeUpstreamError(error),
        });
      }
      return;
    }

    sendJson(res, 404, { ok: false, error: "not found" });
  });
}

function proxyHealthy(timeoutMs = 400) {
  return new Promise((resolve) => {
    const req = http.get({ host: HOST, port: PORT, path: "/health", timeout: timeoutMs }, (res) => {
      res.resume();
      resolve(res.statusCode >= 200 && res.statusCode < 300);
    });
    req.on("error", () => resolve(false));
    req.on("timeout", () => {
      req.destroy();
      resolve(false);
    });
  });
}

/**
 * @param {{ settingsPath?: string }} [opts]
 * @returns {Promise<"started"|"already"|"failed">}
 */
async function startProxy(opts = {}) {
  if (opts.settingsPath) {
    settingsPath = opts.settingsPath;
    process.env.CPO_SETTINGS_PATH = opts.settingsPath;
  } else {
    settingsPath = resolveSettingsPath();
  }
  if (await proxyHealthy()) return "already";
  if (server) return "already";

  return new Promise((resolve) => {
    const s = createServer();
    const onError = (err) => {
      s.off("listening", onListening);
      if (err?.code === "EADDRINUSE") {
        resolve("already");
        return;
      }
      console.warn("[PromptSpark] proxy listen failed", err?.message || err);
      resolve("failed");
    };
    const onListening = () => {
      s.off("error", onError);
      server = s;
      console.info(`[PromptSpark] proxy http://${HOST}:${PORT} settings=${settingsPath}`);
      resolve("started");
    };
    s.once("error", onError);
    s.once("listening", onListening);
    s.listen(PORT, HOST);
  });
}

function stopProxy() {
  if (!server) return;
  try {
    server.close();
  } catch {
    /* ignore */
  }
  server = null;
}

module.exports = { startProxy, stopProxy, PORT, HOST, proxyHealthy, resolveSettingsPath };
