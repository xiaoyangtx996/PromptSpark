import fs from "node:fs";

const s = fs.readFileSync("dist/prompt-optimize.js", "utf8");
const ok = {
  v: /SCRIPT_VERSION = "1\.3\.6"/.test(s),
  continueBtn: /CONTINUE_BUTTON_ATTR/.test(s) && /runContinueAndSend/.test(s),
  sendFix: /findCursorComposerSendButton/.test(s) && /isNotificationControl/.test(s),
  tabs: /cpo-main-tabs/.test(s) && /activeCommandId/.test(s),
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
  noDeadFinders: !s.includes("findStructuralContextGroup") && !s.includes("findBestModelControl"),
  noOrphanCss: !s.includes(".cpo-grid") && !s.includes("cpo-channel-hint") && !s.includes("cpo-linkish"),
  commandDd: s.includes("cpo-command-dd") && s.includes("＋ 新增命令") && !s.includes("cpo-cmd-list"),
  continueMenu:
    s.includes("CONTINUE_MENU_ATTR") &&
    s.includes("openContinueCommandMenu") &&
    s.includes("onContinueButtonContextMenu") &&
    s.includes("左键发送"),
  continueWrite:
    s.includes("writeComposerTextForCommand") &&
    s.includes("writeViaPasteEvent") &&
    s.includes("isComposerGenerating") &&
    !s.includes("未能写入") &&
    s.includes("Single path only"),
  githubLink: s.includes("cpo-github") && s.includes("https://github.com/xiaoyangtx996/PromptSpark"),
  shortEnsure: /function ensureSparkleButton\(\) \{\s*if \(typeof refreshHost === "function"\) refreshHost\(\);\s*ensureWorkbenchSparkleButton\(\);\s*\}/.test(
    s,
  ),
  noEarlyReturnDead: !/ensureWorkbenchSparkleButton\(\);\s*return;\s*if \(runtime\.disposed\)/.test(s),
  workbench: s.includes("ensureWorkbenchSparkleButton"),
  settingsDom: s.includes("openSettingsPanelDomSafe"),
};
console.log(ok);
if (Object.values(ok).some((x) => !x)) process.exit(1);
console.log(`verify ok, bytes=${s.length}`);
