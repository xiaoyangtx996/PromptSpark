#!/usr/bin/env node
/**
 * Publish current VSIX to Open VSX and/or VS Marketplace.
 *
 * Env:
 *   OVSX_PAT          Open VSX access token (https://open-vsx.org/user-settings/tokens)
 *   VSCE_PAT          Azure DevOps PAT with Marketplace (Acquire + Publish)
 *   PUBLISH_TARGET    openvsx | vscode | both  (default: both)
 *
 *   npm run publish:marketplace
 *   node scripts/publish-marketplace.mjs --skip-pack
 */
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const skipPack = process.argv.includes("--skip-pack");
const target = (process.env.PUBLISH_TARGET || "both").toLowerCase();

function sh(cmd, opts = {}) {
  console.log(`$ ${cmd}`);
  return execSync(cmd, {
    cwd: ROOT,
    stdio: opts.stdio ?? "inherit",
    shell: true,
    env: { ...process.env, ...(opts.env || {}) },
  });
}

function readVersion() {
  return JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8")).version;
}

if (!skipPack) {
  sh("node scripts/pack-vsix.mjs --no-bump");
}

const version = readVersion();
const vsix = path.join(ROOT, "dist", `PromptSpark-${version}.vsix`);
if (!fs.existsSync(vsix)) throw new Error(`missing ${vsix}`);

const results = [];

if (target === "openvsx" || target === "both") {
  const pat = process.env.OVSX_PAT || process.env.OPENVSX_TOKEN;
  if (!pat) {
    console.warn(
      "[skip Open VSX] 设置环境变量 OVSX_PAT 后重试。\n" +
        "  1) https://open-vsx.org 登录（可用 GitHub）\n" +
        "  2) User Settings → Access Tokens → 创建 token\n" +
        "  3) 若尚未 Claim publisher `xiaoyangtx996`，按站点提示创建/认领\n" +
        "  4) $env:OVSX_PAT='...' ; npm run publish:marketplace -- --skip-pack",
    );
    results.push({ target: "openvsx", ok: false, reason: "missing OVSX_PAT" });
  } else {
    try {
      sh(`npx --yes ovsx publish "${vsix}"`, { env: { OVSX_PAT: pat } });
      results.push({
        target: "openvsx",
        ok: true,
        url: `https://open-vsx.org/extension/xiaoyangtx996/promptspark`,
      });
    } catch (e) {
      results.push({ target: "openvsx", ok: false, reason: e?.message || String(e) });
    }
  }
}

if (target === "vscode" || target === "both") {
  const pat = process.env.VSCE_PAT || process.env.VS_MARKETPLACE_PAT;
  if (!pat) {
    console.warn(
      "[skip VS Marketplace] 设置环境变量 VSCE_PAT 后重试。\n" +
        "  1) https://marketplace.visualstudio.com/manage 创建/登录 Publisher `xiaoyangtx996`\n" +
        "  2) Azure DevOps → User settings → Personal access tokens\n" +
        "     Scope: Marketplace → Acquire + Publish\n" +
        "  3) $env:VSCE_PAT='...' ; npm run publish:marketplace -- --skip-pack",
    );
    results.push({ target: "vscode", ok: false, reason: "missing VSCE_PAT" });
  } else {
    try {
      sh(`npx --yes @vscode/vsce publish --packagePath "${vsix}" --pat ${JSON.stringify(pat)}`);
      results.push({
        target: "vscode",
        ok: true,
        url: `https://marketplace.visualstudio.com/items?itemName=xiaoyangtx996.promptspark`,
      });
    } catch (e) {
      results.push({ target: "vscode", ok: false, reason: e?.message || String(e) });
    }
  }
}

console.log("\n=== publish summary ===");
for (const row of results) {
  console.log(row.ok ? `✓ ${row.target}: ${row.url}` : `✗ ${row.target}: ${row.reason}`);
}

if (!results.some((r) => r.ok)) {
  process.exitCode = 2;
  console.log(
    "\n材料已就绪，但两侧都未发布成功。请按上方提示配置 Token 后执行：\n" +
      "  npm run publish:marketplace -- --skip-pack",
  );
} else if (results.some((r) => !r.ok)) {
  process.exitCode = 0;
  console.log("\n部分渠道已发布；失败项补 Token 后用 --skip-pack 重试即可。");
}
