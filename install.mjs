#!/usr/bin/env node
/**
 * PromptSpark installer
 * Interactive install into Cursor (other hosts gated until verified)
 *
 * Usage:
 *   node install.mjs
 *   node install.mjs --hosts=cursor
 *   node install.mjs --uninstall
 *   node install.mjs --no-restart
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { spawn, execSync } from "node:child_process";
import readline from "node:readline";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = __dirname;
const DIST = path.join(ROOT, "dist", "prompt-optimize.js");
const PROXY_JS = path.join(ROOT, "proxy.mjs");
const PROXY_PORT = 37841;
const PATCH_BEGIN = "<!-- PROMPTSPARK-PATCH -->";
const PATCH_END = "<!-- /PROMPTSPARK-PATCH -->";
const LEGACY_PATCH_BEGIN = "<!-- PROMPT-OPTIMIZE-PATCH -->";
const LEGACY_PATCH_END = "<!-- /PROMPT-OPTIMIZE-PATCH -->";

const args = process.argv.slice(2);
const UNINSTALL = args.includes("--uninstall");
const NO_RESTART = args.includes("--no-restart");
const hostsArg = args.find((a) => a.startsWith("--hosts="));
const FORCE_HOSTS = hostsArg
  ? hostsArg
      .slice("--hosts=".length)
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)
  : null;

/**
 * 当前对外安装入口只开放已验证宿主。
 * 其它宿主检测逻辑保留，待测试通过后再加入此列表。
 */
const ENABLED_HOST_IDS = new Set(["cursor"]);

function exists(p) {
  try {
    return fs.existsSync(p);
  } catch {
    return false;
  }
}

function firstExisting(paths) {
  for (const p of paths) {
    if (p && exists(p)) return p;
  }
  return null;
}

function uniq(list) {
  return [...new Set(list.filter(Boolean))];
}

function winEnvPaths() {
  const home = process.env.USERPROFILE || process.env.HOME || "";
  return {
    home,
    localAppData: process.env.LOCALAPPDATA || path.join(home, "AppData", "Local"),
    appData: process.env.APPDATA || path.join(home, "AppData", "Roaming"),
    programFiles: process.env.ProgramFiles || "C:\\Program Files",
    programFilesX86: process.env["ProgramFiles(x86)"] || "C:\\Program Files (x86)",
  };
}

/** Resolve workbench.html + product.json for Electron VS Code–like shells. */
function resolveElectronWorkbench(appRoot) {
  if (!appRoot) return { workbench: null, productJson: null, checksumKey: null };
  const workbench = firstExisting([
    path.join(appRoot, "resources", "app", "out", "vs", "code", "electron-sandbox", "workbench", "workbench.html"),
    path.join(appRoot, "resources", "app", "out", "vs", "code", "electron-browser", "workbench", "workbench.html"),
    path.join(appRoot, "app", "resources", "app", "out", "vs", "code", "electron-sandbox", "workbench", "workbench.html"),
    path.join(appRoot, "app", "resources", "app", "out", "vs", "code", "electron-browser", "workbench", "workbench.html"),
  ]);
  const productJson = firstExisting([
    path.join(appRoot, "resources", "app", "product.json"),
    path.join(appRoot, "app", "resources", "app", "product.json"),
  ]);
  let checksumKey = null;
  if (workbench?.includes("electron-sandbox")) {
    checksumKey = "vs/code/electron-sandbox/workbench/workbench.html";
  } else if (workbench?.includes("electron-browser")) {
    checksumKey = "vs/code/electron-browser/workbench/workbench.html";
  }
  return { workbench, productJson, checksumKey };
}

function whichExe(exeName) {
  try {
    const out = execSync(`where.exe ${JSON.stringify(exeName)}`, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      windowsHide: true,
    });
    const line = String(out)
      .split(/\r?\n/)
      .map((s) => s.trim())
      .find((s) => s && exists(s) && /\.exe$/i.test(s));
    return line || null;
  } catch {
    return null;
  }
}

