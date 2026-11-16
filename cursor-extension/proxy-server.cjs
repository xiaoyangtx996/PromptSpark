/**
 * In-process LLM proxy for PromptSpark (127.0.0.1 only).
 * Used by the Cursor extension host — no external Node spawn.
 */
const http = require("node:http");

const PORT = Number(process.env.CPO_PROXY_PORT || 37841);
const HOST = "127.0.0.1";
const VERSION = "1.4.9";

let server = null;

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
      sendJson(res, 200, { ok: true, service: "promptspark-proxy", version: VERSION });
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
 * @returns {Promise<"started"|"already"|"failed">}
 */
async function startProxy() {
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
      console.info(`[PromptSpark] proxy http://${HOST}:${PORT}`);
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

module.exports = { startProxy, stopProxy, PORT, HOST, proxyHealthy };
