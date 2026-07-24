/* injected: multi-host adapters (Cursor / Devin / Antigravity) */
  function detectHost() {
    try {
      const href = String(location?.href || "");
      const title = String(document.title || "");
      const product = window.product?.nameShort || window.product?.nameLong || "";
      const blob = `${href}\n${title}\n${product}`.toLowerCase();
      if (/antigravity|jetski|workbench-jetski/.test(blob) || document.querySelector("[class*='jetski'],[class*='antigravity']")) {
        return "antigravity";
      }
      if (/devin|windsurf|cascade/.test(blob) || document.querySelector(".cascade-panel,[class*='cascade']")) {
        return "devin";
      }
      if (/cursor|anysphere/.test(blob) || document.querySelector(".composer-bar,.composer-bar-input-buttons")) {
        return "cursor";
      }
      if (/openai\.com\/codex|codex\.app|__codexSessionDeleteBridge/.test(blob) || typeof window.__codexSessionDeleteBridge === "function") {
        return "codex";
      }
      if (document.querySelector(".monaco-workbench")) return "cursor";
      return "codex";
    } catch (_) {
      return "codex";
    }
  }

  HOST = detectHost();

  function refreshHost() {
    HOST = detectHost();
    return HOST;
  }

  function findWorkbenchChatInput() {
    const selectors = [
      ".composer-input [contenteditable='true']",
      ".composer-input-container [contenteditable='true']",
      ".composer-input .ProseMirror",
      ".composer-input [role='textbox']",
      ".aislash-editor-input",
      ".chat-input-container [contenteditable='true']",
      "[contenteditable='true'][role='textbox']",
      "textarea.composer-input",
    ];
    for (const sel of selectors) {
      const nodes = Array.from(document.querySelectorAll(sel));
      for (const el of nodes) {
        if (!(el instanceof HTMLElement) || !isVisible(el) || isInSidebar(el)) continue;
        const r = el.getBoundingClientRect();
        if (r.width < 80 || r.height < 18 || r.top < window.innerHeight * 0.2) continue;
        return el;
      }
    }
    return null;
  }

  /**
   * Cursor DOM:
   *   .composer-bar-input-buttons > .button-container.composer-button-area > [attach][mic]...
   * Place as the first child of .composer-button-area (leftmost of right tools).
   */
  function findWorkbenchButtonMount() {
    const areas = Array.from(
      document.querySelectorAll(
        ".composer-bar-input-buttons .composer-button-area, .composer-bar-input-buttons .button-container, .composer-button-area",
      ),
    );
    for (const el of areas) {
      if (!(el instanceof HTMLElement) || !isVisible(el) || isInSidebar(el)) continue;
      // Must be the right tool cluster (has attach/mic), not left mode pills
      const hasTool = !!el.querySelector(
        "button, a, [role='button'], .codicon-attach, .codicon-mic, [class*='paperclip'], [class*='microphone']",
      );
      if (!hasTool) continue;
      const r = el.getBoundingClientRect();
      if (r.top < window.innerHeight * 0.25) continue;
      if (r.height < 12) continue;
      // Prefer right half
      if (r.left < window.innerWidth * 0.35) continue;
      const first = Array.from(el.children).find(
        (n) => n instanceof HTMLElement && !n.hasAttribute?.(BUTTON_ATTR),
      );
      return { mount: el, before: first || null };
    }

    // Universal fallback: leftmost of right-side attach/mic/send siblings
    const input = findWorkbenchChatInput();
    const bandTop = input ? input.getBoundingClientRect().top - 12 : window.innerHeight * 0.45;
    const candidates = [];
    for (const el of document.querySelectorAll("button, a, [role='button']")) {
      if (!(el instanceof HTMLElement) || !isVisible(el) || isInSidebar(el)) continue;
      if (el.hasAttribute?.(BUTTON_ATTR)) continue;
      const label = elementLabel(el);
      if (/智能体|自动|agent|auto|mode/i.test(label) && !/send|attach|mic/i.test(label)) continue;
      const looks =
        /attach|attachment|paperclip|麦克风|voice|mic|send|发送|上传/i.test(label) ||
        !!el.querySelector?.(".codicon-attach, .codicon-mic, .codicon-send, [class*='paperclip']");
      if (!looks) continue;
      const r = el.getBoundingClientRect();
      if (r.top < bandTop - 30 || r.left < window.innerWidth * 0.4) continue;
      candidates.push({ el, left: r.left });
    }
    if (!candidates.length) return null;
    candidates.sort((a, b) => a.left - b.left);
    const leftmost = candidates[0].el;
    const mount = leftmost.parentElement;
    if (!(mount instanceof HTMLElement)) return null;
    return { mount, before: leftmost };
  }

  function getOrCreateStableButton() {
    let button = runtime.button;
    if (button instanceof HTMLElement && button.isConnected && button.dataset.version === SCRIPT_VERSION) {
      return button;
    }
    button = document.querySelector(`[${BUTTON_ATTR}]`);
    if (button instanceof HTMLElement && button.dataset.version === SCRIPT_VERSION) {
      runtime.button = button;
      return button;
    }
    button?.remove();
    button = createButton();
    runtime.button = button;
    return button;
  }

  function placeButtonBefore(button, mount, before) {
    if (!(button instanceof HTMLElement) || !(mount instanceof HTMLElement)) return false;
    try {
      if (before && before.parentElement === mount && before !== button) {
        if (button.parentElement === mount && button.nextElementSibling === before) return false;
        mount.insertBefore(button, before);
        return true;
      }
      if (button.parentElement === mount && mount.firstElementChild === button) return false;
      if (mount.firstChild) mount.insertBefore(button, mount.firstChild);
      else mount.appendChild(button);
      return true;
    } catch (_) {
      try {
        mount.appendChild(button);
        return true;
      } catch (__) {
        return false;
      }
    }
  }

  function syncButtonChrome(button, mount) {
    if (!(button instanceof HTMLElement)) return;
    // Match peer icon buttons: no box, same row alignment
    button.style.cssText = [
      "display:inline-flex",
      "align-items:center",
      "justify-content:center",
      "width:24px",
      "height:24px",
      "min-width:24px",
      "margin:0 2px 0 0",
      "padding:0",
      "border:none",
      "background:transparent",
      "box-shadow:none",
      "outline:none",
      "flex:0 0 auto",
      "align-self:center",
      "position:relative",
      "top:0",
      "vertical-align:middle",
      "cursor:pointer",
    ].join(";");
    // Mirror peer button size if available
    const peer = mount?.querySelector?.("button:not([" + BUTTON_ATTR + "])");
    if (peer instanceof HTMLElement) {
      const cs = window.getComputedStyle(peer);
      const w = peer.getBoundingClientRect();
      if (w.height >= 18 && w.height <= 36) {
        button.style.width = `${Math.round(w.width || w.height)}px`;
        button.style.height = `${Math.round(w.height)}px`;
        button.style.minWidth = button.style.width;
      }
      if (cs.borderRadius) button.style.borderRadius = cs.borderRadius;
    }
  }

  function ensureWorkbenchSparkleButton() {
    if (runtime.disposed) return;
    refreshHost();
    const button = getOrCreateStableButton();
    button.dataset.placement = "workbench-inline";

    const spot = findWorkbenchButtonMount();
    if (spot?.mount) {
      const float = document.querySelector(`[${FLOAT_HOST_ATTR}]`);
      if (float && float !== spot.mount && !float.contains(button)) float.remove();

      placeButtonBefore(button, spot.mount, spot.before instanceof Element ? spot.before : null);
      syncButtonChrome(button, spot.mount);

      document.querySelectorAll(`[${BUTTON_ATTR}]`).forEach((node) => {
        if (node !== button) node.remove();
      });
      refreshButtonAppearance(button);
      bindComposerInputWatch();
      return;
    }

    if (button.isConnected && button.dataset.placement === "workbench-inline" && isVisible(button)) {
      refreshButtonAppearance(button);
      bindComposerInputWatch();
      return;
    }

    const host = ensureFloatingHost();
    button.dataset.placement = "float";
    if (button.parentElement !== host) host.appendChild(button);
    syncButtonChrome(button, host);
    refreshButtonAppearance(button);
    bindComposerInputWatch();
  }
