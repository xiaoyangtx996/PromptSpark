/**
 * Apple-style settings sheet (Trusted Types safe).
 * Top tabs: 提示词优化 · 快捷命令 · 模型配置
 */

  const LOCKED_STYLE_IDS = ["concise", "structured", "coding"];
  const PROTOCOL_OPTIONS = [
    { value: "openai", label: "OpenAI 兼容" },
    { value: "anthropic", label: "Anthropic" },
  ];
  const SETTINGS_TABS = [
    { id: "styles", label: "提示词优化" },
    { id: "commands", label: "快捷命令" },
    { id: "model", label: "模型配置" },
  ];
  const GITHUB_URL = "https://github.com/xiaoyangtx996/PromptSpark";

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

  function cpoGitHubIcon() {
    const svgNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("class", "cpo-github-icon");
    svg.setAttribute("viewBox", "0 0 16 16");
    svg.setAttribute("width", "17");
    svg.setAttribute("height", "17");
    svg.setAttribute("aria-hidden", "true");
    const path = document.createElementNS(svgNS, "path");
    path.setAttribute(
      "d",
      "M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z",
    );
    path.setAttribute("fill", "currentColor");
    svg.appendChild(path);
    return svg;
  }

  function cpoBrandIcon() {
    const img = document.createElement("img");
    img.className = "cpo-brand-icon";
    img.width = 36;
    img.height = 36;
    img.alt = "";
    img.setAttribute("aria-hidden", "true");
    // build.mjs inlines assets/brand/logo-promptspark.png (mark)
    img.src = "__CPO_BRAND_ICON_DATA_URL__";
    return img;
  }

  function cpoBrandBlock() {
    return cpoEl("div", { className: "cpo-brand" }, [
      cpoBrandIcon(),
      cpoEl("span", { className: "cpo-brand-name", text: "PromptSpark" }),
    ]);
  }

  function cpoSecTitle(text, opts) {
    const strong = opts && opts.strong;
    return cpoEl("div", { className: strong ? "cpo-sec-title cpo-sec-title-strong" : "cpo-sec-title" }, [
      cpoEl("span", { className: "cpo-sec-bar", "aria-hidden": "true" }),
      cpoEl("span", { className: "cpo-sec-text", text }),
    ]);
  }

  function cpoLucideSvg(className, size, paths) {
    const svgNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("class", className);
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("width", String(size));
    svg.setAttribute("height", String(size));
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", "1.8");
    svg.setAttribute("stroke-linecap", "round");
    svg.setAttribute("stroke-linejoin", "round");
    svg.setAttribute("aria-hidden", "true");
    for (const d of paths) {
      const path = document.createElementNS(svgNS, "path");
      path.setAttribute("d", d);
      svg.appendChild(path);
    }
    return svg;
  }

  function cpoInfoGlyph() {
    return cpoLucideSvg("cpo-info-glyph", 12, [
      "M12 16v-4",
      "M12 8h.01",
      "M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z",
    ]);
  }

  function cpoTabGlyph(kind) {
    if (kind === "styles") {
      // Lucide sparkle
      return cpoLucideSvg("cpo-tab-glyph", 13, [
        "M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6L12 3z",
        "M5 16l.8 2.2L8 19l-2.2.8L5 22l-.8-2.2L2 19l2.2-.8L5 16z",
        "M19 13l.6 1.6L21 15l-1.4.6L19 17l-.6-1.4L17 15l1.4-.6L19 13z",
      ]);
    }
    if (kind === "commands") {
      // Lucide zap
      return cpoLucideSvg("cpo-tab-glyph", 13, ["M13 2L3 14h9l-1 8 10-12h-9l1-8z"]);
    }
    // Lucide settings (simplified gear)
    return cpoLucideSvg("cpo-tab-glyph", 13, [
      "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
      "M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9c.36.31.83.47 1.31.43H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z",
    ]);
  }

  function cpoCloseGlyph() {
    const svgNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("class", "cpo-close-glyph");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("width", "18");
    svg.setAttribute("height", "18");
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", "1.8");
    svg.setAttribute("stroke-linecap", "round");
    svg.setAttribute("aria-hidden", "true");
    const path = document.createElementNS(svgNS, "path");
    path.setAttribute("d", "M18 6L6 18M6 6l12 12");
    path.setAttribute("fill", "none");
    path.setAttribute("stroke", "currentColor");
    path.setAttribute("stroke-width", "1.8");
    path.setAttribute("stroke-linecap", "round");
    svg.appendChild(path);
    return svg;
  }

  function cpoHelpGlyph() {
    const svgNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("class", "cpo-help-glyph");
    svg.setAttribute("viewBox", "0 0 16 16");
    svg.setAttribute("width", "12");
    svg.setAttribute("height", "12");
    svg.setAttribute("aria-hidden", "true");
    const circle = document.createElementNS(svgNS, "circle");
    circle.setAttribute("cx", "8");
    circle.setAttribute("cy", "8");
    circle.setAttribute("r", "6.2");
    circle.setAttribute("fill", "none");
    circle.setAttribute("stroke", "currentColor");
    circle.setAttribute("stroke-width", "1.4");
    const q = document.createElementNS(svgNS, "path");
    q.setAttribute("d", "M5.8 6.1c0-1.2.9-2 2.2-2s2.2.8 2.2 1.9c0 .9-.5 1.4-1.3 1.8-.5.3-.7.5-.7 1.1v.3");
    q.setAttribute("fill", "none");
    q.setAttribute("stroke", "currentColor");
    q.setAttribute("stroke-width", "1.4");
    q.setAttribute("stroke-linecap", "round");
    const dot = document.createElementNS(svgNS, "circle");
    dot.setAttribute("cx", "8");
    dot.setAttribute("cy", "11.6");
    dot.setAttribute("r", "0.85");
    dot.setAttribute("fill", "currentColor");
    svg.appendChild(circle);
    svg.appendChild(q);
    svg.appendChild(dot);
    return svg;
  }

  function cpoRefreshIcon() {
    const svgNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("class", "cpo-refresh-icon");
    svg.setAttribute("viewBox", "0 0 16 16");
    svg.setAttribute("width", "15");
    svg.setAttribute("height", "15");
    svg.setAttribute("aria-hidden", "true");
    const arc = document.createElementNS(svgNS, "path");
    arc.setAttribute("d", "M13.2 8A5.2 5.2 0 1 1 11.4 3.6");
    arc.setAttribute("fill", "none");
    arc.setAttribute("stroke", "currentColor");
    arc.setAttribute("stroke-width", "1.6");
    arc.setAttribute("stroke-linecap", "round");
    const head = document.createElementNS(svgNS, "path");
    head.setAttribute("d", "M11.1 1.6v3.2h3.2");
    head.setAttribute("fill", "none");
    head.setAttribute("stroke", "currentColor");
    head.setAttribute("stroke-width", "1.6");
    head.setAttribute("stroke-linecap", "round");
    head.setAttribute("stroke-linejoin", "round");
    svg.appendChild(arc);
    svg.appendChild(head);
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

  function cloneCommands(commands) {
    return normalizeCommands(commands).map((c) => ({ ...c }));
  }

  function openSettingsPanelDomSafe(opts) {
    closeSettingsPanel();
    const settings = loadSettings();
    let draftStyles = cloneStyles(settings.styles);
    let activeId = settings.style;
    if (!draftStyles.some((s) => s.id === activeId)) activeId = "structured";
    let draftCommands = cloneCommands(settings.commands);
    let activeCommandId = settings.activeCommandId || DEFAULT_COMMAND_ID;
    if (!draftCommands.some((c) => c.id === activeCommandId)) activeCommandId = draftCommands[0].id;
    let protocolValue = settings.protocol === "anthropic" ? "anthropic" : "openai";
    let mainTab =
      opts && typeof opts === "object" && ["styles", "commands", "model"].includes(opts.tab)
        ? opts.tab
        : "styles";

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
    const modelFetchBtn = cpoEl("button", {
      type: "button",
      className: "cpo-field-icon-btn cpo-model-fetch-btn",
      title: "拉取可用模型",
      "aria-label": "拉取可用模型",
    });
    modelFetchBtn.appendChild(cpoRefreshIcon());
    const modelPickTrigger = cpoEl("button", {
      type: "button",
      className: "cpo-field-icon-btn cpo-model-pick-btn",
      title: "从已拉取列表选择",
      "aria-label": "从已拉取列表选择",
      "aria-haspopup": "listbox",
      "aria-expanded": "false",
    });
    modelPickTrigger.appendChild(cpoCaret());
    const modelPickMenu = cpoEl("div", {
      className: "cpo-dd-menu cpo-model-pick-menu",
      role: "listbox",
      "aria-label": "模型列表",
      hidden: "true",
    });
    // Combo owns the menu so the list spans the full Model input width (not the tiny caret).
    const modelPickDd = cpoEl("div", { className: "cpo-dd cpo-model-combo" }, [
      modelEl,
      modelPickTrigger,
      modelPickMenu,
    ]);
    let fetchedModelIds = Array.isArray(settings.modelIds) ? settings.modelIds.slice() : [];
    const modelRow = cpoEl("div", { className: "cpo-model-row" }, [modelPickDd, modelFetchBtn]);
    const warnEl = cpoEl("div", { className: "cpo-warn-banner", hidden: "true" });

    const segment = cpoEl("div", { className: "cpo-segment cpo-segment-sm", role: "tablist" });
    const styleDd = cpoEl("div", { className: "cpo-dd cpo-style-dd" });
    const styleDdTrigger = cpoEl("button", {
      type: "button",
      className: "cpo-dd-trigger",
      "aria-haspopup": "listbox",
      "aria-expanded": "false",
    });
    const styleDdValue = cpoEl("span", { className: "cpo-dd-value", text: "暂无自定义 · 点击新增" });
    styleDdTrigger.appendChild(styleDdValue);
    styleDdTrigger.appendChild(cpoCaret());
    const styleDdMenu = cpoEl("div", {
      className: "cpo-dd-menu",
      role: "listbox",
      hidden: "true",
    });
    styleDd.appendChild(styleDdTrigger);
    styleDd.appendChild(styleDdMenu);
    const styleAddBtn = cpoEl("button", {
      type: "button",
      className: "cpo-btn-add",
      text: "+ 新增",
      title: "新增自定义风格",
    });

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
    const promptHelp = cpoEl("button", {
      type: "button",
      className: "cpo-prompt-help",
      title:
        "默认风格不可删除，system prompt 不可修改。自定义风格可改名与 system prompt；下拉项右侧 × 可删除。",
      "aria-label": "系统提示词说明",
    });
    promptHelp.appendChild(cpoHelpGlyph());

    const commandDd = cpoEl("div", { className: "cpo-dd cpo-command-dd" });
    const commandDdTrigger = cpoEl("button", {
      type: "button",
      className: "cpo-dd-trigger",
      "aria-haspopup": "listbox",
      "aria-expanded": "false",
    });
    const commandDdValue = cpoEl("span", { className: "cpo-dd-value", text: "选择命令" });
    commandDdTrigger.appendChild(commandDdValue);
    commandDdTrigger.appendChild(cpoCaret());
    const commandDdMenu = cpoEl("div", {
      className: "cpo-dd-menu",
      role: "listbox",
      "aria-label": "快捷命令",
      hidden: "true",
    });
    commandDd.appendChild(commandDdTrigger);
    commandDd.appendChild(commandDdMenu);
    const commandTitleEl = cpoEl("input", {
      "data-cpo": "commandTitle",
      type: "text",
      spellcheck: "false",
      placeholder: "例如：继续",
    });
    const commandContentEl = cpoEl("textarea", {
      "data-cpo": "commandContent",
      placeholder: "例如：继续 或 /navigate-software-development",
      rows: "5",
    });
    const commandHintEl = cpoEl("div", {
      className: "cpo-lock-hint",
      text: "标题显示在 Composer 按钮上；内容为点击后填入并自动发送的文本。下拉可切换、新增或删除。",
    });

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

    const mainTabBar = cpoEl("div", { className: "cpo-main-tabs", role: "tablist", "aria-label": "设置分区" });
    const paneStyles = cpoEl("section", {
      className: "cpo-pane",
      "data-pane": "styles",
      role: "tabpanel",
    });
    const paneCommands = cpoEl("section", {
      className: "cpo-pane",
      "data-pane": "commands",
      role: "tabpanel",
      hidden: "true",
    });
    const paneModel = cpoEl("section", {
      className: "cpo-pane",
      "data-pane": "model",
      role: "tabpanel",
      hidden: "true",
    });

    function clearModelMenuFixed(menu) {
      if (!(menu instanceof HTMLElement)) return;
      for (const prop of ["position", "left", "top", "width", "max-width", "right", "z-index"]) {
        menu.style.removeProperty(prop);
      }
    }

    function placeModelMenuFixed(menu, anchor) {
      if (!(menu instanceof HTMLElement) || !(anchor instanceof HTMLElement)) return;
      const rect = anchor.getBoundingClientRect();
      const width = Math.round(Math.min(Math.max(rect.width, 160), Math.min(rect.width, window.innerWidth - 16)));
      let left = Math.round(rect.left);
      const maxLeft = Math.max(8, window.innerWidth - width - 8);
      if (left > maxLeft) left = maxLeft;
      if (left < 8) left = 8;
      let top = Math.round(rect.bottom + 4);
      if (top + 160 > window.innerHeight - 8) {
        top = Math.max(8, Math.round(rect.top - 4 - Math.min(220, rect.top - 8)));
      }
      // !important — CSS must not force width:100% of the viewport when position:fixed
      menu.style.setProperty("position", "fixed", "important");
      menu.style.setProperty("left", `${left}px`, "important");
      menu.style.setProperty("top", `${top}px`, "important");
      menu.style.setProperty("width", `${width}px`, "important");
      menu.style.setProperty("max-width", `${width}px`, "important");
      menu.style.setProperty("right", "auto", "important");
      menu.style.setProperty("z-index", "2147483000", "important");
    }

    function closeAllMenus(except) {
      for (const dd of [protocolDd, styleDd, commandDd, modelPickDd]) {
        if (except && dd === except) continue;
        const menu = dd.querySelector(".cpo-dd-menu");
        const trigger = dd.querySelector(".cpo-dd-trigger, .cpo-model-pick-btn");
        if (menu) {
          menu.hidden = true;
          if (dd === modelPickDd) clearModelMenuFixed(menu);
        }
        if (trigger) trigger.setAttribute("aria-expanded", "false");
        dd.classList.remove("is-open");
      }
    }

    function toggleMenu(dd) {
      const menu = dd.querySelector(".cpo-dd-menu");
      const trigger = dd.querySelector(".cpo-dd-trigger, .cpo-model-pick-btn");
      const willOpen = !!(menu && menu.hidden);
      closeAllMenus(willOpen ? dd : null);
      if (!menu || !trigger) return;
      menu.hidden = !willOpen;
      trigger.setAttribute("aria-expanded", willOpen ? "true" : "false");
      dd.classList.toggle("is-open", willOpen);
      if (dd === modelPickDd) {
        if (willOpen) placeModelMenuFixed(menu, modelPickDd);
        else clearModelMenuFixed(menu);
      }
    }

    function rebuildModelPickMenu(ids, { open = false } = {}) {
      fetchedModelIds = Array.isArray(ids) ? ids.slice() : [];
      modelPickMenu.replaceChildren();
      if (!fetchedModelIds.length) {
        modelPickMenu.appendChild(
          cpoEl("div", { className: "cpo-dd-empty", text: "先点右侧刷新拉取模型" }),
        );
      } else {
        const current = modelEl.value.trim();
        for (const id of fetchedModelIds) {
          const btn = cpoEl("button", {
            type: "button",
            className: "cpo-dd-item",
            role: "option",
            "data-value": id,
            text: id,
          });
          if (id === current) btn.setAttribute("aria-selected", "true");
          btn.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            modelEl.value = id;
            updateMismatchWarn();
            closeAllMenus();
          });
          modelPickMenu.appendChild(btn);
        }
      }
      if (open) toggleMenu(modelPickDd);
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
      if (isLockedStyle(cur.id)) {
        cur.name = (defaultStyleList().find((d) => d.id === cur.id) || cur).name;
        cur.systemPrompt = DEFAULT_SYSTEM_PROMPTS[cur.id] || DEFAULT_SYSTEM_PROMPTS.structured;
        return;
      }
      cur.name = styleNameEl.value.trim() || cur.name || "自定义";
      const prompt = stylePromptEl.value;
      cur.systemPrompt = prompt.trim() ? prompt : DEFAULT_SYSTEM_PROMPTS.structured;
    }

    function commitCommandEditor() {
      const cur = draftCommands.find((c) => c.id === activeCommandId);
      if (!cur) return;
      cur.title = commandTitleEl.value.trim() || cur.title || CONTINUE_PROMPT_TEXT;
      cur.content = commandContentEl.value.trim() || cur.content || cur.title;
    }

    function paintEditor() {
      const cur = ensureStylePrompt(draftStyles.find((s) => s.id === activeId));
      if (!cur) return;
      const idx = draftStyles.findIndex((s) => s.id === activeId);
      if (idx >= 0) draftStyles[idx] = cur;

      const locked = isLockedStyle(cur.id);
      styleNameEl.value = cur.name;
      styleNameEl.disabled = locked;
      stylePromptEl.value = locked
        ? DEFAULT_SYSTEM_PROMPTS[cur.id] || cur.systemPrompt || ""
        : cur.systemPrompt || "";
      stylePromptEl.readOnly = locked;
      stylePromptEl.disabled = locked;
      promptHelp.title = locked
        ? "默认风格不可删除，system prompt 不可修改"
        : "自定义风格可改名与 system prompt；下拉项右侧 × 可删除";

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
        styleDdValue.textContent = "暂无自定义 · 点击新增";
        styleDd.classList.remove("has-value");
      }

      styleDdMenu.querySelectorAll("[data-style-id]").forEach((row) => {
        row.setAttribute("aria-selected", row.getAttribute("data-style-id") === activeId ? "true" : "false");
      });
    }

    function paintCommandEditor() {
      const cur = draftCommands.find((c) => c.id === activeCommandId) || draftCommands[0];
      if (!cur) return;
      activeCommandId = cur.id;
      commandTitleEl.value = cur.title || "";
      commandContentEl.value = cur.content || "";
      commandDdValue.textContent = cur.title || "未命名";
      commandDd.classList.add("has-value");
      commandDdMenu.querySelectorAll("[data-command-id]").forEach((row) => {
        row.setAttribute("aria-selected", row.getAttribute("data-command-id") === activeCommandId ? "true" : "false");
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

    function addCommand() {
      commitCommandEditor();
      const id = typeof newCommandId === "function" ? newCommandId() : `cmd_${Date.now().toString(36)}`;
      const n = draftCommands.length + 1;
      draftCommands.push({
        id,
        title: `命令 ${n}`,
        content: typeof CONTINUE_PROMPT_TEXT === "string" ? CONTINUE_PROMPT_TEXT : "继续",
      });
      activeCommandId = id;
      rebuildCommandUi();
      closeAllMenus();
    }

    function removeCommand(id) {
      if (draftCommands.length <= 1) {
        showToast("至少保留一条快捷命令", "warn");
        return;
      }
      commitCommandEditor();
      draftCommands = draftCommands.filter((c) => c.id !== id);
      if (activeCommandId === id) activeCommandId = draftCommands[0].id;
      rebuildCommandUi();
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
      if (!customs.length) {
        styleDdMenu.appendChild(
          cpoEl("div", { className: "cpo-dd-empty", text: "暂无自定义风格，点右侧「新增」" }),
        );
      }
    }

    function rebuildStyleUi() {
      rebuildDefaultTabs();
      rebuildStyleMenu();
      paintEditor();
    }

    function rebuildCommandMenu() {
      commandDdMenu.textContent = "";
      for (const cmd of draftCommands) {
        const row = cpoEl("div", {
          className: "cpo-dd-row",
          "data-command-id": cmd.id,
          role: "option",
          "aria-selected": "false",
        });
        const pick = cpoEl("button", {
          type: "button",
          className: "cpo-dd-item",
          text: cmd.title || "未命名",
        });
        pick.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          commitCommandEditor();
          activeCommandId = cmd.id;
          paintCommandEditor();
          closeAllMenus();
        });
        const xBtn = cpoEl("button", {
          type: "button",
          className: "cpo-dd-x",
          title: "删除此命令",
          "aria-label": `删除 ${cmd.title || "命令"}`,
          text: "×",
        });
        xBtn.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          removeCommand(cmd.id);
        });
        row.appendChild(pick);
        row.appendChild(xBtn);
        commandDdMenu.appendChild(row);
      }
      const addBtn = cpoEl("button", {
        type: "button",
        className: "cpo-dd-add",
        text: "＋ 新增命令",
      });
      addBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        addCommand();
      });
      commandDdMenu.appendChild(addBtn);
    }

    function rebuildCommandUi() {
      rebuildCommandMenu();
      paintCommandEditor();
    }

    function setMainTab(next) {
      const id = SETTINGS_TABS.some((t) => t.id === next) ? next : "styles";
      if (mainTab === "styles" && id !== "styles") commitCurrent();
      if (mainTab === "commands" && id !== "commands") commitCommandEditor();
      mainTab = id;
      mainTabBar.querySelectorAll("[data-main-tab]").forEach((btn) => {
        btn.setAttribute("aria-selected", btn.getAttribute("data-main-tab") === id ? "true" : "false");
      });
      paneStyles.hidden = id !== "styles";
      paneCommands.hidden = id !== "commands";
      paneModel.hidden = id !== "model";
      closeAllMenus();
    }

    for (const tab of SETTINGS_TABS) {
      const btn = cpoEl("button", {
        type: "button",
        className: "cpo-main-tab",
        "data-main-tab": tab.id,
        role: "tab",
        text: tab.label,
        "aria-selected": tab.id === "styles" ? "true" : "false",
      });
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        setMainTab(tab.id);
      });
      mainTabBar.appendChild(btn);
    }

    paneStyles.append(
      cpoEl("div", { className: "cpo-styles-compact" }, [
        cpoEl("div", { className: "cpo-inline-row" }, [cpoSecTitle("风格"), segment]),
        cpoEl("div", { className: "cpo-custom-block" }, [
          cpoEl("div", { className: "cpo-inline-row" }, [cpoSecTitle("自定义"), styleAddBtn]),
          styleDd,
        ]),
        cpoEl("div", { className: "cpo-field cpo-field-name" }, [
          cpoSecTitle("名称"),
          styleNameEl,
        ]),
      ]),
      cpoEl("div", { className: "cpo-prompt-panel" }, [
        cpoEl("div", { className: "cpo-prompt-head-row" }, [
          cpoSecTitle("System prompt", { strong: true }),
          promptHelp,
        ]),
        stylePromptEl,
      ]),
    );

    paneCommands.append(
      cpoEl("div", { className: "cpo-field" }, [cpoSecTitle("当前命令"), commandDd]),
      cpoEl("div", { className: "cpo-hint-row" }, [cpoInfoGlyph(), commandHintEl]),
      cpoEl("div", { className: "cpo-field" }, [cpoSecTitle("标题"), commandTitleEl]),
      cpoEl("div", { className: "cpo-field cpo-field-grow" }, [cpoSecTitle("内容"), commandContentEl]),
    );

    paneModel.append(
      cpoEl("div", { className: "cpo-fields" }, [
        cpoEl("div", { className: "cpo-field cpo-span2" }, [cpoSecTitle("协议"), protocolDd]),
        cpoEl("div", { className: "cpo-field cpo-span2" }, [cpoSecTitle("Base URL"), baseUrlEl]),
        cpoEl("div", { className: "cpo-field" }, [cpoSecTitle("API Key"), apiKeyEl]),
        cpoEl("div", { className: "cpo-field" }, [cpoSecTitle("Model"), modelRow]),
      ]),
      warnEl,
    );

    rebuildProtocolMenu();
    setProtocol(protocolValue);
    baseUrlEl.value = settings.baseUrl || "";
    apiKeyEl.value = settings.apiKey || "";
    modelEl.value = settings.model || "";
    modelEl.addEventListener("input", updateMismatchWarn);
    baseUrlEl.addEventListener("input", updateMismatchWarn);
    updateMismatchWarn();

    rebuildModelPickMenu(fetchedModelIds);
    modelPickTrigger.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (!fetchedModelIds.length) {
        showToast("请先点刷新拉取模型", "warn");
        return;
      }
      toggleMenu(modelPickDd);
    });

    let modelFetchBusy = false;
    modelFetchBtn.addEventListener("click", async (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (modelFetchBusy) return;
      const baseUrl = baseUrlEl.value.trim();
      const apiKey = apiKeyEl.value.trim();
      if (!baseUrl) {
        showToast("请先填写 Base URL", "warn");
        return;
      }
      if (!apiKey) {
        showToast("请先填写 API Key", "warn");
        return;
      }
      modelFetchBusy = true;
      modelFetchBtn.classList.add("is-loading");
      modelFetchBtn.disabled = true;
      try {
        const ids = await listRemoteModels({
          protocol: protocolValue,
          baseUrl,
          apiKey,
        });
        if (!ids.length) {
          rebuildModelPickMenu([]);
          showToast("未获取到模型列表（检查 Base URL / Key / 协议）", "warn");
        } else {
          if (!modelEl.value.trim() || !ids.includes(modelEl.value.trim())) {
            modelEl.value = ids[0];
            updateMismatchWarn();
          }
          rebuildModelPickMenu(ids, { open: true });
          showToast(`已拉取 ${ids.length} 个模型`, "ok");
          try {
            const cur = loadSettings();
            saveSettings({ ...cur, modelIds: ids.slice() });
          } catch (_) {
            /* ignore */
          }
        }
      } catch (error) {
        showToast(collapseWs(error?.message || "拉取模型失败").slice(0, 160), "error");
      } finally {
        modelFetchBusy = false;
        modelFetchBtn.classList.remove("is-loading");
        modelFetchBtn.disabled = false;
      }
    });
    rebuildStyleUi();
    rebuildCommandUi();
    setMainTab(mainTab);

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
    styleAddBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      closeAllMenus();
      addCustomStyle();
    });
    commandDdTrigger.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      toggleMenu(commandDd);
    });
    commandTitleEl.addEventListener("input", () => {
      commandDdValue.textContent = commandTitleEl.value.trim() || "未命名";
    });

    const closeIconBtn = cpoEl("button", {
      type: "button",
      className: "cpo-close-x",
      "data-cpo-action": "close",
      title: "关闭",
      "aria-label": "关闭",
    });
    closeIconBtn.appendChild(cpoCloseGlyph());

    const card = cpoEl("div", { className: "cpo-card", role: "dialog", "aria-modal": "true", "aria-label": "PromptSpark" }, [
      cpoEl("header", { className: "cpo-sheet-head" }, [cpoBrandBlock(), closeIconBtn]),
      cpoEl("div", { className: "cpo-nav-wrap" }, [mainTabBar]),
      cpoEl("div", { className: "cpo-pane-host" }, [paneStyles, paneCommands, paneModel]),
      cpoEl("footer", { className: "cpo-sheet-foot" }, [
        cpoEl(
          "a",
          {
            className: "cpo-github",
            href: GITHUB_URL,
            target: "_blank",
            rel: "noopener noreferrer",
            title: "GitHub · PromptSpark",
            "aria-label": "打开 PromptSpark GitHub",
          },
          [cpoGitHubIcon()],
        ),
        cpoEl("div", { className: "cpo-sheet-actions" }, [
          cpoEl("button", { type: "button", className: "cpo-btn", "data-cpo-action": "close", text: "取消" }),
          cpoEl("button", { type: "button", className: "cpo-btn cpo-btn-fill", "data-cpo-action": "save", text: "存储" }),
        ]),
      ]),
    ]);
    overlay.appendChild(card);

    overlay.querySelector(".cpo-github")?.addEventListener("click", (event) => {
      event.stopPropagation();
    });

    function draftSnapshot() {
      commitCurrent();
      commitCommandEditor();
      return JSON.stringify({
        protocol: protocolValue === "anthropic" ? "anthropic" : "openai",
        baseUrl: baseUrlEl.value.trim(),
        apiKey: apiKeyEl.value.trim(),
        model: modelEl.value.trim(),
        style: activeId,
        styles: draftStyles.map((s) => ({
          id: s.id,
          name: s.name,
          systemPrompt: String(s.systemPrompt || ""),
        })),
        commands: draftCommands.map((c) => ({
          id: c.id,
          title: c.title,
          content: c.content,
        })),
        activeCommandId,
      });
    }
    // Stabilize commits once, then freeze baseline after focus so open/focus
    // side-effects do not mark the sheet dirty.
    let initialSnapshot = draftSnapshot();

    function isDirty() {
      return draftSnapshot() !== initialSnapshot;
    }

    const confirmStayBtn = cpoEl("button", {
      type: "button",
      className: "cpo-confirm-btn",
      "data-cpo-confirm": "stay",
      text: "继续编辑",
    });
    const confirmLeaveBtn = cpoEl("button", {
      type: "button",
      className: "cpo-confirm-btn cpo-confirm-btn-danger",
      "data-cpo-confirm": "leave",
      text: "放弃并关闭",
    });
    const confirmDialog = cpoEl("div", { className: "cpo-confirm-dialog" }, [
      cpoEl("h3", { className: "cpo-confirm-title", text: "未存储的修改" }),
      cpoEl("p", { className: "cpo-confirm-msg", text: "关闭后将丢失本次未保存的改动。" }),
      cpoEl("div", { className: "cpo-confirm-actions" }, [confirmStayBtn, confirmLeaveBtn]),
    ]);
    const confirmLayer = cpoEl(
      "div",
      {
        className: "cpo-confirm",
        role: "alertdialog",
        "aria-modal": "true",
        "aria-label": "未存储确认",
      },
      [confirmDialog],
    );
    card.appendChild(confirmLayer);

    function hideCloseConfirm() {
      confirmLayer.classList.remove("is-open");
    }

    function showCloseConfirm() {
      closeAllMenus();
      confirmLayer.classList.add("is-open");
      confirmStayBtn.focus();
    }

    function requestClose() {
      if (!isDirty()) {
        closeSettingsPanel();
        return;
      }
      if (confirmLayer.classList.contains("is-open")) return;
      showCloseConfirm();
    }

    confirmStayBtn.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      hideCloseConfirm();
    });
    confirmLeaveBtn.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      closeSettingsPanel();
    });
    confirmLayer.addEventListener("click", (event) => {
      if (event.target === confirmLayer) {
        event.preventDefault();
        hideCloseConfirm();
      }
    });
    confirmDialog.addEventListener("click", (event) => {
      event.stopPropagation();
    });

    // Scrim click must not close the sheet — only 关闭 / 取消（确认后）.
    overlay.addEventListener("click", (event) => {
      if (!(event.target instanceof Element) || !event.target.closest(".cpo-dd")) {
        closeAllMenus();
      }
    });
    overlay.querySelectorAll('[data-cpo-action="close"]').forEach((btn) => {
      btn.addEventListener("click", (event) => {
        event.preventDefault();
        requestClose();
      });
    });
    overlay.querySelector('[data-cpo-action="save"]').addEventListener("click", async (event) => {
      event.preventDefault();
      commitCurrent();
      commitCommandEditor();
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
        setMainTab("model");
        baseUrlEl.focus();
        return;
      }
      draftStyles = cloneStyles(draftStyles);
      if (!draftStyles.some((s) => s.id === activeId)) activeId = "structured";
      draftCommands = cloneCommands(draftCommands);
      if (!draftCommands.some((c) => c.id === activeCommandId)) activeCommandId = draftCommands[0].id;
      const stored = saveSettings({
        protocol,
        baseUrl,
        apiKey: apiKeyEl.value.trim(),
        model,
        style: activeId,
        styles: draftStyles.map((s) => {
          const row = ensureStylePrompt(s);
          if (!isLockedStyle(row.id)) return row;
          return {
            ...row,
            name: (defaultStyleList().find((d) => d.id === row.id) || row).name,
            systemPrompt: DEFAULT_SYSTEM_PROMPTS[row.id] || DEFAULT_SYSTEM_PROMPTS.structured,
          };
        }),
        commands: draftCommands,
        activeCommandId,
        modelIds: fetchedModelIds.slice(),
      });
      try {
        refreshContinueButtonAppearance();
      } catch (_) {
        /* ignore */
      }
      closeSettingsPanel();
      let disk = { ok: false, reason: "skipped" };
      try {
        if (typeof pushSettingsToDisk === "function") {
          disk = await pushSettingsToDisk(stored);
        }
      } catch (_) {
        disk = { ok: false, reason: "error" };
      }
      if (disk?.ok) {
        showToast("已存储", "ok");
      } else if (disk?.reason === "old-proxy") {
        showToast("已存到缓存；代理过旧，请完全退出 Cursor 后再开，否则更新插件可能丢失", "warn");
      } else {
        showToast("已存到缓存；磁盘同步失败，更新插件前请确认扩展代理已启动", "warn");
      }
    });
    overlay.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        if (confirmLayer.classList.contains("is-open")) {
          hideCloseConfirm();
          return;
        }
        if (overlay.querySelector(".cpo-dd.is-open")) {
          closeAllMenus();
          return;
        }
        // Same as 取消 — no header close button.
        requestClose();
      }
    });

    document.documentElement.appendChild(overlay);
    if (stylePromptEl.disabled) {
      if (mainTab === "model") baseUrlEl.focus();
      else if (mainTab === "commands") commandTitleEl.focus();
      else styleDdTrigger.focus();
    } else {
      stylePromptEl.focus();
    }
    queueMicrotask(() => {
      initialSnapshot = draftSnapshot();
    });
  }
