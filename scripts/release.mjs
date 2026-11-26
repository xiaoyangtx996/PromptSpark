#!/usr/bin/env node
/**
 * Official release flow:
 *   1) Read latest GitHub release tag (online)
 *   2) Set repo version = online patch +1
 *   3) pack:vsix --no-bump
 *   4) Create/update GitHub Release and upload VSIX
 *
 * Auth: GH_TOKEN / GITHUB_TOKEN, or `gh`, or git credential helper token.
 *
 *   npm run release
 *   node scripts/release.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { execSync, execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const REPO = "xiaoyangtx996/PromptSpark";
const API = `https://api.github.com/repos/${REPO}`;

function sh(cmd, opts = {}) {
  console.log(`$ ${cmd}`);
  return execSync(cmd, { cwd: ROOT, stdio: opts.stdio ?? "inherit", shell: true, encoding: "utf8" });
}

function shCapture(cmd) {
  return execSync(cmd, { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"], shell: true, encoding: "utf8" }).trim();
}

function bumpPatch(v) {
  const parts = String(v).replace(/^v/, "").split(".").map(Number);
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) {
    throw new Error(`bad version: ${v}`);
  }
  parts[2] += 1;
  return parts.join(".");
}

function readGitHubToken() {
  if (process.env.GH_TOKEN) return process.env.GH_TOKEN;
  if (process.env.GITHUB_TOKEN) return process.env.GITHUB_TOKEN;
  try {
    const filled = execFileSync("git", ["credential", "fill"], {
      cwd: ROOT,
      input: "url=https://github.com\n\n",
      encoding: "utf8",
      stdio: ["pipe", "pipe", "ignore"],
    });
    const m = filled.match(/^password=(.+)$/m);
    if (m) return m[1].trim();
  } catch (_) {
    /* ignore */
  }
  return null;
}

async function api(method, urlPath, { token, body, raw } = {}) {
  const headers = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "PromptSpark-Release",
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API}${urlPath}`, {
    method,
    headers: body && !raw ? { ...headers, "Content-Type": "application/json" } : headers,
    body: body == null ? undefined : raw ? body : JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch (_) {
    json = { raw: text };
  }
  if (!res.ok) {
    const msg = json?.message || text || res.statusText;
    const err = new Error(`GitHub API ${method} ${urlPath} → ${res.status}: ${msg}`);
    err.status = res.status;
    err.json = json;
    throw err;
  }
  return json;
}

async function latestOnlineVersion(token) {
  try {
    const rel = await api("GET", "/releases/latest", { token });
    if (rel?.tag_name) return String(rel.tag_name).replace(/^v/, "");
  } catch (e) {
    if (e.status !== 404) throw e;
  }
  try {
    const tags = await api("GET", "/tags?per_page=1", { token });
    if (Array.isArray(tags) && tags[0]?.name) return String(tags[0].name).replace(/^v/, "");
  } catch (_) {
    /* ignore */
  }
  try {
    const out = shCapture(`gh release view --repo ${REPO} --json tagName -q .tagName`);
    if (out) return out.replace(/^v/, "");
  } catch (_) {
    /* ignore */
  }
  return "0.0.0";
}

function buildNotes(version) {
  const tag = `v${version}`;
  return `## PromptSpark ${tag}

### 安装
1. 下载 \`PromptSpark-${version}.vsix\`
2. 拖进 Cursor（或扩展 → 从 VSIX 安装）
3. 若提示已写入 Composer 控件，请**完全退出并重新打开** Cursor（托盘进程也要退）

### 更新说明
- 设置面板字号整体加大，阅读更轻松
- 本机代理上游请求失败自动重试；网络抖动提示改为中文（不再直接显示 fetch failed）
- 设置面板按像素规范：单层白卡片、分区橙竖条、透明遮罩
- 快捷命令 / 风格说明收入「？」悬停；未改动关闭不再误报
`;
}

async function createOrUploadRelease({ token, version, vsix, notes }) {
  const tag = `v${version}`;
  const notesFile = path.join(ROOT, "dist", `release-notes-${version}.md`);
  fs.mkdirSync(path.dirname(notesFile), { recursive: true });
  fs.writeFileSync(notesFile, notes, "utf8");

  if (token) {
    let release;
    try {
      release = await api("GET", `/releases/tags/${tag}`, { token });
      console.log(`Release ${tag} exists → uploading asset`);
    } catch (e) {
      if (e.status !== 404) throw e;
      release = await api("POST", "/releases", {
        token,
        body: {
          tag_name: tag,
          target_commitish: "main",
          name: `PromptSpark ${tag}`,
          body: notes,
          draft: false,
          prerelease: false,
        },
      });
      console.log(`Created release ${tag}`);
    }
    const uploadBase = String(release.upload_url || "").replace(/\{[^}]+\}$/, "");
    const uploadUrl = `${uploadBase}?name=${encodeURIComponent(`PromptSpark-${version}.vsix`)}`;
    const bytes = fs.readFileSync(vsix);
    const res = await fetch(uploadUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "PromptSpark-Release",
        "Content-Type": "application/octet-stream",
      },
      body: bytes,
    });
    if (!res.ok && res.status !== 422) {
      // 422 often means asset name exists — delete then retry once
      const existing = (release.assets || []).find((a) => a.name === `PromptSpark-${version}.vsix`);
      if (existing?.id) {
        await api("DELETE", `/releases/assets/${existing.id}`, { token });
        const retry = await fetch(uploadUrl, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
            "User-Agent": "PromptSpark-Release",
            "Content-Type": "application/octet-stream",
          },
          body: bytes,
        });
        if (!retry.ok) throw new Error(`upload failed: ${retry.status} ${await retry.text()}`);
      } else {
        throw new Error(`upload failed: ${res.status} ${await res.text()}`);
      }
    }
    return;
  }

  // Fallback: gh CLI
  try {
    sh(`gh release view ${tag} --repo ${REPO}`);
    console.log(`Release ${tag} exists → uploading asset (clobber)`);
    sh(`gh release upload ${tag} "${vsix}" --repo ${REPO} --clobber`);
  } catch (_) {
    sh(
      `gh release create ${tag} "${vsix}" --repo ${REPO} --title "PromptSpark ${tag}" --notes-file "${notesFile}"`,
    );
  }
}

async function main() {
  const token = readGitHubToken();
  const online = await latestOnlineVersion(token);
  const next = bumpPatch(online);
  console.log(`online ${online} → release ${next}`);

  sh(`node scripts/bump-version.mjs ${next}`);
  sh("node scripts/pack-vsix.mjs --no-bump");

  // prune old local vsix keep latest + previous
  const dist = path.join(ROOT, "dist");
  const vsixs = fs
    .readdirSync(dist)
    .filter((n) => /^PromptSpark-\d+\.\d+\.\d+\.vsix$/.test(n))
    .map((n) => ({ n, t: fs.statSync(path.join(dist, n)).mtimeMs }))
    .sort((a, b) => b.t - a.t);
  for (const row of vsixs.slice(3)) {
    fs.rmSync(path.join(dist, row.n), { force: true });
    console.log("pruned", row.n);
  }

  const version = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8")).version;
  const vsix = path.join(ROOT, "dist", `PromptSpark-${version}.vsix`);
  if (!fs.existsSync(vsix)) throw new Error(`missing ${vsix}`);

  const notes = buildNotes(version);
  await createOrUploadRelease({ token, version, vsix, notes });
  console.log(`✓ Release v${version}: https://github.com/${REPO}/releases/tag/v${version}`);
}

main().catch((err) => {
  console.error(err?.message || err);
  process.exit(1);
});
