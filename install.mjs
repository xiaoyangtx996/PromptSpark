#!/usr/bin/env node
/**
 * PromptSpark installer
 * Interactive install into Cursor (Windows)
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
import { ensureProxyRunning as ensureProxyRunningShared } from "./ensure-proxy.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = __dirname;
const DIST = path.join(ROOT, "dist", "prompt-optimize.js");
const PROXY_JS = path.join(ROOT, "proxy.mjs");
const ENSURE_PROXY_JS = path.join(ROOT, "ensure-proxy.mjs");
const CURSOR_RUNTIME_JS = path.join(ROOT, "cursor-runtime.mjs");
const CODEX_RUNTIME_JS = path.join(ROOT, "codex-runtime.mjs");
const PROXY_PORT = 37841;
const PROTOCOL_SCHEME = "promptspark";
const PATCH_BEGIN = "<!-- PROMPTSPARK-PATCH -->";
const PATCH_END = "<!-- /PROMPTSPARK-PATCH -->";
const LEGACY_PATCH_BEGIN = "<!-- PROMPT-OPTIMIZE-PATCH -->";
const LEGACY_PATCH_END = "<!-- /PROMPT-OPTIMIZE-PATCH -->";
const PATCH_ASSET = "promptspark.js";

function promptSparkDataRoot() {
  const { localAppData, home } = winEnvPaths();
  return path.join(localAppData || path.join(home, "AppData", "Local"), "PromptSpark");
}

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
 * PromptSpark 安装入口仅开放 Cursor。
 * Codex 提示词优化已迁入 Codex++ 内置用户脚本，请使用 Codex++。
 * Devin / Antigravity 检测逻辑保留，待验证后再开放。
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
      scriptPaths: cursorLauncherPaths(),
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
    if (target.id === "codex") {
      target.installed = exists(codexPlusUserScriptPaths().script) || exists(codexScriptPaths.script);
    } else {
      target.installed = !!(target.workbench && exists(target.workbench) &&
        (exists(path.join(path.dirname(target.workbench), PATCH_ASSET)) ||
          fs.readFileSync(target.workbench, "utf8").includes(PATCH_BEGIN)));
    }
  }
  return targets;
}

function codexPlusPlusPaths() {
  const root = path.join(promptSparkDataRoot(), "codex");
  return {
    root,
    scripts: root,
    registry: path.join(root, "promptspark-codex.json"),
    script: path.join(root, "promptspark-codex.js"),
    host: path.join(root, "promptspark-codex-host.js"),
    runtime: path.join(root, "promptspark-codex-runtime.mjs"),
    ensureProxy: path.join(root, "ensure-proxy.mjs"),
    proxy: path.join(root, "proxy.mjs"),
  };
}

function cursorLauncherPaths() {
  const root = path.join(promptSparkDataRoot(), "cursor");
  return {
    root,
    registry: path.join(root, "promptspark-cursor.json"),
    host: path.join(root, "promptspark-cursor-host.js"),
    runtime: path.join(root, "cursor-runtime.mjs"),
    ensureProxy: path.join(root, "ensure-proxy.mjs"),
    proxy: path.join(root, "proxy.mjs"),
    shortcutBackup: path.join(root, "shortcut-backup.json"),
  };
}

function codexPlusUserScriptPaths() {
  const root = path.join(process.env.APPDATA || path.join(winEnvPaths().home, "AppData", "Roaming"), "Codex++");
  return {
    root,
    scriptsDir: path.join(root, "user_scripts"),
    registry: path.join(root, "user_scripts.json"),
    script: path.join(root, "user_scripts", "market-promptspark.js"),
    scriptKey: "user:market-promptspark.js",
    marketId: "prompt-optimize",
  };
}

function hasCodexPlusPlusRuntime() {
  return exists(codexPlusUserScriptPaths().script) || exists(codexPlusPlusPaths().script);
}

function deployRuntimeFiles(destDir) {
  fs.mkdirSync(destDir, { recursive: true });
  const copies = [
    [PROXY_JS, path.join(destDir, "proxy.mjs")],
    [ENSURE_PROXY_JS, path.join(destDir, "ensure-proxy.mjs")],
  ];
  for (const [src, dest] of copies) {
    if (!exists(src)) throw new Error(`缺少运行时文件: ${src}`);
    fs.copyFileSync(src, dest);
  }
}

function writeWshHost(hostPath, command) {
  const host = `var sh = new ActiveXObject("WScript.Shell");\r\nsh.Run(${JSON.stringify(command)}, 0, false);\r\n`;
  fs.writeFileSync(hostPath, host, "utf8");
}

function psQuote(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function writePs1File(filePath, content) {
  // PowerShell 5.1 defaults to ANSI when reading .ps1 without BOM; Chinese paths break.
  fs.writeFileSync(filePath, `\uFEFF${content}`, "utf8");
}

function runPs1File(filePath) {
  try {
    return execSync(
      `powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "${filePath}"`,
      { windowsHide: true, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
    );
  } catch (error) {
    const stderr = String(error?.stderr || "").trim();
    const stdout = String(error?.stdout || "").trim();
    const detail = stderr || stdout || error?.message || String(error);
    const short = detail.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)[0] || "PowerShell failed";
    const err = new Error(short);
    err.cause = error;
    throw err;
  }
}

function readPowerShellText(command) {
  const tmp = path.join(
    process.env.TEMP || process.env.TMP || promptSparkDataRoot(),
    `promptspark-ps-${process.pid}-${Date.now()}.txt`,
  );
  const ps = `
$ErrorActionPreference = 'Stop'
$value = & { ${command} }
[System.IO.File]::WriteAllText(${psQuote(tmp)}, [string]$value, (New-Object System.Text.UTF8Encoding $false))
`;
  const psFile = `${tmp}.ps1`;
  try {
    writePs1File(psFile, ps);
    runPs1File(psFile);
    return fs.readFileSync(tmp, "utf8").replace(/^\uFEFF/, "").trim();
  } finally {
    fs.rmSync(psFile, { force: true });
    fs.rmSync(tmp, { force: true });
  }
}

function sharedProxyPaths() {
  const root = promptSparkDataRoot();
  return {
    root,
    proxy: path.join(root, "proxy.mjs"),
    ensureProxy: path.join(root, "ensure-proxy.mjs"),
  };
}

function deploySharedProxyRuntime() {
  const shared = sharedProxyPaths();
  deployRuntimeFiles(shared.root);
  return shared;
}

function registerSharedProtocolHandler() {
  const shared = deploySharedProxyRuntime();
  registerProtocolHandler(shared.ensureProxy);
}

function refreshProtocolAfterHostChange() {
  const cursorExt = cursorExtensionPaths();
  const cursorOk = exists(path.join(cursorExt.dir, "extension.js"));
  const codexOk = exists(codexPlusUserScriptPaths().script);
  if (cursorOk || codexOk) {
    registerSharedProtocolHandler();
  } else {
    unregisterProtocolHandler();
  }
}

function registerProtocolHandler(ensureProxyPath) {
  if (process.platform !== "win32") return;
  const command = `"${process.execPath}" "${ensureProxyPath}"`;
  const dir = path.dirname(ensureProxyPath);
  fs.mkdirSync(dir, { recursive: true });
  const psFile = path.join(dir, `.register-protocol-${Date.now()}.ps1`);
  const ps = `
$ErrorActionPreference = 'Stop'
$key = 'HKCU:\\Software\\Classes\\${PROTOCOL_SCHEME}'
New-Item -Path $key -Force | Out-Null
Set-ItemProperty -Path $key -Name '(default)' -Value 'URL:PromptSpark Protocol'
New-ItemProperty -Path $key -Name 'URL Protocol' -Value '' -PropertyType String -Force | Out-Null
$cmdKey = Join-Path $key 'shell\\open\\command'
New-Item -Path $cmdKey -Force | Out-Null
Set-ItemProperty -Path $cmdKey -Name '(default)' -Value ${psQuote(command)}
`;
  try {
    writePs1File(psFile, ps);
    runPs1File(psFile);
    console.log(`✓ 已注册协议 ${PROTOCOL_SCHEME}:// → ${ensureProxyPath}`);
  } catch (error) {
    console.warn(`协议注册失败（可忽略）: ${error.message}`);
  } finally {
    fs.rmSync(psFile, { force: true });
  }
}

function unregisterProtocolHandler() {
  if (process.platform !== "win32") return;
  try {
    execSync(
      `powershell.exe -NoProfile -NonInteractive -Command "Remove-Item -Path 'HKCU:\\Software\\Classes\\${PROTOCOL_SCHEME}' -Recurse -Force -ErrorAction SilentlyContinue"`,
      { windowsHide: true },
    );
  } catch {
    /* ignore */
  }
}