function regAppPath(exeName) {
  const keys = [
    `HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\App Paths\\${exeName}`,
    `HKLM\\Software\\Microsoft\\Windows\\CurrentVersion\\App Paths\\${exeName}`,
    `HKLM\\Software\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\App Paths\\${exeName}`,
  ];
  for (const key of keys) {
    try {
      const out = execSync(`reg query ${JSON.stringify(key)} /ve`, {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
        windowsHide: true,
      });
      const m = String(out).match(/REG_SZ\s+(.+)$/im);
      if (!m) continue;
      const p = m[1].trim().replace(/^"|"$/g, "");
      if (p && exists(p)) return p;
    } catch {
      /* next */
    }
  }
  return null;
}

function resolveLnkTarget(lnkPath) {
  if (!lnkPath || !exists(lnkPath) || !/\.lnk$/i.test(lnkPath)) return null;
  try {
    const ps = [
      "$s = (New-Object -ComObject WScript.Shell).CreateShortcut($env:CPO_LNK)",
      "if ($s.TargetPath) { Write-Output $s.TargetPath }",
    ].join("; ");
    const out = execSync(`powershell -NoProfile -NonInteractive -Command ${JSON.stringify(ps)}`, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      windowsHide: true,
      env: { ...process.env, CPO_LNK: lnkPath },
    });
    const p = String(out).trim().replace(/^"|"$/g, "");
    return p && exists(p) ? p : null;
  } catch {
    return null;
  }
}

function walkFindExe(root, exeNames, { maxDepth = 4, maxDirs = 400 } = {}) {
  if (!root || !exists(root)) return null;
  const want = new Set(exeNames.map((n) => n.toLowerCase()));
  const queue = [{ dir: root, depth: 0 }];
  let seen = 0;
  while (queue.length) {
    const { dir, depth } = queue.shift();
    if (++seen > maxDirs) break;
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const ent of entries) {
      const full = path.join(dir, ent.name);
      if (ent.isFile() && want.has(ent.name.toLowerCase()) && exists(full)) {
        return full;
      }
    }
    if (depth >= maxDepth) continue;
    for (const ent of entries) {
      if (!ent.isDirectory()) continue;
      const name = ent.name.toLowerCase();
      if (name === "node_modules" || name === ".git" || name === "cache" || name === "temp" || name === "tmp") continue;
      queue.push({ dir: path.join(dir, ent.name), depth: depth + 1 });
    }
  }
  return null;
}

function findStartMenuExe(exeNames, titleHints = []) {
  const { home, appData, programFiles, programFilesX86 } = winEnvPaths();
  const roots = uniq([
    path.join(appData, "Microsoft", "Windows", "Start Menu", "Programs"),
    path.join(home, "Desktop"),
    path.join(programFiles, "Microsoft", "Windows", "Start Menu", "Programs"),
    "C:\\ProgramData\\Microsoft\\Windows\\Start Menu\\Programs",
    programFilesX86 && path.join(programFilesX86, "Microsoft", "Windows", "Start Menu", "Programs"),
  ]);
  const hints = titleHints.map((h) => h.toLowerCase());
  const wantExe = new Set(exeNames.map((n) => n.toLowerCase()));

  for (const root of roots) {
    if (!exists(root)) continue;
    const queue = [{ dir: root, depth: 0 }];
    let n = 0;
    while (queue.length && n < 300) {
      const { dir, depth } = queue.shift();
      n++;
      let entries;
      try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
      } catch {
        continue;
      }
      for (const ent of entries) {
        const full = path.join(dir, ent.name);
        if (ent.isFile() && /\.lnk$/i.test(ent.name)) {
          const base = ent.name.replace(/\.lnk$/i, "").toLowerCase();
          const hintOk = !hints.length || hints.some((h) => base.includes(h));
          if (!hintOk) continue;
          const target = resolveLnkTarget(full);
          if (target && wantExe.has(path.basename(target).toLowerCase())) return target;
        } else if (ent.isDirectory() && depth < 3) {
          queue.push({ dir: full, depth: depth + 1 });
        }
      }
    }
  }
  return null;
}

