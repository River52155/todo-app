(function (root, factory) {
  const api = factory();

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }

  root.ExpenseRole = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const LIFE_SUPPORT = "life_support";
  const LIFE_EXTRA = "life_extra";
  const SUPPORT_CATEGORY_IDS = new Set(["food", "transport", "daily", "medical", "housing"]);
  const ROLE_META = {
    [LIFE_SUPPORT]: {
      id: LIFE_SUPPORT,
      label: "基础生存",
      shortLabel: "必要",
      description: "吃饭、喝水、交通、医疗、居住、日用这类维持生活的花费。",
      color: "#67e8f9",
      softColor: "rgba(103, 232, 249, 0.22)"
    },
    [LIFE_EXTRA]: {
      id: LIFE_EXTRA,
      label: "自由选择",
      shortLabel: "非必要",
      description: "零食、娱乐、购物和其它主动选择的生活之外花费。",
      color: "#f8c76b",
      softColor: "rgba(248, 199, 107, 0.22)"
    }
  };

  function normalizeExpenseRole(value, categoryId = "") {
    if (value === LIFE_SUPPORT || value === LIFE_EXTRA) return value;
    return defaultRoleForCategory(categoryId);
  }

  function defaultRoleForCategory(categoryId) {
    return SUPPORT_CATEGORY_IDS.has(String(categoryId || "")) ? LIFE_SUPPORT : LIFE_EXTRA;
  }

  function getRoleMeta(role) {
    return ROLE_META[normalizeExpenseRole(role)] || ROLE_META[LIFE_EXTRA];
  }

  function withExpenseRole(record) {
    if (!record || typeof record !== "object") return null;
    return {
      ...record,
      expenseRole: normalizeExpenseRole(record.expenseRole, record.categoryId)
    };
  }

  function buildRoleBreakdown(records) {
    const safeRecords = Array.isArray(records) ? records.map(withExpenseRole).filter(Boolean) : [];
    const rows = [createEmptyRow(LIFE_SUPPORT), createEmptyRow(LIFE_EXTRA)];

    safeRecords.forEach(record => {
      const row = rows.find(item => item.role === record.expenseRole) || rows[1];
      row.total = roundAmount(row.total + normalizeAmount(record.amount));
      row.count += 1;
    });

    const total = roundAmount(rows.reduce((sum, row) => sum + row.total, 0));
    rows.forEach(row => {
      row.percent = total ? Math.round((row.total / total) * 1000) / 10 : 0;
      row.totalText = formatCurrency(row.total);
      row.percentText = `${row.percent.toFixed(1)}%`;
    });

    return { total, totalText: formatCurrency(total), rows };
  }

  function buildRoleTrend(range, records, rangeInfo) {
    const safeRange = ["day", "week", "month", "year"].includes(range) ? range : "month";
    if (safeRange === "day") return buildHourlyTrend(records);
    if (safeRange === "week") return buildWeekTrend(records, rangeInfo);
    if (safeRange === "year") return buildYearTrend(records, rangeInfo);
    return buildMonthTrend(records, rangeInfo);
  }

  function buildHourlyTrend(records) {
    const points = Array.from({ length: 24 }, (_, hour) => {
      const hourRecords = filterByCreatedHour(records, hour);
      return createTrendPoint(`${String(hour).padStart(2, "0")}:00`, hourRecords);
    });
    return createTrendView("day", "hours", points);
  }

  function buildWeekTrend(records, rangeInfo) {
    const start = rangeInfo?.start instanceof Date ? rangeInfo.start : startOfWeek(new Date());
    const points = Array.from({ length: 7 }, (_, index) => {
      const date = toDateValue(addDays(start, index));
      const dayRecords = records.filter(record => record.date === date);
      return createTrendPoint(["一", "二", "三", "四", "五", "六", "日"][index], dayRecords, date);
    });
    return createTrendView("week", "days", points);
  }

  function buildMonthTrend(records, rangeInfo) {
    const start = rangeInfo?.start instanceof Date ? rangeInfo.start : new Date();
    const year = start.getFullYear();
    const month = start.getMonth();
    const days = new Date(year, month + 1, 0).getDate();
    const points = Array.from({ length: days }, (_, index) => {
      const date = toDateValue(new Date(year, month, index + 1));
      const dayRecords = records.filter(record => record.date === date);
      return createTrendPoint(String(index + 1), dayRecords, date);
    });
    return createTrendView("month", "days", points);
  }

  function buildYearTrend(records, rangeInfo) {
    const start = rangeInfo?.start instanceof Date ? rangeInfo.start : new Date();
    const year = start.getFullYear();
    const points = Array.from({ length: 12 }, (_, index) => {
      const monthKey = `${year}-${String(index + 1).padStart(2, "0")}`;
      const monthRecords = records.filter(record => String(record.date || "").startsWith(`${monthKey}-`));
      return createTrendPoint(`${index + 1}月`, monthRecords, monthKey);
    });
    return createTrendView("year", "months", points);
  }

  function createTrendView(range, layout, points) {
    const maxTotal = Math.max(...points.map(point => point.total), 1);
    return { range, layout, maxTotal, points };
  }

  function createTrendPoint(label, records, key = label) {
    const breakdown = buildRoleBreakdown(records);
    return {
      key,
      label,
      total: breakdown.total,
      totalText: breakdown.totalText,
      supportTotal: breakdown.rows[0].total,
      extraTotal: breakdown.rows[1].total,
      supportText: breakdown.rows[0].totalText,
      extraText: breakdown.rows[1].totalText,
      count: records.length
    };
  }

  function createEmptyRow(role) {
    const meta = getRoleMeta(role);
    return {
      role,
      label: meta.label,
      shortLabel: meta.shortLabel,
      description: meta.description,
      color: meta.color,
      softColor: meta.softColor,
      total: 0,
      totalText: "¥0.00",
      count: 0,
      percent: 0,
      percentText: "0.0%"
    };
  }

  function filterByCreatedHour(records, hour) {
    return records.filter(record => {
      const createdAt = new Date(record.createdAt || `${record.date || ""}T00:00:00`);
      return !Number.isNaN(createdAt.getTime()) && createdAt.getHours() === hour;
    });
  }

  function normalizeAmount(value) {
    const number = Number(value);
    if (!Number.isFinite(number) || number <= 0) return 0;
    return roundAmount(number);
  }

  function roundAmount(value) {
    return Math.round((Number(value) || 0) * 100) / 100;
  }

  function formatCurrency(value) {
    return `¥${roundAmount(value).toFixed(2)}`;
  }

  function startOfWeek(date) {
    const value = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const offset = (value.getDay() + 6) % 7;
    value.setDate(value.getDate() - offset);
    return value;
  }

  function addDays(date, days) {
    const value = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    value.setDate(value.getDate() + days);
    return value;
  }

  function toDateValue(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  }

  return {
    LIFE_SUPPORT,
    LIFE_EXTRA,
    ROLE_META,
    normalizeExpenseRole,
    defaultRoleForCategory,
    getRoleMeta,
    withExpenseRole,
    buildRoleBreakdown,
    buildRoleTrend
  };
});
