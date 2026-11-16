#!/usr/bin/env node
/**
 * Build PromptSpark and pack a drag-install .vsix for Cursor.
 * Output: dist/PromptSpark-<version>.vsix
 */
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const EXT_SRC = path.join(ROOT, "cursor-extension");
const DIST = path.join(ROOT, "dist");
const STAGE = path.join(DIST, "vsix-extension");

function rimraf(p) {
  fs.rmSync(p, { recursive: true, force: true });
}

function copyFile(src, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

function readVersion() {
  const pkg = JSON.parse(fs.readFileSync(path.join(EXT_SRC, "package.json"), "utf8"));
  return pkg.version || "0.0.0";
}

execSync("node scripts/render-icon.mjs", { cwd: ROOT, stdio: "inherit" });
execSync("node build.mjs", { cwd: ROOT, stdio: "inherit" });
const script = path.join(DIST, "prompt-optimize.js");
if (!fs.existsSync(script)) throw new Error("dist/prompt-optimize.js missing");
const iconPng = path.join(EXT_SRC, "media", "icon.png");
if (!fs.existsSync(iconPng)) throw new Error("cursor-extension/media/icon.png missing");

rimraf(STAGE);
fs.mkdirSync(STAGE, { recursive: true });

const files = ["package.json", "extension.js", "proxy-server.cjs", ".vscodeignore"];
for (const name of files) {
  const srcPath = path.join(EXT_SRC, name);
  if (!fs.existsSync(srcPath)) continue;
  copyFile(srcPath, path.join(STAGE, name));
}
copyFile(script, path.join(STAGE, "promptspark.js"));
const licenseSrc = path.join(ROOT, "LICENSE");
if (fs.existsSync(licenseSrc)) {
  copyFile(licenseSrc, path.join(STAGE, "LICENSE"));
}
// Brand icon for Extensions view
const mediaSrc = path.join(EXT_SRC, "media");
if (fs.existsSync(mediaSrc)) {
  for (const name of fs.readdirSync(mediaSrc)) {
    copyFile(path.join(mediaSrc, name), path.join(STAGE, "media", name));
  }
}

const version = readVersion();
const outName = `PromptSpark-${version}.vsix`;
const outPath = path.join(DIST, outName);

// Prefer @vscode/vsce if available; else hand-roll zip via PowerShell Compress-Archive + rename
let packed = false;
try {
  execSync(
    "npx --yes @vscode/vsce package --no-dependencies --out " + JSON.stringify(outPath),
    {
      cwd: STAGE,
      stdio: "inherit",
    },
  );
  packed = fs.existsSync(outPath);
} catch (error) {
  console.warn("[pack-vsix] vsce failed, falling back to zip:", error?.message || error);
}

if (!packed) {
  const zipPath = path.join(DIST, `PromptSpark-${version}.zip`);
  rimraf(zipPath);
  rimraf(outPath);
  // VSIX = zip with extension/ prefix + [Content_Types].xml
  const packRoot = path.join(DIST, "vsix-pack");
  rimraf(packRoot);
  const extDir = path.join(packRoot, "extension");
  fs.mkdirSync(extDir, { recursive: true });
  for (const name of fs.readdirSync(STAGE)) {
    copyFile(path.join(STAGE, name), path.join(extDir, name));
  }
  fs.writeFileSync(
    path.join(packRoot, "[Content_Types].xml"),
    `<?xml version="1.0" encoding="utf-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="json" ContentType="application/json"/>
  <Default Extension="js" ContentType="application/javascript"/>
  <Default Extension="cjs" ContentType="application/javascript"/>
  <Default Extension="vsixmanifest" ContentType="text/xml"/>
</Types>
`,
    "utf8",
  );
  fs.writeFileSync(
    path.join(packRoot, "extension.vsixmanifest"),
    `<?xml version="1.0" encoding="utf-8"?>
<PackageManifest Version="2.0.0" xmlns="http://schemas.microsoft.com/developer/vsx-schema/2011" xmlns:d="http://schemas.microsoft.com/developer/vsx-schema-design/2011">
  <Metadata>
    <Identity Language="en-US" Id="promptspark" Version="${version}" Publisher="promptspark" />
    <DisplayName>PromptSpark</DisplayName>
    <Description xml:space="preserve">Cursor Composer 提示词优化与快捷命令</Description>
  </Metadata>
  <Installation>
    <InstallationTarget Id="Microsoft.VisualStudio.Code"/>
  </Installation>
  <Dependencies/>
  <Assets>
    <Asset Type="Microsoft.VisualStudio.Code.Manifest" Path="extension/package.json" Addressable="true" />
  </Assets>
</PackageManifest>
`,
    "utf8",
  );
  const ps = `
$ErrorActionPreference = 'Stop'
$pack = ${JSON.stringify(packRoot)}
$zip = ${JSON.stringify(zipPath)}
if (Test-Path $zip) { Remove-Item $zip -Force }
Compress-Archive -Path (Join-Path $pack '*') -DestinationPath $zip -Force
Move-Item -Force $zip ${JSON.stringify(outPath)}
`;
  execSync(`powershell.exe -NoProfile -NonInteractive -Command ${JSON.stringify(ps)}`, {
    cwd: ROOT,
    stdio: "inherit",
    windowsHide: true,
  });
}

if (!fs.existsSync(outPath)) throw new Error("VSIX not created: " + outPath);
console.log(`\n✓ VSIX ready: ${outPath}`);
console.log("拖到 Cursor 窗口，或: Cursor → Extensions → … → Install from VSIX");