/**
 * Auto-detect an app exe by name (no developer machine hardcodes).
 * Order: env override → PATH → App Paths registry → common install dirs → Start Menu → shallow walk.
 * Optional override: PROMPTSPARK_CURSOR_EXE / PROMPTSPARK_CODEX_EXE / …
 */
function findAppExe(exeNames, { dirHints = [], titleHints = [], envKey = "" } = {}) {
  if (envKey) {
    const fromEnv = process.env[envKey];
    if (fromEnv && exists(fromEnv)) return path.resolve(fromEnv);
  }
  const names = Array.isArray(exeNames) ? exeNames : [exeNames];
  const { localAppData, programFiles, programFilesX86 } = winEnvPaths();

  for (const name of names) {
    const fromPath = whichExe(name);
    if (fromPath) return fromPath;
    const fromReg = regAppPath(name);
    if (fromReg) return fromReg;
  }

  const commonDirs = [];
  for (const name of names) {
    const stem = name.replace(/\.exe$/i, "");
    for (const hint of uniq([stem, ...dirHints])) {
      commonDirs.push(
        path.join(localAppData, "Programs", hint, name),
        path.join(localAppData, hint, name),
        path.join(programFiles, hint, name),
        path.join(programFilesX86, hint, name),
      );
    }
  }
  const hit = firstExisting(commonDirs);
  if (hit) return hit;

  const fromMenu = findStartMenuExe(names, titleHints.length ? titleHints : dirHints);
  if (fromMenu) return fromMenu;

  const programsRoot = path.join(localAppData, "Programs");
  return walkFindExe(programsRoot, names, { maxDepth: 4, maxDirs: 500 });
}

function findStoreCodexExe() {
  const { programFiles } = winEnvPaths();
  const winApps = path.join(programFiles, "WindowsApps");
  if (!exists(winApps)) return null;
  try {
    const dirs = fs.readdirSync(winApps).filter((d) => /^OpenAI\.Codex_/i.test(d));
    dirs.sort().reverse();
    for (const d of dirs) {
      const exe = firstExisting([
        path.join(winApps, d, "app", "Codex.exe"),
        path.join(winApps, d, "Codex.exe"),
      ]);
      if (exe) return exe;
    }
  } catch {
    /* ACL */
  }
  return null;
}

