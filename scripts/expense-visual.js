const ExpenseVisualApp = (() => {
  const STORAGE_KEY = "expenseTracker:v1";
  const FALLBACK_CATEGORY_ID = "other";
  const POSTER_COLORS = ["#c93922", "#11100d", "#1f5b7a", "#e7b638", "#8c2f1b", "#284d2f"];
  const BUILTIN_CATEGORIES = [
    { id: "food", name: "餐饮", color: "#fb7185", icon: "餐" },
    { id: "transport", name: "交通", color: "#38bdf8", icon: "行" },
    { id: "shopping", name: "购物", color: "#818cf8", icon: "购" },
    { id: "daily", name: "日用", color: "#f59e0b", icon: "日" },
    { id: "fun", name: "娱乐", color: "#c084fc", icon: "乐" },
    { id: "study", name: "学习", color: "#34d399", icon: "学" },
    { id: "medical", name: "医疗", color: "#f87171", icon: "医" },
    { id: "housing", name: "居住", color: "#94a3b8", icon: "住" },
    { id: FALLBACK_CATEGORY_ID, name: "其他", color: "#60a5fa", icon: "其" }
  ];

  const state = {
    range: "all",
    month: getCurrentMonthKey(),
    focusedCategoryId: "",
    store: null
  };

  function init() {
    if (!document.getElementById("expenseVisualApp")) return;
    state.store = readExpenseStore();
    bindEvents();
    render();

    window.addEventListener("storage", event => {
      if (event.key && event.key !== STORAGE_KEY) return;
      state.store = readExpenseStore();
      render();
    });
  }

  function bindEvents() {
    const rangeSelect = document.getElementById("visualRangeSelect");
    const monthInput = document.getElementById("visualMonthInput");

    setValue("visualMonthInput", state.month);
    rangeSelect?.addEventListener("change", event => {
      state.range = event.target.value === "year" || event.target.value === "month" ? event.target.value : "all";
      render();
    });
    monthInput?.addEventListener("change", event => {
      state.month = normalizeMonthValue(event.target.value) || getCurrentMonthKey();
      setValue("visualMonthInput", state.month);
      render();
    });
    document.getElementById("exportExpenseJson")?.addEventListener("click", () => exportExpenseRecords("json"));
    document.getElementById("exportExpenseCsv")?.addEventListener("click", () => exportExpenseRecords("csv"));
    document.getElementById("exportExpenseHtml")?.addEventListener("click", exportHtmlReport);
    document.getElementById("printExpenseReport")?.addEventListener("click", () => window.print());
    document.getElementById("clearCategoryFocus")?.addEventListener("click", () => {
      state.focusedCategoryId = "";
      render();
    });
    document.getElementById("bassCategoryBlocks")?.addEventListener("click", event => {
      const button = event.target.closest("[data-category-id]");
      if (!button) return;
      state.focusedCategoryId = button.dataset.categoryId === state.focusedCategoryId ? "" : button.dataset.categoryId;
      render();
    });
  }

  function render() {
    const records = getFilteredRecords();
    const focusedRecords = getVisibleRecords(records);
    const breakdown = buildCategoryBreakdown(records, state.store.categories);
    const timeline = state.range === "month" ? buildDailyTimeline(records, state.month) : buildMonthlyTimeline(records);
    const total = roundAmount(records.reduce((sum, record) => sum + record.amount, 0));
    const activeDays = new Set(records.map(record => record.date)).size;
    const largest = focusedRecords.slice().sort((a, b) => b.amount - a.amount)[0];
    const insights = buildInsights(records, focusedRecords, breakdown);

    setText("visualRangeLabel", getRangeLabel());
    setText("visualTotalAmount", formatCurrency(total));
    setText("visualSummary", `${records.length} 笔记录 · ${activeDays} 个消费日`);
    renderInsights(insights);
    renderCategoryBlocks(breakdown);
    renderTimeline(timeline);
    renderLargestRecord(largest);
    renderRecordTable(focusedRecords, records.length);
    renderFocusState();
  }

  function readExpenseStore() {
    try {
      return normalizeStore(JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}"));
    } catch (error) {
      console.warn("消费记录读取失败，已使用空数据。", error);
      return normalizeStore({});
    }
  }

  function normalizeStore(raw) {
    const rawCategories = Array.isArray(raw?.categories) ? raw.categories : [];
    const categoryIds = new Set(BUILTIN_CATEGORIES.map(category => category.id));
    const customCategories = rawCategories
      .filter(category => category && typeof category === "object")
      .map(category => ({
        id: toText(category.id),
        name: toText(category.name),
        color: /^#[0-9a-fA-F]{6}$/.test(toText(category.color)) ? toText(category.color) : "#60a5fa",
        icon: toText(category.icon) || "其"
      }))
      .filter(category => category.id && category.name && !categoryIds.has(category.id));
    const categories = [...BUILTIN_CATEGORIES, ...customCategories];
    const allowedCategories = new Set(categories.map(category => category.id));
    const records = Array.isArray(raw?.records)
      ? raw.records.map(record => normalizeRecord(record, allowedCategories)).filter(Boolean).sort(compareRecords)
      : [];

    return { categories, records };
  }

  function normalizeRecord(record, allowedCategories) {
    if (!record || typeof record !== "object") return null;
    const amount = roundAmount(Number(record.amount));
    const date = normalizeDateValue(record.date);
    if (!amount || amount <= 0 || !date) return null;
    const createdAt = normalizeDateTime(record.createdAt) || new Date(`${date}T00:00:00`).toISOString();

    return {
      id: toText(record.id) || `expense-${date}-${createdAt}`,
      amount,
      date,
      categoryId: allowedCategories.has(record.categoryId) ? record.categoryId : FALLBACK_CATEGORY_ID,
      note: toText(record.note),
      createdAt,
      updatedAt: normalizeDateTime(record.updatedAt) || createdAt
    };
  }

  function getFilteredRecords() {
    const records = state.store.records;
    if (state.range === "year") {
      const year = String(new Date().getFullYear());
      return records.filter(record => record.date.startsWith(`${year}-`));
    }
    if (state.range === "month") {
      return records.filter(record => record.date.startsWith(`${state.month}-`));
    }
    return records;
  }

  function buildCategoryBreakdown(records, categories) {
    const totals = new Map();
    records.forEach(record => {
      totals.set(record.categoryId, roundAmount((totals.get(record.categoryId) || 0) + record.amount));
    });
    const total = roundAmount(records.reduce((sum, record) => sum + record.amount, 0));
    if (!total) return [];

    return Array.from(totals.entries()).map(([categoryId, amount], index) => {
      const category = categories.find(item => item.id === categoryId) || getFallbackCategory();
      return {
        category,
        amount,
        count: records.filter(record => record.categoryId === categoryId).length,
        percent: Math.round((amount / total) * 1000) / 10,
        tone: POSTER_COLORS[index % POSTER_COLORS.length]
      };
    }).sort((a, b) => b.amount - a.amount);
  }

  function buildMonthlyTimeline(records) {
    const year = new Date().getFullYear();
    return Array.from({ length: 12 }, (_, index) => {
      const month = `${year}-${String(index + 1).padStart(2, "0")}`;
      const monthRecords = records.filter(record => record.date.startsWith(`${month}-`));
      return {
        label: `${index + 1}月`,
        amount: sumRecords(monthRecords),
        count: monthRecords.length
      };
    });
  }

  function buildDailyTimeline(records, month) {
    const [year, monthNumber] = month.split("-").map(Number);
    const days = new Date(year, monthNumber, 0).getDate();
    return Array.from({ length: days }, (_, index) => {
      const date = `${month}-${String(index + 1).padStart(2, "0")}`;
      const dayRecords = records.filter(record => record.date === date);
      return {
        label: String(index + 1),
        amount: sumRecords(dayRecords),
        count: dayRecords.length
      };
    });
  }

  function renderCategoryBlocks(breakdown) {
    const container = document.getElementById("bassCategoryBlocks");
    if (!container) return;
    if (!breakdown.length) {
      container.innerHTML = `<div class="empty-poster">还没有可视化的消费块面。先回到消费记录页记一笔。</div>`;
      return;
    }

    container.innerHTML = breakdown.map((item, index) => {
      const span = Math.max(2, Math.min(6, Math.round(item.percent / 18) + 1));
      const tilt = `${((index % 5) - 2) * 1.4}deg`;
      return `
        <button class="category-cut ${state.focusedCategoryId === item.category.id ? "is-active" : ""}" type="button" data-category-id="${escapeAttribute(item.category.id)}" style="--span:${span}; --tone:${item.tone}; --tilt:${tilt};" title="${escapeAttribute(item.category.name)} ${formatCurrency(item.amount)}">
          <span>${escapeHtml(item.category.name)}</span>
          <strong>${formatCurrency(item.amount)}</strong>
          <small>${item.percent}% · ${item.count} 笔</small>
        </button>
      `;
    }).join("");
  }

  function renderTimeline(points) {
    const container = document.getElementById("bassTimeline");
    if (!container) return;
    const max = Math.max(...points.map(point => point.amount), 1);
    container.innerHTML = points.map((point, index) => {
      const level = Math.max(8, Math.round((point.amount / max) * 100));
      const tone = point.amount ? POSTER_COLORS[index % POSTER_COLORS.length] : "#d6bd8d";
      return `<div class="month-cut" style="--level:${level}; --tone:${tone};" title="${escapeAttribute(point.label)} ${formatCurrency(point.amount)}">${escapeHtml(point.label)}</div>`;
    }).join("");
  }

  function renderLargestRecord(record) {
    const container = document.getElementById("bassLargestRecord");
    if (!container) return;
    if (!record) {
      container.innerHTML = `<div class="empty-poster">目前没有最大消费。数据出现后，这里会留下最重的一刀。</div>`;
      return;
    }
    const category = getCategoryById(record.categoryId);
    container.innerHTML = `
      <article class="largest-record-card">
        <div>
          <h3>${escapeHtml(category.name)}</h3>
          <p>${escapeHtml(record.note || "没有备注")}</p>
          <span>${escapeHtml(formatDateLabel(record.date))}</span>
        </div>
        <strong>${formatCurrency(record.amount)}</strong>
      </article>
    `;
  }

  function renderRecordTable(records, originalCount) {
    const container = document.getElementById("bassRecordTable");
    if (!container) return;
    if (!records.length) {
      container.innerHTML = `<div class="empty-poster">当前范围没有记录。</div>`;
      return;
    }
    container.innerHTML = records.slice(0, 18).map(record => {
      const category = getCategoryById(record.categoryId);
      return `
        <article class="record-strip">
          <span>${escapeHtml(record.date)}</span>
          <span>${escapeHtml(category.name)}${record.note ? ` · ${escapeHtml(record.note)}` : ""}</span>
          <strong>${formatCurrency(record.amount)}</strong>
        </article>
      `;
    }).join("");
    setText("recordStripLabel", state.focusedCategoryId
      ? `当前聚焦 ${getCategoryById(state.focusedCategoryId).name}，展示 ${records.length} / ${originalCount} 笔记录。`
      : "默认展示当前范围内最近 18 笔记录。");
  }

  function exportExpenseRecords(format) {
    const records = getFilteredRecords();
    const exportedAt = new Date().toISOString();
    if (!records.length) {
      setStatus("当前范围没有可以导出的消费记录。");
      return;
    }

    if (format === "csv") {
      const csv = buildCsv(records);
      downloadFile(`river-expenses-${getExportSuffix()}.csv`, csv, "text/csv;charset=utf-8");
      setStatus(`已导出 CSV：${records.length} 笔记录。`);
      return;
    }

    const payload = {
      app: "river-todo-expenses",
      version: 1,
      exportedAt,
      range: state.range,
      month: state.range === "month" ? state.month : "",
      records,
      categories: state.store.categories
    };
    downloadFile(`river-expenses-${getExportSuffix()}.json`, JSON.stringify(payload, null, 2), "application/json;charset=utf-8");
    setStatus(`已导出 JSON：${records.length} 笔记录。`);
  }

  function exportHtmlReport() {
    const records = getFilteredRecords();
    if (!records.length) {
      setStatus("当前范围没有可以导出的网页报告。");
      return;
    }
    const title = `River 消费剪影账本 ${getRangeLabel()}`;
    const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)}</title>
  <style>${getReportCss()}</style>
</head>
<body>
${document.getElementById("expenseVisualApp")?.outerHTML || ""}
</body>
</html>`;
    downloadFile(`river-expenses-${getExportSuffix()}-report.html`, html, "text/html;charset=utf-8");
    setStatus(`已导出 HTML 网页报告：${records.length} 笔记录。`);
  }

  function buildInsights(records, focusedRecords, breakdown) {
    if (!records.length) {
      return {
        lead: "还没有消费记录，海报暂时是一张空底片。",
        tempo: "先记 3 到 5 笔，节奏才会显形。",
        advice: "从餐饮、交通、娱乐三类开始记录，后面更容易复盘。",
        risk: "暂无需要盯住的支出。"
      };
    }

    const total = sumRecords(records);
    const focusedTotal = sumRecords(focusedRecords);
    const top = breakdown[0];
    const activeDays = new Set(records.map(record => record.date)).size || 1;
    const dailyAverage = roundAmount(total / activeDays);
    const largest = records.slice().sort((a, b) => b.amount - a.amount)[0];
    const oneShotRatio = largest ? Math.round((largest.amount / total) * 1000) / 10 : 0;
    const focusName = state.focusedCategoryId ? getCategoryById(state.focusedCategoryId).name : "";

    return {
      lead: focusName
        ? `${focusName} 被单独拎出来了：${focusedRecords.length} 笔，共 ${formatCurrency(focusedTotal)}。`
        : `这段时间一共花了 ${formatCurrency(total)}，最高块面是 ${top?.category.name || "暂无"}。`,
      tempo: activeDays > 1
        ? `平均每个消费日 ${formatCurrency(dailyAverage)}，有 ${activeDays} 天留下记录。`
        : `记录集中在 1 天里，先继续记几天，别急着下判断。`,
      advice: createAdvice(top, dailyAverage, records.length, focusName),
      risk: oneShotRatio >= 45
        ? `最大单笔占 ${oneShotRatio}%，它会强烈影响这段时间的判断。`
        : top && top.percent >= 55
          ? `${top.category.name} 占比 ${top.percent}%，这类支出值得单独看。`
          : "结构还算分散，重点看下一次异常变大的分类。"
    };
  }

  function createAdvice(top, dailyAverage, count, focusName) {
    if (focusName) return `先看 ${focusName} 的备注：能不能分出“快乐必要”和“无意识重复”。`;
    if (!top) return "先补记录，不需要急着优化。";
    if (top.category.id === "food") return `餐饮是最大块面。可以保留好吃的，把随机小额重复消费单独标出来。`;
    if (top.category.id === "fun") return `娱乐占上风。建议保留真正快乐的局，把只是逃避情绪的局区分出来。`;
    if (top.category.id === "shopping") return `购物是最大块面。下一步可以给“想要”和“真的会用”分两列。`;
    if (dailyAverage > 120) return `日均已经不低。先抓最大分类，不要从几块钱的小项开始纠结。`;
    if (count < 8) return `记录数还少。先连续记满一周，再决定哪些要砍。`;
    return `先保持记录密度。真正有价值的是看见模式，而不是立刻压低所有支出。`;
  }

  function renderInsights(insights) {
    setText("insightLead", insights.lead);
    setText("insightTempo", insights.tempo);
    setText("insightAdvice", insights.advice);
    setText("insightRisk", insights.risk);
  }

  function renderFocusState() {
    const category = state.focusedCategoryId ? getCategoryById(state.focusedCategoryId) : null;
    setText("categoryFocusLabel", category
      ? `已聚焦 ${category.name}。再次点击该块或点“清除聚焦”恢复全部。`
      : "点击一个分类块，可以只看这一类的记录底片和建议。");
    const clearButton = document.getElementById("clearCategoryFocus");
    if (clearButton) clearButton.hidden = !category;
  }

  function getVisibleRecords(records) {
    if (!state.focusedCategoryId) return records;
    return records.filter(record => record.categoryId === state.focusedCategoryId);
  }

  function buildCsv(records) {
    const rows = [["id", "date", "amount", "category", "note", "createdAt", "updatedAt"]];
    records.forEach(record => {
      const category = getCategoryById(record.categoryId);
      rows.push([record.id, record.date, record.amount, category.name, record.note, record.createdAt, record.updatedAt]);
    });
    return rows.map(row => row.map(escapeCsvCell).join(",")).join("\n");
  }

  function downloadFile(filename, content, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 600);
  }

  function getReportCss() {
    return `
body { margin: 0; color: #11100d; background: #eadbbd; font-family: Arial, "Microsoft YaHei", sans-serif; }
.site-top-nav, script { display: none !important; }
.bass-poster { width: min(1120px, calc(100% - 32px)); margin: 0 auto; padding: 32px 0; }
.poster-hero, .poster-panel { border: 4px solid #11100d; background: #f3ead4; box-shadow: 8px 8px 0 rgba(17,16,13,.18); margin: 0 0 22px; padding: 24px; }
h1 { font-size: clamp(4rem, 11vw, 8rem); line-height: .82; letter-spacing: -.08em; margin: 0; }
.paper-cut, .visual-controls, .bass-button { display: none !important; }
.poster-grid, .insight-marquee { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 18px; }
.category-cuts, .record-strips { display: grid; gap: 10px; }
.category-cut, .record-strip, .month-cut { border: 3px solid #11100d; background: #eadbbd; padding: 10px; color: #11100d; }
.record-strip { display: grid; grid-template-columns: 120px 1fr auto; }
@media (max-width: 760px) { .poster-grid, .insight-marquee, .record-strip { grid-template-columns: 1fr; } }
`;
  }

  function getRangeLabel() {
    if (state.range === "year") return `${new Date().getFullYear()} 年`;
    if (state.range === "month") return state.month;
    return "全部记录";
  }

  function getExportSuffix() {
    return state.range === "month" ? state.month : state.range === "year" ? String(new Date().getFullYear()) : "all";
  }

  function getCategoryById(id) {
    return state.store.categories.find(category => category.id === id) || getFallbackCategory();
  }

  function getFallbackCategory() {
    return BUILTIN_CATEGORIES.find(category => category.id === FALLBACK_CATEGORY_ID) || BUILTIN_CATEGORIES[0];
  }

  function sumRecords(records) {
    return roundAmount(records.reduce((sum, record) => sum + record.amount, 0));
  }

  function compareRecords(a, b) {
    if (a.date !== b.date) return b.date.localeCompare(a.date);
    return String(b.createdAt || "").localeCompare(String(a.createdAt || ""));
  }

  function normalizeDateValue(value) {
    const text = toText(value);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return "";
    const date = new Date(`${text}T00:00:00`);
    return Number.isNaN(date.getTime()) ? "" : text;
  }

  function normalizeDateTime(value) {
    const text = toText(value);
    if (!text) return "";
    const date = new Date(text);
    return Number.isNaN(date.getTime()) ? "" : date.toISOString();
  }

  function normalizeMonthValue(value) {
    const text = toText(value);
    if (!/^\d{4}-\d{2}$/.test(text)) return "";
    const [, month] = text.split("-").map(Number);
    return month >= 1 && month <= 12 ? text : "";
  }

  function getCurrentMonthKey() {
    const date = new Date();
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  }

  function formatDateLabel(value) {
    const [year, month, day] = value.split("-");
    return `${year}年${Number(month)}月${Number(day)}日`;
  }

  function formatCurrency(value) {
    return `¥${roundAmount(value).toFixed(2)}`;
  }

  function roundAmount(value) {
    return Math.round(Number(value || 0) * 100) / 100;
  }

  function escapeCsvCell(value) {
    return `"${String(value ?? "").replaceAll("\"", "\"\"")}"`;
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

  function setText(id, value) {
    const node = document.getElementById(id);
    if (node) node.textContent = String(value ?? "");
  }

  function setValue(id, value) {
    const node = document.getElementById(id);
    if (node) node.value = String(value ?? "");
  }

  function setStatus(text) {
    setText("visualExportStatus", text);
  }

  function toText(value) {
    return typeof value === "string" ? value.trim() : "";
  }

  return { init };
})();

document.addEventListener("DOMContentLoaded", ExpenseVisualApp.init);
