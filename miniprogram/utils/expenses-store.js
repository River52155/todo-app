const {
  addDays,
  createId,
  endOfDay,
  endOfMonth,
  endOfYear,
  formatCurrency,
  formatDateLabel,
  formatDateTime,
  formatDateValue,
  getTodayValue,
  normalizeDateTime,
  parseDateValue,
  roundAmount,
  startOfDay,
  startOfMonth,
  startOfWeek,
  startOfYear,
  toText
} = require('./common');
const { getStorageValue, setStorageValue } = require('./storage');

const STORAGE_KEY = 'expenseTracker:v1';
const DEFAULT_RANGE = 'month';
const FALLBACK_CATEGORY_ID = 'other';

const RANGE_OPTIONS = [
  { value: 'day', label: '今日' },
  { value: 'week', label: '本周' },
  { value: 'month', label: '本月' },
  { value: 'year', label: '本年' }
];

const BUILTIN_CATEGORIES = [
  { id: 'food', name: '餐饮', color: '#fb7185', icon: '🍜', builtin: true },
  { id: 'transport', name: '交通', color: '#38bdf8', icon: '🚌', builtin: true },
  { id: 'shopping', name: '购物', color: '#818cf8', icon: '🛍️', builtin: true },
  { id: 'daily', name: '日用', color: '#f59e0b', icon: '🧴', builtin: true },
  { id: 'fun', name: '娱乐', color: '#c084fc', icon: '🎮', builtin: true },
  { id: 'study', name: '学习', color: '#34d399', icon: '📚', builtin: true },
  { id: 'medical', name: '医疗', color: '#f87171', icon: '🩺', builtin: true },
  { id: 'housing', name: '居住', color: '#94a3b8', icon: '🏠', builtin: true },
  { id: FALLBACK_CATEGORY_ID, name: '其他', color: '#60a5fa', icon: '📦', builtin: true }
];

function getStore() {
  const normalized = normalizeStore(getStorageValue(STORAGE_KEY, createDefaultStore()));
  setStorageValue(STORAGE_KEY, normalized);
  return normalized;
}

function saveStore(store) {
  const normalized = normalizeStore(store);
  setStorageValue(STORAGE_KEY, normalized);
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
      createdAt: '1970-01-01T00:00:00.000Z'
    }))
  };
}

function normalizeStore(raw) {
  const source = raw && typeof raw === 'object' ? raw : {};
  const categories = normalizeCategories(source.categories);
  const categoryIds = new Set(categories.map(item => item.id));
  const records = Array.isArray(source.records)
    ? source.records
        .filter(item => item && typeof item === 'object')
        .map(item => normalizeRecord(item, categoryIds))
        .filter(Boolean)
    : [];
  const fixedForecastTemplates = normalizeFixedForecastTemplates(source.fixedForecastTemplates, categoryIds);
  const forecastMonths = normalizeForecastMonths(source.forecastMonths, categoryIds);
  const budgetMonths = normalizeBudgetMonths(source.budgetMonths, categoryIds);

  return {
    records,
    categories,
    forecastMonths,
    fixedForecastTemplates,
    budgetMonths
  };
}

function normalizeFixedForecastTemplates(raw, categoryIds) {
  return Array.isArray(raw)
    ? raw
        .filter(item => item && typeof item === 'object')
        .map(item => normalizeFixedForecastTemplate(item, categoryIds))
        .filter(Boolean)
    : [];
}

function normalizeForecastMonths(raw, categoryIds) {
  const source = raw && typeof raw === 'object' ? raw : {};
  const normalized = {};

  Object.entries(source).forEach(([monthKey, items]) => {
    const month = normalizeMonthValue(monthKey);
    if (!month || !Array.isArray(items)) return;

    const nextItems = items
      .filter(item => item && typeof item === 'object')
      .map(item => normalizeForecastItem({ ...item, month }, categoryIds))
      .filter(Boolean)
      .sort(compareForecastItems);

    if (nextItems.length) {
      normalized[month] = nextItems;
    }
  });

  return normalized;
}

