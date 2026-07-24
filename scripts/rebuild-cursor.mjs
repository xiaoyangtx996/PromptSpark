import { execSync } from "node:child_process";
import fs from "node:fs";
execSync("node build.mjs", { stdio: "inherit" });
execSync("node --check dist/prompt-optimize.js", { stdio: "inherit" });
const s = fs.readFileSync("dist/prompt-optimize.js", "utf8");
const ok = {
  v: /SCRIPT_VERSION = "1\.3\.0"/.test(s),
  brand: s.includes("PromptSpark") && s.includes("[PromptSpark]") && !s.includes("Codex++"),
  noCodexPlus: !/Codex\+\+/.test(s),
  addTab: s.includes("cpo-dd-add") && s.includes("cpo-spinner"),
  customDd: s.includes("cpo-style-dd") && s.includes("cpo-dd-caret"),
  spinArrow: s.includes("cpo-spin-arrow") && s.includes("cpo-spinner"),
  loadStyles: /function loadSettings\(\) \{[\s\S]*?parsed\.styles[\s\S]*?styles,/.test(s),
  locked: s.includes("LOCKED_STYLE_IDS") && s.includes("默认三种风格不能删除"),
  ensurePrompt: s.includes("ensureStylePrompt"),
  paste: s.includes("writeViaPasteEvent") && s.includes("copyTextFallback"),
  noScroll: s.includes("scrollbar-width: none"),
  autoProto: s.includes("已自动改为 OpenAI 兼容协议"),
  noWhiteOverlay: s.includes("prefers-reduced-transparency") && s.includes("rgba(0, 0, 0, 0.5)"),
};
console.log(ok);
if (Object.values(ok).some((x) => !x)) process.exit(1);
execSync("node install.mjs --hosts=cursor --no-restart", { stdio: "inherit" });