function restoreCursorShortcuts(backupPath) {
  if (!exists(backupPath)) return 0;
  let backups = [];
  try {
    backups = JSON.parse(fs.readFileSync(backupPath, "utf8"));
  } catch {
    return 0;
  }
  let restored = 0;
  for (const item of backups) {
    if (!item?.path || !exists(item.path)) continue;
    const psFile = path.join(promptSparkDataRoot(), `.restore-shortcut-${Date.now()}-${restored}.ps1`);
    const ps = `
$ErrorActionPreference = 'Stop'
$s = (New-Object -ComObject WScript.Shell).CreateShortcut(${psQuote(item.path)})
$s.TargetPath = ${psQuote(item.targetPath || "")}
$s.Arguments = ${psQuote(item.arguments || "")}
$s.WorkingDirectory = ${psQuote(item.workingDirectory || "")}
$s.IconLocation = ${psQuote(item.iconLocation || "")}
$s.Save()
`;
    try {
      writePs1File(psFile, ps);
      runPs1File(psFile);
      restored += 1;
    } catch (error) {
      console.warn(`快捷方式还原失败 (${path.basename(item.path)}): ${error.message}`);
    } finally {
      fs.rmSync(psFile, { force: true });
    }
  }
  fs.rmSync(backupPath, { force: true });
  if (restored) console.log(`✓ 已还原 ${restored} 个 Cursor 快捷方式`);
  return restored;
}

