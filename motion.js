const PageMotion = (() => {
  const reduceMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  const hoverCapabilityQuery = window.matchMedia("(hover: hover) and (pointer: fine)");
  const activeHoverTargets = new WeakSet();
  const hoverStates = new WeakMap();
  const swapStates = new WeakMap();
  const visibilityStates = new WeakMap();

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
    if (rawValue.endsWith("s")) return (Number.parseFloat(rawValue) || 0) * 1000 || fallback;
    return Number.parseFloat(rawValue) || fallback;
  }

  return {
    animateSwap,
    init,
    navigateWithTransition,
    setVisibility
  };
})();

window.PageMotion = PageMotion;

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => PageMotion.init(), { once: true });
} else {
  PageMotion.init();
}
