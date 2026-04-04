(function (root, factory) {
  const api = factory();

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  root.BudgetStore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const STORAGE_KEY = 'expenseTracker:v1';
  const FALLBACK_CATEGORY_ID = 'other';
  const BUILTIN_CATEGORIES = [
    { id: 'food', name: '餐饮', color: '#fb7185', icon: '🍜', builtin: true },
    { id: 'transport', name: '交通', color: '#38bdf8', icon: '🚌', builtin: true },
    { id: 'shopping', name: '购物', color: '#818cf8', icon: '🛍️', builtin: true },
    { id: 'daily', name: '日用', color: '#f59e0b', icon: '🧴', builtin: true },
    { id: 'fun', name: '娱乐', color: '#c084fc', icon: '🎮', builtin: true },
    { id: 'study', name: '学习', color: '#34d399', icon: '📘', builtin: true },
    { id: 'medical', name: '医疗', color: '#f87171', icon: '🩺', builtin: true },
    { id: 'housing', name: '住宿', color: '#94a3b8', icon: '🏠', builtin: true },
    { id: FALLBACK_CATEGORY_ID, name: '其他', color: '#60a5fa', icon: '💠', builtin: true }
  ];
  const RESERVED_KEYS = new Set([
    'records',
    'categories',
    'forecastMonths',
    'fixedForecastTemplates',
    'budgetMonths',
    'extras'
  ]);

  function readStore(storage = getDefaultStorage()) {
    return normalizeStore(readRawStore(storage));
  }

  function saveStore(storageOrStore, maybeStore) {
    const storage = maybeStore ? resolveStorage(storageOrStore) : getDefaultStorage();
    const store = maybeStore ? maybeStore : storageOrStore;
    const normalized = normalizeStore(store);

    storage.setItem(STORAGE_KEY, JSON.stringify(serializeStore(normalized)));
    return normalized;
  }

  function upsertMonthPlan(store, draft) {
    const normalized = normalizeStore(store);
    const amount = normalizeAmount(draft.amount);
    const title = toText(draft.title);
    const month = normalizeMonthValue(draft.month || toMonthKey(draft.plannedDate));

    if (!title) {
      throw new Error('事项名称不能为空');
    }

    if (!amount) {
      throw new Error('预计金额不能为空');
    }

    if (!month) {
      throw new Error('请选择月份或日期');
    }

    const existing = findMonthPlan(normalized, draft.id);
    const categoryId = getKnownCategoryId(normalized.categories, draft.categoryId);
    const timestamp = new Date().toISOString();
    const next = cloneStore(normalized);
    const targetMonth = month;

    if (existing) {
      next.forecastMonths[existing.month] = (next.forecastMonths[existing.month] || []).filter(item => item.id !== existing.item.id);
      if (!next.forecastMonths[existing.month].length) {
        delete next.forecastMonths[existing.month];
      }
    }

    const item = {
      id: toText(draft.id) || createId('forecast'),
      title,
      amount,
      categoryId,
      month: targetMonth,
      kind: draft.kind === 'fixed' ? 'fixed' : 'one_off',
      plannedDate: normalizePlannedDate(draft.plannedDate, targetMonth),
      recurringDay: normalizeRecurringDay(draft.recurringDay),
      note: toText(draft.note),
      status: normalizeStatus(draft.status),
      sourceTemplateId: toText(draft.sourceTemplateId),
      createdAt: existing ? existing.item.createdAt : timestamp,
      updatedAt: timestamp
    };

    next.forecastMonths[targetMonth] = next.forecastMonths[targetMonth] || [];
    next.forecastMonths[targetMonth].push(item);
    next.forecastMonths[targetMonth].sort(compareMonthPlans);

    return next;
  }

  function deleteMonthPlan(store, planId) {
    const normalized = normalizeStore(store);
    const existing = findMonthPlan(normalized, planId);

    if (!existing) {
      return normalized;
    }

    const next = cloneStore(normalized);
    next.forecastMonths[existing.month] = (next.forecastMonths[existing.month] || []).filter(item => item.id !== existing.item.id);
    if (!next.forecastMonths[existing.month].length) {
      delete next.forecastMonths[existing.month];
    }
    return next;
  }

  function setMonthPlanStatus(store, planId, status) {
    const normalized = normalizeStore(store);
    const existing = findMonthPlan(normalized, planId);

    if (!existing) {
      return normalized;
    }

    const next = cloneStore(normalized);
    next.forecastMonths[existing.month] = next.forecastMonths[existing.month].map(item => {
      if (item.id !== existing.item.id) return item;
      return {
        ...item,
        status: normalizeStatus(status),
        updatedAt: new Date().toISOString()
      };
    }).sort(compareMonthPlans);

    return next;
  }

  function upsertFixedTemplate(store, draft) {
    const normalized = normalizeStore(store);
    const amount = normalizeAmount(draft.amount);
    const title = toText(draft.title);

    if (!title) {
      throw new Error('固定项目名称不能为空');
    }

    if (!amount) {
      throw new Error('默认金额不能为空');
    }

    const existing = findFixedTemplate(normalized, draft.id);
    const timestamp = new Date().toISOString();
    const next = cloneStore(normalized);
    const template = {
      id: toText(draft.id) || createId('fixed-template'),
      title,
      amount,
      categoryId: getKnownCategoryId(normalized.categories, draft.categoryId),
      recurringDay: normalizeRecurringDay(draft.recurringDay),
      note: toText(draft.note),
      createdAt: existing ? existing.createdAt : timestamp,
      updatedAt: timestamp
    };

    if (existing) {
      next.fixedForecastTemplates = next.fixedForecastTemplates.map(item => item.id === existing.id ? template : item);
    } else {
      next.fixedForecastTemplates.push(template);
    }

    next.fixedForecastTemplates.sort(compareFixedTemplates);
    return next;
  }

  function deleteFixedTemplate(store, templateId) {
    const normalized = normalizeStore(store);
    const next = cloneStore(normalized);
    next.fixedForecastTemplates = next.fixedForecastTemplates.filter(item => item.id !== toText(templateId));
    return next;
  }

  function loadFixedTemplatesIntoMonth(store, month) {
    const normalized = normalizeStore(store);
    const targetMonth = normalizeMonthValue(month);

    if (!targetMonth) {
      throw new Error('月份不正确');
    }

    if (!normalized.fixedForecastTemplates.length) {
      return normalized;
    }

    const next = cloneStore(normalized);
    const currentItems = next.forecastMonths[targetMonth] || [];
    const existingTemplateIds = new Set(
      currentItems
        .filter(item => item.kind === 'fixed')
        .map(item => toText(item.sourceTemplateId))
        .filter(Boolean)
    );

    normalized.fixedForecastTemplates.forEach(template => {
      if (existingTemplateIds.has(template.id)) {
        return;
      }

      currentItems.push({
        id: createId('forecast'),
        title: template.title,
        amount: template.amount,
        categoryId: template.categoryId,
        month: targetMonth,
        kind: 'fixed',
        plannedDate: buildPlannedDateFromRecurringDay(targetMonth, template.recurringDay),
        recurringDay: template.recurringDay,
        note: template.note,
        status: 'planned',
        sourceTemplateId: template.id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    });

    next.forecastMonths[targetMonth] = currentItems.sort(compareMonthPlans);
    return next;
  }

  function buildMonthView(store, month) {
    const normalized = normalizeStore(store);
    const targetMonth = normalizeMonthValue(month) || getCurrentMonthKey();
    const categoryMap = new Map(normalized.categories.map(category => [category.id, category]));
    const items = (normalized.forecastMonths[targetMonth] || [])
      .slice()
      .sort(compareMonthPlans)
      .map(item => enrichMonthPlan(item, categoryMap.get(item.categoryId) || getFallbackCategory()));
    const pendingItems = items.filter(item => item.status === 'planned');
    const fixedTotal = roundAmount(pendingItems.filter(item => item.kind === 'fixed').reduce((sum, item) => sum + item.amount, 0));
    const oneOffTotal = roundAmount(pendingItems.filter(item => item.kind === 'one_off').reduce((sum, item) => sum + item.amount, 0));
    const actualTotal = roundAmount(
      normalized.records
        .filter(record => toMonthKey(record.date) === targetMonth)
        .reduce((sum, record) => sum + record.amount, 0)
    );
    const templates = normalized.fixedForecastTemplates
      .slice()
      .sort(compareFixedTemplates)
      .map(template => ({
        ...template,
        category: categoryMap.get(template.categoryId) || getFallbackCategory(),
        amountText: formatCurrency(template.amount),
        recurringLabel: template.recurringDay ? `通常每月 ${template.recurringDay} 号` : '日期可不填'
      }));

    return {
      month: targetMonth,
      monthLabel: formatMonthLabel(targetMonth),
      summary: {
        plannedTotal: roundAmount(fixedTotal + oneOffTotal),
        fixedTotal,
        oneOffTotal,
        actualTotal,
        pendingCount: pendingItems.length
      },
      categories: normalized.categories.slice(),
      items,
      pendingItems,
      templates
    };
  }

  function normalizeStore(source) {
    const raw = source && typeof source === 'object' ? source : {};
    const extras = {};

    Object.entries(raw).forEach(([key, value]) => {
      if (!RESERVED_KEYS.has(key)) {
        extras[key] = value;
      }
    });

    const categories = normalizeCategories(raw.categories);
    const categoryIds = new Set(categories.map(category => category.id));

    return {
      records: normalizeRecords(raw.records, categoryIds),
      categories,
      forecastMonths: normalizeForecastMonths(raw.forecastMonths, categoryIds),
      fixedForecastTemplates: normalizeFixedTemplates(raw.fixedForecastTemplates, categoryIds),
      budgetMonths: raw.budgetMonths && typeof raw.budgetMonths === 'object' ? raw.budgetMonths : {},
      extras
    };
  }

  function serializeStore(store) {
    const normalized = normalizeStore(store);

    return {
      ...normalized.extras,
      records: normalized.records.map(record => ({
        id: record.id,
        amount: record.amount,
        date: record.date,
        categoryId: record.categoryId,
        note: record.note,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt
      })),
      categories: normalized.categories
        .filter(category => !category.builtin)
        .map(category => ({
          id: category.id,
          name: category.name,
          color: category.color,
          icon: category.icon,
          createdAt: category.createdAt
        })),
      forecastMonths: Object.fromEntries(
        Object.entries(normalized.forecastMonths).map(([month, items]) => [
          month,
          items.map(item => ({
            id: item.id,
            title: item.title,
            amount: item.amount,
            categoryId: item.categoryId,
            month: item.month,
            kind: item.kind,
            plannedDate: item.plannedDate,
            recurringDay: item.recurringDay,
            note: item.note,
            status: item.status,
            sourceTemplateId: item.sourceTemplateId,
            createdAt: item.createdAt,
            updatedAt: item.updatedAt
          }))
        ])
      ),
      fixedForecastTemplates: normalized.fixedForecastTemplates.map(template => ({
        id: template.id,
        title: template.title,
        amount: template.amount,
        categoryId: template.categoryId,
        recurringDay: template.recurringDay,
        note: template.note,
        createdAt: template.createdAt,
        updatedAt: template.updatedAt
      })),
      budgetMonths: normalized.budgetMonths
    };
  }

  function readRawStore(storage) {
    try {
      const raw = storage.getItem(STORAGE_KEY);
      if (!raw) return {};
      return JSON.parse(raw);
    } catch (error) {
      return {};
    }
  }

  function normalizeCategories(rawCategories) {
    const customCategories = Array.isArray(rawCategories)
      ? rawCategories
          .filter(category => category && typeof category === 'object' && !BUILTIN_CATEGORIES.some(item => item.id === category.id))
          .map(category => ({
            id: toText(category.id) || createId('category'),
            name: toText(category.name) || '未命名分类',
            color: normalizeColor(category.color),
            icon: toText(category.icon) || '💠',
            builtin: false,
            createdAt: normalizeDateTime(category.createdAt) || new Date().toISOString()
          }))
      : [];

    return [
      ...BUILTIN_CATEGORIES.map(category => ({
        ...category,
        createdAt: '1970-01-01T00:00:00.000Z'
      })),
      ...customCategories
    ];
  }

  function normalizeRecords(rawRecords, categoryIds) {
    return Array.isArray(rawRecords)
      ? rawRecords
          .filter(record => record && typeof record === 'object')
          .map(record => {
            const amount = normalizeAmount(record.amount);
            if (!amount) return null;

            const createdAt = normalizeDateTime(record.createdAt) || new Date().toISOString();
            return {
              id: toText(record.id) || createId('expense'),
              amount,
              date: normalizeDateValue(record.date) || getTodayValue(),
              categoryId: categoryIds.has(record.categoryId) ? record.categoryId : FALLBACK_CATEGORY_ID,
              note: toText(record.note),
              createdAt,
              updatedAt: normalizeDateTime(record.updatedAt) || createdAt
            };
          })
          .filter(Boolean)
      : [];
  }

  function normalizeForecastMonths(rawMonths, categoryIds) {
    const source = rawMonths && typeof rawMonths === 'object' ? rawMonths : {};
    const output = {};

    Object.entries(source).forEach(([monthKey, items]) => {
      const month = normalizeMonthValue(monthKey);
      if (!month || !Array.isArray(items)) return;

      const nextItems = items
        .filter(item => item && typeof item === 'object')
        .map(item => normalizeMonthPlan({ ...item, month }, categoryIds))
        .filter(Boolean)
        .sort(compareMonthPlans);

      if (nextItems.length) {
        output[month] = nextItems;
      }
    });

    return output;
  }

  function normalizeFixedTemplates(rawTemplates, categoryIds) {
    return Array.isArray(rawTemplates)
      ? rawTemplates
          .filter(template => template && typeof template === 'object')
          .map(template => {
            const amount = normalizeAmount(template.amount);
            if (!amount) return null;

            const createdAt = normalizeDateTime(template.createdAt) || new Date().toISOString();
            return {
              id: toText(template.id) || createId('fixed-template'),
              title: toText(template.title) || '未命名固定项目',
              amount,
              categoryId: categoryIds.has(template.categoryId) ? template.categoryId : FALLBACK_CATEGORY_ID,
              recurringDay: normalizeRecurringDay(template.recurringDay),
              note: toText(template.note),
              createdAt,
              updatedAt: normalizeDateTime(template.updatedAt) || createdAt
            };
          })
          .filter(Boolean)
      : [];
  }

  function normalizeMonthPlan(item, categoryIds) {
    const amount = normalizeAmount(item.amount);
    const month = normalizeMonthValue(item.month);

    if (!amount || !month) {
      return null;
    }

    const createdAt = normalizeDateTime(item.createdAt) || new Date().toISOString();
    return {
      id: toText(item.id) || createId('forecast'),
      title: toText(item.title) || '未命名事项',
      amount,
      categoryId: categoryIds.has(item.categoryId) ? item.categoryId : FALLBACK_CATEGORY_ID,
      month,
      kind: item.kind === 'fixed' ? 'fixed' : 'one_off',
      plannedDate: normalizePlannedDate(item.plannedDate, month),
      recurringDay: normalizeRecurringDay(item.recurringDay),
      note: toText(item.note),
      status: normalizeStatus(item.status),
      sourceTemplateId: toText(item.sourceTemplateId),
      createdAt,
      updatedAt: normalizeDateTime(item.updatedAt) || createdAt
    };
  }

  function enrichMonthPlan(item, category) {
    return {
      ...item,
      category,
      amountText: formatCurrency(item.amount),
      plannedDateLabel: item.plannedDate ? formatDateLabel(item.plannedDate) : '未设置日期',
      statusLabel: getStatusLabel(item.status),
      kindLabel: item.kind === 'fixed' ? '固定项目' : '临时事项'
    };
  }

  function findMonthPlan(store, planId) {
    const targetId = toText(planId);
    if (!targetId) return null;

    for (const [month, items] of Object.entries(store.forecastMonths || {})) {
      const item = items.find(entry => entry.id === targetId);
      if (item) {
        return { month, item };
      }
    }

    return null;
  }

  function findFixedTemplate(store, templateId) {
    const targetId = toText(templateId);
    return store.fixedForecastTemplates.find(item => item.id === targetId) || null;
  }

  function cloneStore(store) {
    return {
      records: store.records.map(record => ({ ...record })),
      categories: store.categories.map(category => ({ ...category })),
      forecastMonths: Object.fromEntries(
        Object.entries(store.forecastMonths || {}).map(([month, items]) => [
          month,
          items.map(item => ({ ...item }))
        ])
      ),
      fixedForecastTemplates: store.fixedForecastTemplates.map(template => ({ ...template })),
      budgetMonths: { ...(store.budgetMonths || {}) },
      extras: { ...(store.extras || {}) }
    };
  }

  function getKnownCategoryId(categories, candidate) {
    return categories.some(category => category.id === candidate) ? candidate : FALLBACK_CATEGORY_ID;
  }

  function getFallbackCategory() {
    return BUILTIN_CATEGORIES.find(category => category.id === FALLBACK_CATEGORY_ID) || BUILTIN_CATEGORIES[0];
  }

  function buildPlannedDateFromRecurringDay(month, recurringDay) {
    if (!recurringDay) return '';
    const [year, monthNumber] = month.split('-').map(Number);
    const lastDay = new Date(year, monthNumber, 0).getDate();
    const day = Math.min(recurringDay, lastDay);
    return `${month}-${String(day).padStart(2, '0')}`;
  }

  function compareMonthPlans(a, b) {
    const aDate = a.plannedDate || `${a.month}-99`;
    const bDate = b.plannedDate || `${b.month}-99`;
    if (aDate !== bDate) return aDate.localeCompare(bDate);
    if (a.kind !== b.kind) return a.kind === 'fixed' ? -1 : 1;
    return String(a.createdAt || '').localeCompare(String(b.createdAt || ''));
  }

  function compareFixedTemplates(a, b) {
    return String(a.createdAt || '').localeCompare(String(b.createdAt || ''));
  }

  function normalizeAmount(value) {
    const number = Number(value);
    if (Number.isNaN(number) || number <= 0) {
      return 0;
    }
    return roundAmount(number);
  }

  function normalizeMonthValue(value) {
    const text = toText(value);
    if (!/^\d{4}-\d{2}$/.test(text)) return '';
    const [year, month] = text.split('-').map(Number);
    if (!year || !month || month < 1 || month > 12) return '';
    return `${year}-${String(month).padStart(2, '0')}`;
  }

  function normalizeDateValue(value) {
    const text = toText(value);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return '';
    const date = new Date(text);
    return Number.isNaN(date.getTime()) ? '' : text;
  }

  function normalizePlannedDate(value, month) {
    const normalized = normalizeDateValue(value);
    if (!normalized) return '';
    return toMonthKey(normalized) === month ? normalized : '';
  }

  function normalizeRecurringDay(value) {
    const day = Number.parseInt(value, 10);
    if (!Number.isInteger(day) || day < 1 || day > 31) return null;
    return day;
  }

  function normalizeStatus(value) {
    return ['planned', 'done', 'skipped'].includes(value) ? value : 'planned';
  }

  function normalizeDateTime(value) {
    const text = toText(value);
    if (!text) return '';
    const date = new Date(text);
    return Number.isNaN(date.getTime()) ? '' : date.toISOString();
  }

  function normalizeColor(value) {
    const text = toText(value);
    return /^#[0-9a-fA-F]{6}$/.test(text) ? text : '#60a5fa';
  }

  function toMonthKey(dateValue) {
    const normalized = normalizeDateValue(dateValue);
    return normalized ? normalized.slice(0, 7) : '';
  }

  function shiftMonthKey(monthValue, delta) {
    const normalized = normalizeMonthValue(monthValue) || getCurrentMonthKey();
    const [year, month] = normalized.split('-').map(Number);
    const shifted = new Date(year, month - 1 + delta, 1);
    return `${shifted.getFullYear()}-${String(shifted.getMonth() + 1).padStart(2, '0')}`;
  }

  function getCurrentMonthKey() {
    return getTodayValue().slice(0, 7);
  }

  function getTodayValue() {
    return formatDateValue(new Date());
  }

  function formatCurrency(value) {
    return `¥${roundAmount(value).toFixed(2)}`;
  }

  function formatMonthLabel(monthValue) {
    const normalized = normalizeMonthValue(monthValue);
    if (!normalized) return '当前月份';
    const [year, month] = normalized.split('-');
    return `${year} 年 ${Number(month)} 月`;
  }

  function formatDateLabel(dateValue) {
    const normalized = normalizeDateValue(dateValue);
    if (!normalized) return '未设置日期';
    const [year, month, day] = normalized.split('-');
    return `${year}/${month}/${day}`;
  }

  function formatDateValue(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }

  function getStatusLabel(status) {
    if (status === 'done') return '已处理';
    if (status === 'skipped') return '已跳过';
    return '待发生';
  }

  function createId(prefix) {
    if (typeof crypto !== 'undefined' && crypto && typeof crypto.randomUUID === 'function') {
      return `${prefix}-${crypto.randomUUID()}`;
    }
    return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
  }

  function resolveStorage(storage) {
    if (!storage || typeof storage.getItem !== 'function' || typeof storage.setItem !== 'function') {
      throw new Error('storage adapter is required');
    }
    return storage;
  }

  function getDefaultStorage() {
    if (typeof localStorage === 'undefined') {
      throw new Error('localStorage is not available');
    }
    return localStorage;
  }

  function roundAmount(value) {
    return Math.round(Number(value || 0) * 100) / 100;
  }

  function toText(value) {
    return typeof value === 'string' ? value.trim() : '';
  }

  return {
    STORAGE_KEY,
    BUILTIN_CATEGORIES,
    readStore,
    saveStore,
    upsertMonthPlan,
    deleteMonthPlan,
    setMonthPlanStatus,
    upsertFixedTemplate,
    deleteFixedTemplate,
    loadFixedTemplatesIntoMonth,
    buildMonthView,
    shiftMonthKey,
    getCurrentMonthKey,
    formatCurrency,
    formatMonthLabel
  };
});
