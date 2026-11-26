#!/usr/bin/env node
/**
 * Local LLM proxy for PromptSpark (bypasses Cursor/Electron CORS).
 * Listens on 127.0.0.1 only.
 */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.CPO_PROXY_PORT || 37841);
const HOST = "127.0.0.1";
const VERSION = "1.4.11";
const PID_FILE = path.join(__dirname, ".proxy.pid");
const SETTINGS_FILE =
  process.env.CPO_SETTINGS_PATH ||
  path.join(process.env.APPDATA || process.env.HOME || __dirname, "PromptSpark", "settings.json");

function readSettingsFile() {
  try {
    if (!fs.existsSync(SETTINGS_FILE)) return null;
    const parsed = JSON.parse(fs.readFileSync(SETTINGS_FILE, "utf8"));
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function writeSettingsFile(obj) {
  const dir = path.dirname(SETTINGS_FILE);
  fs.mkdirSync(dir, { recursive: true });
  const tmp = `${SETTINGS_FILE}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(obj, null, 2), "utf8");
  fs.renameSync(tmp, SETTINGS_FILE);
}

function writePid() {
  try {
    fs.writeFileSync(PID_FILE, String(process.pid), "utf8");
  } catch {
    /* ignore */
  }
}

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

const server = http.createServer(async (req, res) => {
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
      settingsPath: SETTINGS_FILE,
    });
    return;
  }

  if (req.method === "GET" && url.pathname === "/settings") {
    sendJson(res, 200, { ok: true, settings: readSettingsFile(), path: SETTINGS_FILE });
    return;
  }

  if (req.method === "POST" && url.pathname === "/settings") {
    try {
      const raw = await readBody(req);
      const payload = JSON.parse(raw.toString("utf8") || "{}");
      if (!payload?.settings || typeof payload.settings !== "object") {
        sendJson(res, 400, { ok: false, error: "settings object required" });
        return;
      }
      writeSettingsFile(payload.settings);
      sendJson(res, 200, { ok: true, path: SETTINGS_FILE });
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
      delete headers["host"];
      delete headers["content-length"];
      delete headers["connection"];

      const upstream = await fetch(target, {
        method,
        headers,
        body: method === "GET" || method === "HEAD" ? undefined : payload.body ?? null,
        signal: AbortSignal.timeout(Number(payload.timeout_ms || 60000)),
      });
      const text = await upstream.text();
      sendJson(res, 200, {
        ok: upstream.ok,
        status: upstream.status,
        body: text,
      });
    } catch (error) {
      sendJson(res, 502, {
        ok: false,
        error: error?.message || String(error) || "proxy error",
      });
    }
    return;
  }

  sendJson(res, 404, { ok: false, error: "not found" });
});

server.on("error", (err) => {
  if (err?.code === "EADDRINUSE") {
    console.log(`[cpo-proxy] already running on ${HOST}:${PORT}`);
    process.exit(0);
  }
  console.error("[cpo-proxy]", err);
  process.exit(1);
});

server.listen(PORT, HOST, () => {
  writePid();
  console.log(`[cpo-proxy] http://${HOST}:${PORT}`);
});

process.on("exit", () => {
  try {
    if (fs.existsSync(PID_FILE) && fs.readFileSync(PID_FILE, "utf8").trim() === String(process.pid)) {
      fs.unlinkSync(PID_FILE);
    }
  } catch {
    /* ignore */
  }
});