function detectTargets() {
  const codexExe =
    findAppExe(["Codex.exe"], {
      dirHints: ["Codex", "codex", "OpenAI Codex", "OpenAI"],
      titleHints: ["codex", "openai"],
      envKey: "PROMPTSPARK_CODEX_EXE",
    }) || findStoreCodexExe();
  const codexWb = resolveElectronWorkbench(codexExe ? path.dirname(codexExe) : null);

  const cursorExe = findAppExe(["Cursor.exe"], {
    dirHints: ["cursor", "Cursor"],
    titleHints: ["cursor"],
    envKey: "PROMPTSPARK_CURSOR_EXE",
  });
  const cursorWb = resolveElectronWorkbench(cursorExe ? path.dirname(cursorExe) : null);

  const windsurfExe = findAppExe(["Windsurf.exe"], {
    dirHints: ["Windsurf", "windsurf"],
    titleHints: ["windsurf"],
    envKey: "PROMPTSPARK_WINDSURF_EXE",
  });
  const devinExe =
    findAppExe(["Devin.exe"], {
      dirHints: ["Devin", "devin"],
      titleHints: ["devin"],
      envKey: "PROMPTSPARK_DEVIN_EXE",
    }) || windsurfExe;
  const devinWb = resolveElectronWorkbench(devinExe ? path.dirname(devinExe) : null);

  const antigravityExe = findAppExe(["Antigravity.exe", "Antigravity IDE.exe"], {
    dirHints: ["antigravity", "Antigravity", "Antigravity IDE"],
    titleHints: ["antigravity"],
    envKey: "PROMPTSPARK_ANTIGRAVITY_EXE",
  });
  const antigravityRoots = uniq([
    antigravityExe && path.dirname(antigravityExe),
    antigravityExe && path.join(path.dirname(antigravityExe), "Antigravity"),
  ]);
  let antigravityWb = { workbench: null, productJson: null, checksumKey: null };
  for (const root of antigravityRoots) {
    antigravityWb = resolveElectronWorkbench(root);
    if (antigravityWb.workbench) break;
  }
  // Some installs put workbench one level above the exe folder
  if (!antigravityWb.workbench && antigravityExe) {
    antigravityWb = resolveElectronWorkbench(path.dirname(path.dirname(antigravityExe)));
  }

  return {
    codex: {
      id: "codex",
      label: "Codex",
      available: ENABLED_HOST_IDS.has("codex") && !!(codexExe && codexWb.workbench && exists(codexWb.workbench)),
      exe: codexExe,
      workbench: codexWb.workbench,
      productJson: codexWb.productJson,
      checksumKey: codexWb.checksumKey,
      restart: {
        processNames: ["Codex"],
        launch: codexExe,
      },
    },
    cursor: {
      id: "cursor",
      label: "Cursor",
      available: ENABLED_HOST_IDS.has("cursor") && !!(cursorExe && cursorWb.workbench && exists(cursorWb.workbench)),
      exe: cursorExe,
      workbench: cursorWb.workbench,
      productJson: cursorWb.productJson,
      checksumKey: cursorWb.checksumKey || "vs/code/electron-sandbox/workbench/workbench.html",
      restart: {
        processNames: ["Cursor"],
        launch: cursorExe,
      },
    },
    devin: {
      id: "devin",
      label: "Devin / Windsurf",
      available: ENABLED_HOST_IDS.has("devin") && !!(devinExe && devinWb.workbench && exists(devinWb.workbench)),
      exe: devinExe,
      workbench: devinWb.workbench,
      productJson: devinWb.productJson,
      checksumKey: devinWb.checksumKey || "vs/code/electron-browser/workbench/workbench.html",
      restart: {
        processNames: ["Devin", "Windsurf"],
        launch: devinExe,
      },
    },
    antigravity: {
      id: "antigravity",
      label: "Antigravity",
      available:
        ENABLED_HOST_IDS.has("antigravity") && !!(antigravityWb.workbench && exists(antigravityWb.workbench)),
      exe: antigravityExe,
      workbench: antigravityWb.workbench,
      productJson: antigravityWb.productJson,
      checksumKey: antigravityWb.checksumKey || "vs/code/electron-browser/workbench/workbench.html",
      restart: {
        processNames: ["Antigravity", "Antigravity IDE"],
        launch: antigravityExe,
      },
    },
  };
}

function ensureBuilt() {
  if (!exists(DIST)) {
    console.log("Building dist/prompt-optimize.js …");
    execSync("node build.mjs", { cwd: ROOT, stdio: "inherit" });
  }
  if (!exists(DIST)) throw new Error("Build failed: dist/prompt-optimize.js missing");
  return fs.readFileSync(DIST, "utf8");
}

function vscodeChecksum(content) {
  return crypto.createHash("sha256").update(content, "utf8").digest("base64").replace(/=+$/, "");
}

function updateProductChecksum(productJsonPath, checksumKey, workbenchPath) {
  if (!productJsonPath || !exists(productJsonPath) || !checksumKey) return false;
  const raw = fs.readFileSync(productJsonPath, "utf8");
  const json = JSON.parse(raw);
  if (!json.checksums || typeof json.checksums !== "object") return false;
  const html = fs.readFileSync(workbenchPath, "utf8");
  const sum = vscodeChecksum(html);
  // Try both sandbox and browser keys if needed
  const keys = [checksumKey, "vs/code/electron-sandbox/workbench/workbench.html", "vs/code/electron-browser/workbench/workbench.html"];
  let updated = false;
  for (const key of keys) {
    if (key in json.checksums) {
      json.checksums[key] = sum;
      updated = true;
    }
  }
  if (!updated) return false;
  fs.writeFileSync(productJsonPath, JSON.stringify(json, null, "\t") + "\n", "utf8");
  return true;
}

