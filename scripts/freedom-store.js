(function (root, factory) {
  const roleApi = typeof module !== "undefined" && module.exports
    ? require("./expense-role")
    : root.ExpenseRole;
  const api = factory(roleApi);

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }

  root.FreedomStore = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (ExpenseRole) {
  const STORAGE_KEY = "riverFreedom:v1";
  const EXPENSE_STORAGE_KEY = "expenseTracker:v1";
  const ENTRY_TYPES = new Set(["fund", "spend"]);

  function readStore(storage = getDefaultStorage()) {
    return normalizeStore(readJson(storage, STORAGE_KEY));
  }

  function saveStore(storageOrStore, maybeStore) {
    const storage = maybeStore ? resolveStorage(storageOrStore) : getDefaultStorage();
    const store = maybeStore ? maybeStore : storageOrStore;
    const normalized = normalizeStore(store);
    storage.setItem(STORAGE_KEY, JSON.stringify(normalized));
    return normalized;
  }

  function updateSettings(store, settings) {
    const normalized = normalizeStore(store);
    return {
      ...normalized,
      settings: {
        ...normalized.settings,
        dailyNeed: normalizeAmount(settings?.dailyNeed)
      }
    };
  }

  function upsertEntry(store, draft, editingId = "") {
    const normalized = normalizeStore(store);
    const amount = normalizeAmount(draft?.amount);
    const type = normalizeEntryType(draft?.type);
    const date = normalizeDateValue(draft?.date) || getTodayValue();

    if (!amount) {
      throw new Error("请输入大于 0 的金额");
    }

    const next = cloneStore(normalized);
    const oldEntry = next.entries.find(entry => entry.id === editingId);
    const entriesWithoutOld = oldEntry
      ? next.entries.filter(entry => entry.id !== oldEntry.id)
      : next.entries.slice();
    const availableBefore = calculateAvailableFund(entriesWithoutOld);

    if (type === "spend" && amount > availableBefore) {
      throw new Error("这笔花费超过了当前闲置资金");
    }

    const timestamp = new Date().toISOString();
    const entry = {
      id: oldEntry ? oldEntry.id : createId("freedom"),
      type,
      amount,
      date,
      note: toText(draft?.note),
      createdAt: oldEntry ? oldEntry.createdAt : timestamp,
      updatedAt: timestamp
    };

    entriesWithoutOld.push(entry);
    return {
      ...next,
      entries: entriesWithoutOld.sort(compareEntries)
    };
  }

  function deleteEntry(store, entryId) {
    const normalized = normalizeStore(store);
    return {
      ...normalized,
      entries: normalized.entries.filter(entry => entry.id !== toText(entryId))
    };
  }

  function buildFreedomView(store) {
    const normalized = normalizeStore(store);
    const dailyNeed = normalized.settings.dailyNeed;
    const totalFund = sumEntries(normalized.entries, "fund");
    const totalSpend = sumEntries(normalized.entries, "spend");
    const availableFund = roundAmount(totalFund - totalSpend);
    const freeDays = dailyNeed > 0 ? Math.floor(availableFund / dailyNeed) : 0;
    const spentDays = dailyNeed > 0 ? totalSpend / dailyNeed : 0;
    const lastEntries = normalized.entries.slice(0, 12);

    return {
      settings: normalized.settings,
      entries: normalized.entries,
      totalFund,
      totalSpend,
      availableFund,
      dailyNeed,
      freeDays,
      spentDays,
      lastEntries,
      totalFundText: formatCurrency(totalFund),
      totalSpendText: formatCurrency(totalSpend),
      availableFundText: formatCurrency(availableFund),
      dailyNeedText: dailyNeed > 0 ? formatCurrency(dailyNeed) : "未设置",
      spentDaysText: formatDays(spentDays),
      freeDaysText: `${freeDays.toLocaleString("zh-CN")} 天`
    };
  }

  function buildDailyNeedSuggestion(expenseStore, now = new Date()) {
    const records = Array.isArray(expenseStore?.records) ? expenseStore.records : [];
    const monthKey = toMonthKey(getTodayValue(now));
    const elapsedDays = Math.max(1, now.getDate());
    const supportRecords = records
      .map(record => ExpenseRole?.withExpenseRole ? ExpenseRole.withExpenseRole(record) : record)
      .filter(record => record && record.date && record.date.startsWith(`${monthKey}-`))
      .filter(record => {
        const role = ExpenseRole?.normalizeExpenseRole
          ? ExpenseRole.normalizeExpenseRole(record.expenseRole, record.categoryId)
          : record.expenseRole;
        return role === "life_support";
      });
    const total = roundAmount(supportRecords.reduce((sum, record) => sum + normalizeAmount(record.amount), 0));
    const dailyNeed = elapsedDays ? roundAmount(total / elapsedDays) : 0;

    return {
      month: monthKey,
      total,
      elapsedDays,
      dailyNeed,
      totalText: formatCurrency(total),
      dailyNeedText: dailyNeed ? formatCurrency(dailyNeed) : "暂无建议"
    };
  }

  function readExpenseStore(storage = getDefaultStorage()) {
    return readJson(storage, EXPENSE_STORAGE_KEY) || { records: [] };
  }

  function normalizeStore(raw) {
    const source = raw && typeof raw === "object" ? raw : {};
    const settings = {
      dailyNeed: normalizeAmount(source.settings?.dailyNeed)
    };
    const entries = Array.isArray(source.entries)
      ? source.entries.map(normalizeEntry).filter(Boolean).sort(compareEntries)
      : [];

    return { settings, entries };
  }

  function normalizeEntry(entry) {
    if (!entry || typeof entry !== "object") return null;
    const amount = normalizeAmount(entry.amount);
    if (!amount) return null;
    const type = normalizeEntryType(entry.type);
    const createdAt = normalizeDateTime(entry.createdAt) || new Date().toISOString();

    return {
      id: toText(entry.id) || createId("freedom"),
      type,
      amount,
      date: normalizeDateValue(entry.date) || getTodayValue(),
      note: toText(entry.note),
      createdAt,
      updatedAt: normalizeDateTime(entry.updatedAt) || createdAt
    };
  }

  function normalizeEntryType(value) {
    return ENTRY_TYPES.has(value) ? value : "fund";
  }

  function calculateAvailableFund(entries) {
    return roundAmount(sumEntries(entries, "fund") - sumEntries(entries, "spend"));
  }

  function sumEntries(entries, type) {
    return roundAmount(entries
      .filter(entry => entry.type === type)
      .reduce((sum, entry) => sum + normalizeAmount(entry.amount), 0));
  }

  function readJson(storage, key) {
    try {
      return JSON.parse(storage.getItem(key) || "null");
    } catch (error) {
      return null;
    }
  }

  function cloneStore(store) {
    const normalized = normalizeStore(store);
    return {
      settings: { ...normalized.settings },
      entries: normalized.entries.map(entry => ({ ...entry }))
    };
  }

  function normalizeAmount(value) {
    const number = Number(value);
    if (!Number.isFinite(number) || number <= 0) return 0;
    return roundAmount(number);
  }

  function roundAmount(value) {
    return Math.round((Number(value) || 0) * 100) / 100;
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

  function toMonthKey(value) {
    const normalized = normalizeDateValue(value);
    return normalized ? normalized.slice(0, 7) : "";
  }

  function getTodayValue(date = new Date()) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  }

  function formatCurrency(value) {
    return `¥${roundAmount(value).toFixed(2)}`;
  }

  function formatDays(value) {
    const number = Number(value) || 0;
    if (number < 1 && number > 0) return `${number.toFixed(1)} 天`;
    return `${Math.floor(number).toLocaleString("zh-CN")} 天`;
  }

  function compareEntries(a, b) {
    if (a.date !== b.date) return b.date.localeCompare(a.date);
    return String(b.createdAt || "").localeCompare(String(a.createdAt || ""));
  }

  function createId(prefix) {
    const cryptoApi = typeof globalThis !== "undefined" ? globalThis.crypto : null;
    if (cryptoApi && typeof cryptoApi.randomUUID === "function") {
      return `${prefix}-${cryptoApi.randomUUID()}`;
    }
    return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
  }

  function getDefaultStorage() {
    return globalThis.localStorage;
  }

  function resolveStorage(storage) {
    return storage || getDefaultStorage();
  }

  function toText(value) {
    return typeof value === "string" ? value.trim() : "";
  }

  return {
    STORAGE_KEY,
    EXPENSE_STORAGE_KEY,
    readStore,
    saveStore,
    updateSettings,
    upsertEntry,
    deleteEntry,
    buildFreedomView,
    buildDailyNeedSuggestion,
    readExpenseStore,
    normalizeStore,
    normalizeEntry,
    normalizeAmount,
    formatCurrency
  };
});
