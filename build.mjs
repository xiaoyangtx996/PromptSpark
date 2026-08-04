/**
 * Build multi-host PromptSpark bundle.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = __dirname;
const sourcePath = path.join(root, "src", "prompt-optimize.codex-source.js");
const adaptersPath = path.join(root, "src", "host-adapters.js");
const settingsDomPath = path.join(root, "src", "settings-dom.js");
const outPath = path.join(root, "dist", "prompt-optimize.js");
const VERSION = "1.3.0";

let src = fs.readFileSync(sourcePath, "utf8");
let adapters = fs.readFileSync(adaptersPath, "utf8");
const settingsDom = fs.readFileSync(settingsDomPath, "utf8");

adapters = adapters
  .replace(/^\s*const\s+HOST\s*=\s*detectHost\(\);/m, "  HOST = detectHost();")
  .replace(/^\s*let\s+HOST\s*=\s*detectHost\(\);/m, "  HOST = detectHost();");

src = src.replace(
  /\/\*[\s\S]*?\*\/\s*\(\(\) => \{/,
  `/*
@prompt-spark-script
name: PromptSpark
description: Optimize the composer prompt with an external LLM; click to optimize, click again to restore. Multi-host: Codex / Cursor / Devin / Antigravity.
version: ${VERSION}
author: PromptSpark
*/