function wrapWorkbenchPatch(scriptBody) {
  // Escape </script> in body
  const safe = scriptBody.replace(/<\/script/gi, "<\\/script");
  return `\n${PATCH_BEGIN}\n<script>\n${safe}\n</script>\n${PATCH_END}\n`;
}

function patchWorkbench(workbenchPath, scriptBody, uninstall = false) {
  let html = fs.readFileSync(workbenchPath, "utf8");
  const strip = (begin, end) => {
    const re = new RegExp(`${escapeRe(begin)}[\\s\\S]*?${escapeRe(end)}\\n?`, "g");
    html = html.replace(re, "");
  };
  strip(PATCH_BEGIN, PATCH_END);
  strip(LEGACY_PATCH_BEGIN, LEGACY_PATCH_END);
  if (uninstall) {
    fs.writeFileSync(workbenchPath, html, "utf8");
    return { changed: true, action: "removed" };
  }
  const patch = wrapWorkbenchPatch(scriptBody);
  if (html.includes("</html>")) {
    html = html.replace(/<\/html>\s*$/i, `${patch}</html>\n`);
  } else {
    html += patch;
  }
  fs.writeFileSync(workbenchPath, html, "utf8");
  return { changed: true, action: "installed" };
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function killProcesses(names) {
  for (const name of names) {
    try {
      execSync(`taskkill /IM "${name}.exe" /F`, { stdio: "ignore" });
    } catch {
      /* not running */
    }
  }
}

function launchApp(exePath) {
  if (!exePath || !exists(exePath)) return false;
  spawn(exePath, [], { detached: true, stdio: "ignore" }).unref();
  return true;
}

async function proxyHealthy() {
  try {
    const res = await fetch(`http://127.0.0.1:${PROXY_PORT}/health`, {
      signal: AbortSignal.timeout(800),
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function ensureProxyRunning() {
  if (!exists(PROXY_JS)) {
    console.warn("⚠ 未找到 proxy.mjs，Cursor/Devin 的 API 请求可能失败（CORS）");
    return false;
  }
  if (await proxyHealthy()) {
    console.log(`✓ 本地 LLM 代理已在运行 (127.0.0.1:${PROXY_PORT})`);
    return true;
  }
  console.log(`启动本地 LLM 代理 (127.0.0.1:${PROXY_PORT}) …`);
  const child = spawn(process.execPath, [PROXY_JS], {
    cwd: ROOT,
    detached: true,
    stdio: "ignore",
    windowsHide: true,
  });
  child.unref();
  for (let i = 0; i < 15; i++) {
    await new Promise((r) => setTimeout(r, 200));
    if (await proxyHealthy()) {
      console.log("✓ 本地 LLM 代理已启动");
      return true;
    }
  }
  console.warn("⚠ 代理启动超时，可手动运行: node proxy.mjs");
  return false;
}

function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(String(answer || "").trim());
    });
  });
}