function normalizeBudgetMonths(raw, categoryIds) {
  const source = raw && typeof raw === 'object' ? raw : {};
  const normalized = {};

  Object.entries(source).forEach(([monthKey, value]) => {
    const month = normalizeMonthValue(monthKey);
    if (!month || !value || typeof value !== 'object') return;

    const categoryBudgets = value.categoryBudgets && typeof value.categoryBudgets === 'object'
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

function normalizeCategories(raw) {
  const custom = Array.isArray(raw)
    ? raw
        .filter(item => item && typeof item === 'object' && !BUILTIN_CATEGORIES.some(builtin => builtin.id === item.id))
        .map(item => ({
          id: toText(item.id) || `category-${Date.now()}`,
          name: toText(item.name) || '未命名分类',
          color: normalizeColor(item.color),
          icon: toText(item.icon) || '📦',
          builtin: false,
          createdAt: normalizeDateTime(item.createdAt) || new Date().toISOString()
        }))
    : [];

  return BUILTIN_CATEGORIES.map(category => ({
    ...category,
    createdAt: '1970-01-01T00:00:00.000Z'
  })).concat(custom);
}

function normalizeRecord(raw, categoryIds) {
  const source = raw && typeof raw === 'object' ? raw : {};
  const amount = normalizeAmount(source.amount);
  if (!amount) return null;

  const createdAt = normalizeDateTime(source.createdAt) || new Date().toISOString();
  return {
    id: toText(source.id) || createRecordId(),
    amount,
    date: normalizeDateValue(source.date) || getTodayValue(),
    categoryId: categoryIds.has(source.categoryId) ? source.categoryId : FALLBACK_CATEGORY_ID,
    note: toText(source.note),
    createdAt,
    updatedAt: normalizeDateTime(source.updatedAt) || createdAt
  };
}

function normalizeForecastItem(raw, categoryIds) {
  const source = raw && typeof raw === 'object' ? raw : {};
  const amount = normalizeAmount(source.amount);
  const month = normalizeMonthValue(source.month);
  if (!amount || !month) return null;

  const createdAt = normalizeDateTime(source.createdAt) || new Date().toISOString();
  const plannedDate = normalizeForecastPlannedDate(source.plannedDate, month);

  return {
    id: toText(source.id) || createId('forecast'),
    title: toText(source.title) || '未命名预估项',
    amount,
    categoryId: categoryIds.has(source.categoryId) ? source.categoryId : FALLBACK_CATEGORY_ID,
    month,
    kind: normalizeForecastKind(source.kind),
    plannedDate,
    recurringDay: normalizeRecurringDay(source.recurringDay),
    note: toText(source.note),
    status: normalizeForecastStatus(source.status),
    createdAt,
    updatedAt: normalizeDateTime(source.updatedAt) || createdAt
  };
}

function normalizeFixedForecastTemplate(raw, categoryIds) {
  const source = raw && typeof raw === 'object' ? raw : {};
  const amount = normalizeAmount(source.amount);
  if (!amount) return null;

  const createdAt = normalizeDateTime(source.createdAt) || new Date().toISOString();
  return {
    id: toText(source.id) || createId('fixed-forecast'),
    title: toText(source.title) || '未命名固定项',
    amount,
    categoryId: categoryIds.has(source.categoryId) ? source.categoryId : FALLBACK_CATEGORY_ID,
    recurringDay: normalizeRecurringDay(source.recurringDay),
    note: toText(source.note),
    createdAt,
    updatedAt: normalizeDateTime(source.updatedAt) || createdAt
  };
}

function upsertRecord(store, payload, editingId = '') {
  const nextStore = normalizeStore(store);
  const targetId = toText(editingId);
  const now = new Date().toISOString();
  const existing = targetId ? nextStore.records.find(item => item.id === targetId) : null;
  const categoryIds = new Set(nextStore.categories.map(item => item.id));

  const nextRecord = normalizeRecord({
    ...existing,
    ...payload,
    id: existing ? existing.id : createRecordId(),
    createdAt: existing ? existing.createdAt : now,
    updatedAt: now
  }, categoryIds);

  if (!nextRecord) return saveStore(nextStore);

  if (existing) {
    nextStore.records = nextStore.records.map(item => item.id === targetId ? nextRecord : item);
  } else {
    nextStore.records = nextStore.records.concat(nextRecord);
  }

  return saveStore(nextStore);
}

function deleteRecord(store, recordId) {
  const targetId = toText(recordId);
  const nextStore = normalizeStore(store);
  nextStore.records = nextStore.records.filter(item => item.id !== targetId);
  return saveStore(nextStore);
}

function addCategory(store, payload) {
  const nextStore = normalizeStore(store);
  const name = toText(payload.name);
  if (!name) return saveStore(nextStore);

  const icon = toText(payload.icon) || '📦';
  const color = normalizeColor(payload.color);
  const exists = nextStore.categories.some(item => item.name.toLowerCase() === name.toLowerCase());
  if (exists) return saveStore(nextStore);

  nextStore.categories.push({
    id: `category-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    name,
    icon,
    color,
    builtin: false,
    createdAt: new Date().toISOString()
  });

  return saveStore(nextStore);
}

function upsertForecastItem(store, payload, editingId = '') {
  const nextStore = normalizeStore(store);
  const categoryIds = new Set(nextStore.categories.map(item => item.id));
  const targetId = toText(editingId);
  const now = new Date().toISOString();
  const existing = targetId ? findForecastItem(nextStore, targetId) : null;
  const nextItem = normalizeForecastItem({
    ...existing?.item,
    ...payload,
    id: existing?.item?.id || createId('forecast'),
    month: payload?.month || existing?.item?.month,
    createdAt: existing?.item?.createdAt || now,
    updatedAt: now
  }, categoryIds);

  if (!nextItem) return saveStore(nextStore);

  if (existing) {
    const currentItems = nextStore.forecastMonths[existing.month] || [];
    nextStore.forecastMonths[existing.month] = currentItems.filter(item => item.id !== targetId);
    if (!nextStore.forecastMonths[existing.month].length) {
      delete nextStore.forecastMonths[existing.month];
    }
  }

  const monthItems = nextStore.forecastMonths[nextItem.month] || [];
  nextStore.forecastMonths[nextItem.month] = monthItems
    .concat(nextItem)
    .sort(compareForecastItems);

  return saveStore(nextStore);
}

function deleteForecastItem(store, month, forecastId) {
  const nextStore = normalizeStore(store);
  const targetId = toText(forecastId);
  const targetMonth = normalizeMonthValue(month);
  if (!targetId) return saveStore(nextStore);

  if (targetMonth && Array.isArray(nextStore.forecastMonths[targetMonth])) {
    nextStore.forecastMonths[targetMonth] = nextStore.forecastMonths[targetMonth].filter(item => item.id !== targetId);
    if (!nextStore.forecastMonths[targetMonth].length) {
      delete nextStore.forecastMonths[targetMonth];
    }
    return saveStore(nextStore);
  }

  Object.keys(nextStore.forecastMonths).forEach(monthKey => {
    nextStore.forecastMonths[monthKey] = nextStore.forecastMonths[monthKey].filter(item => item.id !== targetId);
    if (!nextStore.forecastMonths[monthKey].length) {
      delete nextStore.forecastMonths[monthKey];
    }
  });

  return saveStore(nextStore);
}

function upsertFixedForecastTemplate(store, payload, editingId = '') {
  const nextStore = normalizeStore(store);
  const categoryIds = new Set(nextStore.categories.map(item => item.id));
  const targetId = toText(editingId);
  const now = new Date().toISOString();
  const existing = targetId ? nextStore.fixedForecastTemplates.find(item => item.id === targetId) : null;
  const nextTemplate = normalizeFixedForecastTemplate({
    ...existing,
    ...payload,
    id: existing?.id || createId('fixed-forecast'),
    createdAt: existing?.createdAt || now,
    updatedAt: now
  }, categoryIds);

  if (!nextTemplate) return saveStore(nextStore);

  if (existing) {
    nextStore.fixedForecastTemplates = nextStore.fixedForecastTemplates.map(item => item.id === targetId ? nextTemplate : item);
  } else {
    nextStore.fixedForecastTemplates = nextStore.fixedForecastTemplates.concat(nextTemplate);
  }

  nextStore.fixedForecastTemplates.sort(compareFixedForecastTemplates);
  return saveStore(nextStore);
}

function deleteFixedForecastTemplate(store, templateId) {
  const nextStore = normalizeStore(store);
  const targetId = toText(templateId);
  nextStore.fixedForecastTemplates = nextStore.fixedForecastTemplates.filter(item => item.id !== targetId);
  return saveStore(nextStore);
}

function loadFixedForecastTemplatesIntoMonth(store, month) {
  const nextStore = normalizeStore(store);
  const targetMonth = normalizeMonthValue(month);
  if (!targetMonth) return saveStore(nextStore);

  const existingItems = nextStore.forecastMonths[targetMonth] || [];
  const nextItems = existingItems.slice();
  const now = new Date().toISOString();

  nextStore.fixedForecastTemplates.forEach(template => {
    const duplicate = nextItems.some(item =>
      item.kind === 'fixed' &&
      item.title === template.title &&
      item.amount === template.amount &&
      item.categoryId === template.categoryId
    );

    if (duplicate) return;

    nextItems.push({
      id: createId('forecast'),
      title: template.title,
      amount: template.amount,
      categoryId: template.categoryId,
      month: targetMonth,
      kind: 'fixed',
      plannedDate: '',
      recurringDay: template.recurringDay,
      note: template.note,
      status: 'planned',
      createdAt: now,
      updatedAt: now
    });
  });

  nextStore.forecastMonths[targetMonth] = nextItems.sort(compareForecastItems);
  return saveStore(nextStore);
}

function upsertBudgetMonthConfig(store, month, payload = {}) {
  const nextStore = normalizeStore(store);
  const targetMonth = normalizeMonthValue(month);
  if (!targetMonth) return saveStore(nextStore);

  const existing = nextStore.budgetMonths[targetMonth] || {
    totalBudget: 0,
    categoryBudgets: {}
  };

  const totalBudget = Object.prototype.hasOwnProperty.call(payload, 'totalBudget')
    ? normalizeAmount(payload.totalBudget)
    : existing.totalBudget;

  const incomingCategoryBudgets = payload.categoryBudgets && typeof payload.categoryBudgets === 'object'
    ? payload.categoryBudgets
    : null;
  const nextCategoryBudgets = incomingCategoryBudgets
    ? Object.fromEntries(Object.entries(incomingCategoryBudgets)
        .filter(([categoryId, amount]) => nextStore.categories.some(item => item.id === categoryId) && normalizeAmount(amount) > 0)
        .map(([categoryId, amount]) => [categoryId, normalizeAmount(amount)]))
    : existing.categoryBudgets;

  nextStore.budgetMonths[targetMonth] = {
    totalBudget,
    categoryBudgets: nextCategoryBudgets
  };

  return saveStore(nextStore);
}

function removeBudgetCategory(store, month, categoryId) {
  const nextStore = normalizeStore(store);
  const targetMonth = normalizeMonthValue(month);
  const targetCategoryId = toText(categoryId);
  if (!targetMonth || !targetCategoryId || !nextStore.budgetMonths[targetMonth]) return saveStore(nextStore);

  const nextCategoryBudgets = { ...nextStore.budgetMonths[targetMonth].categoryBudgets };
  delete nextCategoryBudgets[targetCategoryId];
  nextStore.budgetMonths[targetMonth] = {
    ...nextStore.budgetMonths[targetMonth],
    categoryBudgets: nextCategoryBudgets
  };

  return saveStore(nextStore);
}

function buildForecastMonthView(store, month) {
  const normalized = normalizeStore(store);
  const targetMonth = normalizeMonthValue(month) || getCurrentMonthKey();
  const items = (normalized.forecastMonths[targetMonth] || []).map(item => ({
    ...item,
    amountText: formatCurrency(item.amount),
    category: getCategoryById(normalized.categories, item.categoryId),
    plannedDateLabel: item.plannedDate ? formatDateLabel(item.plannedDate) : '本月内',
    recurringDayLabel: item.recurringDay ? `通常每月 ${item.recurringDay} 号` : '每月固定项目'
  }));

  const activeItems = items.filter(item => item.status !== 'skipped');
  const fixedItems = items.filter(item => item.kind === 'fixed');
  const oneOffItems = items.filter(item => item.kind === 'one_off');
  const actualTotal = roundAmount(normalized.records
    .filter(record => toMonthKey(record.date) === targetMonth)
    .reduce((sum, record) => sum + record.amount, 0));

  return {
    month: targetMonth,
    stats: {
      total: roundAmount(activeItems.reduce((sum, item) => sum + item.amount, 0)),
      fixedTotal: roundAmount(activeItems.filter(item => item.kind === 'fixed').reduce((sum, item) => sum + item.amount, 0)),
      oneOffTotal: roundAmount(activeItems.filter(item => item.kind === 'one_off').reduce((sum, item) => sum + item.amount, 0)),
      actualTotal
    },
    groups: {
      fixed: fixedItems,
      oneOff: oneOffItems
    },
    items,
    fixedTemplates: normalized.fixedForecastTemplates.slice().sort(compareFixedForecastTemplates)
  };
}

function buildBudgetMonthView(store, month) {
  const normalized = normalizeStore(store);
  const targetMonth = normalizeMonthValue(month) || getCurrentMonthKey();
  const budgetConfig = normalized.budgetMonths[targetMonth] || {
    totalBudget: 0,
    categoryBudgets: {}
  };

  const actualRecords = normalized.records.filter(record => toMonthKey(record.date) === targetMonth);
  const actualTotal = roundAmount(actualRecords.reduce((sum, record) => sum + record.amount, 0));
  const plannedForecastItems = (normalized.forecastMonths[targetMonth] || []).filter(item => item.status === 'planned');
  const plannedForecastTotal = roundAmount(plannedForecastItems.reduce((sum, item) => sum + item.amount, 0));
  const committedTotal = roundAmount(actualTotal + plannedForecastTotal);
  const remaining = roundAmount(budgetConfig.totalBudget - committedTotal);

  const categoryRows = Object.entries(budgetConfig.categoryBudgets)
    .map(([categoryId, budgetAmount]) => {
      const category = getCategoryById(normalized.categories, categoryId);
      const actualByCategory = roundAmount(actualRecords
        .filter(record => record.categoryId === categoryId)
        .reduce((sum, record) => sum + record.amount, 0));
      const plannedByCategory = roundAmount(plannedForecastItems
        .filter(item => item.categoryId === categoryId)
        .reduce((sum, item) => sum + item.amount, 0));
      const usedTotal = roundAmount(actualByCategory + plannedByCategory);
      const rowRemaining = roundAmount(budgetAmount - usedTotal);

      return {
        categoryId,
        category,
        budgetAmount,
        actualSpent: actualByCategory,
        plannedSpent: plannedByCategory,
        usedTotal,
        remaining: rowRemaining,
        progressPercent: budgetAmount > 0 ? Math.max(0, Math.round((usedTotal / budgetAmount) * 1000) / 10) : 0
      };
    })
    .sort((a, b) => b.usedTotal - a.usedTotal);

  return {
    month: targetMonth,
    summary: {
      totalBudget: budgetConfig.totalBudget,
      actualTotal,
      plannedForecastTotal,
      committedTotal,
      remaining,
      categoryBudgetTotal: roundAmount(Object.values(budgetConfig.categoryBudgets).reduce((sum, amount) => sum + amount, 0))
    },
    categoryRows,
    budgetConfig,
    plannedForecastItems,
    fixedTemplates: normalized.fixedForecastTemplates.slice().sort(compareFixedForecastTemplates)
  };
}

function buildRangeView(store, range) {
  const normalized = normalizeStore(store);
  const key = normalizeRange(range);
  const info = getRangeInfo(key);
  const records = normalized.records
    .filter(record => {
      const date = parseDateValue(record.date);
      return date >= info.start && date <= info.end;
    })
    .sort((a, b) => {
      if (a.date !== b.date) return b.date.localeCompare(a.date);
      return String(b.createdAt || '').localeCompare(String(a.createdAt || ''));
    })
    .map(record => ({
      ...record,
      amountText: formatCurrency(record.amount),
      dateLabel: formatDateLabel(record.date),
      updatedLabel: formatDateTime(record.updatedAt || record.createdAt),
      category: getCategoryById(normalized.categories, record.categoryId)
    }));

  const total = roundAmount(records.reduce((sum, record) => sum + record.amount, 0));
  const days = getEffectiveDayCount(key, info.start, info.end);
  const breakdown = buildCategoryBreakdown(records, normalized.categories);
  const rawTrend = buildTrendPoints(key, records);
  const maxTrendValue = Math.max(...rawTrend.map(item => item.total), 0);
  const trend = rawTrend.map(item => ({
    ...item,
    widthPercent: maxTrendValue > 0 ? Math.max((item.total / maxTrendValue) * 100, item.total > 0 ? 6 : 0) : 0
  }));

  return {
    range: key,
    meta: RANGE_OPTIONS.find(item => item.value === key) || RANGE_OPTIONS[2],
    stats: {
      total,
      totalText: formatCurrency(total),
      count: records.length,
      average: days ? roundAmount(total / days) : 0,
      averageText: formatCurrency(days ? roundAmount(total / days) : 0)
    },
    breakdown,
    trend,
    records,
    categories: normalized.categories
  };
}

function buildCategoryBreakdown(records, categories) {
  const totals = new Map();
  const overall = roundAmount(records.reduce((sum, record) => sum + record.amount, 0));
  if (!overall) return [];

  records.forEach(record => {
    totals.set(record.categoryId, roundAmount((totals.get(record.categoryId) || 0) + record.amount));
  });

  return Array.from(totals.entries())
    .map(([categoryId, total]) => {
      const count = records.filter(record => record.categoryId === categoryId).length;
      const percent = Math.round((total / overall) * 1000) / 10;
      return {
        categoryId,
        category: getCategoryById(categories, categoryId),
        total,
        totalText: formatCurrency(total),
        percent,
        count
      };
    })
    .sort((a, b) => b.total - a.total);
}

function buildTrendPoints(range, records) {
  if (range === 'day') {
    return Array.from({ length: 24 }, (_, hour) => {
      const total = roundAmount(records
        .filter(record => new Date(record.createdAt).getHours() === hour)
        .reduce((sum, record) => sum + record.amount, 0));
      return {
        label: String(hour).padStart(2, '0'),
        total,
        totalText: total ? formatCurrency(total) : ''
      };
    });
  }

  if (range === 'week') {
    const weekStart = startOfWeek(new Date());
    const labels = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
    return labels.map((label, index) => {
      const dateValue = formatDateValue(addDays(weekStart, index));
      const total = roundAmount(records
        .filter(record => record.date === dateValue)
        .reduce((sum, record) => sum + record.amount, 0));
      return { label, total, totalText: total ? formatCurrency(total) : '' };
    });
  }

  if (range === 'year') {
    const currentYear = new Date().getFullYear();
    return Array.from({ length: 12 }, (_, month) => {
      const total = roundAmount(records
        .filter(record => {
          const date = parseDateValue(record.date);
          return date.getFullYear() === currentYear && date.getMonth() === month;
        })
        .reduce((sum, record) => sum + record.amount, 0));
      return { label: `${month + 1}月`, total, totalText: total ? formatCurrency(total) : '' };
    });
  }

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  return Array.from({ length: daysInMonth }, (_, dayIndex) => {
    const dateValue = formatDateValue(new Date(year, month, dayIndex + 1));
    const total = roundAmount(records
      .filter(record => record.date === dateValue)
      .reduce((sum, record) => sum + record.amount, 0));
    return { label: `${dayIndex + 1}`, total, totalText: total ? formatCurrency(total) : '' };
  });
}

function getCategoryById(categories, categoryId) {
  return categories.find(item => item.id === categoryId) || BUILTIN_CATEGORIES.find(item => item.id === FALLBACK_CATEGORY_ID) || BUILTIN_CATEGORIES[0];
}

function getRangeInfo(range) {
  const today = startOfDay(new Date());

  if (range === 'day') {
    return { start: today, end: endOfDay(today) };
  }
  if (range === 'week') {
    const start = startOfWeek(today);
    return { start, end: endOfDay(addDays(start, 6)) };
  }
  if (range === 'year') {
    return { start: startOfYear(today), end: endOfYear(today) };
  }

  return { start: startOfMonth(today), end: endOfMonth(today) };
}

function getEffectiveDayCount(range, start, end) {
  if (range === 'day') return 1;
  const today = startOfDay(new Date());
  const effectiveEnd = today < end ? today : startOfDay(end);
  return Math.max(Math.floor((effectiveEnd - startOfDay(start)) / 86400000) + 1, 1);
}

function normalizeRange(value) {
  return RANGE_OPTIONS.some(item => item.value === value) ? value : DEFAULT_RANGE;
}

function normalizeDateValue(value) {
  const text = toText(value);
  if (!text) return '';
  const date = parseDateValue(text);
  return date ? formatDateValue(date) : '';
}

function normalizeMonthValue(value) {
  const text = toText(value);
  if (!/^\d{4}-\d{2}$/.test(text)) return '';
  const [year, month] = text.split('-').map(part => Number.parseInt(part, 10));
  if (!year || !month || month < 1 || month > 12) return '';
  return `${year}-${String(month).padStart(2, '0')}`;
}

function normalizeAmount(value) {
  const number = Number(value);
  if (Number.isNaN(number) || number <= 0) return 0;
  return roundAmount(number);
}

function normalizeRecurringDay(value) {
  const day = Number.parseInt(value, 10);
  if (!Number.isInteger(day) || day < 1 || day > 31) return null;
  return day;
}

function normalizeForecastKind(value) {
  return value === 'fixed' ? 'fixed' : 'one_off';
}

function normalizeForecastStatus(value) {
  return ['planned', 'done', 'skipped'].includes(value) ? value : 'planned';
}

function normalizeForecastPlannedDate(value, month) {
  const normalized = normalizeDateValue(value);
  if (!normalized) return '';
  return toMonthKey(normalized) === month ? normalized : '';
}

function toMonthKey(value) {
  const normalized = normalizeDateValue(value);
  return normalized ? normalized.slice(0, 7) : '';
}

function getCurrentMonthKey() {
  return getTodayValue().slice(0, 7);
}

function compareForecastItems(a, b) {
  const aDate = a.plannedDate || `${a.month}-99`;
  const bDate = b.plannedDate || `${b.month}-99`;
  if (aDate !== bDate) return aDate.localeCompare(bDate);
  if (a.kind !== b.kind) return a.kind === 'fixed' ? -1 : 1;
  return String(a.createdAt || '').localeCompare(String(b.createdAt || ''));
}

function compareFixedForecastTemplates(a, b) {
  return String(a.createdAt || '').localeCompare(String(b.createdAt || ''));
}

function findForecastItem(store, forecastId) {
  const targetId = toText(forecastId);
  if (!targetId) return null;

  for (const [month, items] of Object.entries(store.forecastMonths || {})) {
    const item = items.find(entry => entry.id === targetId);
    if (item) {
      return { month, item };
    }
  }

  return null;
}

function normalizeColor(value) {
  const text = toText(value);
  return /^#[0-9a-fA-F]{6}$/.test(text) ? text : '#60a5fa';
}

function createRecordId() {
  return `expense-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

module.exports = {
  BUILTIN_CATEGORIES,
  DEFAULT_RANGE,
  FALLBACK_CATEGORY_ID,
  RANGE_OPTIONS,
  STORAGE_KEY,
  addCategory,
  buildCategoryBreakdown,
  buildBudgetMonthView,
  buildForecastMonthView,
  buildRangeView,
  buildTrendPoints,
  removeBudgetCategory,
  deleteFixedForecastTemplate,
  deleteForecastItem,
  deleteRecord,
  getStore,
  loadFixedForecastTemplatesIntoMonth,
  saveStore,
  upsertBudgetMonthConfig,
  upsertFixedForecastTemplate,
  upsertForecastItem,
  upsertRecord
};
