#!/usr/bin/env node
/**
 * Create/update GitHub Release for the current package version and upload VSIX.
 * Requires: gh auth login (or GH_TOKEN), and dist/PromptSpark-<ver>.vsix
 *
 *   node scripts/release.mjs
 *   npm run release
 */
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
const version = pkg.version;
const tag = `v${version}`;
const vsix = path.join(ROOT, "dist", `PromptSpark-${version}.vsix`);

if (!fs.existsSync(vsix)) {
  console.error(`Missing ${vsix}. Run: npm run pack:vsix`);
  process.exit(1);
}

const notes = `## PromptSpark ${tag}

### 安装
1. 下载 \`PromptSpark-${version}.vsix\`
2. 拖进 Cursor（或扩展 → 从 VSIX 安装）
3. 若提示已写入 Composer 控件，请完全退出并重新打开 Cursor

### 更新说明
- VSIX 拖装，扩展内嵌本机代理（\`127.0.0.1:37841\`）
- Composer 闪光优化/还原 +「继续」快捷命令
- 支持从 Base URL + API Key 拉取模型列表
- 单次 paste 写入（保留换行）
- 默认「简洁 / 结构化 / 编程」system prompt 与上游一致
`;

const notesFile = path.join(ROOT, "dist", `release-notes-${version}.md`);
fs.mkdirSync(path.dirname(notesFile), { recursive: true });
fs.writeFileSync(notesFile, notes, "utf8");

function sh(cmd) {
  console.log(`$ ${cmd}`);
  execSync(cmd, { cwd: ROOT, stdio: "inherit", shell: true });
}

try {
  sh(`gh release view ${tag} --repo xiaoyangtx996/PromptSpark`);
  console.log(`Release ${tag} exists → uploading asset (clobber)`);
  sh(
    `gh release upload ${tag} "${vsix}" --repo xiaoyangtx996/PromptSpark --clobber`,
  );
} catch (_) {
  sh(
    `gh release create ${tag} "${vsix}" --repo xiaoyangtx996/PromptSpark --title "PromptSpark ${tag}" --notes-file "${notesFile}"`,
  );
}

console.log(`✓ Release ${tag}: https://github.com/xiaoyangtx996/PromptSpark/releases/tag/${tag}`);