function cursorExtensionPaths() {
  const home = process.env.USERPROFILE || winEnvPaths().home;
  const root = path.join(home, ".cursor", "extensions");
  const folderName = "promptspark.promptspark-proxy-1.3.0";
  return {
    root,
    dir: path.join(root, folderName),
    folderName,
    extensionsJson: path.join(root, "extensions.json"),
    id: "promptspark.promptspark-proxy",
    version: "1.3.0",
  };
}

function logStep(message) {
  console.log(message);
  try {
    if (typeof process.stdout?.write === "function") process.stdout.write("");
  } catch {
    /* ignore */
  }
}

function installCursorProxyExtension(proxyPaths, uninstall = false) {
  const ext = cursorExtensionPaths();
  const srcDir = path.join(ROOT, "cursor-extension");
  if (uninstall) {
    fs.rmSync(ext.dir, { recursive: true, force: true });
    // Remove older versions if any
    if (exists(ext.root)) {
      for (const name of fs.readdirSync(ext.root)) {
        if (/^promptspark\.promptspark-proxy-/i.test(name)) {
          fs.rmSync(path.join(ext.root, name), { recursive: true, force: true });
        }
      }
    }
    updateExtensionsJson(ext, null);
    logStep("✓ 已移除 Cursor 代理扩展");
    return { changed: true, action: "removed", path: ext.dir };
  }
  if (!exists(path.join(srcDir, "extension.js")) || !exists(path.join(srcDir, "package.json"))) {
    throw new Error("缺少 cursor-extension/ 源文件");
  }
  const shared = deploySharedProxyRuntime();
  fs.mkdirSync(ext.dir, { recursive: true });
  fs.copyFileSync(path.join(srcDir, "package.json"), path.join(ext.dir, "package.json"));
  fs.copyFileSync(path.join(srcDir, "extension.js"), path.join(ext.dir, "extension.js"));
  fs.writeFileSync(
    path.join(ext.dir, "proxy-config.json"),
    JSON.stringify(
      {
        node: process.execPath,
        ensureProxy: shared.ensureProxy,
        proxy: shared.proxy,
        root: shared.root,
      },
      null,
      2,
    ),
    "utf8",
  );
  updateExtensionsJson(ext, {
    identifier: { id: ext.id },
    version: ext.version,
    location: {
      $mid: 1,
      fsPath: ext.dir,
      _sep: 1,
      external: "file:///" + ext.dir.replace(/\\/g, "/").replace(/^([A-Za-z]):/, "$1%3A"),
      path: "/" + ext.dir.replace(/\\/g, "/").replace(/^([A-Za-z]):/, "$1:"),
      scheme: "file",
    },
    relativeLocation: ext.folderName,
    metadata: {
      isApplicationScoped: false,
      installedTimestamp: Date.now(),
      pinned: true,
      source: "vsix",
    },
  });
  logStep(`✓ 已安装 Cursor 代理扩展（随 Cursor 启动）→ ${ext.dir}`);
  return { changed: true, action: "installed", path: ext.dir };
}

