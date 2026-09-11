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
    svg.setAttribute("width", "16");
    svg.setAttribute("height", "16");
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

  function openSettingsPanelDomSafe() {
    closeSettingsPanel();
    const settings = loadSettings();
    let draftStyles = cloneStyles(settings.styles);
    let activeId = settings.style;
    if (!draftStyles.some((s) => s.id === activeId)) activeId = "structured";
    let draftCommands = cloneCommands(settings.commands);
    let activeCommandId = settings.activeCommandId || DEFAULT_COMMAND_ID;
    if (!draftCommands.some((c) => c.id === activeCommandId)) activeCommandId = draftCommands[0].id;
    let protocolValue = settings.protocol === "anthropic" ? "anthropic" : "openai";
    let mainTab = "styles";

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

    function closeAllMenus(except) {
      for (const dd of [protocolDd, styleDd, commandDd]) {
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
        content: "/navigate-software-development",
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
      cpoEl("div", { className: "cpo-block-head" }, [
        cpoEl("h3", { className: "cpo-h3", text: "风格" }),
        segment,
      ]),
      cpoEl("label", { className: "cpo-field" }, [cpoEl("span", { text: "自定义" }), styleDd]),
      styleLockHint,
      cpoEl("label", { className: "cpo-field" }, [cpoEl("span", { text: "名称" }), styleNameEl]),
      cpoEl("label", { className: "cpo-field cpo-field-grow" }, [cpoEl("span", { text: "System prompt" }), stylePromptEl]),
    );

    paneCommands.append(
      cpoEl("label", { className: "cpo-field" }, [cpoEl("span", { text: "当前命令" }), commandDd]),
      commandHintEl,
      cpoEl("label", { className: "cpo-field" }, [cpoEl("span", { text: "标题" }), commandTitleEl]),
      cpoEl("label", { className: "cpo-field cpo-field-grow" }, [cpoEl("span", { text: "内容" }), commandContentEl]),
    );

    paneModel.append(
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
    );

    rebuildProtocolMenu();
    setProtocol(protocolValue);
    baseUrlEl.value = settings.baseUrl || "";
    apiKeyEl.value = settings.apiKey || "";
    modelEl.value = settings.model || "";
    modelEl.addEventListener("input", updateMismatchWarn);
    baseUrlEl.addEventListener("input", updateMismatchWarn);
    updateMismatchWarn();
    rebuildStyleUi();
    rebuildCommandUi();
    setMainTab("styles");

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
    commandDdTrigger.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      toggleMenu(commandDd);
    });
    commandTitleEl.addEventListener("input", () => {
      commandDdValue.textContent = commandTitleEl.value.trim() || "未命名";
    });

    const card = cpoEl("div", { className: "cpo-card", role: "dialog", "aria-modal": "true", "aria-label": "PromptSpark" }, [
      cpoEl("header", { className: "cpo-sheet-head" }, [
        cpoEl("div", null, [
          cpoEl("h2", { text: "PromptSpark" }),
          cpoEl("p", { className: "cpo-sub", text: "优化 · 快捷命令 · Alt+点击打开设置" }),
        ]),
        cpoEl("button", { type: "button", className: "cpo-close", "data-cpo-action": "close", text: "关闭" }),
      ]),
      mainTabBar,
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
      saveSettings({
        protocol,
        baseUrl,
        apiKey: apiKeyEl.value.trim(),
        model,
        style: activeId,
        styles: draftStyles.map((s) => ensureStylePrompt(s)),
        commands: draftCommands,
        activeCommandId,
      });
      try {
        refreshContinueButtonAppearance();
      } catch (_) {
        /* ignore */
      }
      closeSettingsPanel();
      showToast("已存储", "ok");
    });
    overlay.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        const anyOpen =
          protocolDd.classList.contains("is-open") ||
          styleDd.classList.contains("is-open") ||
          commandDd.classList.contains("is-open");
        if (anyOpen) {
          closeAllMenus();
          return;
        }
        closeSettingsPanel();
      }
    });

    document.documentElement.appendChild(overlay);
    stylePromptEl.focus();
  }
