const ExpensesApp = (() => {
  const STORAGE_KEY = "expenseTracker:v1";
  const DEFAULT_RANGE = "month";
  const FALLBACK_CATEGORY_ID = "other";
  const BUILTIN_CREATED_AT = "1970-01-01T00:00:00.000Z";
  const RANGE_META = {
    day: { label: "今日", totalLabel: "今日总消费", countLabel: "今日记录数", averageLabel: "今日平均消费", trendLabel: "今日消费趋势", categoryLabel: "今日分类构成" },
    week: { label: "本周", totalLabel: "本周总消费", countLabel: "本周记录数", averageLabel: "本周日均消费", trendLabel: "本周消费趋势", categoryLabel: "本周分类构成" },
    month: { label: "本月", totalLabel: "本月总消费", countLabel: "本月记录数", averageLabel: "本月日均消费", trendLabel: "本月消费趋势", categoryLabel: "本月分类构成" },
    year: { label: "本年", totalLabel: "本年总消费", countLabel: "本年记录数", averageLabel: "本年日均消费", trendLabel: "本年消费趋势", categoryLabel: "本年分类构成" }
  };
  const BUILTIN_CATEGORIES = [
    { id: "food", name: "餐饮", color: "#fb7185", icon: "🍜", builtin: true },
    { id: "transport", name: "交通", color: "#38bdf8", icon: "🚌", builtin: true },
    { id: "shopping", name: "购物", color: "#818cf8", icon: "🛍️", builtin: true },
    { id: "daily", name: "日用", color: "#f59e0b", icon: "🧴", builtin: true },
    { id: "fun", name: "娱乐", color: "#c084fc", icon: "🎮", builtin: true },
    { id: "study", name: "学习", color: "#34d399", icon: "📘", builtin: true },
    { id: "medical", name: "医疗", color: "#f87171", icon: "💊", builtin: true },
    { id: "housing", name: "居住", color: "#94a3b8", icon: "🏠", builtin: true },
    { id: FALLBACK_CATEGORY_ID, name: "其他", color: "#60a5fa", icon: "🧾", builtin: true }
  ];
  const state = {
    selectedRange: DEFAULT_RANGE,
    selectedForecastMonth: getCurrentMonthKey(),
    store: null
  };

  function init() {
    if (!document.getElementById("expenseForm")) return;

    state.store = getExpenseStore();
    bindEvents();
    renderAll({ resetForm: true });

    window.addEventListener("storage", event => {
      if (event.key && event.key !== STORAGE_KEY) return;
      state.store = getExpenseStore();
      renderAll({ resetForm: false });
    });
  }

  function bindEvents() {
    document.getElementById("rangeTabs")?.addEventListener("click", event => {
      const button = event.target.closest("[data-range]");
      if (!button) return;

      const nextRange = button.dataset.range;
      if (!RANGE_META[nextRange] || state.selectedRange === nextRange) return;

      state.selectedRange = nextRange;
      updateRangeButtons();
      renderHero();
      renderRangeInsights({ animate: true });
    });

    document.getElementById("forecastMonthInput")?.addEventListener("change", event => {
      const nextMonth = normalizeMonthValue(event.target.value);
      if (!nextMonth || nextMonth === state.selectedForecastMonth) {
        event.target.value = state.selectedForecastMonth;
        return;
      }

      state.selectedForecastMonth = nextMonth;
      renderForecastSection();
    });

    document.getElementById("forecastPrevMonth")?.addEventListener("click", () => {
      state.selectedForecastMonth = shiftMonth(state.selectedForecastMonth, -1);
      renderForecastSection();
    });

    document.getElementById("forecastNextMonth")?.addEventListener("click", () => {
      state.selectedForecastMonth = shiftMonth(state.selectedForecastMonth, 1);
      renderForecastSection();
    });

    document.getElementById("loadFixedForecastBtn")?.addEventListener("click", () => {
      loadFixedForecastTemplatesForCurrentMonth();
    });

    document.getElementById("expenseForm")?.addEventListener("submit", event => {
      event.preventDefault();
      saveExpenseRecord();
    });

    document.getElementById("cancelExpenseEdit")?.addEventListener("click", () => {
      resetExpenseForm();
    });

    document.getElementById("forecastItemForm")?.addEventListener("submit", event => {
      event.preventDefault();
      saveForecastItem();
    });

    document.getElementById("cancelForecastEdit")?.addEventListener("click", () => {
      resetForecastForm();
    });

    document.getElementById("categoryForm")?.addEventListener("submit", event => {
      event.preventDefault();
      saveCustomCategory();
    });

    document.getElementById("fixedForecastForm")?.addEventListener("submit", event => {
      event.preventDefault();
      saveFixedForecastTemplate();
    });

    document.getElementById("cancelFixedForecastEdit")?.addEventListener("click", () => {
      resetFixedForecastForm();
    });

    document.getElementById("recordsList")?.addEventListener("click", event => {
      const button = event.target.closest("[data-action]");
      if (!button) return;

      const id = button.dataset.id;
      if (!id) return;

      if (button.dataset.action === "edit") editExpenseRecord(id);
      if (button.dataset.action === "delete") deleteExpenseRecord(id, button);
    });

    document.getElementById("forecastFixedList")?.addEventListener("click", handleForecastListClick);
    document.getElementById("forecastOneOffList")?.addEventListener("click", handleForecastListClick);
    document.getElementById("fixedForecastTemplatesList")?.addEventListener("click", handleFixedTemplateListClick);
  }

  function renderAll(options = {}) {
    updateRangeButtons();
    renderCategoryOptions();
    renderKpis();
    renderHero();
    renderForecastSection();
    renderRangeInsights({ animate: false });

    if (options.resetForm) {
      resetExpenseForm();
      resetForecastForm();
      resetFixedForecastForm();
      resetCategoryForm();
    }
  }

  function renderKpis() {
    const totals = {
      day: getRangeStats("day", state.store.records).total,
      week: getRangeStats("week", state.store.records).total,
      month: getRangeStats("month", state.store.records).total,
      year: getRangeStats("year", state.store.records).total
    };

    setText("kpiDayTotal", formatCurrency(totals.day));
    setText("kpiWeekTotal", formatCurrency(totals.week));
    setText("kpiMonthTotal", formatCurrency(totals.month));
    setText("kpiYearTotal", formatCurrency(totals.year));
  }

  function renderForecastSection() {
    syncForecastMonthInput();
    renderForecastCategoryOptions();

    const view = buildForecastMonthView(state.store, state.selectedForecastMonth);
    setText("forecastTotalAmount", formatCurrency(view.stats.total));
    setText("forecastFixedAmount", formatCurrency(view.stats.fixedTotal));
    setText("forecastOneOffAmount", formatCurrency(view.stats.oneOffTotal));
    setText("forecastActualAmount", formatCurrency(view.stats.actualTotal));
    setText("forecastSummaryLabel", `${formatForecastMonthLabel(view.month)} 共 ${view.items.length} 项，预计支出 ${formatCurrency(view.stats.total)}`);
    setText("fixedForecastSummaryLabel", view.fixedTemplates.length ? `当前有 ${view.fixedTemplates.length} 个固定项目模板，可手动载入到任意月份。` : "你还没有固定项目模板。");

    renderForecastItems("forecastFixedList", view.groups.fixed, "fixed");
    renderForecastItems("forecastOneOffList", view.groups.oneOff, "one_off");
    renderFixedForecastTemplates(view.fixedTemplates);
  }

  function syncForecastMonthInput() {
    setValue("forecastMonthInput", state.selectedForecastMonth);
  }

  function renderForecastCategoryOptions() {
    renderSelectOptions("forecastCategoryInput");
    renderSelectOptions("fixedForecastCategoryInput");
  }

  function renderSelectOptions(selectId, preferredValue = "") {
    const select = document.getElementById(selectId);
    if (!select) return;

    const currentValue = preferredValue || toText(select.value);
    select.innerHTML = state.store.categories.map(category => `
      <option value="${escapeAttribute(category.id)}">${escapeHtml(category.icon)} ${escapeHtml(category.name)}</option>
    `).join("");

    const nextValue = state.store.categories.some(category => category.id === currentValue)
      ? currentValue
      : state.store.categories[0]?.id || FALLBACK_CATEGORY_ID;

    select.value = nextValue;
  }

  function renderForecastItems(containerId, items, kind) {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (!items.length) {
      container.innerHTML = `
        <div class="empty-state">
          <strong>${kind === "fixed" ? "这个月还没有固定项目" : "这个月还没有临时事项"}</strong>
          <span>${kind === "fixed" ? "点击“载入固定项目到本月”后，模板会进入这里。" : "像剧本杀、住宿、聚餐这种一次性支出，先放到这里。"}
          </span>
        </div>
      `;
      window.PageMotion?.reconcilePendingRemovals?.();
      return;
    }

    container.innerHTML = items.map(item => {
      const note = item.note ? `<p class="forecast-item-note">${escapeHtml(item.note)}</p>` : "";
      const recurring = item.kind === "fixed" ? `<span class="forecast-tag">${escapeHtml(item.recurringDayLabel)}</span>` : "";
      return `
        <article class="forecast-item ${item.status === "skipped" ? "is-skipped" : ""}" data-forecast-id="${escapeAttribute(item.id)}" data-forecast-month="${escapeAttribute(item.month)}">
          <div class="forecast-item-top">
            <div>
              <h4 class="forecast-item-title">${escapeHtml(item.title)}</h4>
              <div class="forecast-item-meta">
                <span class="forecast-tag">${escapeHtml(item.category.icon)} ${escapeHtml(item.category.name)}</span>
                <span class="forecast-tag">${escapeHtml(item.plannedDateLabel)}</span>
                ${recurring}
                <span class="forecast-status forecast-status--${escapeAttribute(item.status)}">${escapeHtml(getForecastStatusLabel(item.status))}</span>
              </div>
            </div>
            <div class="forecast-item-amount">${formatCurrency(item.amount)}</div>
          </div>
          ${note}
          <div class="forecast-item-actions">
            <button class="btn-secondary btn-small" type="button" data-action="edit" data-id="${escapeAttribute(item.id)}">编辑</button>
            <button class="btn-soft-success btn-small" type="button" data-action="apply-expense" data-id="${escapeAttribute(item.id)}">${item.status === "done" ? "再次预填消费" : "记为已支出"}</button>
            <button class="btn-soft-warning btn-small" type="button" data-action="${item.status === "skipped" ? "restore" : "skip"}" data-id="${escapeAttribute(item.id)}">${item.status === "skipped" ? "恢复" : "标记跳过"}</button>
            <button class="btn-danger btn-small" type="button" data-action="delete" data-id="${escapeAttribute(item.id)}">删除</button>
          </div>
        </article>
      `;
    }).join("");

    window.PageMotion?.reconcilePendingRemovals?.();
  }

  function renderFixedForecastTemplates(templates) {
    const container = document.getElementById("fixedForecastTemplatesList");
    if (!container) return;

    if (!templates.length) {
      container.innerHTML = `
        <div class="empty-state">
          <strong>还没有固定项目模板</strong>
          <span>先把每月吃饭、BTC 定投、固定住宿这类项目建成模板，再按月手动载入。</span>
        </div>
      `;
      window.PageMotion?.reconcilePendingRemovals?.();
      return;
    }

    container.innerHTML = templates.map(item => `
      <article class="forecast-template-item" data-fixed-forecast-id="${escapeAttribute(item.id)}">
        <div class="forecast-template-top">
          <div>
            <h4 class="forecast-template-title">${escapeHtml(item.title)}</h4>
            <div class="forecast-template-meta">
              <span class="forecast-tag">${escapeHtml(item.category.icon)} ${escapeHtml(item.category.name)}</span>
              <span class="forecast-tag">${item.recurringDay ? `通常每月 ${item.recurringDay} 号` : "未设置固定日期"}</span>
            </div>
          </div>
          <div class="forecast-template-amount">${formatCurrency(item.amount)}</div>
        </div>
        <p class="forecast-template-note">${escapeHtml(item.note || "暂无备注")}</p>
        <div class="forecast-template-actions">
          <button class="btn-secondary btn-small" type="button" data-action="edit" data-id="${escapeAttribute(item.id)}">编辑</button>
          <button class="btn-danger btn-small" type="button" data-action="delete" data-id="${escapeAttribute(item.id)}">删除</button>
        </div>
      </article>
    `).join("");

    window.PageMotion?.reconcilePendingRemovals?.();
  }

  function renderHero() {
    const rangeStats = getRangeStats(state.selectedRange, state.store.records);
    const categoryBreakdown = getCategoryBreakdown(rangeStats.records, state.store.categories);
    const topCategory = categoryBreakdown[0];
    const activeDays = new Set(rangeStats.records.map(record => record.date)).size;
    const meta = RANGE_META[state.selectedRange];

    setText("heroRangeTotal", formatCurrency(rangeStats.total));
    setText("heroRangeLabel", meta.totalLabel);
    setText("heroRangeCount", rangeStats.records.length);
    setText("heroCountLabel", meta.countLabel);
    setText("heroRangeAverage", formatCurrency(rangeStats.average));
    setText("heroAverageLabel", meta.averageLabel);
    setText("heroVisualRange", meta.categoryLabel);
    setText("heroTopCategory", topCategory ? `${topCategory.category.icon} ${topCategory.category.name}` : "暂无消费记录");
    setText("heroDonutValue", formatCurrency(rangeStats.total));
    setText("heroDonutCaption", meta.totalLabel);

    const heroMeta = document.getElementById("heroVisualMeta");
    if (heroMeta) {
      heroMeta.innerHTML = `
        <div class="hero-meta-pill">当前范围共 ${rangeStats.records.length} 笔消费记录。</div>
        <div class="hero-meta-pill">活跃消费天数 ${activeDays} 天。</div>
        <div class="hero-meta-pill">${topCategory ? `最高分类是 ${escapeHtml(topCategory.category.name)}，占比 ${formatPercent(topCategory.percent)}。` : "添加第一笔消费后，这里会显示最高消费分类。"}</div>
      `;
    }

    applyDonutChart(document.getElementById("heroDonutChart"), categoryBreakdown);
  }

  function renderRangeInsights(options = {}) {
    const rangeStats = getRangeStats(state.selectedRange, state.store.records);
    const categoryBreakdown = getCategoryBreakdown(rangeStats.records, state.store.categories);
    const trendPoints = buildTrendPoints(state.selectedRange, rangeStats.records);

    const renderCategory = () => renderCategoryAnalysis(rangeStats, categoryBreakdown);
    const renderTrend = () => renderTrendChart(trendPoints);
    const renderRecordsView = () => renderRecords(rangeStats.records);

    if (!options.animate || !window.PageMotion) {
      renderCategory();
      renderTrend();
      renderRecordsView();
      return;
    }

    Promise.all([
      window.PageMotion.animateSwap(document.getElementById("categoryChartPanel"), renderCategory, { outMs: 150, inMs: 240 }),
      window.PageMotion.animateSwap(document.getElementById("trendChartShell"), renderTrend, { outMs: 150, inMs: 240 }),
      window.PageMotion.animateSwap(document.getElementById("recordsList"), renderRecordsView, { outMs: 150, inMs: 240 })
    ]);
  }

  function renderCategoryAnalysis(rangeStats, breakdown) {
    const meta = RANGE_META[state.selectedRange];
    setText("categorySummaryLabel", `当前范围：${meta.label}，已自动按分类汇总消费构成。`);
    setText("categoryChartTotal", formatCurrency(rangeStats.total));
    setText("categoryChartLabel", meta.totalLabel);
    setText("categoryChartCaption", breakdown[0] ? `消费最高的是 ${breakdown[0].category.icon} ${breakdown[0].category.name}` : "当前范围暂无消费记录");
    applyDonutChart(document.getElementById("categoryDonutChart"), breakdown);
    renderCategoryLegend(breakdown);
  }

  function renderCategoryLegend(breakdown) {
    const container = document.getElementById("categoryLegend");
    if (!container) return;

    if (!breakdown.length) {
      container.innerHTML = `
        <div class="empty-state">
          <strong>还没有分类数据</strong>
          <span>新增几笔消费后，这里会自动展示分类金额和占比。</span>
        </div>
      `;
      return;
    }

    container.innerHTML = breakdown.map(item => `
      <div class="category-item">
        <div class="category-item-top">
          <span class="category-pill">
            <span class="category-dot" style="background:${escapeAttribute(item.category.color)}"></span>
            <span>${escapeHtml(item.category.icon)} ${escapeHtml(item.category.name)}</span>
          </span>
          <span class="category-amount">${formatCurrency(item.total)}</span>
        </div>
        <div class="category-progress">
          <div class="category-progress-fill" style="width:${item.percent}%; background:${escapeAttribute(item.category.color)}"></div>
        </div>
        <div class="category-foot">
          <span>占比 ${formatPercent(item.percent)}</span>
          <span>${item.count} 笔</span>
        </div>
      </div>
    `).join("");
  }

  function renderTrendChart(points) {
    const container = document.getElementById("trendChartShell");
    if (!container) return;

    const meta = RANGE_META[state.selectedRange];
    setText("trendRangeLabel", `当前查看：${meta.trendLabel}`);

    if (!points.length || points.every(point => point.total <= 0)) {
      container.innerHTML = `
        <div class="empty-state">
          <strong>当前范围暂无趋势数据</strong>
          <span>在这个时间范围内新增消费后，这里会自动展示趋势图。</span>
        </div>
      `;
      return;
    }

    const maxValue = Math.max(...points.map(point => point.total), 1);
    const minColumnWidth = state.selectedRange === "month" ? 34 : state.selectedRange === "day" ? 28 : 48;

    container.innerHTML = `
      <div class="trend-grid" style="grid-template-columns: repeat(${points.length}, minmax(${minColumnWidth}px, 1fr)); min-width: ${points.length * minColumnWidth}px;">
        ${points.map(point => {
          const height = Math.max((point.total / maxValue) * 100, point.total > 0 ? 4 : 0);
          return `
            <div class="trend-bar" title="${escapeAttribute(point.title)}">
              <div class="trend-value">${point.total > 0 ? formatCurrency(point.total) : ""}</div>
              <div class="trend-track">
                <div class="trend-fill" style="height:${height}%"></div>
              </div>
              <div class="trend-label">${escapeHtml(point.label)}</div>
            </div>
          `;
        }).join("")}
      </div>
    `;
  }

  function renderRecords(records) {
    const container = document.getElementById("recordsList");
    if (!container) return;

    const sortedRecords = records.slice().sort((a, b) => {
      if (a.date !== b.date) return b.date.localeCompare(a.date);
      return (b.createdAt || "").localeCompare(a.createdAt || "");
    });

    setText("recordsSummaryLabel", `当前范围内共 ${sortedRecords.length} 笔记录。`);

    if (!sortedRecords.length) {
      container.innerHTML = `
        <div class="empty-state">
          <strong>当前范围暂无消费记录</strong>
          <span>切换时间范围或者新增一笔消费后，这里会自动出现记录列表。</span>
        </div>
      `;
      window.PageMotion?.reconcilePendingRemovals?.();
      return;
    }

    container.innerHTML = sortedRecords.map(record => {
      const category = getCategoryById(record.categoryId);
      return `
        <article class="record-item" data-record-id="${escapeAttribute(record.id)}">
          <div class="record-main">
            <div class="record-top">
              <span class="record-category">
                <span class="category-dot" style="background:${escapeAttribute(category.color)}"></span>
                <span>${escapeHtml(category.icon)} ${escapeHtml(category.name)}</span>
              </span>
              <span class="record-date">${escapeHtml(formatDateLabel(record.date))}</span>
              <span class="record-chip">录入于 ${escapeHtml(formatDateTime(record.createdAt))}</span>
            </div>
            <p class="record-note">${escapeHtml(record.note || "未填写备注")}</p>
          </div>
          <div class="record-side">
            <div class="record-amount">${formatCurrency(record.amount)}</div>
            <div class="record-actions">
              <button class="btn-secondary" type="button" data-action="edit" data-id="${escapeAttribute(record.id)}">编辑</button>
              <button class="btn-danger" type="button" data-action="delete" data-id="${escapeAttribute(record.id)}">删除</button>
            </div>
          </div>
        </article>
      `;
    }).join("");

    window.PageMotion?.reconcilePendingRemovals?.();
  }

  function saveExpenseRecord() {
    const amount = normalizeAmount(getValue("expenseAmountInput"));
    const date = normalizeDateValue(getValue("expenseDateInput")) || getTodayValue();
    const categoryId = toText(getValue("expenseCategoryInput")) || FALLBACK_CATEGORY_ID;
    const note = toText(getValue("expenseNoteInput"));
    const editingId = toText(getValue("expenseEditingId"));

    if (!amount || amount <= 0) {
      alert("请输入大于 0 的消费金额");
      return;
    }

    if (!state.store.categories.some(category => category.id === categoryId)) {
      alert("请选择有效的消费分类");
      return;
    }

    const nextStore = cloneStore(state.store);
    const now = new Date().toISOString();

    if (editingId) {
      const current = nextStore.records.find(record => record.id === editingId);
      if (!current) return;

      current.amount = amount;
      current.date = date;
      current.categoryId = categoryId;
      current.note = note;
      current.updatedAt = now;
    } else {
      nextStore.records.push({
        id: createId("expense"),
        amount,
        date,
        categoryId,
        note,
        createdAt: now,
        updatedAt: now
      });
    }

    state.store = saveExpenseStore(nextStore);
    renderAll({ resetForm: true });
    setStatus("expenseFormStatus", editingId ? "消费记录已更新" : "消费记录已保存", true);
  }

  function editExpenseRecord(id) {
    const record = state.store.records.find(item => item.id === id);
    if (!record) return;

    setValue("expenseEditingId", record.id);
    setValue("expenseAmountInput", record.amount.toFixed(2));
    setValue("expenseDateInput", record.date);
    setValue("expenseCategoryInput", record.categoryId);
    setValue("expenseNoteInput", record.note);
    setText("expenseSubmitLabel", "保存修改");

    const cancelButton = document.getElementById("cancelExpenseEdit");
    if (cancelButton) cancelButton.hidden = false;

    setStatus("expenseFormStatus", `正在编辑：${formatDateLabel(record.date)} ${formatCurrency(record.amount)}`, true);
    document.getElementById("expenseAmountInput")?.focus();
  }

  function findExpenseDeleteElement(id, trigger) {
    if (trigger && typeof trigger.closest === "function") {
      const container = trigger.closest(".record-item");
      if (container) return container;
    }

    return document.querySelector(`[data-record-id="${id}"]`) || null;
  }

  function findForecastDeleteElement(id, trigger) {
    if (trigger && typeof trigger.closest === "function") {
      const container = trigger.closest(".forecast-item");
      if (container) return container;
    }

    return document.querySelector(`[data-forecast-id="${id}"]`) || null;
  }

  function findFixedForecastDeleteElement(id, trigger) {
    if (trigger && typeof trigger.closest === "function") {
      const container = trigger.closest(".forecast-template-item");
      if (container) return container;
    }

    return document.querySelector(`[data-fixed-forecast-id="${id}"]`) || null;
  }

  function removeForecastItemFromStore(store, forecastId) {
    Object.keys(store.forecastMonths || {}).forEach(month => {
      store.forecastMonths[month] = store.forecastMonths[month].filter(item => item.id !== forecastId);
      if (!store.forecastMonths[month].length) {
        delete store.forecastMonths[month];
      }
    });
  }

  function deleteExpenseRecord(id, trigger) {
    const recordIndex = state.store.records.findIndex(item => item.id === id);
    if (recordIndex < 0) return;

    const snapshot = { ...state.store.records[recordIndex] };
    const wasEditing = getValue("expenseEditingId") === id;
    const deleteElement = findExpenseDeleteElement(id, trigger);
    const label = snapshot.note || [formatDateLabel(snapshot.date), formatCurrency(snapshot.amount)].filter(Boolean).join(" ");

    const removeRecord = () => {
      const nextStore = cloneStore(state.store);
      nextStore.records = nextStore.records.filter(record => record.id !== id);
      state.store = saveExpenseStore(nextStore);
      renderAll({ resetForm: false });

      if (wasEditing) {
        resetExpenseForm();
      }
    };

    const restoreRecord = () => {
      if (state.store.records.some(record => record.id === id)) return;

      const nextStore = cloneStore(state.store);
      const nextRecords = nextStore.records.slice();
      nextRecords.splice(Math.min(recordIndex, nextRecords.length), 0, { ...snapshot });
      nextStore.records = nextRecords;
      state.store = saveExpenseStore(nextStore);
      renderAll({ resetForm: false });

      if (wasEditing) {
        editExpenseRecord(id);
      }
    };

    if (window.PageMotion?.removeWithUndo) {
      PageMotion.removeWithUndo({
        key: `expense:${id}`,
        element: deleteElement,
        label: label || formatCurrency(snapshot.amount),
        remove: removeRecord,
        restore: restoreRecord,
        timeoutMs: 2200
      });
      return;
    }

    removeRecord();
  }

  function handleForecastListClick(event) {
    const button = event.target.closest("[data-action]");
    if (!button) return;

    const id = button.dataset.id;
    if (!id) return;

    if (button.dataset.action === "edit") editForecastItem(id);
    if (button.dataset.action === "apply-expense") applyForecastItemToExpenseForm(id);
    if (button.dataset.action === "skip") updateForecastItemStatus(id, "skipped");
    if (button.dataset.action === "restore") updateForecastItemStatus(id, "planned");
    if (button.dataset.action === "delete") deleteForecastItem(id, button);
  }

  function handleFixedTemplateListClick(event) {
    const button = event.target.closest("[data-action]");
    if (!button) return;

    const id = button.dataset.id;
    if (!id) return;

    if (button.dataset.action === "edit") editFixedForecastTemplate(id);
    if (button.dataset.action === "delete") deleteFixedForecastTemplate(id, button);
  }

  function saveForecastItem() {
    const title = toText(getValue("forecastTitleInput"));
    const amount = normalizeAmount(getValue("forecastAmountInput"));
    const categoryId = toText(getValue("forecastCategoryInput")) || FALLBACK_CATEGORY_ID;
    const plannedDate = normalizeForecastPlannedDate(getValue("forecastDateInput"), state.selectedForecastMonth);
    const note = toText(getValue("forecastNoteInput"));
    const recurringDay = normalizeRecurringDay(getValue("forecastRecurringDayInput"));
    const editingId = toText(getValue("forecastEditingId"));
    const kind = normalizeForecastKind(getValue("forecastKindInput"));

    if (!title) {
      alert("请输入事项名称");
      return;
    }

    if (!amount || amount <= 0) {
      alert("请输入大于 0 的预计金额");
      return;
    }

    if (!state.store.categories.some(category => category.id === categoryId)) {
      alert("请选择有效的分类");
      return;
    }

    const nextStore = cloneStore(state.store);
    const now = new Date().toISOString();
    const existing = editingId ? findForecastItem(state.store, editingId)?.item : null;
    const nextItem = normalizeForecastItem({
      ...existing,
      id: existing?.id || createId("forecast"),
      title,
      amount,
      categoryId,
      month: state.selectedForecastMonth,
      kind,
      plannedDate,
      recurringDay,
      note,
      status: existing?.status || "planned",
      createdAt: existing?.createdAt || now,
      updatedAt: now
    }, new Set(nextStore.categories.map(category => category.id)));

    if (!nextItem) {
      alert("预估项数据不完整");
      return;
    }

    if (editingId) {
      removeForecastItemFromStore(nextStore, editingId);
    }

    nextStore.forecastMonths[nextItem.month] = (nextStore.forecastMonths[nextItem.month] || [])
      .concat(nextItem)
      .sort(compareForecastItems);

    state.store = saveExpenseStore(nextStore);
    renderAll({ resetForm: false });
    resetForecastForm();
    setStatus("forecastFormStatus", editingId ? "本月预估项已更新" : "临时事项已保存", true);
  }

  function saveFixedForecastTemplate() {
    const title = toText(getValue("fixedForecastTitleInput"));
    const amount = normalizeAmount(getValue("fixedForecastAmountInput"));
    const categoryId = toText(getValue("fixedForecastCategoryInput")) || FALLBACK_CATEGORY_ID;
    const recurringDay = normalizeRecurringDay(getValue("fixedForecastRecurringDayInput"));
    const note = toText(getValue("fixedForecastNoteInput"));
    const editingId = toText(getValue("fixedForecastEditingId"));
    const now = new Date().toISOString();

    if (!title) {
      alert("请输入固定项目名称");
      return;
    }

    if (!amount || amount <= 0) {
      alert("请输入大于 0 的默认金额");
      return;
    }

    if (!state.store.categories.some(category => category.id === categoryId)) {
      alert("请选择有效的分类");
      return;
    }

    const nextStore = cloneStore(state.store);
    const existing = editingId ? nextStore.fixedForecastTemplates.find(item => item.id === editingId) : null;
    const nextTemplate = normalizeFixedForecastTemplate({
      ...existing,
      id: existing?.id || createId("fixed-forecast"),
      title,
      amount,
      categoryId,
      recurringDay,
      note,
      createdAt: existing?.createdAt || now,
      updatedAt: now
    }, new Set(nextStore.categories.map(category => category.id)));

    if (!nextTemplate) {
      alert("固定项目数据不完整");
      return;
    }

    if (editingId) {
      nextStore.fixedForecastTemplates = nextStore.fixedForecastTemplates.map(item => item.id === editingId ? nextTemplate : item);
    } else {
      nextStore.fixedForecastTemplates.push(nextTemplate);
    }

    nextStore.fixedForecastTemplates.sort(compareFixedForecastTemplates);
    state.store = saveExpenseStore(nextStore);
    renderAll({ resetForm: false });
    resetFixedForecastForm();
    setStatus("fixedForecastFormStatus", editingId ? "固定项目模板已更新" : "固定项目模板已保存", true);
  }

  function editForecastItem(id) {
    const match = findForecastItem(state.store, id);
    if (!match?.item) return;

    const item = match.item;
    state.selectedForecastMonth = item.month;
    syncForecastMonthInput();

    setValue("forecastEditingId", item.id);
    setValue("forecastKindInput", item.kind);
    setValue("forecastTitleInput", item.title);
    setValue("forecastAmountInput", item.amount.toFixed(2));
    setValue("forecastCategoryInput", item.categoryId);
    setValue("forecastDateInput", item.plannedDate);
    setValue("forecastRecurringDayInput", item.recurringDay || "");
    setValue("forecastNoteInput", item.note);
    toggleForecastRecurringDayField(item.kind === "fixed");
    setText("forecastSubmitLabel", "保存预估项");
    setStatus("forecastFormStatus", `正在编辑：${item.title}`, true);

    const cancelButton = document.getElementById("cancelForecastEdit");
    if (cancelButton) cancelButton.hidden = false;

    document.getElementById("forecastTitleInput")?.focus();
  }

  function editFixedForecastTemplate(id) {
    const template = state.store.fixedForecastTemplates.find(item => item.id === id);
    if (!template) return;

    setValue("fixedForecastEditingId", template.id);
    setValue("fixedForecastTitleInput", template.title);
    setValue("fixedForecastAmountInput", template.amount.toFixed(2));
    setValue("fixedForecastCategoryInput", template.categoryId);
    setValue("fixedForecastRecurringDayInput", template.recurringDay || "");
    setValue("fixedForecastNoteInput", template.note);
    setText("fixedForecastSubmitLabel", "保存固定项目");
    setStatus("fixedForecastFormStatus", `正在编辑：${template.title}`, true);

    const cancelButton = document.getElementById("cancelFixedForecastEdit");
    if (cancelButton) cancelButton.hidden = false;

    document.getElementById("fixedForecastTitleInput")?.focus();
  }

  function updateForecastItemStatus(id, nextStatus) {
    const match = findForecastItem(state.store, id);
    if (!match?.item) return;

    const nextStore = cloneStore(state.store);
    nextStore.forecastMonths[match.month] = nextStore.forecastMonths[match.month].map(item => item.id === id
      ? {
          ...item,
          status: normalizeForecastStatus(nextStatus),
          updatedAt: new Date().toISOString()
        }
      : item
    );

    state.store = saveExpenseStore(nextStore);
    renderForecastSection();
    setStatus("forecastFormStatus", nextStatus === "skipped" ? "该项已标记为跳过" : "该项已恢复到计划中", true);
  }

  function applyForecastItemToExpenseForm(id) {
    const match = findForecastItem(state.store, id);
    if (!match?.item) return;

    const item = match.item;
    updateForecastItemStatus(id, "done");
    const fallbackDate = item.recurringDay
      ? `${item.month}-${String(item.recurringDay).padStart(2, "0")}`
      : `${item.month}-01`;

    setValue("expenseEditingId", "");
    setValue("expenseAmountInput", item.amount.toFixed(2));
    setValue("expenseDateInput", item.plannedDate || fallbackDate);
    setValue("expenseCategoryInput", item.categoryId);
    setValue("expenseNoteInput", item.note || item.title);
    setText("expenseSubmitLabel", "保存消费");
    setStatus("expenseFormStatus", `已从预估项预填：${item.title}，确认后再保存到实际消费记录。`, true);

    const cancelButton = document.getElementById("cancelExpenseEdit");
    if (cancelButton) cancelButton.hidden = true;

    document.getElementById("expenseAmountInput")?.focus();
  }

  function loadFixedForecastTemplatesForCurrentMonth() {
    const nextStore = cloneStore(state.store);
    const templates = nextStore.fixedForecastTemplates.slice();

    if (!templates.length) {
      setStatus("fixedForecastFormStatus", "还没有固定项目模板可载入", false);
      return;
    }

    const existing = nextStore.forecastMonths[state.selectedForecastMonth] || [];
    const now = new Date().toISOString();
    let inserted = 0;

    templates.forEach(template => {
      const duplicate = existing.some(item =>
        item.kind === "fixed" &&
        item.title === template.title &&
        item.amount === template.amount &&
        item.categoryId === template.categoryId
      );

      if (duplicate) return;

      existing.push({
        id: createId("forecast"),
        title: template.title,
        amount: template.amount,
        categoryId: template.categoryId,
        month: state.selectedForecastMonth,
        kind: "fixed",
        plannedDate: "",
        recurringDay: template.recurringDay,
        note: template.note,
        status: "planned",
        createdAt: now,
        updatedAt: now
      });
      inserted += 1;
    });

    nextStore.forecastMonths[state.selectedForecastMonth] = existing.sort(compareForecastItems);
    state.store = saveExpenseStore(nextStore);
    renderForecastSection();
    setStatus("fixedForecastFormStatus", inserted ? `已载入 ${inserted} 个固定项目到 ${formatForecastMonthLabel(state.selectedForecastMonth)}` : "这个月已包含所有固定项目，无需重复载入", true);
  }

  function deleteForecastItem(id, trigger) {
    const match = findForecastItem(state.store, id);
    if (!match?.item) return;

    const snapshot = { ...match.item };
    const month = match.month;
    const deleteElement = findForecastDeleteElement(id, trigger);

    const removeItem = () => {
      const nextStore = cloneStore(state.store);
      removeForecastItemFromStore(nextStore, id);
      state.store = saveExpenseStore(nextStore);
      renderForecastSection();
    };

    const restoreItem = () => {
      const nextStore = cloneStore(state.store);
      nextStore.forecastMonths[month] = (nextStore.forecastMonths[month] || [])
        .concat(snapshot)
        .sort(compareForecastItems);
      state.store = saveExpenseStore(nextStore);
      renderForecastSection();
    };

    if (window.PageMotion?.removeWithUndo) {
      PageMotion.removeWithUndo({
        key: `forecast:${id}`,
        element: deleteElement,
        label: snapshot.title,
        remove: removeItem,
        restore: restoreItem,
        timeoutMs: 2200
      });
      return;
    }

    removeItem();
  }

  function deleteFixedForecastTemplate(id, trigger) {
    const templateIndex = state.store.fixedForecastTemplates.findIndex(item => item.id === id);
    if (templateIndex < 0) return;

    const snapshot = { ...state.store.fixedForecastTemplates[templateIndex] };
    const deleteElement = findFixedForecastDeleteElement(id, trigger);

    const removeTemplate = () => {
      const nextStore = cloneStore(state.store);
      nextStore.fixedForecastTemplates = nextStore.fixedForecastTemplates.filter(item => item.id !== id);
      state.store = saveExpenseStore(nextStore);
      renderForecastSection();
    };

    const restoreTemplate = () => {
      const nextStore = cloneStore(state.store);
      const nextTemplates = nextStore.fixedForecastTemplates.slice();
      nextTemplates.splice(Math.min(templateIndex, nextTemplates.length), 0, snapshot);
      nextStore.fixedForecastTemplates = nextTemplates.sort(compareFixedForecastTemplates);
      state.store = saveExpenseStore(nextStore);
      renderForecastSection();
    };

    if (window.PageMotion?.removeWithUndo) {
      PageMotion.removeWithUndo({
        key: `fixed-forecast:${id}`,
        element: deleteElement,
        label: snapshot.title,
        remove: removeTemplate,
        restore: restoreTemplate,
        timeoutMs: 2200
      });
      return;
    }

    removeTemplate();
  }

  function saveCustomCategory() {
    const name = toText(getValue("categoryNameInput"));
    const icon = toText(getValue("categoryIconInput")) || "🧾";
    const color = toText(getValue("categoryColorInput")) || "#60a5fa";

    if (!name) {
      alert("请输入分类名称");
      return;
    }

    const exists = state.store.categories.some(category => category.name.toLowerCase() === name.toLowerCase());
    if (exists) {
      alert("这个分类已经存在了");
      return;
    }

    const nextStore = cloneStore(state.store);
    const nextCategory = {
      id: createId("category"),
      name,
      icon,
      color,
      builtin: false,
      createdAt: new Date().toISOString()
    };

    nextStore.categories.push(nextCategory);
    state.store = saveExpenseStore(nextStore);
    renderCategoryOptions(nextCategory.id);
    resetCategoryForm();
    setStatus("categoryFormStatus", `已添加分类：${name}`, true);
  }

  function resetExpenseForm() {
    setValue("expenseEditingId", "");
    setValue("expenseAmountInput", "");
    setValue("expenseDateInput", getTodayValue());
    setValue("expenseNoteInput", "");

    const firstCategory = state.store.categories[0]?.id || FALLBACK_CATEGORY_ID;
    setValue("expenseCategoryInput", firstCategory);
    setText("expenseSubmitLabel", "保存消费");
    setStatus("expenseFormStatus", "");

    const cancelButton = document.getElementById("cancelExpenseEdit");
    if (cancelButton) cancelButton.hidden = true;
  }

  function resetForecastForm() {
    setValue("forecastEditingId", "");
    setValue("forecastKindInput", "one_off");
    setValue("forecastTitleInput", "");
    setValue("forecastAmountInput", "");
    setValue("forecastDateInput", `${state.selectedForecastMonth}-01`);
    setValue("forecastRecurringDayInput", "");
    setValue("forecastNoteInput", "");
    renderSelectOptions("forecastCategoryInput");
    setText("forecastSubmitLabel", "保存临时事项");
    setStatus("forecastFormStatus", "");
    toggleForecastRecurringDayField(false);

    const cancelButton = document.getElementById("cancelForecastEdit");
    if (cancelButton) cancelButton.hidden = true;
  }

  function resetFixedForecastForm() {
    setValue("fixedForecastEditingId", "");
    setValue("fixedForecastTitleInput", "");
    setValue("fixedForecastAmountInput", "");
    setValue("fixedForecastRecurringDayInput", "");
    setValue("fixedForecastNoteInput", "");
    renderSelectOptions("fixedForecastCategoryInput");
    setText("fixedForecastSubmitLabel", "保存固定项目");
    setStatus("fixedForecastFormStatus", "");

    const cancelButton = document.getElementById("cancelFixedForecastEdit");
    if (cancelButton) cancelButton.hidden = true;
  }

  function toggleForecastRecurringDayField(visible) {
    const field = document.getElementById("forecastRecurringDayField");
    if (field) field.hidden = !visible;
  }

  function resetCategoryForm() {
    setValue("categoryNameInput", "");
    setValue("categoryIconInput", "");
    setValue("categoryColorInput", "#60a5fa");
    setStatus("categoryFormStatus", "");
  }

  function renderCategoryOptions(preferredCategoryId = "") {
    renderSelectOptions("expenseCategoryInput", preferredCategoryId);
    renderSelectOptions("forecastCategoryInput", preferredCategoryId);
    renderSelectOptions("fixedForecastCategoryInput", preferredCategoryId);
  }

  function getExpenseStore() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      const normalized = normalizeStore(parsed);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
      return normalized;
    } catch (error) {
      const fallback = createDefaultStore();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(fallback));
      return fallback;
    }
  }

  function saveExpenseStore(store) {
    const normalized = normalizeStore(store);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
    return normalized;
  }

  function createDefaultStore() {
    return {
      records: [],
      forecastMonths: {},
      fixedForecastTemplates: [],
      budgetMonths: {},
      categories: BUILTIN_CATEGORIES.map(category => ({
        ...category,
        createdAt: BUILTIN_CREATED_AT
      }))
    };
  }

  function normalizeStore(raw) {
    const source = raw && typeof raw === "object" ? raw : {};
    const categories = normalizeCategories(source.categories);
    const categoryIds = new Set(categories.map(category => category.id));

    const records = Array.isArray(source.records)
      ? source.records
          .filter(record => record && typeof record === "object")
          .map(record => normalizeRecord(record, categoryIds))
          .filter(Boolean)
      : [];
    const forecastMonths = normalizeForecastMonths(source.forecastMonths, categoryIds);
    const fixedForecastTemplates = normalizeFixedForecastTemplates(source.fixedForecastTemplates, categoryIds);
    const budgetMonths = normalizeBudgetMonths(source.budgetMonths, categoryIds);

    return { records, categories, forecastMonths, fixedForecastTemplates, budgetMonths };
  }

  function normalizeCategories(rawCategories) {
    const normalizedCustom = Array.isArray(rawCategories)
      ? rawCategories
          .filter(category => category && typeof category === "object" && !BUILTIN_CATEGORIES.some(builtin => builtin.id === category.id))
          .map(category => ({
            id: toText(category.id) || createId("category"),
            name: toText(category.name) || "未命名分类",
            color: normalizeColor(category.color),
            icon: toText(category.icon) || "🧾",
            builtin: false,
            createdAt: normalizeDateTime(category.createdAt) || new Date().toISOString()
          }))
      : [];

    return [
      ...BUILTIN_CATEGORIES.map(category => ({
        ...category,
        createdAt: BUILTIN_CREATED_AT
      })),
      ...normalizedCustom
    ];
  }

  function normalizeRecord(record, categoryIds) {
    const amount = normalizeAmount(record.amount);
    if (!amount || amount <= 0) return null;

    const createdAt = normalizeDateTime(record.createdAt) || new Date().toISOString();
    return {
      id: toText(record.id) || createId("expense"),
      amount,
      date: normalizeDateValue(record.date) || getTodayValue(),
      categoryId: categoryIds.has(record.categoryId) ? record.categoryId : FALLBACK_CATEGORY_ID,
      note: toText(record.note),
      createdAt,
      updatedAt: normalizeDateTime(record.updatedAt) || createdAt
    };
  }

  function normalizeFixedForecastTemplates(rawTemplates, categoryIds) {
    return Array.isArray(rawTemplates)
      ? rawTemplates
          .filter(template => template && typeof template === "object")
          .map(template => normalizeFixedForecastTemplate(template, categoryIds))
          .filter(Boolean)
      : [];
  }

  function normalizeForecastMonths(rawMonths, categoryIds) {
    const source = rawMonths && typeof rawMonths === "object" ? rawMonths : {};
    const normalized = {};

    Object.entries(source).forEach(([monthKey, items]) => {
      const month = normalizeMonthValue(monthKey);
      if (!month || !Array.isArray(items)) return;

      const nextItems = items
        .filter(item => item && typeof item === "object")
        .map(item => normalizeForecastItem({ ...item, month }, categoryIds))
        .filter(Boolean)
        .sort(compareForecastItems);

      if (nextItems.length) {
        normalized[month] = nextItems;
      }
    });

    return normalized;
  }

  function normalizeBudgetMonths(rawMonths, categoryIds) {
    const source = rawMonths && typeof rawMonths === "object" ? rawMonths : {};
    const normalized = {};

    Object.entries(source).forEach(([monthKey, value]) => {
      const month = normalizeMonthValue(monthKey);
      if (!month || !value || typeof value !== "object") return;

      const categoryBudgets = value.categoryBudgets && typeof value.categoryBudgets === "object"
        ? Object.fromEntries(Object.entries(value.categoryBudgets)
            .filter(([categoryId, amount]) => categoryIds.has(categoryId) && normalizeAmount(amount) > 0)
            .map(([categoryId, amount]) => [categoryId, normalizeAmount(amount)]))
        : {};

      normalized[month] = {
        totalBudget: normalizeAmount(value.totalBudget),
        categoryBudgets
      };
    });

    return normalized;
  }

  function normalizeForecastItem(item, categoryIds) {
    const amount = normalizeAmount(item.amount);
    const month = normalizeMonthValue(item.month);
    if (!amount || !month) return null;

    const createdAt = normalizeDateTime(item.createdAt) || new Date().toISOString();
    return {
      id: toText(item.id) || createId("forecast"),
      title: toText(item.title) || "未命名预估项",
      amount,
      categoryId: categoryIds.has(item.categoryId) ? item.categoryId : FALLBACK_CATEGORY_ID,
      month,
      kind: normalizeForecastKind(item.kind),
      plannedDate: normalizeForecastPlannedDate(item.plannedDate, month),
      recurringDay: normalizeRecurringDay(item.recurringDay),
      note: toText(item.note),
      status: normalizeForecastStatus(item.status),
      createdAt,
      updatedAt: normalizeDateTime(item.updatedAt) || createdAt
    };
  }

  function normalizeFixedForecastTemplate(template, categoryIds) {
    const amount = normalizeAmount(template.amount);
    if (!amount) return null;

    const createdAt = normalizeDateTime(template.createdAt) || new Date().toISOString();
    return {
      id: toText(template.id) || createId("fixed-forecast"),
      title: toText(template.title) || "未命名固定项",
      amount,
      categoryId: categoryIds.has(template.categoryId) ? template.categoryId : FALLBACK_CATEGORY_ID,
      recurringDay: normalizeRecurringDay(template.recurringDay),
      note: toText(template.note),
      createdAt,
      updatedAt: normalizeDateTime(template.updatedAt) || createdAt
    };
  }

  function getRangeStats(range, records) {
    const info = getRangeInfo(range);
    const rangeRecords = records.filter(record => {
      const recordDate = parseDateValue(record.date);
      return recordDate >= info.start && recordDate <= info.end;
    });
    const total = roundAmount(rangeRecords.reduce((sum, record) => sum + record.amount, 0));
    const elapsedDays = getElapsedDays(range, info.start, info.end);

    return {
      info,
      records: rangeRecords,
      total,
      average: elapsedDays ? roundAmount(total / elapsedDays) : 0
    };
  }

  function buildForecastMonthView(store, month) {
    const normalized = normalizeStore(store);
    const targetMonth = normalizeMonthValue(month) || getCurrentMonthKey();
    const items = (normalized.forecastMonths[targetMonth] || []).map(item => ({
      ...item,
      category: normalized.categories.find(category => category.id === item.categoryId) || getFallbackCategory(),
      plannedDateLabel: item.plannedDate ? formatDateLabel(item.plannedDate) : "本月内",
      recurringDayLabel: item.recurringDay ? `通常每月 ${item.recurringDay} 号` : "每月固定项目"
    }));
    const activeItems = items.filter(item => item.status !== "skipped");

    return {
      month: targetMonth,
      items,
      stats: {
        total: roundAmount(activeItems.reduce((sum, item) => sum + item.amount, 0)),
        fixedTotal: roundAmount(activeItems.filter(item => item.kind === "fixed").reduce((sum, item) => sum + item.amount, 0)),
        oneOffTotal: roundAmount(activeItems.filter(item => item.kind === "one_off").reduce((sum, item) => sum + item.amount, 0)),
        actualTotal: roundAmount(normalized.records.filter(record => toMonthKey(record.date) === targetMonth).reduce((sum, record) => sum + record.amount, 0))
      },
      groups: {
        fixed: items.filter(item => item.kind === "fixed"),
        oneOff: items.filter(item => item.kind === "one_off")
      },
      fixedTemplates: normalized.fixedForecastTemplates.slice().sort(compareFixedForecastTemplates)
    };
  }

  function getRangeInfo(range) {
    const now = new Date();
    const today = startOfDay(now);

    if (range === "day") {
      return { label: RANGE_META.day.label, start: today, end: endOfDay(today) };
    }

    if (range === "week") {
      const start = startOfWeek(today);
      return { label: RANGE_META.week.label, start, end: endOfDay(addDays(start, 6)) };
    }

    if (range === "year") {
      const start = new Date(today.getFullYear(), 0, 1);
      return { label: RANGE_META.year.label, start, end: endOfDay(new Date(today.getFullYear(), 11, 31)) };
    }

    const start = new Date(today.getFullYear(), today.getMonth(), 1);
    const end = endOfDay(new Date(today.getFullYear(), today.getMonth() + 1, 0));
    return { label: RANGE_META.month.label, start, end };
  }

  function getElapsedDays(range, start, end) {
    const today = startOfDay(new Date());
    const effectiveEnd = today < end ? today : startOfDay(end);
    if (range === "day") return 1;
    return Math.max(Math.floor((effectiveEnd - startOfDay(start)) / 86400000) + 1, 1);
  }

  function getCategoryBreakdown(records, categories) {
    const totals = new Map();

    records.forEach(record => {
      totals.set(record.categoryId, roundAmount((totals.get(record.categoryId) || 0) + record.amount));
    });

    const overall = roundAmount(records.reduce((sum, record) => sum + record.amount, 0));
    if (!overall) return [];

    return Array.from(totals.entries())
      .map(([categoryId, total]) => ({
        category: categories.find(category => category.id === categoryId) || getFallbackCategory(),
        total,
        percent: Math.round((total / overall) * 1000) / 10,
        count: records.filter(record => record.categoryId === categoryId).length
      }))
      .sort((a, b) => b.total - a.total);
  }

  function buildTrendPoints(range, records) {
    if (range === "day") {
      const totals = Array.from({ length: 24 }, (_, hour) => ({
        label: `${String(hour).padStart(2, "0")}`,
        total: 0
      }));

      records.forEach(record => {
        const hour = new Date(record.createdAt).getHours();
        totals[hour].total = roundAmount(totals[hour].total + record.amount);
      });

      return totals.map((point, index) => ({
        label: `${String(index).padStart(2, "0")}`,
        total: point.total,
        title: `${String(index).padStart(2, "0")}:00 - ${formatCurrency(point.total)}`
      }));
    }

    if (range === "week") {
      const start = startOfWeek(startOfDay(new Date()));
      const labels = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];
      return labels.map((label, index) => {
        const dateValue = toDateValue(addDays(start, index));
        const total = roundAmount(records.filter(record => record.date === dateValue).reduce((sum, record) => sum + record.amount, 0));
        return {
          label,
          total,
          title: `${label} - ${formatCurrency(total)}`
        };
      });
    }

    if (range === "year") {
      const year = new Date().getFullYear();
      return Array.from({ length: 12 }, (_, month) => {
        const total = roundAmount(records.filter(record => {
          const date = parseDateValue(record.date);
          return date.getFullYear() === year && date.getMonth() === month;
        }).reduce((sum, record) => sum + record.amount, 0));

        return {
          label: `${month + 1}月`,
          total,
          title: `${month + 1}月 - ${formatCurrency(total)}`
        };
      });
    }

    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    return Array.from({ length: daysInMonth }, (_, dayIndex) => {
      const dateValue = toDateValue(new Date(year, month, dayIndex + 1));
      const total = roundAmount(records.filter(record => record.date === dateValue).reduce((sum, record) => sum + record.amount, 0));
      return {
        label: `${dayIndex + 1}`,
        total,
        title: `${dayIndex + 1}日 - ${formatCurrency(total)}`
      };
    });
  }

  function applyDonutChart(element, breakdown) {
    if (!element) return;

    if (!breakdown.length) {
      element.style.background = "conic-gradient(rgba(255, 255, 255, 0.12) 0deg 360deg)";
      return;
    }

    let offset = 0;
    const segments = breakdown.map(item => {
      const start = offset;
      const end = item === breakdown[breakdown.length - 1] ? 360 : start + (item.percent / 100) * 360;
      offset = end;
      return `${item.category.color} ${start}deg ${end}deg`;
    });

    element.style.background = `conic-gradient(${segments.join(", ")})`;
  }

  function updateRangeButtons() {
    document.querySelectorAll("[data-range]").forEach(button => {
      button.classList.toggle("active", button.dataset.range === state.selectedRange);
    });
  }

  function getCategoryById(id) {
    return state.store.categories.find(category => category.id === id) || getFallbackCategory();
  }

  function getFallbackCategory() {
    return BUILTIN_CATEGORIES.find(category => category.id === FALLBACK_CATEGORY_ID) || BUILTIN_CATEGORIES[0];
  }

  function cloneStore(store) {
    return {
      records: store.records.map(record => ({ ...record })),
      categories: store.categories.map(category => ({ ...category })),
      forecastMonths: Object.fromEntries(Object.entries(store.forecastMonths || {}).map(([month, items]) => [
        month,
        items.map(item => ({ ...item }))
      ])),
      fixedForecastTemplates: (store.fixedForecastTemplates || []).map(item => ({ ...item })),
      budgetMonths: Object.fromEntries(Object.entries(store.budgetMonths || {}).map(([month, value]) => [
        month,
        {
          totalBudget: value.totalBudget || 0,
          categoryBudgets: { ...(value.categoryBudgets || {}) }
        }
      ]))
    };
  }

  function startOfDay(date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  function endOfDay(date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
  }

  function startOfWeek(date) {
    const current = startOfDay(date);
    const day = current.getDay() || 7;
    current.setDate(current.getDate() - day + 1);
    return current;
  }

  function addDays(date, days) {
    const next = new Date(date);
    next.setDate(next.getDate() + days);
    return next;
  }

  function roundAmount(value) {
    return Math.round(Number(value || 0) * 100) / 100;
  }

  function normalizeAmount(value) {
    const number = Number(value);
    if (Number.isNaN(number) || number <= 0) return 0;
    return roundAmount(number);
  }

  function normalizeMonthValue(value) {
    const text = toText(value);
    if (!/^\d{4}-\d{2}$/.test(text)) return "";
    const [year, month] = text.split("-").map(part => Number.parseInt(part, 10));
    if (!year || !month || month < 1 || month > 12) return "";
    return `${year}-${String(month).padStart(2, "0")}`;
  }

  function normalizeRecurringDay(value) {
    const day = Number.parseInt(value, 10);
    if (!Number.isInteger(day) || day < 1 || day > 31) return null;
    return day;
  }

  function normalizeForecastKind(value) {
    return value === "fixed" ? "fixed" : "one_off";
  }

  function normalizeForecastStatus(value) {
    return ["planned", "done", "skipped"].includes(value) ? value : "planned";
  }

  function normalizeForecastPlannedDate(value, month) {
    const normalized = normalizeDateValue(value);
    if (!normalized) return "";
    return toMonthKey(normalized) === month ? normalized : "";
  }

  function normalizeDateValue(value) {
    const text = toText(value);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return "";
    const date = parseDateValue(text);
    return Number.isNaN(date.getTime()) ? "" : text;
  }

  function normalizeDateTime(value) {
    const text = toText(value);
    if (!text) return "";
    const date = new Date(text);
    return Number.isNaN(date.getTime()) ? "" : date.toISOString();
  }

  function normalizeColor(value) {
    const text = toText(value);
    return /^#[0-9a-fA-F]{6}$/.test(text) ? text : "#60a5fa";
  }

  function toMonthKey(value) {
    const normalized = normalizeDateValue(value);
    return normalized ? normalized.slice(0, 7) : "";
  }

  function getCurrentMonthKey() {
    return getTodayValue().slice(0, 7);
  }

  function shiftMonth(monthValue, delta) {
    const month = normalizeMonthValue(monthValue) || getCurrentMonthKey();
    const [year, monthIndex] = month.split("-").map(part => Number.parseInt(part, 10));
    return `${new Date(year, monthIndex - 1 + delta, 1).getFullYear()}-${String(new Date(year, monthIndex - 1 + delta, 1).getMonth() + 1).padStart(2, "0")}`;
  }

  function compareForecastItems(a, b) {
    const aDate = a.plannedDate || `${a.month}-99`;
    const bDate = b.plannedDate || `${b.month}-99`;
    if (aDate !== bDate) return aDate.localeCompare(bDate);
    if (a.kind !== b.kind) return a.kind === "fixed" ? -1 : 1;
    return String(a.createdAt || "").localeCompare(String(b.createdAt || ""));
  }

  function compareFixedForecastTemplates(a, b) {
    return String(a.createdAt || "").localeCompare(String(b.createdAt || ""));
  }

  function findForecastItem(store, forecastId) {
    const targetId = toText(forecastId);
    if (!targetId) return null;

    for (const [month, items] of Object.entries(store.forecastMonths || {})) {
      const item = items.find(entry => entry.id === targetId);
      if (item) return { month, item };
    }

    return null;
  }

  function parseDateValue(value) {
    const [year, month, day] = String(value).split("-").map(part => Number.parseInt(part, 10));
    return new Date(year, (month || 1) - 1, day || 1);
  }

  function formatDateLabel(value) {
    const date = parseDateValue(value);
    return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
  }

  function formatDateTime(value) {
    const date = new Date(value);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
  }

  function formatCurrency(value) {
    return `¥${roundAmount(value).toFixed(2)}`;
  }

  function formatPercent(value) {
    return `${roundAmount(value).toFixed(1)}%`;
  }

  function formatForecastMonthLabel(monthValue) {
    const month = normalizeMonthValue(monthValue);
    if (!month) return "当前月份";
    const [year, monthNumber] = month.split("-");
    return `${year} 年 ${Number.parseInt(monthNumber, 10)} 月`;
  }

  function getForecastStatusLabel(status) {
    if (status === "done") return "已记为支出";
    if (status === "skipped") return "已跳过";
    return "计划中";
  }

  function getTodayValue() {
    return toDateValue(new Date());
  }

  function toDateValue(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  }

  function createId(prefix) {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      return `${prefix}-${window.crypto.randomUUID()}`;
    }
    return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
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

  function getValue(id) {
    const node = document.getElementById(id);
    return node ? node.value : "";
  }

  function setStatus(id, text, success = false) {
    const node = document.getElementById(id);
    if (!node) return;
    node.textContent = text;
    node.classList.toggle("success", Boolean(text) && success);
  }

  function toText(value) {
    return typeof value === "string" ? value.trim() : "";
  }

  return { init };
})();

document.addEventListener("DOMContentLoaded", ExpensesApp.init);