function updateExtensionsJson(ext, entryOrNull) {
  fs.mkdirSync(ext.root, { recursive: true });
  let list = [];
  if (exists(ext.extensionsJson)) {
    try {
      const raw = JSON.parse(fs.readFileSync(ext.extensionsJson, "utf8"));
      list = Array.isArray(raw) ? raw : [];
    } catch {
      list = [];
    }
  }
  list = list.filter((item) => {
    const id = item?.identifier?.id || "";
    return id !== ext.id && !String(id).startsWith("promptspark.promptspark-proxy");
  });
  if (entryOrNull) list.push(entryOrNull);
  fs.writeFileSync(ext.extensionsJson, JSON.stringify(list), "utf8");
}

function updateCursorLauncher(uninstall = false, cursorExe = "") {
  const paths = cursorLauncherPaths();
  fs.mkdirSync(paths.root, { recursive: true });
  if (uninstall) {
    // Undo any previous shortcut retarget from older installs.
    try { restoreCursorShortcuts(paths.shortcutBackup); } catch { /* ignore */ }
    installCursorProxyExtension(paths, true);
    fs.rmSync(paths.host, { force: true });
    fs.rmSync(paths.registry, { force: true });
    fs.rmSync(paths.runtime, { force: true });
    fs.rmSync(paths.ensureProxy, { force: true });
    fs.rmSync(paths.proxy, { force: true });
    try { fs.rmSync(path.join(desktopPath(), "PromptSpark Cursor.lnk"), { force: true }); } catch { /* ignore */ }
    return { changed: true, action: "removed", path: paths.root };
  }
  if (!cursorExe) throw new Error("未找到 Cursor.exe");
  logStep("部署本地代理运行时 …");
  deployRuntimeFiles(paths.root);
  if (exists(CURSOR_RUNTIME_JS)) {
    fs.copyFileSync(CURSOR_RUNTIME_JS, paths.runtime);
  }
  if (exists(ENSURE_PROXY_JS)) {
    fs.copyFileSync(ENSURE_PROXY_JS, paths.ensureProxy);
  }
  fs.writeFileSync(
    paths.registry,
    JSON.stringify({ exe: cursorExe, proxy: paths.proxy }, null, 2),
    "utf8",
  );
  // Optional manual launcher (not required for normal Cursor.exe start).
  if (exists(CURSOR_RUNTIME_JS)) {
    const command = `"${process.execPath}" "${paths.runtime}" "${paths.registry}"`;
    writeWshHost(paths.host, command);
  }
  logStep("安装 Cursor 扩展以随进程启动代理 …");
  installCursorProxyExtension(paths, false);
  // Restore shortcuts if a previous version rewrote them; do NOT retarget again.
  if (exists(paths.shortcutBackup)) {
    logStep("还原此前改写的 Cursor 快捷方式 …");
    restoreCursorShortcuts(paths.shortcutBackup);
  }
  registerSharedProtocolHandler();
  return { changed: true, action: "installed", path: paths.root };
}

