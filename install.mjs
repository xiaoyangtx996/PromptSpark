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
const PATCH_ASSET = "promptspark.js";

const args = process.argv.slice(2);
const UNINSTALL = args.includes("--uninstall");
let uninstallMode = UNINSTALL;
const NO_RESTART = args.includes("--no-restart");
const ELEVATED_CHILD = args.includes("--elevated-child");
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
const ENABLED_HOST_IDS = new Set(["cursor", "codex"]);

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
    const packageRoot = execSync(
      "powershell.exe -NoProfile -NonInteractive -Command \"(Get-AppxPackage -Name 'OpenAI.Codex*' | Select-Object -First 1 -ExpandProperty InstallLocation)\"",
      { encoding: "utf8", windowsHide: true },
    ).trim();
    const packageExe = packageRoot && path.join(packageRoot, "app", "ChatGPT.exe");
    if (packageExe) return packageExe;
  } catch {
    /* AppX lookup is unavailable on some Windows builds. */
  }
  try {
    const direct = execSync(
      `powershell.exe -NoProfile -NonInteractive -Command "Get-ChildItem -LiteralPath '${winApps.replaceAll("'", "''")}' -Directory -Filter 'OpenAI.Codex_*' -ErrorAction Stop | ForEach-Object { $p = Join-Path $_.FullName 'app\\Codex.exe'; if (Test-Path -LiteralPath $p) { $p; break } }"`,
      { encoding: "utf8", windowsHide: true },
    ).trim();
    if (direct && exists(direct.split(/\r?\n/)[0].trim())) return direct.split(/\r?\n/)[0].trim();
  } catch {
    /* WindowsApps may deny directory enumeration; fall back to known paths. */
  }
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
  const codexScriptPaths = codexPlusPlusPaths();
  const codexPlusLauncher = findAppExe(["codex-plus-plus.exe"], {
    dirHints: ["CodexPlusPlus", "Codex++"],
    titleHints: ["codex-plus-plus", "codex++"],
    envKey: "PROMPTSPARK_CODEX_PLUS_EXE",
  });

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

  const targets = {
    codex: {
      id: "codex",
      label: "Codex",
      available: ENABLED_HOST_IDS.has("codex") && !!codexExe,
      runtimeAvailable: hasCodexPlusPlusRuntime(),
      exe: codexExe,
      workbench: codexWb.workbench,
      productJson: codexWb.productJson,
      checksumKey: codexWb.checksumKey,
      scriptPaths: codexScriptPaths,
      restart: {
        processNames: ["Codex", "ChatGPT"],
        launch: codexScriptPaths.host,
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
  for (const target of Object.values(targets)) {
    target.installed = target.id === "codex"
      ? exists(codexScriptPaths.script)
      : !!(target.workbench && exists(target.workbench) &&
      (exists(path.join(path.dirname(target.workbench), PATCH_ASSET)) ||
        fs.readFileSync(target.workbench, "utf8").includes(PATCH_BEGIN)));
  }
  return targets;
}

function codexPlusPlusPaths() {
  const root = path.join(process.env.LOCALAPPDATA || path.join(process.env.USERPROFILE || "", "AppData", "Local"), "PromptSpark", "codex");
  return {
    root,
    scripts: root,
    registry: path.join(root, "promptspark-codex.json"),
    script: path.join(root, "promptspark-codex.js"),
    host: path.join(root, "promptspark-codex-host.js"),
  };
}

function hasCodexPlusPlusRuntime() {
  const paths = codexPlusPlusPaths();
  return exists(paths.script) && exists(paths.host);
}

function updateCodexPlusPlusScript(scriptBody, uninstall = false, codexExe = "") {
  const paths = codexPlusPlusPaths();
  fs.mkdirSync(paths.root, { recursive: true });
  let data = { enabled: true, name: "PromptSpark Codex Host", version: "1.3.0" };
  if (exists(paths.registry)) {
    try { data = { ...data, ...JSON.parse(fs.readFileSync(paths.registry, "utf8")) }; } catch { /* reset malformed registry */ }
  }
  if (uninstall) {
    fs.rmSync(paths.script, { force: true });
    fs.rmSync(paths.host, { force: true });
    fs.rmSync(paths.registry, { force: true });
    fs.rmSync(path.join(desktopPath(), "PromptSpark Codex.lnk"), { force: true });
  } else {
    fs.writeFileSync(paths.script, scriptBody, "utf8");
    const runtimePath = path.join(paths.root, "promptspark-codex-runtime.mjs");
    fs.writeFileSync(paths.registry, JSON.stringify({ exe: codexExe, script: paths.script }, null, 2), "utf8");
    fs.copyFileSync(path.join(ROOT, "codex-runtime.mjs"), runtimePath);
    const command = `"${process.execPath}" "${runtimePath}" "${paths.registry}"`;
    const host = `var sh = new ActiveXObject("WScript.Shell");\r\nsh.Run(${JSON.stringify(command)}, 0, false);\r\n`;
    fs.writeFileSync(paths.host, host, "utf8");
    const shortcut = path.join(desktopPath(), "PromptSpark Codex.lnk");
    const psq = (value) => `'${String(value).replaceAll("'", "''")}'`;
    const ps = `$w=New-Object -ComObject WScript.Shell; $s=$w.CreateShortcut(${psq(shortcut)}); $s.TargetPath='wscript.exe'; $s.Arguments=${psq('"' + paths.host + '"')}; $s.WorkingDirectory=${psq(paths.root)}; $s.Description='PromptSpark Codex'; $s.Save()`;
    try {
      const psFile = path.join(paths.root, ".create-promptspark-shortcut.ps1");
      fs.writeFileSync(psFile, ps, "utf8");
      execSync(`powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "${psFile}"`, { windowsHide: true });
      fs.rmSync(psFile, { force: true });
      if (!exists(shortcut)) console.warn(`未能创建快捷方式: ${shortcut}`);
    } catch (error) {
      console.warn(`快捷方式创建失败: ${error.message}`);
    }
  }
  if (uninstall) fs.rmSync(paths.registry, { force: true });
  return { changed: true, action: uninstall ? "removed" : "installed", path: paths.script };
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

function wrapWorkbenchPatch() {
  return `\n${PATCH_BEGIN}\n<script src="./${PATCH_ASSET}"></script>\n${PATCH_END}\n`;
}

function patchWorkbench(workbenchPath, scriptBody, uninstall = false) {
  const assetPath = path.join(path.dirname(workbenchPath), PATCH_ASSET);
  let html = fs.readFileSync(workbenchPath, "utf8");
  const strip = (begin, end) => {
    const re = new RegExp(`${escapeRe(begin)}[\\s\\S]*?${escapeRe(end)}\\n?`, "g");
    html = html.replace(re, "");
  };
  strip(PATCH_BEGIN, PATCH_END);
  strip(LEGACY_PATCH_BEGIN, LEGACY_PATCH_END);
  if (uninstall) {
    fs.writeFileSync(workbenchPath, html, "utf8");
    fs.rmSync(assetPath, { force: true });
    return { changed: true, action: "removed" };
  }
  fs.writeFileSync(assetPath, scriptBody, "utf8");
  const patch = wrapWorkbenchPatch();
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

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function isProcessRunning(name) {
  try {
    const out = execSync(`tasklist /FI "IMAGENAME eq ${name}.exe" /NH`, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      windowsHide: true,
    });
    return String(out).toLowerCase().includes(`${name}.exe`.toLowerCase());
  } catch {
    return false;
  }
}

function killProcesses(names) {
  for (const name of names) {
    try {
      execSync(`taskkill /IM "${name}.exe" /F /T`, { stdio: "ignore", windowsHide: true });
    } catch {
      /* not running */
    }
  }
}

async function waitProcessesGone(names, timeoutMs = 30000) {
  const uniqNames = [...new Set(names.filter(Boolean))];
  if (!uniqNames.length) return true;
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (!uniqNames.some((n) => isProcessRunning(n))) return true;
    await sleep(350);
  }
  return !uniqNames.some((n) => isProcessRunning(n));
}

function collectProcessNames(selected, targets) {
  return [...new Set(selected.flatMap((id) => targets[id]?.restart?.processNames || []))];
}

async function withWriteRetry(fn, retries = 3) {
  let last;
  for (let i = 0; i < retries; i++) {
    try {
      return fn();
    } catch (error) {
      last = error;
      const code = error?.code;
      if (code !== "EPERM" && code !== "EBUSY" && code !== "EACCES") throw error;
      console.log(`  写入重试 ${i + 1}/${retries}…`);
      await sleep(400 + i * 200);
    }
  }
  if (last?.code === "EACCES") {
    throw new Error("管理员进程仍没有目标文件的写入权限。", { cause: last });
  }
  throw last;
}

function launchApp(exePath) {
  if (!exePath) return false;
  if (/\.(vbs|js)$/i.test(exePath)) {
    spawn("wscript.exe", [exePath], { detached: true, stdio: "ignore", windowsHide: true }).unref();
    return true;
  }
  if (String(exePath).startsWith("shell:")) {
    spawn("explorer.exe", [String(exePath)], { detached: true, stdio: "ignore", windowsHide: true }).unref();
    return true;
  }
  if (!exists(exePath)) {
    try {
      spawn("powershell.exe", ["-NoProfile", "-WindowStyle", "Hidden", "-Command", `Start-Process -FilePath '${String(exePath).replaceAll("'", "''")}'`], { detached: true, stdio: "ignore", windowsHide: true }).unref();
      return true;
    } catch { return false; }
  }
  spawn("cmd.exe", ["/c", "start", "", exePath], {
    detached: true,
    stdio: "ignore",
    windowsHide: true,
  }).unref();
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
  const menuAvailable = [...ENABLED_HOST_IDS]
    .map((id) => targets[id])
    .filter(Boolean);
  {
  if (FORCE_HOSTS?.length) {
    const selected = FORCE_HOSTS.filter((id) => targets[id]?.available);
    if (!selected.length) throw new Error("未检测到可用的 Cursor");
    return { selected, uninstall: uninstallMode };
  }
  if (!menuAvailable.length) throw new Error("未检测到 Cursor");
  console.log("\nPromptSpark 安装界面\n");
  menuAvailable.forEach((t, i) => {
    const status = t.installed ? "已安装" : t.available ? "未安装" : "未检测到";
    console.log(`  [${i + 1}] ${t.label} (${status})`);
  });
  var answer = await ask("请选择软件编号（q 取消）：");
  if (answer.toLowerCase() === "q") { console.log("已取消。"); process.exit(0); }
  const index = Number(answer);
  if (!Number.isInteger(index) || index < 1 || index > menuAvailable.length) throw new Error("无效的软件编号");
  const target = menuAvailable[index - 1];
  if (!target.available) throw new Error(`${target.label} 未检测到，请确认已安装或设置对应 EXE 路径`);
  console.log(`\n  [1] 安装${target.installed ? "（覆盖当前安装）" : ""}`);
  console.log("  [2] 卸载");
  const action = await ask("请选择操作（q 取消）：");
  if (action.toLowerCase() === "q") { console.log("已取消。"); process.exit(0); }
  if (action !== "1" && action !== "2") throw new Error("无效的操作");
  uninstallMode = action === "2";
  const verb = uninstallMode ? "卸载" : "安装";
  const confirm = await ask(`确认${verb} ${target.label}？请输入 y 确认：`);
  if (!/^y(es)?$/i.test(confirm)) { console.log("已取消。"); process.exit(0); }
  return { selected: [target.id], uninstall: uninstallMode };
  /*
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

  var answer = await ask("选择要安装的目标（如 1 或 a）： ");
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
  */
  }
}

function desktopPath() {
  try {
    const value = execSync("powershell.exe -NoProfile -NonInteractive -Command \"[Environment]::GetFolderPath('Desktop')\"", { encoding: "utf8", windowsHide: true }).trim();
    if (value) return value;
  } catch { /* fallback */ }
  return path.join(process.env.USERPROFILE || "", "Desktop");
}

async function closeHosts(selected, targets) {
  const procNames = collectProcessNames(selected, targets);
  if (!procNames.length) return;
  if (!procNames.some((n) => isProcessRunning(n))) return;
  console.log(`关闭进程：${procNames.join(", ")} …`);
  killProcesses(procNames);
  const gone = await waitProcessesGone(procNames, 30000);
  if (!gone) {
    killProcesses(procNames);
    await waitProcessesGone(procNames, 10000);
  }
  await sleep(1000);
}

async function applyPatches(selected, targets, scriptBody) {
  await closeHosts(selected, targets);

  const results = [];
  for (const id of selected) {
    const t = targets[id];
    try {
      if (id === "codex") {
        const result = updateCodexPlusPlusScript(scriptBody, uninstallMode, t.exe);
        results.push({ id, ...result });
        console.log(`✅${t.label}: ${result.action}`);
        continue;
      }
      if (!t.workbench || !exists(t.workbench)) {
        throw new Error("未找到可注入的 workbench.html（请确认已安装原生应用）");
      }
      const r = await withWriteRetry(() => patchWorkbench(t.workbench, scriptBody, uninstallMode));
      if (t.productJson && exists(t.productJson)) {
        await withWriteRetry(() => updateProductChecksum(t.productJson, t.checksumKey, t.workbench));
      }
      results.push({ id, ...r, path: t.workbench });
      console.log(`✓ ${t.label}: ${results.at(-1).action}`);
      if (results.at(-1).path) console.log(`  → ${results.at(-1).path}`);
    } catch (error) {
      console.error(`✗ ${t.label}: ${error.message}`);
      results.push({ id, error: error.message });
    }
  }
  return results;
}

async function relaunchHosts(selected, targets) {
  if (NO_RESTART) {
    if (NO_RESTART) console.log("已跳过重启（--no-restart）。请手动打开应用后生效。");
    return;
  }
  for (const id of selected) {
    const t = targets[id];
    if (!t?.restart?.launch) continue;
    console.log(`启动 ${t.label} …`);
    if (!launchApp(t.restart.launch)) {
      console.warn(`⚠ 未能启动：${t.restart.launch}`);
    }
  }
}

function isElevated() {
  if (process.platform !== "win32") return true;
  try {
    const output = execSync(
      "powershell.exe -NoProfile -NonInteractive -Command \"([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)\"",
      { encoding: "utf8", windowsHide: true },
    );
    return output.trim().toLowerCase() === "true";
  } catch {
    return false;
  }
}

function psQuote(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

async function ensureElevated() {
  if (isElevated()) return true;
  console.log("正在请求管理员权限…");
  const childArgs = [fileURLToPath(import.meta.url), ...process.argv.slice(2)];
  const command = [
    `$process = Start-Process -FilePath ${psQuote(process.execPath)}`,
    `-ArgumentList @(${[...childArgs, "--elevated-child"].map(psQuote).join(", ")})`,
    "-Verb RunAs -Wait -PassThru",
    "; exit $process.ExitCode",
  ].join(" ");
  const exitCode = await new Promise((resolve) => {
    const child = spawn("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", command], {
      stdio: "inherit",
      windowsHide: true,
    });
    child.on("error", () => resolve(1));
    child.on("exit", (code) => resolve(code ?? 1));
  });
  process.exitCode = exitCode;
  return false;
}

async function main() {
  if (!(await ensureElevated())) return;
  console.log(`PromptSpark installer  ·  ${UNINSTALL ? "卸载" : "安装"}`);
  const targets = detectTargets();
  const selection = await selectHosts(targets);
  const selected = selection.selected;
  uninstallMode = selection.uninstall;
  if (!uninstallMode) {
    await ensureProxyRunning();
  }
  const scriptBody = uninstallMode ? null : ensureBuilt();

  // 顺序：关进程 → 写补丁 → 再启动
  const results = await applyPatches(selected, targets, scriptBody);
  if (results.some((r) => r.changed)) {
    await relaunchHosts(selected, targets);
  }

  console.log("\n完成。交互：左键优化 / 再点还原 / 右键或 Alt+点击打开设置。");
  if (!uninstallMode) {
    console.log(`API 请求经本地代理 http://127.0.0.1:${PROXY_PORT}（Electron 宿主需此代理绕过 CORS）。`);
  }
  if (results.some((r) => r.error)) process.exit(1);
  if (ELEVATED_CHILD && process.platform === "win32") {
    await ask("\n管理员窗口已保留。按 Enter 关闭窗口：");
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
