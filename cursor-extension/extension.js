/**
 * PromptSpark — Cursor extension
 * - Starts local LLM proxy in-process
 * - Injects Composer UI script into workbench.html (first run / upgrade)
 */
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const vscode = require("vscode");
const { startProxy, stopProxy } = require("./proxy-server.cjs");

const PATCH_BEGIN = "<!-- PROMPTSPARK-PATCH -->";
const PATCH_END = "<!-- /PROMPTSPARK-PATCH -->";
const LEGACY_PATCH_BEGIN = "<!-- PROMPT-OPTIMIZE-PATCH -->";
const LEGACY_PATCH_END = "<!-- /PROMPT-OPTIMIZE-PATCH -->";
const PATCH_ASSET = "promptspark.js";

function vscodeChecksum(content) {
  return crypto.createHash("sha256").update(content, "utf8").digest("base64").replace(/=+$/, "");
}

function resolveWorkbench(appRoot) {
  if (!appRoot) return { workbench: null, productJson: null, checksumKey: null };
  const candidates = [
    path.join(appRoot, "resources", "app", "out", "vs", "code", "electron-sandbox", "workbench", "workbench.html"),
    path.join(appRoot, "resources", "app", "out", "vs", "code", "electron-browser", "workbench", "workbench.html"),
  ];
  const workbench = candidates.find((p) => fs.existsSync(p)) || null;
  const productJson = [
    path.join(appRoot, "resources", "app", "product.json"),
  ].find((p) => fs.existsSync(p)) || null;
  let checksumKey = null;
  if (workbench?.includes("electron-sandbox")) {
    checksumKey = "vs/code/electron-sandbox/workbench/workbench.html";
  } else if (workbench?.includes("electron-browser")) {
    checksumKey = "vs/code/electron-browser/workbench/workbench.html";
  }
  return { workbench, productJson, checksumKey };
}

function findCursorAppRoot() {
  // Extension Host runs under Cursor.exe
  const exeDir = path.dirname(process.execPath);
  if (fs.existsSync(path.join(exeDir, "resources", "app"))) return exeDir;
  // Fallback: common install dirs
  const home = process.env.LOCALAPPDATA || "";
  const extras = [
    path.join(home, "Programs", "cursor"),
    path.join(home, "cursor"),
    "C:\\Program Files\\Cursor",
  ];
  for (const root of extras) {
    if (fs.existsSync(path.join(root, "resources", "app"))) return root;
  }
  return null;
}

function stripPatches(html) {
  let out = html;
  for (const [begin, end] of [
    [PATCH_BEGIN, PATCH_END],
    [LEGACY_PATCH_BEGIN, LEGACY_PATCH_END],
  ]) {
    const re = new RegExp(
      `${begin.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[\\s\\S]*?${end.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\n?`,
      "g",
    );
    out = out.replace(re, "");
  }
  return out;
}

