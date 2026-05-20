const PageMotion = (() => {
  const reduceMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  const hoverCapabilityQuery = window.matchMedia("(hover: hover) and (pointer: fine)");
  const activeHoverTargets = new WeakSet();
  const hoverStates = new WeakMap();
  const swapStates = new WeakMap();
  const visibilityStates = new WeakMap();
  const removalStates = new Map();
  let removalLayer = null;
  let fallbackStack = null;
  let reconciliationFrame = 0;

  function init() {
    document.documentElement.classList.add("motion-enabled");
    syncMotionPreference();
    bindPageLinks();
    bindHoverPops();
    preparePageEntrance();

    reduceMotionQuery.addEventListener?.("change", syncMotionPreference);
    window.addEventListener("pageshow", restorePageState);
  }

  function syncMotionPreference() {
    document.documentElement.classList.toggle("motion-reduce", reduceMotionQuery.matches);
  }

  function restorePageState() {
    document.body?.classList.remove("page-leaving");
    document.body?.classList.add("page-ready");
  }

  function preparePageEntrance() {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        document.body?.classList.add("page-ready");
      });
    });
  }

  function bindPageLinks() {
    document.addEventListener("click", event => {
      const link = event.target.closest("a[href]");
      if (!link || !shouldHandleLink(event, link)) return;

      event.preventDefault();
      navigateWithTransition(link.href);
    });
  }

  function shouldHandleLink(event, link) {
    if (event.defaultPrevented || reduceMotionQuery.matches) return false;
    if (event.button !== 0) return false;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false;
    if (link.target && link.target !== "_self") return false;
    if (link.hasAttribute("download")) return false;
    if (link.closest(".page-nav, .site-top-nav")) return false;

    const href = link.getAttribute("href");
    if (!href || href.startsWith("#")) return false;
    if (href.startsWith("javascript:") || href.startsWith("mailto:") || href.startsWith("tel:")) return false;
    if (document.body?.classList.contains("page-leaving")) return false;

    const currentUrl = new URL(window.location.href);
    const targetUrl = new URL(link.href, currentUrl);

    if (targetUrl.href === currentUrl.href) return false;
    if (isSameDocumentRoute(currentUrl, targetUrl)) return false;
    if (!isSameFolder(currentUrl, targetUrl)) return false;
    if (!targetUrl.pathname.toLowerCase().endsWith(".html")) return false;

    return true;
  }

  function isSameDocumentRoute(currentUrl, targetUrl) {
    return (
      currentUrl.protocol === targetUrl.protocol &&
      currentUrl.pathname === targetUrl.pathname &&
      currentUrl.search === targetUrl.search
    );
  }

  function isSameFolder(currentUrl, targetUrl) {
    if (currentUrl.protocol !== targetUrl.protocol) return false;

    const currentFolder = currentUrl.pathname.slice(0, currentUrl.pathname.lastIndexOf("/") + 1);
    const targetFolder = targetUrl.pathname.slice(0, targetUrl.pathname.lastIndexOf("/") + 1);

    if (currentUrl.protocol === "file:") {
      return currentFolder === targetFolder;
    }

    return currentUrl.origin === targetUrl.origin && currentFolder === targetFolder;
  }

  function navigateWithTransition(href) {
    if (!document.body || reduceMotionQuery.matches) {
      window.location.href = href;
      return;
    }

    document.body.classList.remove("page-ready");
    document.body.classList.add("page-leaving");

    window.setTimeout(() => {
      window.location.href = href;
    }, 220);
  }

  function animateSwap(element, render, options = {}) {
    if (!element || typeof render !== "function") {
      render?.();
      return Promise.resolve();
    }

    if (reduceMotionQuery.matches) {
      render();
      return Promise.resolve();
    }

    clearSwapState(element);

    const outMs = options.outMs ?? 140;
    const inMs = options.inMs ?? 240;

    return new Promise(resolve => {
      const state = {};
      swapStates.set(element, state);
      element.classList.add("motion-swap", "is-switching", "is-switching-out");

      state.outTimer = window.setTimeout(() => {
        render();
        element.classList.remove("is-switching-out");
        void element.offsetWidth;
        element.classList.add("is-switching-in");

        state.inTimer = window.setTimeout(() => {
          if (swapStates.get(element) !== state) return;
          element.classList.remove("is-switching", "is-switching-in");
          swapStates.delete(element);
          resolve();
        }, inMs);
      }, outMs);
    });
  }

  function clearSwapState(element) {
    const state = swapStates.get(element);
    if (!state) return;

    window.clearTimeout(state.outTimer);
    window.clearTimeout(state.inTimer);
    swapStates.delete(element);
    element.classList.remove("is-switching", "is-switching-out", "is-switching-in");
  }

  function setVisibility(element, visible, options = {}) {
    if (!element) return Promise.resolve();

    const displayValue = options.displayValue ?? "";
    const duration = options.duration ?? 220;

    if (reduceMotionQuery.matches) {
      if (visible) {
        element.hidden = false;
        if (displayValue) element.style.display = displayValue;
        else element.style.removeProperty("display");
        element.classList.remove("is-hidden", "is-hiding", "is-revealing");
        element.classList.add("motion-section", "is-visible");
      } else {
        element.hidden = true;
        element.style.display = "none";
        element.classList.remove("is-visible", "is-hiding", "is-revealing");
        element.classList.add("motion-section", "is-hidden");
      }
      return Promise.resolve();
    }

    clearVisibilityState(element);

    return new Promise(resolve => {
      const state = {};
      visibilityStates.set(element, state);
      element.classList.add("motion-section");

      if (visible) {
        element.hidden = false;
        if (displayValue) element.style.display = displayValue;
        else element.style.removeProperty("display");

        element.classList.remove("is-hidden", "is-hiding");
        element.classList.add("is-revealing");

        requestAnimationFrame(() => {
          if (visibilityStates.get(element) !== state) return;
          element.classList.add("is-visible");
        });

        state.timer = window.setTimeout(() => {
          if (visibilityStates.get(element) !== state) return;
          element.classList.remove("is-revealing");
          visibilityStates.delete(element);
          resolve();
        }, duration);
        return;
      }

      element.classList.remove("is-revealing", "is-visible");
      element.classList.add("is-hiding");

      state.timer = window.setTimeout(() => {
        if (visibilityStates.get(element) !== state) return;
        element.hidden = true;
        element.style.display = "none";
        element.classList.remove("is-hiding");
        element.classList.add("is-hidden");
        visibilityStates.delete(element);
        resolve();
      }, duration);
    });
  }

  function clearVisibilityState(element) {
    const state = visibilityStates.get(element);
    if (!state) return;

    window.clearTimeout(state.timer);
    visibilityStates.delete(element);
  }

  function bindHoverPops() {
    document.addEventListener("pointerover", event => {
      if (!hoverCapabilityQuery.matches || reduceMotionQuery.matches) return;

      const target = event.target.closest("[data-hover-pop]");
      if (!target) return;
      if (activeHoverTargets.has(target)) return;

      const related = event.relatedTarget;
      if (related instanceof Node && target.contains(related)) return;

      activeHoverTargets.add(target);
      triggerHoverPop(target);
    });

    document.addEventListener("pointerout", event => {
      if (!hoverCapabilityQuery.matches) return;

      const target = event.target.closest("[data-hover-pop]");
      if (!target) return;

      const related = event.relatedTarget;
      if (related instanceof Node && target.contains(related)) return;

      activeHoverTargets.delete(target);
    });
  }

  function triggerHoverPop(element) {
    clearHoverState(element);
    element.classList.remove("is-hover-popping");
    void element.offsetWidth;
    element.classList.add("is-hover-popping");

    const duration = readDurationMs(element, "--hover-pop-ms", 460);
    const state = {
      timer: window.setTimeout(() => {
        if (hoverStates.get(element) !== state) return;
        element.classList.remove("is-hover-popping");
        hoverStates.delete(element);
      }, duration)
    };

    hoverStates.set(element, state);
  }

  function clearHoverState(element) {
    const state = hoverStates.get(element);
    if (!state) return;

    window.clearTimeout(state.timer);
    hoverStates.delete(element);
    element.classList.remove("is-hover-popping");
  }

  function readDurationMs(element, propertyName, fallback) {
    const rawValue = window.getComputedStyle(element).getPropertyValue(propertyName).trim();
    if (!rawValue) return fallback;
    if (rawValue.endsWith("ms")) return Number.parseFloat(rawValue) || fallback;
    if (rawValue.endsWith("s")) return ((Number.parseFloat(rawValue) || 0) * 1000) || fallback;
    return Number.parseFloat(rawValue) || fallback;
  }

  function removeWithUndo(options = {}) {
    const remove = typeof options.remove === "function" ? options.remove : null;
    const restore = typeof options.restore === "function" ? options.restore : null;
    const key = String(options.key ?? "").trim();
    const timeoutMs = Number.isFinite(options.timeoutMs) ? Math.max(1000, options.timeoutMs) : 2200;

    if (!remove) return false;
    if (key && removalStates.has(key)) return false;

    const item = findRemovalItemElement(options.element);
    const stateKey = key || `removal-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
    const state = {
      key: stateKey,
      label: normalizeRemovalLabel(options.label),
      restore,
      timeoutMs,
      expiresAt: Date.now() + timeoutMs,
      timer: 0,
      ghostTimer: 0,
      ghostShell: captureRemovalGhost(item),
      panelToast: null,
      fallbackToast: null,
      anchor: captureUndoAnchor(item)
    };

    removalStates.set(stateKey, state);

    try {
      remove();
    } catch (error) {
      clearRemovalArtifacts(state);
      removalStates.delete(stateKey);
      throw error;
    }

    if (state.ghostShell) {
      playRemovalGhost(state.ghostShell, state);
    }

    queueUndoReconciliation();

    if (!restore) {
      state.timer = window.setTimeout(() => finalizeRemoval(stateKey), reduceMotionQuery.matches ? 40 : 120);
      return true;
    }

    state.timer = window.setTimeout(() => finalizeRemoval(stateKey), timeoutMs);
    return true;
  }

  function normalizeRemovalLabel(label) {
    const text = String(label ?? "").trim();
    return text || "\u672a\u547d\u540d\u5185\u5bb9";
  }

  function findRemovalItemElement(element) {
    if (!(element instanceof Element)) return null;
    return element.closest("[data-task-id], [data-record-id], [data-milestone-id], [data-forecast-id], [data-fixed-forecast-id]") || element;
  }

  function findRemovalVisualSource(item) {
    if (!(item instanceof Element)) return null;
    if (item.classList.contains("task-item")) {
      return item.querySelector(".task-card") || item;
    }
    return item;
  }

  function captureUndoAnchor(item) {
    if (!(item instanceof Element)) return null;

    const panel = findUndoPanel(item);
    if (!(panel instanceof Element)) return null;

    const root = panel.id ? panel : panel.closest("[id]");
    if (!(root instanceof Element) || !root.id) return null;

    return {
      rootId: root.id,
      panelPath: buildElementPath(panel, root),
      variant: classifyUndoVariant(item),
      context: captureUndoContext(item)
    };
  }

  function findUndoPanel(item) {
    if (!(item instanceof Element)) return null;

    if (item.classList.contains("task-item")) {
      return item.closest("#weeklyList, #taskList, #monthlyList");
    }

    if (item.classList.contains("history-item")) {
      return item.closest("#taskList");
    }

    if (item.classList.contains("record-item")) {
      return item.closest("#recordsList, .records-list");
    }

    if (item.classList.contains("forecast-item")) {
      return item.closest("#forecastFixedList, #forecastOneOffList");
    }

    if (item.classList.contains("forecast-template-item")) {
      return item.closest("#fixedForecastTemplatesList");
    }

    if (item.classList.contains("milestone-card")) {
      return item.closest("#milestoneList, .milestone-list");
    }

    if (item.classList.contains("recent-card")) {
      return item.closest(".recent-lane-list");
    }

    return item.closest("#weeklyList, #taskList, #monthlyList, #recordsList, #milestoneList, #forecastFixedList, #forecastOneOffList, #fixedForecastTemplatesList, .records-list, .milestone-list, .recent-lane-list");
  }

  function classifyUndoVariant(item) {
    if (!(item instanceof Element)) return "default";
    if (item.classList.contains("task-item")) return "task";
    if (item.classList.contains("history-item")) return "history";
    if (item.classList.contains("record-item")) return "record";
    if (item.classList.contains("forecast-item")) return "record";
    if (item.classList.contains("forecast-template-item")) return "default";
    if (item.classList.contains("milestone-card")) return "milestone";
    if (item.classList.contains("recent-card")) return "default";
    return "default";
  }

  function captureUndoContext(item) {
    if (!(item instanceof Element)) return "default";
    if (item.classList.contains("history-item")) return "history";
    if (item.classList.contains("task-item")) return "tasks";
    if (item.classList.contains("record-item")) return "records";
    if (item.classList.contains("forecast-item")) return "records";
    if (item.classList.contains("forecast-template-item")) return "records";
    if (item.classList.contains("milestone-card")) return "milestones";
    if (item.classList.contains("recent-card")) return "recent";
    return "default";
  }

  function queueUndoReconciliation() {
    if (reconciliationFrame) {
      window.cancelAnimationFrame(reconciliationFrame);
    }

    reconciliationFrame = window.requestAnimationFrame(() => {
      reconciliationFrame = 0;
      reconcilePendingRemovals();
    });
  }

  function reconcilePendingRemovals() {
    removalStates.forEach(state => reconcilePendingUndoState(state));
  }

  function reconcilePendingUndoState(state) {
    if (!state?.restore || !removalStates.has(state.key)) return;

    if (state.panelToast && !state.panelToast.isConnected) {
      state.panelToast = null;
    }
    if (state.fallbackToast && !state.fallbackToast.isConnected) {
      state.fallbackToast = null;
    }

    const remainingMs = Math.max(0, state.expiresAt - Date.now());
    if (!remainingMs) return;

    const mount = resolveUndoMount(state.anchor);
    if (mount) {
      if (state.fallbackToast?.isConnected) {
        dismissFallbackToast(state.fallbackToast);
        state.fallbackToast = null;
      }

      const stack = ensurePanelUndoStack(mount.root);
      if (!(stack instanceof Element)) return;

      if (state.panelToast?.parentElement === stack) return;

      if (state.panelToast?.isConnected) {
        dismissPanelUndo(state.panelToast);
      }

      const panelToast = createPanelUndo(state, remainingMs);
      stack.prepend(panelToast);
      state.panelToast = panelToast;
      requestAnimationFrame(() => panelToast.classList.add("is-visible"));
      return;
    }

    if (state.panelToast?.isConnected) {
      dismissPanelUndo(state.panelToast);
      state.panelToast = null;
    }

    if (!state.fallbackToast?.isConnected) {
      state.fallbackToast = createFallbackUndoToast(state, remainingMs);
    }
  }

  function resolveUndoMount(anchor) {
    if (!anchor) return null;

    const root = document.getElementById(anchor.rootId);
    if (!(root instanceof Element)) return null;

    const panel = resolveElementPath(root, anchor.panelPath);
    if (!(panel instanceof HTMLElement) || !isUndoContextActive(anchor, panel)) return null;

    return { root: panel };
  }

  function isUndoContextActive(anchor, root) {
    if (!anchor || !(root instanceof HTMLElement) || !document.body?.contains(root)) return false;
    if (!isElementVisible(root)) return false;

    if (anchor.context === "history") {
      const tab = document.getElementById("tab-history");
      if (tab && !tab.classList.contains("active")) return false;
    }

    if (anchor.context === "tasks") {
      const tab = document.getElementById("tab-tasks");
      if (tab && !tab.classList.contains("active")) return false;
    }

    return true;
  }

  function isElementVisible(element) {
    let current = element;

    while (current instanceof HTMLElement && current !== document.body) {
      if (current.hidden) return false;

      const style = window.getComputedStyle(current);
      if (style.display === "none" || style.visibility === "hidden") return false;

      current = current.parentElement;
    }

    return true;
  }

  function ensurePanelUndoStack(root) {
    if (!(root instanceof HTMLElement)) return null;

    let stack = Array.from(root.children).find(child => child.classList.contains("motion-panel-undo-stack")) || null;
    if (stack) return stack;

    root.classList.add("motion-undo-host");
    stack = document.createElement("div");
    stack.className = "motion-panel-undo-stack";
    stack.setAttribute("aria-live", "polite");
    stack.setAttribute("aria-atomic", "false");
    root.appendChild(stack);
    return stack;
  }

  function createPanelUndo(state, remainingMs) {
    const undo = document.createElement("div");
    undo.className = `motion-panel-undo motion-panel-undo--${state.anchor?.variant || "default"}`;
    undo.dataset.removalKey = state.key;
    undo.style.setProperty("--undo-duration", `${remainingMs}ms`);

    const copy = document.createElement("div");
    copy.className = "motion-panel-undo-copy";

    const badge = document.createElement("span");
    badge.className = "motion-panel-undo-badge";

    const label = document.createElement("strong");
    label.className = "motion-panel-undo-label";
    label.textContent = `\u5df2\u5220\u9664 ${state.label}`;

    copy.append(badge, label);

    const action = document.createElement("button");
    action.className = "motion-panel-undo-action";
    action.type = "button";
    action.textContent = "\u64a4\u9500";
    action.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();
      restoreRemoval(state.key);
    });

    const progress = createUndoProgress("motion-panel-undo-progress", "motion-panel-undo-progress-fill", remainingMs);
    undo.append(copy, action, progress);
    return undo;
  }

  function ensureFallbackStack() {
    if (fallbackStack?.isConnected) return fallbackStack;

    fallbackStack = document.createElement("div");
    fallbackStack.className = "motion-fallback-stack";
    fallbackStack.setAttribute("aria-live", "polite");
    fallbackStack.setAttribute("aria-atomic", "false");
    document.body.appendChild(fallbackStack);
    return fallbackStack;
  }

  function createFallbackUndoToast(state, remainingMs) {
    const toast = document.createElement("div");
    toast.className = "motion-fallback-undo";
    toast.style.setProperty("--undo-duration", `${remainingMs}ms`);

    const copy = document.createElement("div");
    copy.className = "motion-fallback-undo-copy";

    const label = document.createElement("strong");
    label.className = "motion-fallback-undo-label";
    label.textContent = `\u5df2\u5220\u9664 ${state.label}`;
    copy.appendChild(label);

    const action = document.createElement("button");
    action.className = "motion-fallback-undo-action";
    action.type = "button";
    action.textContent = "\u64a4\u9500";
    action.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();
      restoreRemoval(state.key);
    });

    const progress = createUndoProgress("motion-fallback-undo-progress", "motion-fallback-undo-progress-fill", remainingMs);
    toast.append(copy, action, progress);
    ensureFallbackStack().prepend(toast);

    requestAnimationFrame(() => toast.classList.add("is-visible"));
    return toast;
  }

  function createUndoProgress(shellClassName, fillClassName, remainingMs) {
    const shell = document.createElement("div");
    shell.className = shellClassName;

    const fill = document.createElement("div");
    fill.className = fillClassName;
    fill.style.setProperty("--undo-duration", `${remainingMs}ms`);

    shell.appendChild(fill);
    return shell;
  }

  function captureRemovalGhost(item) {
    const source = findRemovalVisualSource(item);
    if (!(source instanceof Element) || !document.body) return null;

    const rect = source.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;

    const shell = document.createElement("div");
    shell.className = "motion-remove-shell";
    if (reduceMotionQuery.matches) shell.classList.add("is-reduced");
    shell.style.left = `${rect.left}px`;
    shell.style.top = `${rect.top}px`;
    shell.style.width = `${rect.width}px`;
    shell.style.height = `${rect.height}px`;
    shell.style.setProperty("--ghost-radius", window.getComputedStyle(source).borderRadius || "16px");

    const ghost = document.createElement("div");
    ghost.className = "motion-remove-ghost";

    const copy = source.cloneNode(true);
    sanitizeGhostTree(copy);
    copy.classList.add("motion-remove-ghost-copy");

    ghost.appendChild(copy);
    shell.appendChild(ghost);
    return shell;
  }

  function sanitizeGhostTree(root) {
    if (!(root instanceof Element)) return;

    [root, ...root.querySelectorAll("*")].forEach(node => {
      node.removeAttribute("id");
      node.removeAttribute("data-hover-pop");
      node.removeAttribute("onclick");
      node.removeAttribute("onchange");
      node.removeAttribute("oninput");
      node.setAttribute("aria-hidden", "true");
      if ("disabled" in node) {
        try {
          node.disabled = true;
        } catch (error) {
          void error;
        }
      }
    });
  }

  function playRemovalGhost(shell, state) {
    if (!(shell instanceof HTMLElement)) return;

    ensureRemovalLayer().appendChild(shell);
    requestAnimationFrame(() => {
      shell.classList.add("is-animating");
    });

    const duration = reduceMotionQuery.matches ? 80 : 120;
    state.ghostTimer = window.setTimeout(() => {
      state.ghostTimer = 0;
      if (shell.isConnected) shell.remove();
      if (state.ghostShell === shell) state.ghostShell = null;
    }, duration);
  }

  function ensureRemovalLayer() {
    if (removalLayer?.isConnected) return removalLayer;

    removalLayer = document.createElement("div");
    removalLayer.className = "motion-remove-layer";
    removalLayer.setAttribute("aria-hidden", "true");
    document.body.appendChild(removalLayer);
    return removalLayer;
  }

  function restoreRemoval(key) {
    const state = removalStates.get(key);
    if (!state) return;

    removalStates.delete(key);
    window.clearTimeout(state.timer);
    clearRemovalArtifacts(state);

    try {
      state.restore?.();
    } catch (error) {
      console.error(error);
    }

    queueUndoReconciliation();
  }

  function finalizeRemoval(key) {
    const state = removalStates.get(key);
    if (!state) return;

    removalStates.delete(key);
    window.clearTimeout(state.timer);
    clearRemovalArtifacts(state);
  }

  function clearRemovalArtifacts(state) {
    if (!state) return;

    if (state.ghostTimer) {
      window.clearTimeout(state.ghostTimer);
      state.ghostTimer = 0;
    }

    if (state.panelToast?.isConnected) {
      dismissPanelUndo(state.panelToast);
    }
    state.panelToast = null;

    if (state.fallbackToast?.isConnected) {
      dismissFallbackToast(state.fallbackToast);
    }
    state.fallbackToast = null;

    if (state.ghostShell?.isConnected) {
      state.ghostShell.remove();
    }
    state.ghostShell = null;
  }

  function dismissPanelUndo(toast) {
    dismissUndoNotice(toast);
  }

  function dismissFallbackToast(toast) {
    dismissUndoNotice(toast);
  }

  function dismissUndoNotice(toast) {
    if (!(toast instanceof HTMLElement)) return;

    toast.classList.remove("is-visible");
    toast.classList.add("is-exiting");
    window.setTimeout(() => {
      if (toast.isConnected) toast.remove();
    }, 120);
  }

  function buildElementPath(node, root) {
    if (!(node instanceof Element) || !(root instanceof Element)) return [];
    if (node === root) return [];

    const steps = [];
    let current = node;
    while (current && current !== root) {
      steps.unshift(describePathStep(current));
      current = current.parentElement;
    }

    return current === root ? steps : [];
  }

  function describePathStep(node) {
    return {
      tagName: node.tagName,
      classes: getStableClasses(node),
      nthOfType: getNthOfType(node)
    };
  }

  function getStableClasses(node) {
    if (!(node instanceof Element)) return [];

    return Array.from(node.classList).filter(className => {
      return className && !className.startsWith("is-") && !className.startsWith("motion-");
    });
  }

  function getNthOfType(node) {
    if (!(node instanceof Element) || !(node.parentElement instanceof Element)) return 1;

    const sameTagSiblings = Array.from(node.parentElement.children).filter(child => child.tagName === node.tagName);
    return sameTagSiblings.indexOf(node) + 1 || 1;
  }

  function resolveElementPath(root, path) {
    if (!(root instanceof Element)) return null;
    if (!Array.isArray(path) || path.length === 0) return root;

    let current = root;
    for (const step of path) {
      current = findChildByPathStep(current, step);
      if (!current) return null;
    }

    return current;
  }

  function findChildByPathStep(parent, step) {
    if (!(parent instanceof Element)) return null;

    const children = Array.from(parent.children);
    const tagMatches = children.filter(child => child.tagName === step.tagName);
    const nthCandidate = tagMatches[step.nthOfType - 1] || null;
    if (matchesPathStep(nthCandidate, step)) {
      return nthCandidate;
    }

    return children.find(child => matchesPathStep(child, step)) || null;
  }

  function matchesPathStep(node, step) {
    if (!(node instanceof Element)) return false;
    if (node.tagName !== step.tagName) return false;
    return step.classes.every(className => node.classList.contains(className));
  }

  return {
    animateSwap,
    init,
    navigateWithTransition,
    reconcilePendingRemovals,
    removeWithUndo,
    setVisibility
  };
})();

window.PageMotion = PageMotion;

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => PageMotion.init(), { once: true });
} else {
  PageMotion.init();
}