async function selectHosts(targets) {
  if (FORCE_HOSTS?.length) {
    const picked = FORCE_HOSTS.filter((id) => targets[id]?.available);
    const blocked = FORCE_HOSTS.filter((id) => !ENABLED_HOST_IDS.has(id));
    if (blocked.length) {
      console.warn(`⚠ 暂未开放安装（待验证）：${blocked.join(", ")}。当前仅支持：${[...ENABLED_HOST_IDS].join(", ")}`);
    }
    if (!picked.length) {
      console.error("未选中可安装目标。当前仅开放 Cursor。");
      process.exit(1);
    }
    return picked;
  }
  const available = Object.values(targets).filter((t) => t.available);
  if (!available.length) {
    console.error("未检测到 Cursor（当前安装器仅开放 Cursor）。");
    console.error("请确认已安装 Cursor；或设置环境变量后重试：");
    console.error('  $env:PROMPTSPARK_CURSOR_EXE="C:\\path\\to\\Cursor.exe"');
    process.exit(1);
  }

  console.log("\n可安装目标（当前仅开放已验证宿主）：\n");
  available.forEach((t, i) => {
    console.log(`  [${i + 1}] ${t.label}`);
    if (t.exe) console.log(`      exe: ${t.exe}`);
    if (t.workbench) console.log(`      workbench: ${t.workbench}`);
  });
  if (available.length === 1) {
    console.log(`\n将安装到：${available[0].label}`);
    return [available[0].id];
  }
  console.log(`  [a] 全部安装`);
  console.log(`  [q] 取消\n`);
  console.log("提示：若未自动找到，可设置：");
  console.log('  $env:PROMPTSPARK_CURSOR_EXE="C:\\path\\to\\Cursor.exe"\n');

  const answer = await ask("选择要安装的目标（如 1 或 a）： ");
  if (!answer || answer.toLowerCase() === "q") {
    console.log("已取消。");
    process.exit(0);
  }
  if (answer.toLowerCase() === "a") return available.map((t) => t.id);

  const picked = new Set();
  for (const part of answer.split(/[,\s]+/)) {
    const n = Number(part);
    if (Number.isInteger(n) && n >= 1 && n <= available.length) {
      picked.add(available[n - 1].id);
    } else if (targets[part]?.available) {
      picked.add(part);
    }
  }
  if (!picked.size) {
    console.error("无效选择。");
    process.exit(1);
  }
  return [...picked];
}

async function main() {
  console.log(`PromptSpark installer  ·  ${UNINSTALL ? "卸载" : "安装"}`);
  if (!UNINSTALL) {
    await ensureProxyRunning();
  }
  const targets = detectTargets();
  const selected = await selectHosts(targets);
  const scriptBody = UNINSTALL ? null : ensureBuilt();

  const results = [];
  for (const id of selected) {
    const t = targets[id];
    try {
      if (!t.workbench || !exists(t.workbench)) {
        throw new Error("未找到可注入的 workbench.html（请确认已安装原生应用）");
      }
      const r = patchWorkbench(t.workbench, scriptBody, UNINSTALL);
      if (t.productJson && exists(t.productJson)) {
        updateProductChecksum(t.productJson, t.checksumKey, t.workbench);
      }
      results.push({ id, ...r, path: t.workbench });
      console.log(`✓ ${t.label}: ${results.at(-1).action}`);
      if (results.at(-1).path) console.log(`  → ${results.at(-1).path}`);
    } catch (error) {
      console.error(`✗ ${t.label}: ${error.message}`);
      results.push({ id, error: error.message });
    }
  }

  if (!NO_RESTART && results.some((r) => r.changed)) {
    const restart = await ask("\n是否立即重启已安装的应用？[Y/n] ");
    if (!restart || /^y/i.test(restart)) {
      for (const id of selected) {
        const t = targets[id];
        if (!t?.restart) continue;
        console.log(`重启 ${t.label} …`);
        killProcesses(t.restart.processNames);
        await new Promise((r) => setTimeout(r, 800));
        if (!UNINSTALL && t.restart.launch) {
          launchApp(t.restart.launch);
        }
      }
    } else {
      console.log("请手动重启对应应用后生效。");
    }
  }

  console.log("\n完成。交互：左键优化 / 再点还原 / 右键或 Alt+点击打开设置。");
  if (!UNINSTALL) {
    console.log(`API 请求经本地代理 http://127.0.0.1:${PROXY_PORT}（Electron 宿主需此代理绕过 CORS）。`);
  }
}

const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isMain) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
