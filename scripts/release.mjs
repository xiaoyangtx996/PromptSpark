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
  console.error(`Missing ${vsix}. Run: npm run pack:vsix -- --no-bump`);
  process.exit(1);
}

const notes = `## PromptSpark ${tag}

### 安装
1. 下载 \`PromptSpark-${version}.vsix\`
2. 拖进 Cursor（或扩展 → 从 VSIX 安装）
3. 若提示已写入 Composer 控件，请**完全退出并重新打开** Cursor

### 更新说明
- 设置面板按像素规范重排：单层白卡片、分区橙竖条、透明遮罩
- 顶部 Tab / 风格分段恢复初始 iOS 分段质感；焦点输入恢复偏橙描边
- 「+ 新增」单行显示；确认弹窗按钮不再挤换行；未改动关闭不再误报
- 模型配置去掉多余「接口」标题与底部代理说明长文案
- 默认风格说明收入 System prompt 旁「？」悬停提示
- 品牌 Logo 透明底；UI 统一系统字体
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