(() => {`,
);
src = src.replace(/const DEBUG_PREFIX = "[^"]+";/, `const DEBUG_PREFIX = "[PromptSpark]";`);
src = src.replace(/const SCRIPT_VERSION = "[^"]+";/, `const SCRIPT_VERSION = "${VERSION}";`);

// Brand + host-facing copy (no Codex++ in user messages)
src = src.replaceAll("当前 Codex++ 的 LLM Bridge 路由不可用", "当前 Codex 的请求通道不可用");
src = src.replaceAll("当前 Codex++ 不提供可用的 LLM 请求通道", "当前应用不提供可用的 LLM 请求通道");
src = src.replaceAll("Codex++ LLM Bridge", "Codex 请求通道");
src = src.replaceAll("Codex++ 请求通道", "请求通道");
src = src.replaceAll("兼容当前 Codex++ 发行版", "兼容当前 Codex 发行版");
src = src.replaceAll("已检测到 Codex++ LLM Bridge。", "已检测到 Codex 请求桥接。");
src = src.replaceAll("Prompt Optimize 设置", "PromptSpark 设置");
src = src.replaceAll("Prompt Optimize", "PromptSpark");

src = src.replace(
  `const SETTINGS_KEY = "codexPlusPromptOptimize.settings.v1";`,
  `const SETTINGS_KEY = "promptOptimize.settings.v1";
  const LEGACY_SETTINGS_KEY = "codexPlusPromptOptimize.settings.v1";
  let HOST = "codex";`,
);

src = src.replace(
  `function defaultSettings() {
    return {
      protocol: "openai",
      baseUrl: DEFAULT_BASE_URLS.openai,
      apiKey: "",
      model: DEFAULT_MODELS.openai,
      style: "structured",
      systemPrompts: { ...DEFAULT_SYSTEM_PROMPTS },
    };
  }`,
  `function defaultStyleList() {
    return [
      { id: "concise", name: "简洁", systemPrompt: DEFAULT_SYSTEM_PROMPTS.concise },
      { id: "structured", name: "结构化", systemPrompt: DEFAULT_SYSTEM_PROMPTS.structured },
      { id: "coding", name: "编程", systemPrompt: DEFAULT_SYSTEM_PROMPTS.coding },
    ];
  }

  function defaultSettings() {
    return {
      protocol: "openai",
      baseUrl: DEFAULT_BASE_URLS.openai,
      apiKey: "",
      model: DEFAULT_MODELS.openai,
      style: "structured",
      styles: defaultStyleList(),
    };
  }`,
);

src = src.replace(`const MUTATION_DEBOUNCE_MS = 120;`, `const MUTATION_DEBOUNCE_MS = 220;`);

src = src.replace(
  `disposed: false,
    loading: false,
    abort: null,`,
  `disposed: false,
    loading: false,
    button: null,
    abort: null,`,
);

src = src.replace(
  /function loadSettings\(\) \{[\s\S]*?\n  \}\n\n  function saveSettings\(settings\) \{/,
  `function loadSettings() {
    try {
      let raw = localStorage.getItem(SETTINGS_KEY);
      if (!raw) raw = localStorage.getItem(LEGACY_SETTINGS_KEY);
      if (!raw) return defaultSettings();
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return defaultSettings();
      const protocol = parsed.protocol === "anthropic" ? "anthropic" : "openai";
      let styles;
      if (Array.isArray(parsed.styles) && parsed.styles.length) {
        styles = parsed.styles
          .filter((s) => s && typeof s === "object")
          .map((s, i) => ({
            id: typeof s.id === "string" && s.id.trim() ? s.id.trim() : \`style_\${i}\`,
            name: typeof s.name === "string" && s.name.trim() ? s.name.trim() : \`风格 \${i + 1}\`,
            systemPrompt:
              typeof s.systemPrompt === "string" && s.systemPrompt.trim()
                ? s.systemPrompt
                : DEFAULT_SYSTEM_PROMPTS.structured,
          }));
      } else {
        // Migrate legacy systemPrompts map → styles list
        styles = defaultStyleList().map((s) => ({
          ...s,
          systemPrompt:
            typeof parsed.systemPrompts?.[s.id] === "string" && parsed.systemPrompts[s.id].trim()
              ? parsed.systemPrompts[s.id]
              : s.systemPrompt,
        }));
      }
      if (!styles.length) styles = defaultStyleList();
      // Keep locked defaults present even if older saves dropped them
      const byId = new Map(styles.map((s) => [s.id, s]));
      for (const def of defaultStyleList()) {
        if (!byId.has(def.id)) styles.unshift({ ...def });
      }
      let style = typeof parsed.style === "string" && parsed.style.trim() ? parsed.style.trim() : "structured";
      if (!styles.some((s) => s.id === style)) style = "structured";
      return {
        protocol,
        baseUrl: typeof parsed.baseUrl === "string" && parsed.baseUrl.trim() ? parsed.baseUrl.trim() : DEFAULT_BASE_URLS[protocol],
        apiKey: typeof parsed.apiKey === "string" ? parsed.apiKey : "",
        model: typeof parsed.model === "string" && parsed.model.trim() ? parsed.model.trim() : DEFAULT_MODELS[protocol],
        style,
        styles,
      };
    } catch (_) {
      return defaultSettings();
    }
  }

  function saveSettings(settings) {`,
);

src = src.replace(
  `function saveSettings(settings) {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }`,
  `function saveSettings(settings) {
    const next = {
      protocol: settings?.protocol === "anthropic" ? "anthropic" : "openai",
      baseUrl: typeof settings?.baseUrl === "string" ? settings.baseUrl : "",
      apiKey: typeof settings?.apiKey === "string" ? settings.apiKey : "",
      model: typeof settings?.model === "string" ? settings.model : "",
      style: typeof settings?.style === "string" ? settings.style : "structured",
      styles: Array.isArray(settings?.styles) ? settings.styles : defaultStyleList(),
    };
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
    try {
      localStorage.setItem(LEGACY_SETTINGS_KEY, JSON.stringify(next));
    } catch (_) {
      /* ignore */
    }
  }`,
);

// Remove duplicate defaultSettings patch if present later
src = src.replace(
  `function defaultSettings() {
    return {
      protocol: "openai",
      baseUrl: DEFAULT_BASE_URLS.openai,
      apiKey: "",
      model: DEFAULT_MODELS.openai,
      style: "structured",
      styles: defaultStyleList(),
    };
  }

  function defaultSettings() {
    return {
      protocol: "openai",
      baseUrl: DEFAULT_BASE_URLS.openai,
      apiKey: "",
      model: DEFAULT_MODELS.openai,
      style: "structured",
      styles: defaultStyleList(),
    };
  }`,
  `function defaultSettings() {
    return {
      protocol: "openai",
      baseUrl: DEFAULT_BASE_URLS.openai,
      apiKey: "",
      model: DEFAULT_MODELS.openai,
      style: "structured",
      styles: defaultStyleList(),
    };
  }`,
);

src = src.replace(
  `function hasRequestTransport() {
    return hasCodexPlusBridge() || hasElectronFetchBridge();
  }`,
  `const LOCAL_PROXY = "http://127.0.0.1:37841";
  const PROXY_WAKE_URL = "promptspark://ensure-proxy";
  let proxyWakeAt = 0;

  function hasNativeFetch() {
    return typeof fetch === "function";
  }

  function hasRequestTransport() {
    return hasCodexPlusBridge() || hasElectronFetchBridge() || hasNativeFetch();
  }

  function wakeLocalProxy() {
    const now = Date.now();
    if (now - proxyWakeAt < 4000) return;
    proxyWakeAt = now;
    try {
      const iframe = document.createElement("iframe");
      iframe.style.cssText = "display:none;width:0;height:0;border:0;position:absolute";
      iframe.src = PROXY_WAKE_URL;
      document.documentElement.appendChild(iframe);
      window.setTimeout(() => {
        try { iframe.remove(); } catch (_) { /* ignore */ }
      }, 4000);
    } catch (error) {
      debugLog("wakeLocalProxy iframe failed", error?.message || error);
    }
    try {
      const a = document.createElement("a");
      a.href = PROXY_WAKE_URL;
      a.rel = "noopener";
      a.style.display = "none";
      document.documentElement.appendChild(a);
      a.click();
      a.remove();
    } catch (_) { /* ignore */ }
    try {
      if (typeof window.electronBridge?.openExternal === "function") {
        window.electronBridge.openExternal(PROXY_WAKE_URL);
      }
    } catch (_) { /* ignore */ }
  }

  async function waitLocalProxy(timeoutMs = 2500) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      try {
        const res = await fetch(LOCAL_PROXY + "/health", { signal: AbortSignal.timeout(500) });
        if (res.ok) return true;
      } catch (_) { /* retry */ }
      await new Promise((r) => setTimeout(r, 200));
    }
    return false;
  }

  async function localProxyFetchJson({ upstreamUrl, method, headers, body, signal }) {
    const upstream = normalizeBaseUrl(upstreamUrl);
    let res;
    try {
      res = await fetch(LOCAL_PROXY + "/proxy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: upstream,
          method: method || "POST",
          headers: headers || {},
          body: body == null ? null : typeof body === "string" ? body : JSON.stringify(body),
          timeout_ms: REQUEST_TIMEOUT_MS,
        }),
        signal,
      });
    } catch (error) {
      wakeLocalProxy();
      const recovered = await waitLocalProxy(3000);
      if (recovered) {
        try {
          res = await fetch(LOCAL_PROXY + "/proxy", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              url: upstream,
              method: method || "POST",
              headers: headers || {},
              body: body == null ? null : typeof body === "string" ? body : JSON.stringify(body),
              timeout_ms: REQUEST_TIMEOUT_MS,
            }),
            signal,
          });
        } catch (retryErr) {
          const err = new Error(
          "本地代理未运行。请重启 Cursor/Codex，或运行: node ensure-proxy.mjs",
        );
          err.code = "CPO_PROXY_DOWN";
          err.cause = retryErr;
          throw err;
        }
      } else {
        const err = new Error(
          "本地代理未运行。请重启 Cursor/Codex，或运行: node ensure-proxy.mjs",
        );
        err.code = "CPO_PROXY_DOWN";
        err.cause = error;
        throw err;
      }
    }
    const envelope = await res.json().catch(() => ({}));
    if (envelope?.error && envelope?.status == null && envelope?.ok === false) {
      throw new Error(collapseWs(envelope.error).slice(0, 240));
    }
    const httpStatus = Number(envelope.status || 0);
    const rawBody = typeof envelope.body === "string" ? envelope.body : "";
    if (!(httpStatus >= 200 && httpStatus < 300)) {
      throw new Error(responseErrorMessage(rawBody, \`HTTP \${httpStatus || "error"}\`));
    }
    try {
      return rawBody.trim() ? JSON.parse(rawBody) : {};
    } catch (_) {
      throw new Error("模型返回了无法解析的 JSON");
    }
  }

  async function nativeFetchJson({ upstreamUrl, method, headers, body, signal }) {
    const upstream = normalizeBaseUrl(upstreamUrl);
    const res = await fetch(upstream, {
      method: method || "POST",
      headers: headers || {},
      body: body == null ? null : typeof body === "string" ? body : JSON.stringify(body),
      signal,
    });
    const rawBody = await res.text();
    if (!res.ok) {
      throw new Error(responseErrorMessage(rawBody, \`HTTP \${res.status}\`));
    }
    try {
      return rawBody.trim() ? JSON.parse(rawBody) : {};
    } catch (_) {
      throw new Error("模型返回了无法解析的 JSON");
    }
  }`,
);

src = src.replace(
  `async function requestJson(options) {
    if (hasCodexPlusBridge() && !runtime.bridgePathUnsupported) {
      try {
        const data = await requestJsonViaCodexBridge(options);
        return data;
      } catch (error) {
        if (!isBridgeUnsupportedError(error)) throw error;
        runtime.bridgePathUnsupported = true;
        debugLog("/llm-proxy unavailable; falling back to Electron fetch bridge");
      }
    }
    return electronFetchJson(options);
  }`,
  `async function requestJson(options) {
    if (hasCodexPlusBridge() && !runtime.bridgePathUnsupported) {
      try {
        const data = await requestJsonViaCodexBridge(options);
        return data;
      } catch (error) {
        if (!isBridgeUnsupportedError(error)) throw error;
        runtime.bridgePathUnsupported = true;
        debugLog("/llm-proxy unavailable; falling back");
      }
    }
    if (hasElectronFetchBridge()) {
      try {
        return await electronFetchJson(options);
      } catch (error) {
        debugLog("electron bridge failed; trying local proxy", error?.message);
      }
    }
    // Cursor / VS Code forks: renderer fetch to public APIs is often blocked by CORS.
    // Prefer local proxy (Node) which install.mjs starts on 127.0.0.1:37841.
    try {
      return await localProxyFetchJson(options);
    } catch (error) {
      if (error?.code === "CPO_PROXY_DOWN" && hasNativeFetch()) {
        debugLog("proxy down; last-resort direct fetch");
        try {
          return await nativeFetchJson(options);
        } catch (directErr) {
          throw new Error(
            (error?.message || "代理不可用") +
              "；直连也失败: " +
              (directErr?.message || "Failed to fetch"),
          );
        }
      }
      throw error;
    }
  }`,
);

// optimizePrompt: resolve system prompt from styles list
src = src.replace(
  `async function optimizePrompt(userText, settings, signal) {
    const system = settings.systemPrompts?.[settings.style] || DEFAULT_SYSTEM_PROMPTS[settings.style] || DEFAULT_SYSTEM_PROMPTS.structured;`,
  `async function optimizePrompt(userText, settings, signal) {
    const styleRow = Array.isArray(settings.styles)
      ? settings.styles.find((s) => s.id === settings.style)
      : null;
    const system =
      (styleRow && styleRow.systemPrompt) ||
      settings.systemPrompts?.[settings.style] ||
      DEFAULT_SYSTEM_PROMPTS[settings.style] ||
      DEFAULT_SYSTEM_PROMPTS.structured;`,
);

src = src.replace(
  `const message = collapseWs(error?.message || String(error) || "优化失败");
        showToast(message.slice(0, 160) || "优化失败", "error");`,
  `let message = collapseWs(error?.message || String(error) || "优化失败");
        if (/no eligible group/i.test(message)) {
          message = "网关分组没有该模型渠道。请改用 OpenAI 兼容协议，Base URL 带 /v1，并换已开通模型";
        } else if (/invalid api key|incorrect api key|unauthorized|401/i.test(message)) {
          message = "API Key 无效或无权限";
        }
        showToast(message.slice(0, 200) || "优化失败", "error");`,
);

src = src.replace(
  `function writeComposerText(text, input = findComposerInput()) {
    if (!(input instanceof HTMLElement)) return { ok: false, reason: "input-not-found" };
    const next = normalizeText(text);
    const token = ++runtime.writeToken;

    if (input instanceof HTMLTextAreaElement || input instanceof HTMLInputElement) {
      input.focus();
      setNativeValue(input, next);
      dispatchInputEvents(input);
    } else {
      input.focus();
      try {
        const selection = window.getSelection?.();
        const range = document.createRange();
        range.selectNodeContents(input);
        selection?.removeAllRanges?.();
        selection?.addRange?.(range);
      } catch (_) {
        /* ignore */
      }
      let replaced = false;
      try {
        replaced = document.execCommand?.("selectAll", false, null) && document.execCommand?.("insertText", false, next);
      } catch (_) {
        replaced = false;
      }
      if (!replaced) {
        return { ok: false, reason: "editor-write-unsupported" };
      }
      dispatchInputEvents(input);
    }
    return { ok: true, input, next, token };
  }`,
  `function selectElementContents(el) {
    try {
      const selection = window.getSelection?.();
      const range = document.createRange();
      range.selectNodeContents(el);
      selection?.removeAllRanges?.();
      selection?.addRange?.(range);
      return true;
    } catch (_) {
      return false;
    }
  }

  function writeViaPasteEvent(input, text) {
    try {
      const dt = new DataTransfer();
      dt.setData("text/plain", text);
      selectElementContents(input);
      document.execCommand?.("delete", false, null);
      const before = new InputEvent("beforeinput", {
        bubbles: true,
        cancelable: true,
        inputType: "insertFromPaste",
        data: text,
      });
      input.dispatchEvent(before);
      const paste = new ClipboardEvent("paste", {
        bubbles: true,
        cancelable: true,
        clipboardData: dt,
      });
      input.dispatchEvent(paste);
      return true;
    } catch (_) {
      return false;
    }
  }

  function writeComposerText(text, input = findComposerInput()) {
    if (!(input instanceof HTMLElement)) return { ok: false, reason: "input-not-found" };
    const next = normalizeText(text);
    const token = ++runtime.writeToken;

    if (input instanceof HTMLTextAreaElement || input instanceof HTMLInputElement) {
      input.focus();
      setNativeValue(input, next);
      dispatchInputEvents(input);
      return { ok: true, input, next, token };
    }

    input.focus();
    selectElementContents(input);

    let replaced = false;
    try {
      replaced = !!(document.execCommand?.("selectAll", false, null) && document.execCommand?.("insertText", false, next));
    } catch (_) {
      replaced = false;
    }
    if (!replaced) {
      replaced = writeViaPasteEvent(input, next);
    }
    if (!replaced) {
      try {
        input.textContent = next;
        dispatchInputEvents(input);
        replaced = normalizeText(readComposerText(input)).length > 0;
      } catch (_) {
        replaced = false;
      }
    } else {
      dispatchInputEvents(input);
    }
    if (!replaced) return { ok: false, reason: "editor-write-unsupported" };
    return { ok: true, input, next, token };
  }

  function copyTextFallback(text) {
    const value = normalizeText(text);
    try {
      if (navigator.clipboard?.writeText) {
        return navigator.clipboard.writeText(value).then(() => true).catch(() => false);
      }
    } catch (_) {
      /* fall through */
    }
    return new Promise((resolve) => {
      try {
        const ta = document.createElement("textarea");
        ta.value = value;
        ta.setAttribute("readonly", "true");
        ta.style.cssText = "position:fixed;left:-9999px;top:0;opacity:0;";
        document.documentElement.appendChild(ta);
        ta.focus();
        ta.select();
        ta.setSelectionRange(0, ta.value.length);
        const ok = document.execCommand("copy");
        ta.remove();
        resolve(!!ok);
      } catch (_) {
        resolve(false);
      }
    });
  }`,
);

src = src.replace(
  `async function writeComposerTextWithFallback(text, input = findComposerInput()) {
    const result = writeComposerText(text, input);
    if (result.ok) {
      await afterEditorPaint();
      if (result.token === runtime.writeToken && result.input.isConnected) {
        const verified = normalizeText(readComposerText(result.input));
        if (verified === result.next || verified.trimEnd() === result.next.trimEnd()) {
          runtime.lastWrittenText = verified;
          return { ok: true, verified: true, normalized: verified !== result.next };
        }
        result.reason = "write-mismatch";
        result.verified = verified;
      } else {
        result.reason = "editor-changed";
      }
    }
    try {
      await navigator.clipboard.writeText(normalizeText(text));
      showToast("无法直接写入输入框，已复制优化结果，请粘贴替换", "warn");
      return { ok: false, reason: result.reason || "write-failed", clipboard: true };
    } catch (_) {
      showToast("写入输入框失败，且无法复制到剪贴板", "error");
      return { ok: false, reason: result.reason || "write-failed", clipboard: false };
    }
  }`,
  `async function writeComposerTextWithFallback(text, input = findComposerInput()) {
    let result = writeComposerText(text, input);
    if (result.ok) {
      await afterEditorPaint();
      if (result.token === runtime.writeToken && result.input.isConnected) {
        const verified = normalizeText(readComposerText(result.input));
        if (
          verified === result.next ||
          verified.trimEnd() === result.next.trimEnd() ||
          (verified.includes(result.next.slice(0, Math.min(40, result.next.length))) && verified.length >= Math.min(20, result.next.length))
        ) {
          runtime.lastWrittenText = verified || result.next;
          return { ok: true, verified: true, normalized: verified !== result.next };
        }
        // Retry once via paste path
        writeViaPasteEvent(result.input, result.next);
        await afterEditorPaint();
        const verified2 = normalizeText(readComposerText(result.input));
        if (verified2 && (verified2 === result.next || verified2.length >= Math.min(verified2.length, result.next.length) * 0.5)) {
          runtime.lastWrittenText = verified2;
          return { ok: true, verified: true, normalized: true };
        }
        result.reason = "write-mismatch";
        result.verified = verified;
      } else {
        result.reason = "editor-changed";
      }
    }
    const copied = await copyTextFallback(text);
    if (copied) {
      showToast("无法直接写入，已复制结果，请 Ctrl+V 粘贴", "warn");
      return { ok: false, reason: result.reason || "write-failed", clipboard: true };
    }
    showToast("写入失败，且剪贴板不可用（可手动复制控制台结果）", "error");
    try {
      console.info(DEBUG_PREFIX, "optimized text:\\n" + normalizeText(text));
    } catch (_) {
      /* ignore */
    }
    return { ok: false, reason: result.reason || "write-failed", clipboard: false };
  }`,
);

// Button look: theme-aware, high contrast, no square chrome
src = src.replace(
  `border-radius: 999px;
        border: 1px solid rgba(255,255,255,.14);
        background: rgba(63,63,70,.55);`,
  `border-radius: 4px;
        border: none !important;
        background: transparent !important;
        box-shadow: none !important;
        opacity: 1;
        color: var(--vscode-icon-foreground, var(--vscode-foreground, #3c3c3c)) !important;`,
);

// Drop the original light-gray color that would sit after our theme color
src = src.replace(
  `color: var(--vscode-icon-foreground, var(--vscode-foreground, #3c3c3c)) !important;
        color: #e4e4e7;
        font-size: 14px;`,
  `color: var(--vscode-icon-foreground, var(--vscode-foreground, #3c3c3c)) !important;
        font-size: 14px;`,
);

src = src.replace(
  `background: rgba(82,82,91,.8);
        border-color: rgba(255,255,255,.28);`,
  `background: transparent !important;
        border: none !important;
        opacity: 1;
        color: var(--vscode-foreground, #1f1f1f) !important;`,
);

src = src.replace(
  `background: rgba(16,163,127,.22);
        border-color: #10a37f;
        color: #6ee7b7;`,
  `background: transparent !important;
        border: none !important;
        color: #0d9488 !important;
        opacity: 1;`,
);

src = src.replace(
  `background: #18181b;
        border: 1px solid rgba(255,255,255,.12);
        border-radius: 14px;
        box-shadow: 0 20px 50px rgba(0,0,0,.45);
        padding: 16px;`,
  `background: linear-gradient(180deg, #1c1c20 0%, #141417 100%);
        border: 1px solid rgba(255,255,255,.1);
        border-radius: 16px;
        box-shadow: 0 24px 60px rgba(0,0,0,.5);
        padding: 18px 18px 16px;`,
);

src = src.replace(
  /\[\$\{BUTTON_ATTR\}\]\[data-state="loading"\] \.cpo-icon \{\s*animation: cpo-spin 0\.9s linear infinite;\s*\}/,
  `[\${BUTTON_ATTR}][data-state="loading"] .cpo-icon {
        animation: none !important;
      }`,
);

src = src.replace(
  `return "点击优化提示词（右键打开设置）";`,
  `return "优化提示词（右键 / Alt+点击 打开设置）";`,
);
src = src.replace(
  `return "点击还原原文（右键打开设置）";`,
  `return "还原原文（右键 / Alt+点击 打开设置）";`,
);

// SVG button + appearance (no emoji)
src = src.replace(
  /function refreshButtonAppearance\(button = document\.querySelector\(`\[\$\{BUTTON_ATTR\}\]`\)\) \{[\s\S]*?\n  \}\n\n  function createButton\(\) \{[\s\S]*?return button;\n  \}/,
  `function refreshButtonAppearance(button = document.querySelector(\`[\${BUTTON_ATTR}]\`)) {
    if (!(button instanceof HTMLElement)) return;
    const state = currentButtonState();
    const title = buttonTitle(state);
    if (button.dataset.state !== state) button.dataset.state = state;
    if (button.getAttribute("title") !== title) button.setAttribute("title", title);
    if (button.getAttribute("aria-label") !== title) button.setAttribute("aria-label", title);
    button.setAttribute("aria-busy", state === "loading" ? "true" : "false");
    const icon = button.querySelector(".cpo-icon");
    const spinner = button.querySelector(".cpo-spinner");
    const loading = state === "loading";
    if (icon instanceof SVGElement || icon instanceof HTMLElement) {
      icon.style.setProperty("display", loading ? "none" : "block", "important");
      icon.style.setProperty("animation", "none", "important");
      icon.style.setProperty("transform", "none", "important");
    }
    if (spinner instanceof SVGElement || spinner instanceof HTMLElement) {
      spinner.style.setProperty("display", loading ? "block" : "none", "important");
      spinner.style.setProperty(
        "animation",
        loading ? "cpo-spin-arrow 0.8s linear infinite" : "none",
        "important",
      );
      spinner.style.setProperty("transform-origin", "8px 8px", "important");
    }
  }

  function createButton() {
    const button = document.createElement("button");
    button.type = "button";
    button.setAttribute(BUTTON_ATTR, "true");
    button.dataset.version = SCRIPT_VERSION;
    button.appendChild(buildOptimizeIconSvg());
    button.addEventListener("click", onButtonClick);
    button.addEventListener("contextmenu", onButtonContextMenu, true);
    button.addEventListener("auxclick", (event) => {
      if (event.button === 2) onButtonContextMenu(event);
    }, true);
    refreshButtonAppearance(button);
    runtime.button = button;
    return button;
  }`,
);

src = src.replace(
  `function onButtonClick(event) {
    event.preventDefault();
    event.stopPropagation();
    if (runtime.loading) {
      cancelOptimize();
      return;
    }
    if (state.mode === "optimized") {
      runRestore();
      return;
    }
    runOptimize();
  }`.replace("state.mode", "getThreadState().mode"),
  `PATCH_CLICK`,
);

// Safer click patch using original source shape
src = src.replace(
  /function onButtonClick\(event\) \{[\s\S]*?\n  \}\n\n  function onButtonContextMenu\(event\) \{[\s\S]*?\n  \}/,
  `function onButtonClick(event) {
    event.preventDefault();
    event.stopPropagation();
    if (event.altKey || event.metaKey) {
      openSettingsPanel();
      return;
    }
    if (runtime.loading) {
      cancelOptimize();
      return;
    }
    const state = getThreadState();
    if (state.mode === "optimized") {
      runRestore();
      return;
    }
    runOptimize();
  }

  function onButtonContextMenu(event) {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();
    openSettingsPanel();
  }`,
);

// Replace entire openSettingsPanel with DOM-safe version
if (!src.includes("function openSettingsPanel() {")) {
  throw new Error("openSettingsPanel not found");
}
src = src.replace(
  /function openSettingsPanel\(\) \{[\s\S]*?\n  \}\n\n\n  function scheduleEnsure/,
  `${settingsDom}

  function openSettingsPanel() {
    try {
      openSettingsPanelDomSafe();
    } catch (error) {
      console.error(DEBUG_PREFIX, "settings panel failed", error);
      showToast("设置面板打开失败（详见控制台）", "error");
    }
  }

  function scheduleEnsure`,
);

const themeCssPath = path.join(root, "src", "theme-css.css");
const themeCss = fs.readFileSync(themeCssPath, "utf8");

// CSS spinning class + theme-aware panel
src = src.replace(
  `@keyframes cpo-spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
      }`,
  `@keyframes cpo-spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
      }
      .cpo-channel-hint {
        font-size: 12px;
        line-height: 1.45;
        opacity: .85;
      }
` + themeCss,
);

src = src.replace(
  `  installStyle();
  startObservers();
  ensureSparkleButton();
  window[API_KEY] = api;
  try {
    console.info(DEBUG_PREFIX, \`loaded v\${SCRIPT_VERSION}. diagnose: window.__codexPlusPromptOptimize.diagnose()\`);
  } catch (_) {
    /* ignore */
  }
  // First paint can lag behind SPA route; retry a few times quickly.
  [300, 1000, 2500, 5000].forEach((ms) => {
    window.setTimeout(() => {
      if (!runtime.disposed) ensureSparkleButton();
    }, ms);
  });
})();`,
  `  try {
    installStyle();
    startObservers();
    ensureSparkleButton();
    window[API_KEY] = api;
    console.info(DEBUG_PREFIX, \`loaded v\${SCRIPT_VERSION} host=\${HOST}\`);
    // When user plugin/script loads (Cursor extension / Codex++ user_scripts), wake local proxy.
    (async () => {
      try {
        if (await waitLocalProxy(500)) return;
        wakeLocalProxy();
        await waitLocalProxy(3500);
      } catch (_) { /* ignore */ }
    })();
    [300, 1000, 2500, 5000, 10000].forEach((ms) => {
      window.setTimeout(() => {
        if (!runtime.disposed) {
          try { ensureSparkleButton(); } catch (e) { console.warn(DEBUG_PREFIX, e); }
        }
      }, ms);
    });
  } catch (error) {
    console.error(DEBUG_PREFIX, "boot failed", error);
  }
})();`,
);

if (!src.includes("function findComposerInput() {\n    const pm = findProseMirrorInput();")) {
  throw new Error("findComposerInput marker not found");
}
src = src.replace(
  "  function findComposerInput() {\n    const pm = findProseMirrorInput();",
  `  function findComposerInput() {
    if (HOST !== "codex" && typeof findWorkbenchChatInput === "function") {
      const wb = findWorkbenchChatInput();
      if (wb) return wb;
    }
    const pm = findProseMirrorInput();`,
);

if (!src.includes("  function ensureSparkleButton() {")) {
  throw new Error("ensureSparkleButton marker not found");
}
src = src.replace(
  "  function ensureSparkleButton() {",
  `${adapters}

  function ensureSparkleButton() {
    if (typeof refreshHost === "function") refreshHost();
    if (HOST !== "codex") {
      ensureWorkbenchSparkleButton();
      return;
    }`,
);

// Guard: icon builder must exist before createButton
src = src.replace(
  "  function refreshButtonAppearance(",
  `  function buildOptimizeIconSvgEarly() {
    // Sparkles stay still; half-arc arrow SVG rotates while loading.
    const svgNS = "http://www.w3.org/2000/svg";
    const wrap = document.createElement("span");
    wrap.className = "cpo-icon-wrap";
    wrap.setAttribute("aria-hidden", "true");

    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("class", "cpo-icon");
    svg.setAttribute("viewBox", "0 0 16 16");
    svg.setAttribute("width", "16");
    svg.setAttribute("height", "16");
    svg.setAttribute("focusable", "false");

    const big = document.createElementNS(svgNS, "path");
    big.setAttribute(
      "d",
      "M7.5 1.2l1.15 3.55L12.3 5.9l-3.65 1.15L7.5 10.7 6.35 7.05 2.7 5.9l3.65-1.15L7.5 1.2z",
    );
    big.setAttribute("fill", "currentColor");

    const small = document.createElementNS(svgNS, "path");
    small.setAttribute(
      "d",
      "M12.4 8.6l.7 1.9 1.95.65-1.95.7-.7 1.9-.7-1.9-1.95-.7 1.95-.65.7-1.9z",
    );
    small.setAttribute("fill", "currentColor");

    svg.appendChild(big);
    svg.appendChild(small);

    const spinner = document.createElementNS(svgNS, "svg");
    spinner.setAttribute("class", "cpo-spinner");
    spinner.setAttribute("viewBox", "0 0 16 16");
    spinner.setAttribute("width", "16");
    spinner.setAttribute("height", "16");
    spinner.setAttribute("focusable", "false");
    spinner.style.display = "none";

    // Classic refresh: 3/4 arc + corner arrow (one clean glyph that rotates)
    const g = document.createElementNS(svgNS, "g");
    g.setAttribute("fill", "none");
    g.setAttribute("stroke", "currentColor");
    g.setAttribute("stroke-width", "1.6");
    g.setAttribute("stroke-linecap", "round");
    g.setAttribute("stroke-linejoin", "round");

    const arc = document.createElementNS(svgNS, "path");
    arc.setAttribute("d", "M13.2 8A5.2 5.2 0 1 1 11.7 4.1");

    const tip = document.createElementNS(svgNS, "path");
    tip.setAttribute("d", "M13.2 2.6v3.1h-3.1");

    g.appendChild(arc);
    g.appendChild(tip);
    spinner.appendChild(g);

    wrap.appendChild(svg);
    wrap.appendChild(spinner);
    return wrap;
  }

  function refreshButtonAppearance(`,
);

// createButton uses early builder
src = src.replace(
  `button.appendChild(buildOptimizeIconSvg());`,
  `button.appendChild(buildOptimizeIconSvgEarly());`,
);

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, src, "utf8");

// Sanity checks
const checks = [
  ["version", src.includes(`SCRIPT_VERSION = "${VERSION}"`)],
  ["svg early", src.includes("buildOptimizeIconSvgEarly")],
  ["settings dom", src.includes("openSettingsPanelDomSafe")],
  ["load styles", src.includes("parsed.styles") && src.includes("LEGACY_SETTINGS_KEY")],
  ["save styles", /function saveSettings\(settings\) \{[\s\S]*?styles: Array\.isArray/.test(src)],
  ["no const HOST detect", !/const\s+HOST\s*=\s*detectHost/.test(src)],
  ["workbench ensure", src.includes("ensureWorkbenchSparkleButton")],
  ["alt settings", src.includes("event.altKey")],
];
for (const [name, ok] of checks) {
  if (!ok) throw new Error(`Build check failed: ${name}`);
}
console.log(`Built ${outPath} (${src.length} bytes) v${VERSION}`);