function updateCodexUserScriptsRegistry(uninstall = false) {
  const paths = codexPlusUserScriptPaths();
  let data = { enabled: true, scripts: {}, market: {} };
  if (exists(paths.registry)) {
    try {
      data = { ...data, ...JSON.parse(fs.readFileSync(paths.registry, "utf8")) };
      if (!data.scripts || typeof data.scripts !== "object") data.scripts = {};
      if (!data.market || typeof data.market !== "object") data.market = {};
    } catch {
      /* reset malformed */
    }
  }
  if (uninstall) {
    delete data.scripts[paths.scriptKey];
    delete data.market[paths.scriptKey];
  } else {
    data.enabled = true;
    data.scripts[paths.scriptKey] = true;
    data.market[paths.scriptKey] = {
      ...(data.market[paths.scriptKey] || {}),
      id: paths.marketId,
      name: "PromptSpark",
      version: "1.3.1",
      script_url: "",
      homepage: "",
      installed_at: String(Date.now()),
    };
  }
  fs.mkdirSync(paths.root, { recursive: true });
  fs.writeFileSync(paths.registry, JSON.stringify(data, null, 2) + "\n", "utf8");
}

function updateCodexPlusPlusScript(scriptBody, uninstall = false, codexExe = "") {
  const paths = codexPlusPlusPaths();
  const userPaths = codexPlusUserScriptPaths();
  fs.mkdirSync(paths.root, { recursive: true });
  let data = { enabled: true, name: "PromptSpark Codex", version: "1.3.1" };
  if (exists(paths.registry)) {
    try { data = { ...data, ...JSON.parse(fs.readFileSync(paths.registry, "utf8")) }; } catch { /* reset malformed registry */ }
  }

  if (uninstall) {
    fs.rmSync(paths.script, { force: true });
    fs.rmSync(paths.host, { force: true });
    fs.rmSync(paths.registry, { force: true });
    fs.rmSync(paths.runtime, { force: true });
    fs.rmSync(paths.ensureProxy, { force: true });
    fs.rmSync(paths.proxy, { force: true });
    fs.rmSync(userPaths.script, { force: true });
    updateCodexUserScriptsRegistry(true);
    try { fs.rmSync(path.join(desktopPath(), "PromptSpark Codex.lnk"), { force: true }); } catch { /* ignore */ }
    logStep("✓ 已移除 Codex++ 用户脚本与本地代理文件");
    return { changed: true, action: "removed", path: userPaths.script };
  }

  logStep("部署 Codex 本地代理运行时 …");
  deployRuntimeFiles(paths.root);
  if (exists(CODEX_RUNTIME_JS)) {
    fs.copyFileSync(CODEX_RUNTIME_JS, paths.runtime);
  }
  fs.writeFileSync(paths.script, scriptBody, "utf8");
  fs.writeFileSync(
    paths.registry,
    JSON.stringify({ ...data, exe: codexExe || "", script: paths.script, proxy: paths.proxy }, null, 2),
    "utf8",
  );

  // Primary: Codex++ user plugin loads with Codex, then wakes local proxy.
  logStep("写入 Codex++ 用户脚本（随插件加载启动代理）…");
  fs.mkdirSync(userPaths.scriptsDir, { recursive: true });
  fs.writeFileSync(userPaths.script, scriptBody, "utf8");
  updateCodexUserScriptsRegistry(false);
  registerSharedProtocolHandler();

  // Remove legacy shortcut launcher approach.
  try { fs.rmSync(path.join(desktopPath(), "PromptSpark Codex.lnk"), { force: true }); } catch { /* ignore */ }
  fs.rmSync(paths.host, { force: true });

  if (!exists(path.join(winEnvPaths().home, ".codex-session-delete")) &&
      !exists(path.join(process.env.LOCALAPPDATA || "", "com.bigpizzav3.codexplusplus.manager"))) {
    console.warn("⚠ 未检测到 Codex++；请安装 Codex++（launchMode=patch）后用户脚本才会随 Codex 自动加载");
  } else {
    logStep(`✓ Codex++ 用户脚本已启用 → ${userPaths.script}`);
  }
  return { changed: true, action: "installed", path: userPaths.script };
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

async function ensureProxyRunning() {
  if (!exists(PROXY_JS)) {
    console.warn("⚠ 未找到 proxy.mjs，Cursor/Devin 的 API 请求可能失败（CORS）");
    return false;
  }
  console.log(`检查本地 LLM 代理 (127.0.0.1:${PROXY_PORT}) …`);
  const ok = await ensureProxyRunningShared({
    proxyJs: PROXY_JS,
    log: (msg) => console.log(msg),
  });
  if (ok) console.log(`✓ 本地 LLM 代理就绪 (127.0.0.1:${PROXY_PORT})`);
  return ok;
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
  const { home } = winEnvPaths();
  const candidates = [];
  try {
    const value = readPowerShellText("[Environment]::GetFolderPath('Desktop')");
    if (value) candidates.push(value);
  } catch {
    /* fallback */
  }
  candidates.push(
    path.join(home, "Desktop"),
    path.join(home, "桌面"),
    path.join(process.env.USERPROFILE || home || "", "Desktop"),
  );
  for (const candidate of uniq(candidates)) {
    if (candidate && exists(candidate)) return candidate;
  }
  return candidates.find(Boolean) || path.join(home || "", "Desktop");
}

async function closeHosts(selected, targets) {
  const procNames = collectProcessNames(selected, targets);
  if (!procNames.length) return;
  if (!procNames.some((n) => isProcessRunning(n))) {
    logStep("目标进程未在运行，跳过关闭。");
    return;
  }
  logStep(`关闭进程：${procNames.join(", ")} …`);
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
        // Codex 已改由 Codex++ 内置 PromptSpark；本安装器不再写入 Codex++ user_scripts。
        if (uninstallMode) {
          logStep(`清理旧版 ${t.label} 安装残留 …`);
          const result = updateCodexPlusPlusScript(scriptBody, true, t.exe);
          results.push({ id, ...result });
          logStep(`✓ ${t.label}: ${result.action}`);
        } else {
          console.warn(
            "⚠ Codex 已改由 Codex++ 内置 PromptSpark 提供；请安装/更新 Codex++，本仓库仅支持 Cursor。",
          );
          results.push({ id, skipped: true, action: "skipped-codex-moved-to-codexplusplus" });
        }
        continue;
      }
      if (!t.workbench || !exists(t.workbench)) {
        throw new Error("未找到可注入的 workbench.html（请确认已安装原生应用）");
      }
      logStep(`${uninstallMode ? "卸载" : "注入"} ${t.label} workbench …`);
      const r = await withWriteRetry(() => patchWorkbench(t.workbench, scriptBody, uninstallMode));
      if (t.productJson && exists(t.productJson)) {
        await withWriteRetry(() => updateProductChecksum(t.productJson, t.checksumKey, t.workbench));
      }
      if (id === "cursor") {
        const launcher = updateCursorLauncher(uninstallMode, t.exe);
        logStep(`✓ ${t.label} 代理随启: ${launcher.action}`);
      }
      results.push({ id, ...r, path: t.workbench });
      logStep(`✓ ${t.label}: ${results.at(-1).action}`);
      if (results.at(-1).path) console.log(`  → ${results.at(-1).path}`);
    } catch (error) {
      console.error(`✗ ${t.label}: ${error.message}`);
      results.push({ id, error: error.message });
    }
  }
  if (uninstallMode) {
    refreshProtocolAfterHostChange();
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
  logStep(uninstallMode ? "准备卸载 …" : "准备注入脚本 …");
  const scriptBody = uninstallMode ? null : ensureBuilt();

  // 顺序：关进程 → 写补丁 → 再启动
  const results = await applyPatches(selected, targets, scriptBody);
  if (results.some((r) => r.changed)) {
    await relaunchHosts(selected, targets);
  }

  console.log("\n完成。交互：左键优化 / 再点还原 / 右键或 Alt+点击打开设置。");
  if (!uninstallMode) {
    console.log(`API 请求经本地代理 http://127.0.0.1:${PROXY_PORT}（Electron 宿主需此代理绕过 CORS）。`);
    console.log("Cursor：代理由扩展随进程启动；Codex：由 Codex++ 用户脚本加载时唤醒。");
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