function updateProductChecksum(productJsonPath, checksumKey, workbenchPath) {
  if (!productJsonPath || !checksumKey || !fs.existsSync(productJsonPath)) return false;
  const json = JSON.parse(fs.readFileSync(productJsonPath, "utf8"));
  if (!json.checksums || typeof json.checksums !== "object") return false;
  const sum = vscodeChecksum(fs.readFileSync(workbenchPath, "utf8"));
  const keys = [
    checksumKey,
    "vs/code/electron-sandbox/workbench/workbench.html",
    "vs/code/electron-browser/workbench/workbench.html",
  ];
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

/**
 * @returns {"injected"|"updated"|"unchanged"|"missing-script"|"missing-workbench"|"write-failed"}
 */
function ensureWorkbenchInject(extensionPath, { force = false } = {}) {
  const scriptSrc = path.join(extensionPath, PATCH_ASSET);
  if (!fs.existsSync(scriptSrc)) return "missing-script";

  const appRoot = findCursorAppRoot();
  const { workbench, productJson, checksumKey } = resolveWorkbench(appRoot);
  if (!workbench) return "missing-workbench";

  const assetPath = path.join(path.dirname(workbench), PATCH_ASSET);
  const scriptBody = fs.readFileSync(scriptSrc, "utf8");
  let html = fs.readFileSync(workbench, "utf8");
  const already = html.includes(PATCH_BEGIN) && fs.existsSync(assetPath);
  const sameScript = already && fs.readFileSync(assetPath, "utf8") === scriptBody;

  if (already && sameScript && !force) return "unchanged";

  try {
    html = stripPatches(html);
    fs.writeFileSync(assetPath, scriptBody, "utf8");
    const patch = `\n${PATCH_BEGIN}\n<script src="./${PATCH_ASSET}"></script>\n${PATCH_END}\n`;
    if (/<\/html>\s*$/i.test(html)) {
      html = html.replace(/<\/html>\s*$/i, `${patch}</html>\n`);
    } else {
      html += patch;
    }
    fs.writeFileSync(workbench, html, "utf8");
    updateProductChecksum(productJson, checksumKey, workbench);
    return already ? "updated" : "injected";
  } catch (error) {
    console.warn("[PromptSpark] workbench inject failed", error?.message || error);
    return "write-failed";
  }
}

function removeWorkbenchInject() {
  const appRoot = findCursorAppRoot();
  const { workbench, productJson, checksumKey } = resolveWorkbench(appRoot);
  if (!workbench) return false;
  try {
    let html = stripPatches(fs.readFileSync(workbench, "utf8"));
    fs.writeFileSync(workbench, html, "utf8");
    fs.rmSync(path.join(path.dirname(workbench), PATCH_ASSET), { force: true });
    updateProductChecksum(productJson, checksumKey, workbench);
    return true;
  } catch (error) {
    console.warn("[PromptSpark] workbench remove failed", error?.message || error);
    return false;
  }
}

async function activate(context) {
  const storageDir = context.globalStorageUri?.fsPath || path.join(process.env.APPDATA || "", "PromptSpark");
  try {
    fs.mkdirSync(storageDir, { recursive: true });
  } catch (error) {
    console.warn("[PromptSpark] storage mkdir failed", error?.message || error);
  }
  const settingsPath = path.join(storageDir, "settings.json");
  process.env.CPO_SETTINGS_PATH = settingsPath;

  const status = await startProxy({ settingsPath });
  if (status === "failed") {
    console.warn("[PromptSpark] proxy failed to start");
  } else {
    console.info("[PromptSpark] settings file:", settingsPath);
  }

  const inject = ensureWorkbenchInject(context.extensionPath);
  if (inject === "injected" || inject === "updated") {
    const pick = await vscode.window.showInformationMessage(
      "PromptSpark 已写入 Composer 控件，请完全退出并重新打开 Cursor 后生效。",
      "我知道了",
    );
    void pick;
  } else if (inject === "write-failed") {
    vscode.window.showWarningMessage(
      "PromptSpark 无法写入 workbench（可能需要管理员权限）。可尝试以管理员运行 Cursor，或执行命令「PromptSpark: 注入 Composer 控件」。",
    );
  } else if (inject === "missing-script") {
    console.warn("[PromptSpark] bundled promptspark.js missing");
  } else if (inject === "missing-workbench") {
    console.warn("[PromptSpark] Cursor workbench.html not found");
  }

  context.subscriptions.push(
    vscode.commands.registerCommand("promptspark.reinject", async () => {
      const r = ensureWorkbenchInject(context.extensionPath, { force: true });
      if (r === "injected" || r === "updated" || r === "unchanged") {
        vscode.window.showInformationMessage("已注入。请完全退出并重新打开 Cursor。");
      } else if (r === "write-failed") {
        vscode.window.showErrorMessage("写入失败：请以管理员身份运行 Cursor 后再试。");
      } else {
        vscode.window.showErrorMessage(`注入失败：${r}`);
      }
    }),
    vscode.commands.registerCommand("promptspark.removeUi", async () => {
      if (removeWorkbenchInject()) {
        vscode.window.showInformationMessage("已移除 Composer 控件。请完全退出并重新打开 Cursor。");
      } else {
        vscode.window.showErrorMessage("移除失败。");
      }
    }),
  );
}

function deactivate() {
  stopProxy();
}

module.exports = { activate, deactivate };
