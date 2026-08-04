import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { ensureProxyRunning } from "./ensure-proxy.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const configPath = process.argv[2];
const config = configPath && JSON.parse(fs.readFileSync(configPath, "utf8"));
const exe = config?.exe || process.env.PROMPTSPARK_CODEX_EXE;
const script = config?.script || process.env.PROMPTSPARK_SCRIPT;
const port = Number(process.env.PROMPTSPARK_CODEX_DEBUG_PORT || 39271);
if (!exe || !script) throw new Error("PROMPTSPARK_CODEX_EXE and PROMPTSPARK_SCRIPT are required");

const proxyJs = config?.proxy
  || process.env.PROMPTSPARK_PROXY_JS
  || path.join(__dirname, "proxy.mjs");
await ensureProxyRunning({ proxyJs, log: null });

const source = fs.readFileSync(script, "utf8");
const child = spawn(exe, [`--remote-debugging-port=${port}`], { detached: false, stdio: "inherit" });
const getJson = () => new Promise((resolve, reject) => {
  const req = http.get(`http://127.0.0.1:${port}/json`, (res) => {
    let body = "";
    res.on("data", (chunk) => { body += chunk; });
    res.on("end", () => { try { resolve(JSON.parse(body)); } catch (e) { reject(e); } });
  });
  req.on("error", reject);
  req.setTimeout(1000, () => req.destroy(new Error("debug endpoint unavailable")));
});

async function inject() {
  for (;;) {
    try {
      const pages = await getJson();
      const page = pages.find((item) => item.webSocketDebuggerUrl && item.type === "page");
      if (page) {
        const ws = new WebSocket(page.webSocketDebuggerUrl);
        await new Promise((resolve, reject) => {
          ws.onopen = resolve;
          ws.onerror = reject;
        });
        ws.send(JSON.stringify({ id: 1, method: "Runtime.evaluate", params: { expression: `(function(){${source}\n})()` } }));
        return;
      }
    } catch { /* wait for Codex startup */ }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
}

await inject();
child.on("exit", (code) => process.exit(code ?? 0));
