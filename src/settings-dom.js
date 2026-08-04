/**
 * Apple-style settings sheet (Trusted Types safe).
 * Frosted material, segmented defaults, custom style dropdown, no visible scrollbars.
 */

  const LOCKED_STYLE_IDS = ["concise", "structured", "coding"];
  const PROTOCOL_OPTIONS = [
    { value: "openai", label: "OpenAI 兼容" },
    { value: "anthropic", label: "Anthropic" },
  ];

  function cpoEl(tag, attrs, children) {
    const el = document.createElement(tag);
    if (attrs) {
      for (const [k, v] of Object.entries(attrs)) {
        if (v == null || v === false) continue;
        if (k === "className") el.className = v;
        else if (k === "text") el.textContent = v;
        else if (k === "htmlFor") el.htmlFor = v;
        else if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2).toLowerCase(), v);
        else el.setAttribute(k, String(v));
      }
    }
    if (children) {
      for (const child of children) {
        if (child == null) continue;
        el.appendChild(typeof child === "string" ? document.createTextNode(child) : child);
      }
    }
    return el;
  }

  function cpoCaret() {
    const svgNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("class", "cpo-dd-caret");
    svg.setAttribute("viewBox", "0 0 12 8");
    svg.setAttribute("width", "10");
    svg.setAttribute("height", "7");
    svg.setAttribute("aria-hidden", "true");
    const path = document.createElementNS(svgNS, "path");
    path.setAttribute("d", "M1.2 1.4L6 6.2l4.8-4.8");
    path.setAttribute("fill", "none");
    path.setAttribute("stroke", "currentColor");
    path.setAttribute("stroke-width", "1.6");
    path.setAttribute("stroke-linecap", "round");
    path.setAttribute("stroke-linejoin", "round");
    svg.appendChild(path);
    return svg;
  }

  function newStyleId() {
    return `custom_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  }

  function isLockedStyle(id) {
    return LOCKED_STYLE_IDS.includes(id);
  }

  function ensureStylePrompt(style) {
    if (!style) return style;
    if (style.systemPrompt && String(style.systemPrompt).trim()) return style;
    const fallback = DEFAULT_SYSTEM_PROMPTS[style.id] || DEFAULT_SYSTEM_PROMPTS.structured;
    return { ...style, systemPrompt: fallback };
  }

  function cloneStyles(styles) {
    const list = Array.isArray(styles) && styles.length ? styles : defaultStyleList();
    const byId = new Map(list.map((s) => [String(s.id), s]));
    const merged = defaultStyleList().map((def) => {
      const existing = byId.get(def.id);
      byId.delete(def.id);
      if (!existing) return { ...def };
      return ensureStylePrompt({
        id: def.id,
        name: def.name,
        systemPrompt: existing.systemPrompt || def.systemPrompt,
      });
    });
    for (const s of byId.values()) {
      merged.push(
        ensureStylePrompt({
          id: String(s.id || newStyleId()),
          name: String(s.name || "自定义"),
          systemPrompt: String(s.systemPrompt || DEFAULT_SYSTEM_PROMPTS.structured),
        }),
      );
    }
    return merged;
  }

  function openSettingsPanelDomSafe() {
    closeSettingsPanel();
    const settings = loadSettings();
    let draftStyles = cloneStyles(settings.styles);
    let activeId = settings.style;
    if (!draftStyles.some((s) => s.id === activeId)) activeId = "structured";
    let protocolValue = settings.protocol === "anthropic" ? "anthropic" : "openai";

    const overlay = cpoEl("div", { [PANEL_ATTR]: "true", className: "cpo-apple" });

    const baseUrlEl = cpoEl("input", {
      "data-cpo": "baseUrl",
      type: "url",
      spellcheck: "false",
      placeholder: "https://api.example.com/v1",
    });
    const apiKeyEl = cpoEl("input", {
      "data-cpo": "apiKey",
      type: "password",
      spellcheck: "false",
      autocomplete: "new-password",
      placeholder: "API Key",
    });
    const modelEl = cpoEl("input", {
      "data-cpo": "model",
      type: "text",
      spellcheck: "false",
      placeholder: "模型 ID",
    });
    const warnEl = cpoEl("div", { className: "cpo-warn-banner", hidden: "true" });

    const segment = cpoEl("div", { className: "cpo-segment cpo-segment-sm", role: "tablist" });
    const styleDd = cpoEl("div", { className: "cpo-dd cpo-style-dd" });
    const styleDdTrigger = cpoEl("button", {
      type: "button",
      className: "cpo-dd-trigger",
      "aria-haspopup": "listbox",
      "aria-expanded": "false",
    });
    const styleDdValue = cpoEl("span", { className: "cpo-dd-value", text: "选择自定义风格" });
    styleDdTrigger.appendChild(styleDdValue);
    styleDdTrigger.appendChild(cpoCaret());
    const styleDdMenu = cpoEl("div", {
      className: "cpo-dd-menu",
      role: "listbox",
      hidden: "true",
    });
    styleDd.appendChild(styleDdTrigger);
    styleDd.appendChild(styleDdMenu);

    const styleNameEl = cpoEl("input", {
      "data-cpo": "styleName",
      type: "text",
      spellcheck: "false",
      placeholder: "风格名称",
    });
    const stylePromptEl = cpoEl("textarea", {
      "data-cpo": "stylePrompt",
      placeholder: "System prompt",
      rows: "5",
    });
    const styleLockHint = cpoEl("div", { className: "cpo-lock-hint" });

    // Protocol custom dropdown
    const protocolDd = cpoEl("div", { className: "cpo-dd", "data-cpo": "protocol" });
    const protocolTrigger = cpoEl("button", {
      type: "button",
      className: "cpo-dd-trigger",
      "aria-haspopup": "listbox",
      "aria-expanded": "false",
    });
    const protocolValueEl = cpoEl("span", { className: "cpo-dd-value", text: "" });
    protocolTrigger.appendChild(protocolValueEl);
    protocolTrigger.appendChild(cpoCaret());
    const protocolMenu = cpoEl("div", {
      className: "cpo-dd-menu",
      role: "listbox",
      hidden: "true",
    });
    protocolDd.appendChild(protocolTrigger);
    protocolDd.appendChild(protocolMenu);

    function closeAllMenus(except) {
      for (const dd of [protocolDd, styleDd]) {
        if (except && dd === except) continue;
        const menu = dd.querySelector(".cpo-dd-menu");
        const trigger = dd.querySelector(".cpo-dd-trigger");
        if (menu) menu.hidden = true;
        if (trigger) trigger.setAttribute("aria-expanded", "false");
        dd.classList.remove("is-open");
      }
    }

    function toggleMenu(dd) {
      const menu = dd.querySelector(".cpo-dd-menu");
      const trigger = dd.querySelector(".cpo-dd-trigger");
      const willOpen = !!(menu && menu.hidden);
      closeAllMenus(willOpen ? dd : null);
      if (!menu || !trigger) return;
      menu.hidden = !willOpen;
      trigger.setAttribute("aria-expanded", willOpen ? "true" : "false");
      dd.classList.toggle("is-open", willOpen);
    }

    function updateMismatchWarn() {
      const protocol = protocolValue;
      const model = modelEl.value.trim();
      if (protocol === "anthropic" && /^(gpt|o[1-9]|chatgpt|deepseek|qwen)/i.test(model)) {
        warnEl.hidden = false;
        warnEl.textContent = "协议与模型不匹配：请改用「OpenAI 兼容」，或换 Claude 模型。";
      } else if (protocol === "openai" && baseUrlEl.value.trim() && !/\/v1\/?$/i.test(baseUrlEl.value.trim())) {
        warnEl.hidden = false;
        warnEl.textContent = "OpenAI 兼容接口的 Base URL 建议以 /v1 结尾。";
      } else {
        warnEl.hidden = true;
        warnEl.textContent = "";
      }
    }

    function setProtocol(next, { syncDefaults = false } = {}) {
      const protocol = next === "anthropic" ? "anthropic" : "openai";
      protocolValue = protocol;
      const opt = PROTOCOL_OPTIONS.find((o) => o.value === protocol) || PROTOCOL_OPTIONS[0];
      protocolValueEl.textContent = opt.label;
      protocolMenu.querySelectorAll("[data-value]").forEach((btn) => {
        btn.setAttribute("aria-selected", btn.getAttribute("data-value") === protocol ? "true" : "false");
      });
      if (syncDefaults) {
        if (!baseUrlEl.value.trim() || baseUrlEl.value.trim() === DEFAULT_BASE_URLS.openai || baseUrlEl.value.trim() === DEFAULT_BASE_URLS.anthropic) {
          baseUrlEl.value = DEFAULT_BASE_URLS[protocol];
        }
        if (!modelEl.value.trim() || modelEl.value.trim() === DEFAULT_MODELS.openai || modelEl.value.trim() === DEFAULT_MODELS.anthropic) {
          modelEl.value = DEFAULT_MODELS[protocol];
        }
      }
      updateMismatchWarn();
    }

    function rebuildProtocolMenu() {
      protocolMenu.textContent = "";
      for (const opt of PROTOCOL_OPTIONS) {
        const item = cpoEl("button", {
          type: "button",
          className: "cpo-dd-item",
          role: "option",
          "data-value": opt.value,
          text: opt.label,
        });
        item.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          setProtocol(opt.value, { syncDefaults: true });
          closeAllMenus();
        });
        protocolMenu.appendChild(item);
      }
    }

    function commitCurrent() {
      const cur = draftStyles.find((s) => s.id === activeId);
      if (!cur) return;
      if (!isLockedStyle(cur.id)) {
        cur.name = styleNameEl.value.trim() || cur.name || "自定义";
      }
      const prompt = stylePromptEl.value;
      cur.systemPrompt = prompt.trim()
        ? prompt
        : DEFAULT_SYSTEM_PROMPTS[cur.id] || DEFAULT_SYSTEM_PROMPTS.structured;
    }

    function paintEditor() {
      const cur = ensureStylePrompt(draftStyles.find((s) => s.id === activeId));
      if (!cur) return;
      const idx = draftStyles.findIndex((s) => s.id === activeId);
      if (idx >= 0) draftStyles[idx] = cur;

      const locked = isLockedStyle(cur.id);
      styleNameEl.value = cur.name;
      styleNameEl.disabled = locked;
      stylePromptEl.value = cur.systemPrompt || "";
      styleLockHint.textContent = locked
        ? "默认风格不可删除，可微调 system prompt"
        : "自定义风格可改名；下拉项右侧 × 可删除";

      segment.querySelectorAll("[data-style-id]").forEach((btn) => {
        btn.setAttribute("aria-selected", btn.getAttribute("data-style-id") === activeId ? "true" : "false");
      });

      const customs = draftStyles.filter((x) => !isLockedStyle(x.id));
      if (!locked) {
        styleDdValue.textContent = cur.name || "自定义风格";
        styleDd.classList.add("has-value");
      } else if (customs.length) {
        styleDdValue.textContent = "选择自定义风格";
        styleDd.classList.remove("has-value");
      } else {
        styleDdValue.textContent = "暂无自定义 · 点下方新增";
        styleDd.classList.remove("has-value");
      }

      styleDdMenu.querySelectorAll("[data-style-id]").forEach((row) => {
        row.setAttribute("aria-selected", row.getAttribute("data-style-id") === activeId ? "true" : "false");
      });
    }

    function addCustomStyle() {
      commitCurrent();
      const id = newStyleId();
      const n = draftStyles.filter((s) => !isLockedStyle(s.id)).length + 1;
      draftStyles.push({
        id,
        name: `自定义 ${n}`,
        systemPrompt: DEFAULT_SYSTEM_PROMPTS.structured,
      });
      activeId = id;
      rebuildStyleUi();
      closeAllMenus();
    }

    function removeCustomStyle(id) {
      if (isLockedStyle(id)) {
        showToast("默认三种风格不能删除", "warn");
        return;
      }
      commitCurrent();
      draftStyles = draftStyles.filter((s) => s.id !== id);
      if (activeId === id) activeId = "structured";
      rebuildStyleUi();
    }

    function rebuildDefaultTabs() {
      segment.textContent = "";
      for (const s of draftStyles.filter((x) => isLockedStyle(x.id))) {
        const btn = cpoEl("button", {
          type: "button",
          className: "cpo-seg-btn",
          "data-style-id": s.id,
          text: s.name,
          role: "tab",
        });
        btn.addEventListener("click", (e) => {
          e.preventDefault();
          commitCurrent();
          activeId = s.id;
          paintEditor();
        });
        segment.appendChild(btn);
      }
    }

    function rebuildStyleMenu() {
      styleDdMenu.textContent = "";
      const customs = draftStyles.filter((x) => !isLockedStyle(x.id));
      for (const s of customs) {
        const row = cpoEl("div", {
          className: "cpo-dd-row",
          "data-style-id": s.id,
          role: "option",
          "aria-selected": "false",
        });
        const pick = cpoEl("button", {
          type: "button",
          className: "cpo-dd-item",
          text: s.name,
        });
        pick.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          commitCurrent();
          activeId = s.id;
          paintEditor();
          closeAllMenus();
        });
        const xBtn = cpoEl("button", {
          type: "button",
          className: "cpo-dd-x",
          title: "删除此风格",
          "aria-label": `删除 ${s.name}`,
          text: "×",
        });
        xBtn.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          removeCustomStyle(s.id);
        });
        row.appendChild(pick);
        row.appendChild(xBtn);
        styleDdMenu.appendChild(row);
      }
      const addBtn = cpoEl("button", {
        type: "button",
        className: "cpo-dd-add",
        text: "＋ 新增风格",
      });
      addBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        addCustomStyle();
      });
      styleDdMenu.appendChild(addBtn);
    }

    function rebuildStyleUi() {
      rebuildDefaultTabs();
      rebuildStyleMenu();
      paintEditor();
    }

    rebuildProtocolMenu();
    setProtocol(protocolValue);
    baseUrlEl.value = settings.baseUrl || "";
    apiKeyEl.value = settings.apiKey || "";
    modelEl.value = settings.model || "";
    modelEl.addEventListener("input", updateMismatchWarn);
    baseUrlEl.addEventListener("input", updateMismatchWarn);
    updateMismatchWarn();
    rebuildStyleUi();

    protocolTrigger.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      toggleMenu(protocolDd);
    });
    styleDdTrigger.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      toggleMenu(styleDd);
    });

    const card = cpoEl("div", { className: "cpo-card", role: "dialog", "aria-modal": "true", "aria-label": "PromptSpark" }, [
      cpoEl("header", { className: "cpo-sheet-head" }, [
        cpoEl("div", null, [
          cpoEl("h2", { text: "PromptSpark" }),
          cpoEl("p", { className: "cpo-sub", text: "优化 · 还原 · Alt+点击打开设置" }),
        ]),
        cpoEl("button", { type: "button", className: "cpo-close", "data-cpo-action": "close", text: "关闭" }),
      ]),
      cpoEl("section", { className: "cpo-block" }, [
        cpoEl("h3", { className: "cpo-h3", text: "接口" }),
        cpoEl("div", { className: "cpo-fields" }, [
          cpoEl("label", { className: "cpo-field cpo-span2" }, [cpoEl("span", { text: "协议" }), protocolDd]),
          cpoEl("label", { className: "cpo-field cpo-span2" }, [cpoEl("span", { text: "Base URL" }), baseUrlEl]),
          cpoEl("label", { className: "cpo-field" }, [cpoEl("span", { text: "API Key" }), apiKeyEl]),
          cpoEl("label", { className: "cpo-field" }, [cpoEl("span", { text: "Model" }), modelEl]),
        ]),
        warnEl,
        cpoEl("p", {
          className: "cpo-footnote",
          text: `通道 ${typeof HOST === "string" ? HOST : "auto"} · 本地代理随宿主启动 · 127.0.0.1:37841`,
        }),
      ]),
      cpoEl("section", { className: "cpo-block" }, [
        cpoEl("div", { className: "cpo-block-head" }, [
          cpoEl("h3", { className: "cpo-h3", text: "风格" }),
          segment,
        ]),
        cpoEl("label", { className: "cpo-field" }, [
          cpoEl("span", { text: "自定义" }),
          styleDd,
        ]),
        styleLockHint,
        cpoEl("label", { className: "cpo-field" }, [cpoEl("span", { text: "名称" }), styleNameEl]),
        cpoEl("label", { className: "cpo-field" }, [cpoEl("span", { text: "System prompt" }), stylePromptEl]),
      ]),
      cpoEl("footer", { className: "cpo-sheet-foot" }, [
        cpoEl("button", { type: "button", className: "cpo-btn", "data-cpo-action": "close", text: "取消" }),
        cpoEl("button", { type: "button", className: "cpo-btn cpo-btn-fill", "data-cpo-action": "save", text: "存储" }),
      ]),
    ]);
    overlay.appendChild(card);

    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) {
        closeSettingsPanel();
        return;
      }
      if (!(event.target instanceof Element) || !event.target.closest(".cpo-dd")) {
        closeAllMenus();
      }
    });
    overlay.querySelectorAll('[data-cpo-action="close"]').forEach((btn) => {
      btn.addEventListener("click", (event) => {
        event.preventDefault();
        closeSettingsPanel();
      });
    });
    overlay.querySelector('[data-cpo-action="save"]').addEventListener("click", (event) => {
      event.preventDefault();
      commitCurrent();
      let protocol = protocolValue === "anthropic" ? "anthropic" : "openai";
      const model = modelEl.value.trim() || DEFAULT_MODELS[protocol];
      if (protocol === "anthropic" && /^(gpt|o[1-9]|chatgpt|deepseek|qwen)/i.test(model)) {
        protocol = "openai";
        setProtocol("openai");
        showToast("已自动改为 OpenAI 兼容协议", "info");
      }
      let baseUrl;
      try {
        let raw = baseUrlEl.value.trim() || DEFAULT_BASE_URLS[protocol];
        if (protocol === "openai" && /^https?:\/\//i.test(raw) && !/\/v1\/?$/i.test(raw) && !/\/chat\/completions/i.test(raw)) {
          raw = raw.replace(/\/+$/, "") + "/v1";
        }
        baseUrl = normalizeBaseUrl(raw);
      } catch (error) {
        showToast(error?.message || "Base URL 无效", "error");
        baseUrlEl.focus();
        return;
      }
      draftStyles = cloneStyles(draftStyles);
      if (!draftStyles.some((s) => s.id === activeId)) activeId = "structured";
      saveSettings({
        protocol,
        baseUrl,
        apiKey: apiKeyEl.value.trim(),
        model,
        style: activeId,
        styles: draftStyles.map((s) => ensureStylePrompt(s)),
      });
      closeSettingsPanel();
      showToast("已存储", "ok");
    });
    overlay.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        const anyOpen = protocolDd.classList.contains("is-open") || styleDd.classList.contains("is-open");
        if (anyOpen) {
          closeAllMenus();
          return;
        }
        closeSettingsPanel();
      }
    });

    document.documentElement.appendChild(overlay);
    apiKeyEl.focus();
  }
