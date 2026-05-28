const FreedomApp = (() => {
  const state = {
    store: null
  };

  function init() {
    if (!document.getElementById("freedomApp")) return;
    state.store = FreedomStore.readStore();
    bindEvents();
    resetEntryForm();
    render();

    window.addEventListener("resize", () => drawGrid(FreedomStore.buildFreedomView(state.store)));
    window.addEventListener("storage", event => {
      if (event.key && event.key !== FreedomStore.STORAGE_KEY) return;
      state.store = FreedomStore.readStore();
      render();
    });
  }

  function bindEvents() {
    document.getElementById("dailyNeedForm")?.addEventListener("submit", event => {
      event.preventDefault();
      saveDailyNeed();
    });

    document.getElementById("freedomEntryForm")?.addEventListener("submit", event => {
      event.preventDefault();
      const type = event.submitter?.value === "spend" ? "spend" : "fund";
      saveEntry(type);
    });
  }

  function saveDailyNeed() {
    const dailyNeed = FreedomStore.normalizeAmount(getValue("dailyNeedInput"));
    if (!dailyNeed) {
      setStatus("dailyNeedStatus", "请输入大于 0 的每日必要花费。", false);
      return;
    }

    state.store = FreedomStore.saveStore(FreedomStore.updateSettings(state.store, { dailyNeed }));
    setStatus("dailyNeedStatus", "每日必要花费已保存。", true);
    render();
  }

  function saveEntry(type) {
    try {
      state.store = FreedomStore.saveStore(FreedomStore.upsertEntry(state.store, {
        type,
        amount: getValue("freedomAmountInput"),
        date: getTodayValue(),
        note: getValue("freedomNoteInput")
      }));
      setStatus("freedomEntryStatus", type === "fund" ? "资金已增加。" : "资金已减少。", true);
      resetEntryForm();
      render();
    } catch (error) {
      setStatus("freedomEntryStatus", error.message || "资金记录保存失败。", false);
    }
  }

  function render() {
    const view = FreedomStore.buildFreedomView(state.store);
    setText("freeDaysText", view.freeDaysText);
    setText("dailyNeedText", view.dailyNeed > 0 ? view.dailyNeedText : "未设置");
    setText("availableFundText", view.availableFundText);
    setText("totalFundText", view.totalFundText);
    setText("totalSpendText", view.totalSpendText);
    setText("spentDaysText", view.spentDaysText);
    setText("nextDayGapText", buildNextDayGapText(view));
    setValue("dailyNeedInput", view.dailyNeed > 0 ? view.dailyNeed.toFixed(2) : "");
    setText("gridSummary", view.dailyNeed > 0
      ? `${view.availableFundText} ÷ ${view.dailyNeedText} = ${view.freeDaysText}`
      : "先设置每日基本消费，再把闲置资金换算成自由天数。");
    renderEntries(view.lastEntries);
    drawGrid(view);
  }

  function renderEntries(entries) {
    const container = document.getElementById("freedomEntryList");
    if (!container) return;
    if (!entries.length) {
      container.innerHTML = `
        <div class="freedom-empty">
          <strong>还没有自由资金记录</strong>
          <span>先增加一笔资金，看它能点亮多少天。</span>
        </div>
      `;
      return;
    }

    container.innerHTML = entries.map(entry => `
      <article class="freedom-entry freedom-entry--${escapeAttribute(entry.type)}">
        <span>${escapeHtml(entry.date)}</span>
        <div>
          <strong>${entry.type === "fund" ? "增加资金" : "减少资金"}</strong>
          <small>${escapeHtml(entry.note || (entry.type === "fund" ? "未填写来源" : "未填写用途"))}</small>
        </div>
        <b>${entry.type === "fund" ? "+" : "-"}${FreedomStore.formatCurrency(entry.amount)}</b>
      </article>
    `).join("");
  }

  function drawGrid(view) {
    const canvas = document.getElementById("freedomGridCanvas");
    if (!canvas) return;
    const frame = canvas.parentElement;
    const width = Math.max(320, frame?.clientWidth || 900);
    const litDays = view.dailyNeed > 0 ? view.freeDays : 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cell = width < 520 ? 7 : 10;
    const baseGap = width < 520 ? 4 : 5;
    const startX = width < 520 ? 14 : 18;
    const startY = width < 520 ? 16 : 20;
    const bottomPadding = width < 520 ? 36 : 42;
    const minHeight = Math.max(width < 520 ? 260 : 230, readCssPixels(frame, "minHeight"));
    const availableWidth = Math.max(cell, width - startX * 2);
    const cols = Math.max(10, Math.floor((availableWidth + baseGap) / (cell + baseGap)));
    const gapX = cols > 1 ? Math.max(2, (availableWidth - cols * cell) / (cols - 1)) : 0;
    const minRows = Math.max(width < 520 ? 8 : 6, Math.floor((minHeight - startY - bottomPadding) / (cell + baseGap)));
    const visibleDays = calculateVisibleDays(litDays, cols, minRows);
    const rows = Math.max(minRows, Math.ceil(visibleDays / cols));
    const height = Math.max(minHeight, rows * (cell + baseGap) + startY + bottomPadding);

    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "#090910";
    ctx.fillRect(0, 0, width, height);

    for (let index = 0; index < visibleDays; index += 1) {
      const col = index % cols;
      const row = Math.floor(index / cols);
      const x = startX + col * (cell + gapX);
      const y = startY + row * (cell + baseGap);
      const lit = index < litDays;
      ctx.fillStyle = lit ? "#fcd34d" : "rgba(255, 255, 255, 0.12)";
      ctx.shadowColor = lit ? "rgba(252, 211, 77, 0.42)" : "transparent";
      ctx.shadowBlur = lit && index % 6 === 0 ? 8 : 0;
      ctx.fillRect(x, y, cell, cell);
    }
    ctx.shadowBlur = 0;
    if (view.dailyNeed <= 0) {
      ctx.fillStyle = "rgba(248, 242, 223, 0.72)";
      ctx.font = "700 16px Microsoft YaHei, sans-serif";
      ctx.fillText("先设置每日基本消费", 20, height - 18);
    }
  }

  function resetEntryForm() {
    setValue("freedomAmountInput", "");
    setValue("freedomNoteInput", "");
  }

  function calculateVisibleDays(freeDays, cols = 30, minRows = 1) {
    const days = Math.max(0, Math.floor(Number(freeDays) || 0));
    const safeCols = Math.max(1, Math.floor(Number(cols) || 1));
    const safeRows = Math.max(1, Math.floor(Number(minRows) || 1));
    return Math.max(safeCols * safeRows, Math.ceil(Math.max(days, 1) / safeCols) * safeCols);
  }

  function buildNextDayGapText(view) {
    if (view.dailyNeed <= 0) return "先设置每日基本消费";
    const remainder = view.availableFund % view.dailyNeed;
    const gap = remainder === 0 ? view.dailyNeed : view.dailyNeed - remainder;
    return `还差 ${FreedomStore.formatCurrency(gap)} 点亮下一天`;
  }

  function getTodayValue() {
    const date = new Date();
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  }

  function getValue(id) {
    const node = document.getElementById(id);
    return node ? node.value : "";
  }

  function setValue(id, value) {
    const node = document.getElementById(id);
    if (node) node.value = String(value ?? "");
  }

  function setText(id, value) {
    const node = document.getElementById(id);
    if (node) node.textContent = String(value ?? "");
  }

  function setStatus(id, text, success) {
    const node = document.getElementById(id);
    if (!node) return;
    node.textContent = text;
    node.classList.toggle("is-success", Boolean(text) && success);
  }

  function readCssPixels(element, propertyName) {
    if (!element) return 0;
    const value = window.getComputedStyle(element)[propertyName];
    const number = Number.parseFloat(value);
    return Number.isFinite(number) ? number : 0;
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll("\"", "&quot;")
      .replaceAll("'", "&#39;");
  }

  function escapeAttribute(value) {
    return escapeHtml(value);
  }

  return { init };
})();

document.addEventListener("DOMContentLoaded", FreedomApp.init);
