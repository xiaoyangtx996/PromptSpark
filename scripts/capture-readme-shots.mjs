#!/usr/bin/env node
/**
 * Render static UI mockups (real theme CSS + brand) and capture README screenshots.
 * Output: assets/readme/{toolbar,settings-styles,settings-commands,settings-model,settings-confirm}.png
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "assets", "readme");
const STAGE = path.join(ROOT, "dist", "readme-shots");

const ATTRS = {
  BUTTON_ATTR: "data-codex-prompt-optimize",
  CONTINUE_BUTTON_ATTR: "data-codex-prompt-continue",
  CONTINUE_MENU_ATTR: "data-codex-prompt-continue-menu",
  PANEL_ATTR: "data-codex-prompt-optimize-panel",
  TOAST_ATTR: "data-codex-prompt-optimize-toast",
  FLOAT_HOST_ATTR: "data-codex-prompt-optimize-float",
};

function themeCss() {
  let css = fs.readFileSync(path.join(ROOT, "src", "theme-css.css"), "utf8");
  for (const [k, v] of Object.entries(ATTRS)) {
    css = css.split(`[\$\{${k}\}]`).join(`[${v}]`).split(`\$\{${k}\}`).join(v);
  }
  // theme file uses [${PANEL_ATTR}] form already as literal template pieces
  css = css
    .replaceAll("${BUTTON_ATTR}", ATTRS.BUTTON_ATTR)
    .replaceAll("${CONTINUE_BUTTON_ATTR}", ATTRS.CONTINUE_BUTTON_ATTR)
    .replaceAll("${CONTINUE_MENU_ATTR}", ATTRS.CONTINUE_MENU_ATTR)
    .replaceAll("${PANEL_ATTR}", ATTRS.PANEL_ATTR)
    .replaceAll("${TOAST_ATTR}", ATTRS.TOAST_ATTR)
    .replaceAll("${FLOAT_HOST_ATTR}", ATTRS.FLOAT_HOST_ATTR);
  return css;
}

const brand = `data:image/png;base64,${fs
  .readFileSync(path.join(ROOT, "assets", "brand", "logo-promptspark.png"))
  .toString("base64")}`;

const helpSvg = `<svg class="cpo-help-glyph" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/></svg>`;
const closeSvg = `<svg class="cpo-close-glyph" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>`;
const caret = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 9 6 6 6-6"/></svg>`;
const spark = `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6L12 3z"/></svg>`;

function shell(extraCss, body) {
  return `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"/>
<style>
  html,body{margin:0;padding:0;background:#1e1e1e;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;}
  ${themeCss()}
  ${extraCss}
</style></head><body>${body}</body></html>`;
}

function sec(title) {
  return `<div class="cpo-sec-title"><span class="cpo-sec-bar"></span><span class="cpo-sec-text">${title}</span></div>`;
}

function tabs(active) {
  const items = [
    ["styles", "提示词优化"],
    ["commands", "快捷命令"],
    ["model", "模型配置"],
  ];
  return `<div class="cpo-nav-wrap"><div class="cpo-main-tabs" role="tablist">${items
    .map(
      ([id, label]) =>
        `<button type="button" class="cpo-main-tab" role="tab" aria-selected="${id === active}">${label}</button>`,
    )
    .join("")}</div></div>`;
}

function card(active, paneHtml, confirm = false) {
  return `
<div ${ATTRS.PANEL_ATTR}="true" class="cpo-apple" style="position:relative;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:28px;background:transparent !important;">
  <div class="cpo-card" style="position:relative;">
    <div class="cpo-sheet-head">
      <div class="cpo-brand">
        <img class="cpo-brand-icon" src="${brand}" alt="" width="28" height="28"/>
        <div class="cpo-brand-name">PromptSpark</div>
      </div>
      <button type="button" class="cpo-close-x" aria-label="关闭">${closeSvg}</button>
    </div>
    ${tabs(active)}
    <div class="cpo-pane-host"><div class="cpo-pane">${paneHtml}</div></div>
    <div class="cpo-sheet-foot">
      <button type="button" class="cpo-btn cpo-btn-ghost">取消</button>
      <button type="button" class="cpo-btn cpo-btn-primary">存储</button>
    </div>
    ${
      confirm
        ? `<div class="cpo-confirm is-open"><div class="cpo-confirm-dialog">
        <div class="cpo-confirm-title">放弃未保存的更改？</div>
        <div class="cpo-confirm-text">关闭后本次修改不会写入。</div>
        <div class="cpo-confirm-actions">
          <button type="button" class="cpo-confirm-btn">继续编辑</button>
          <button type="button" class="cpo-confirm-btn cpo-confirm-btn-danger">放弃并关闭</button>
        </div>
      </div></div>`
        : ""
    }
  </div>
</div>`;
}

const stylesPane = `
<div class="cpo-styles-compact">
  <div class="cpo-field">
    ${sec("默认风格")}
    <div class="cpo-segment cpo-segment-sm" role="tablist">
      <button type="button" class="cpo-seg-btn" aria-selected="false">简洁</button>
      <button type="button" class="cpo-seg-btn" aria-selected="true">结构化</button>
      <button type="button" class="cpo-seg-btn" aria-selected="false">编程</button>
    </div>
  </div>
  <div class="cpo-field cpo-custom-block">
    <div class="cpo-prompt-head-row">${sec("自定义风格")}<button type="button" class="cpo-prompt-help" title="说明">${helpSvg}</button></div>
    <div class="cpo-inline-row">
      <div class="cpo-dd cpo-style-dd" style="flex:1">
        <button type="button" class="cpo-dd-trigger"><span class="cpo-dd-value">暂无自定义 · 点击新增</span>${caret}</button>
      </div>
      <button type="button" class="cpo-btn-add">+ 新增</button>
    </div>
  </div>
  <div class="cpo-field cpo-field-grow">
    <div class="cpo-prompt-head-row">${sec("System prompt")}<button type="button" class="cpo-prompt-help">${helpSvg}</button></div>
    <div class="cpo-prompt-panel"><textarea class="cpo-textarea" rows="8" readonly>把用户草稿改写成结构清晰、可直接执行的提示词：先目标，再约束与上下文，最后验收标准。</textarea></div>
  </div>
</div>`;

const commandsPane = `
<div class="cpo-field">
  <div class="cpo-prompt-head-row">${sec("当前命令")}<button type="button" class="cpo-prompt-help" title="标题显示在 Composer 按钮上">${helpSvg}</button></div>
  <div class="cpo-dd"><button type="button" class="cpo-dd-trigger"><span class="cpo-dd-value">继续</span>${caret}</button></div>
</div>
<div class="cpo-field">${sec("标题")}<input class="cpo-input" value="继续" readonly/></div>
<div class="cpo-field cpo-field-grow">${sec("内容")}
  <textarea class="cpo-textarea" rows="7" readonly>请根据当前上下文继续推进，不要重复已经完成的部分。</textarea>
</div>`;

const modelPane = `
<div class="cpo-field">${sec("协议")}
  <div class="cpo-dd"><button type="button" class="cpo-dd-trigger"><span class="cpo-dd-value">OpenAI 兼容</span>${caret}</button></div>
</div>
<div class="cpo-field">${sec("Base URL")}<input class="cpo-input" value="https://api.openai.com/v1" readonly/></div>
<div class="cpo-field">${sec("API Key")}<input class="cpo-input" type="password" value="sk-········" readonly/></div>
<div class="cpo-field">${sec("Model")}
  <div class="cpo-model-row">
    <div class="cpo-dd cpo-model-combo" style="flex:1"><input class="cpo-input" value="gpt-4.1-mini" readonly/></div>
  </div>
</div>`;

const toolbar = `
<style>
  .fake-composer{
    width:720px;margin:48px auto;padding:14px 16px;border-radius:14px;
    background:#252526;border:1px solid #3c3c3c;box-shadow:0 18px 48px rgba(0,0,0,.45);
  }
  .fake-label{color:#9d9d9d;font-size:12px;margin-bottom:10px}
  .fake-input{
    min-height:72px;border-radius:10px;background:#1e1e1e;border:1px solid #3c3c3c;
    color:#cccccc;padding:12px;font-size:13px;line-height:1.45;margin-bottom:12px;
  }
  .fake-bar{display:flex;align-items:center;gap:8px;justify-content:flex-end}
  [${ATTRS.CONTINUE_BUTTON_ATTR}]{
    display:inline-flex;align-items:center;gap:4px;height:28px;padding:0 10px;border:0;border-radius:8px;
    background:transparent;color:#cccccc;cursor:default;font-size:12px;font-weight:600;
  }
  [${ATTRS.BUTTON_ATTR}]{
    display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border:0;border-radius:8px;
    background:transparent;color:#f47732;cursor:default;
  }
</style>
<div class="fake-composer">
  <div class="fake-label">Cursor Composer</div>
  <div class="fake-input">帮我把这段需求整理成可执行的开发任务……</div>
  <div class="fake-bar">
    <button type="button" ${ATTRS.CONTINUE_BUTTON_ATTR}="true"><span>继续</span>${caret}</button>
    <button type="button" ${ATTRS.BUTTON_ATTR}="true" title="优化提示词">${spark}</button>
  </div>
</div>`;

fs.rmSync(STAGE, { recursive: true, force: true });
fs.mkdirSync(STAGE, { recursive: true });
fs.mkdirSync(OUT, { recursive: true });

const pages = {
  toolbar: shell("", toolbar),
  "settings-styles": shell("body{background:#2a2a2c}", card("styles", stylesPane)),
  "settings-commands": shell("body{background:#2a2a2c}", card("commands", commandsPane)),
  "settings-model": shell("body{background:#2a2a2c}", card("model", modelPane)),
  "settings-confirm": shell("body{background:#2a2a2c}", card("styles", stylesPane, true)),
};

for (const [name, html] of Object.entries(pages)) {
  fs.writeFileSync(path.join(STAGE, `${name}.html`), html, "utf8");
}

const runner = `
import { chromium } from 'playwright';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const dir = path.dirname(fileURLToPath(import.meta.url));
const out = ${JSON.stringify(OUT)};
const names = ${JSON.stringify(Object.keys(pages))};
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 920, height: 780 }, deviceScaleFactor: 2 });
for (const name of names) {
  const file = path.join(dir, name + '.html');
  await page.goto('file:///' + file.replace(/\\\\/g, '/'));
  await page.waitForTimeout(200);
  const target = name === 'toolbar'
    ? page.locator('.fake-composer')
    : page.locator('.cpo-card');
  await target.screenshot({ path: path.join(out, name + '.png'), omitBackground: false });
  console.log('shot', name);
}
await browser.close();
`;

fs.writeFileSync(path.join(STAGE, "run.mjs"), runner, "utf8");

console.log("Installing playwright chromium (one-shot)…");
execSync("npm init -y", { cwd: STAGE, stdio: "ignore" });
execSync("npm install playwright@1.49.1 --no-fund --no-audit", { cwd: STAGE, stdio: "inherit" });
execSync("npx playwright install chromium", { cwd: STAGE, stdio: "inherit" });
execSync("node run.mjs", { cwd: STAGE, stdio: "inherit" });
console.log("✓ screenshots →", OUT);
