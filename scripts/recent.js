const RecentPlanApp = (() => {
  const STORAGE_KEY = "recentPlan:v1";
  const DEFAULT_FILTER = "all";
  const DEFAULT_LANE = "focus";
  const DEFAULT_WINDOW = "this_week";

  const LANE_META = {
    focus: {
      label: "本周关注",
      summary: "放最近几天最想盯住的弹性事项",
      listId: "recentLaneFocus",
      countId: "laneCountFocus"
    },
    in_progress: {
      label: "进行中",
      summary: "已经在推进，但细节还会变化",
      listId: "recentLaneInProgress",
      countId: "laneCountInProgress"
    },
    waiting: {
      label: "等待中",
      summary: "先等回复、时机或外部条件",
      listId: "recentLaneWaiting",
      countId: "laneCountWaiting"
    },
    later: {
      label: "以后再看",
      summary: "先记下来，暂时不急着推进",
      listId: "recentLaneLater",
      countId: "laneCountLater"
    }
  };

  const WINDOW_META = {
    all: { label: "全部" },
    this_week: { label: "本周" },
    next_week: { label: "下周" },
    this_month: { label: "本月" },
    unscheduled: { label: "未排期" }
  };

  const LANE_ORDER = ["focus", "in_progress", "waiting", "later"];
  const WINDOW_ORDER = ["this_week", "next_week", "this_month", "unscheduled"];

  const state = {
    filter: DEFAULT_FILTER,
    store: null
  };

  function init() {
    if (!document.getElementById("recentForm")) return;

    state.store = getRecentStore();
    bindEvents();
    renderAll();

    window.addEventListener("storage", event => {
      if (event.key && event.key !== STORAGE_KEY) return;
      state.store = getRecentStore();
      renderAll();
    });
  }

  function bindEvents() {
    document.getElementById("recentForm")?.addEventListener("submit", event => {
      event.preventDefault();
      saveCard();
    });

    document.getElementById("recentCancelButton")?.addEventListener("click", () => {
      resetForm();
    });

    document.getElementById("recentFilterTabs")?.addEventListener("click", event => {
      const button = event.target.closest("[data-filter]");
      if (!button) return;

      const nextFilter = button.dataset.filter;
      if (!WINDOW_META[nextFilter] || state.filter === nextFilter) return;

      state.filter = nextFilter;
      updateFilterButtons();
      renderLanes();
    });

    document.addEventListener("click", event => {
      const action = event.target.closest("[data-action]");
      if (!action) return;

      const id = action.dataset.id;
      if (!id) return;

      if (action.dataset.action === "edit") {
        editCard(id);
      }

      if (action.dataset.action === "delete") {
        deleteCard(id, action);
      }
    });

    document.addEventListener("change", event => {
      const select = event.target.closest("[data-action='move']");
      if (!select) return;
      updateCardLane(select.dataset.id, select.value);
    });
  }

  function renderAll() {
    updateFilterButtons();
    renderStats();
    renderHeroLaneSummary();
    renderLanes();
    ensureFormDefaults();
  }

  function renderStats() {
    const cards = state.store.cards;
    const focusCount = cards.filter(card => card.lane === "focus").length;
    const waitingCount = cards.filter(card => card.lane === "waiting").length;

    setText("statTotalCards", String(cards.length));
    setText("statThisWeekFocus", String(focusCount));
    setText("statWaitingCount", String(waitingCount));
  }

  function renderHeroLaneSummary() {
    const host = document.getElementById("heroLaneSummary");
    if (!host) return;

    host.innerHTML = LANE_ORDER.map(lane => {
      const count = state.store.cards.filter(card => card.lane === lane).length;
      return `
        <div class="mini-stat">
          <strong>${count}</strong>
          <span>${escapeHtml(LANE_META[lane].label)}</span>
        </div>
      `;
    }).join("");
  }

  function renderLanes() {
    const filteredCards = getFilteredCards();

    setText(
      "filterSummaryText",
      state.filter === "all"
        ? "按窗口查看未来 30 天里仍在变化中的事项。"
        : `当前只显示「${WINDOW_META[state.filter].label}」窗口内的近期计划。`
    );

    for (const lane of LANE_ORDER) {
      const laneCards = filteredCards.filter(card => card.lane === lane);
      const list = document.getElementById(LANE_META[lane].listId);
      if (!list) continue;

      setText(LANE_META[lane].countId, String(laneCards.length));

      if (!laneCards.length) {
        list.innerHTML = `
          <div class="empty-state">
            <strong>当前没有卡片</strong>
            <span>${escapeHtml(getEmptyLaneText(lane))}</span>
          </div>
        `;
        continue;
      }

      list.innerHTML = laneCards.map(card => renderCard(card)).join("");
    }

    window.PageMotion?.reconcilePendingRemovals?.();
  }

  function getEmptyLaneText(lane) {
    if (state.filter !== "all") {
      return `当前筛选下，「${WINDOW_META[state.filter].label}」里没有「${LANE_META[lane].label}」的事项。`;
    }

    return `${LANE_META[lane].summary}。这里不是当天待办，等你需要时再继续拆解。`;
  }

  function getFilteredCards() {
    const cards = state.store.cards.slice().sort(compareCards);
    if (state.filter === "all") return cards;
    return cards.filter(card => card.window === state.filter);
  }

  function renderCard(card) {
    return `
      <article class="recent-card recent-card--${escapeAttribute(card.lane)}" data-recent-id="${escapeAttribute(card.id)}">
        <div class="recent-card-top">
          <div>
            <h4 class="recent-card-title">${escapeHtml(card.title || "未命名计划")}</h4>
          </div>
          <span class="window-chip">${escapeHtml(WINDOW_META[card.window]?.label || WINDOW_META[DEFAULT_WINDOW].label)}</span>
        </div>
        ${card.note ? `<p class="recent-card-note">${escapeHtml(card.note)}</p>` : ""}
        <div class="recent-card-foot">
          <span class="recent-card-time">最近更新 ${escapeHtml(formatDateTime(card.updatedAt || card.createdAt))}</span>
          <div class="recent-card-actions">
            <select class="card-lane-select" data-action="move" data-id="${escapeAttribute(card.id)}" aria-label="区块切换">
              ${LANE_ORDER.map(lane => `<option value="${lane}" ${card.lane === lane ? "selected" : ""}>${escapeHtml(LANE_META[lane].label)}</option>`).join("")}
            </select>
            <button class="btn-secondary card-btn" type="button" data-action="edit" data-id="${escapeAttribute(card.id)}">编辑</button>
            <button class="btn-danger card-btn" type="button" data-action="delete" data-id="${escapeAttribute(card.id)}">删除</button>
          </div>
        </div>
      </article>
    `;
  }

  function saveCard() {
    const title = toText(getValue("recentTitleInput"));
    if (!title) {
      setStatus("recentFormStatus", "请先写一个标题，再保存近期计划。", false);
      document.getElementById("recentTitleInput")?.focus();
      return;
    }

    const editingId = toText(getValue("recentEditingId"));
    const lane = normalizeLane(getValue("recentLaneInput"));
    const windowValue = normalizeWindow(getValue("recentWindowInput"));
    const note = toText(getValue("recentNoteInput"));
    const now = new Date().toISOString();
    const nextStore = cloneStore(state.store);

    if (editingId) {
      const current = nextStore.cards.find(card => card.id === editingId);
      if (!current) {
        setStatus("recentFormStatus", "这张卡片已经不存在了。", false);
        resetForm();
        return;
      }

      current.title = title;
      current.note = note;
      current.lane = lane;
      current.window = windowValue;
      current.updatedAt = now;
      state.store = saveRecentStore(nextStore);
      renderAll();
      setStatus("recentFormStatus", `已更新 ${title}`, true);
      resetForm(false);
      return;
    }

    nextStore.cards.unshift({
      id: createId(),
      title,
      note,
      lane,
      window: windowValue,
      createdAt: now,
      updatedAt: now
    });

    state.store = saveRecentStore(nextStore);
    renderAll();
    setStatus("recentFormStatus", `已新增近期计划：${title}`, true);
    resetForm(false);
  }

  function editCard(id) {
    const card = state.store.cards.find(item => item.id === id);
    if (!card) return;

    setValue("recentEditingId", card.id);
    setValue("recentTitleInput", card.title);
    setValue("recentWindowInput", card.window);
    setValue("recentLaneInput", card.lane);
    setValue("recentNoteInput", card.note);
    setText("recentSubmitButton", "保存修改");
    document.getElementById("recentCancelButton").hidden = false;
    setStatus("recentFormStatus", `正在编辑：${card.title}`, true);
    document.getElementById("recentTitleInput")?.focus();
  }

  function resetForm(clearStatus = true) {
    setValue("recentEditingId", "");
    setValue("recentTitleInput", "");
    setValue("recentWindowInput", DEFAULT_WINDOW);
    setValue("recentLaneInput", DEFAULT_LANE);
    setValue("recentNoteInput", "");
    setText("recentSubmitButton", "保存近期计划");
    document.getElementById("recentCancelButton").hidden = true;
    if (clearStatus) setStatus("recentFormStatus", "", false);
  }

  function ensureFormDefaults() {
    if (!toText(getValue("recentEditingId"))) {
      setValue("recentWindowInput", normalizeWindow(getValue("recentWindowInput") || DEFAULT_WINDOW));
      setValue("recentLaneInput", normalizeLane(getValue("recentLaneInput") || DEFAULT_LANE));
    }
  }

  function updateCardLane(id, lane) {
    const nextLane = normalizeLane(lane);
    const nextStore = cloneStore(state.store);
    const card = nextStore.cards.find(item => item.id === id);
    if (!card || card.lane === nextLane) return;

    card.lane = nextLane;
    card.updatedAt = new Date().toISOString();
    state.store = saveRecentStore(nextStore);
    renderAll();

    if (toText(getValue("recentEditingId")) === id) {
      setValue("recentLaneInput", nextLane);
      setStatus("recentFormStatus", `已切换到${LANE_META[nextLane].label}`, true);
    }
  }

  function findDeleteElement(id, trigger) {
    if (trigger && typeof trigger.closest === "function") {
      const card = trigger.closest(".recent-card");
      if (card) return card;
    }

    return document.querySelector(`.recent-card[data-recent-id="${id}"]`);
  }

  function deleteCard(id, trigger) {
    const index = state.store.cards.findIndex(card => card.id === id);
    if (index < 0) return;

    const snapshot = cloneCard(state.store.cards[index]);
    const wasEditing = toText(getValue("recentEditingId")) === id;
    const deleteElement = findDeleteElement(id, trigger);

    const removeCard = () => {
      const nextStore = cloneStore(state.store);
      nextStore.cards = nextStore.cards.filter(card => card.id !== id);
      state.store = saveRecentStore(nextStore);
      renderAll();
      if (wasEditing) resetForm(false);
    };

    const restoreCard = () => {
      if (state.store.cards.some(card => card.id === id)) return;
      const nextStore = cloneStore(state.store);
      const nextCards = nextStore.cards.slice();
      nextCards.splice(Math.min(index, nextCards.length), 0, cloneCard(snapshot));
      nextStore.cards = nextCards;
      state.store = saveRecentStore(nextStore);
      renderAll();

      if (wasEditing) {
        editCard(id);
      }
    };

    if (window.PageMotion?.removeWithUndo) {
      PageMotion.removeWithUndo({
        key: `recent:${id}`,
        element: deleteElement,
        label: snapshot.title || "未命名计划",
        remove: removeCard,
        restore: restoreCard,
        timeoutMs: 2200
      });
      return;
    }

    removeCard();
  }

  function getRecentStore() {
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

  function saveRecentStore(store) {
    const normalized = normalizeStore(store);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
    return normalized;
  }

  function createDefaultStore() {
    return { cards: [] };
  }

  function normalizeStore(raw) {
    const source = raw && typeof raw === "object" ? raw : {};
    return {
      cards: Array.isArray(source.cards)
        ? source.cards.filter(card => card && typeof card === "object").map(normalizeCard)
        : []
    };
  }

  function normalizeCard(card) {
    const createdAt = toText(card.createdAt) || new Date().toISOString();
    const updatedAt = toText(card.updatedAt) || createdAt;

    return {
      id: toText(card.id) || createId(),
      title: toText(card.title),
      note: toText(card.note),
      lane: normalizeLane(card.lane),
      window: normalizeWindow(card.window),
      createdAt,
      updatedAt
    };
  }

  function cloneStore(store) {
    return {
      cards: store.cards.map(cloneCard)
    };
  }

  function cloneCard(card) {
    if (window.structuredClone) return window.structuredClone(card);
    return JSON.parse(JSON.stringify(card));
  }

  function compareCards(a, b) {
    const windowDiff = WINDOW_ORDER.indexOf(a.window) - WINDOW_ORDER.indexOf(b.window);
    if (windowDiff !== 0) return windowDiff;
    return (b.updatedAt || "").localeCompare(a.updatedAt || "");
  }

  function normalizeLane(value) {
    return LANE_META[value] ? value : DEFAULT_LANE;
  }

  function normalizeWindow(value) {
    return WINDOW_META[value] && value !== "all" ? value : DEFAULT_WINDOW;
  }

  function updateFilterButtons() {
    document.querySelectorAll("#recentFilterTabs [data-filter]").forEach(button => {
      button.classList.toggle("active", button.dataset.filter === state.filter);
    });
  }

  function formatDateTime(value) {
    if (!value) return "未知";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "未知";

    return new Intl.DateTimeFormat("zh-CN", {
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    }).format(date);
  }

  function createId() {
    return `recent-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
  }

  function toText(value) {
    return String(value ?? "").trim();
  }

  function getValue(id) {
    return document.getElementById(id)?.value ?? "";
  }

  function setValue(id, value) {
    const element = document.getElementById(id);
    if (element) element.value = value ?? "";
  }

  function setText(id, value) {
    const element = document.getElementById(id);
    if (element) element.textContent = value ?? "";
  }

  function setStatus(id, value, isPositive) {
    const element = document.getElementById(id);
    if (!element) return;
    element.textContent = value || "";
    element.style.color = value ? (isPositive ? "#fef3c7" : "#fecaca") : "";
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function escapeAttribute(value) {
    return escapeHtml(value);
  }

  return {
    init
  };
})();

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => RecentPlanApp.init(), { once: true });
} else {
  RecentPlanApp.init();
}
