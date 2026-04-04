const test = require('node:test');
const assert = require('node:assert/strict');

function createWxStorage() {
  const memory = new Map();
  return {
    getStorageSync(key) {
      return memory.has(key) ? memory.get(key) : '';
    },
    setStorageSync(key, value) {
      memory.set(key, value);
    },
    clearStorageSync() {
      memory.clear();
    }
  };
}

test.beforeEach(() => {
  global.wx = createWxStorage();
  delete require.cache[require.resolve('../miniprogram/utils/expenses-store')];
  try {
    delete require.cache[require.resolve('../miniprogram/utils/budget-page')];
  } catch (error) {
    // Ignore cache cleanup before the helper exists.
  }
});

test('expenses store initializes budget collections', () => {
  const { getStore } = require('../miniprogram/utils/expenses-store');

  const store = getStore();

  assert.deepEqual(store.budgetMonths, {});
});

test('expenses store builds monthly budget view from total budget, category budgets, actuals, and planned forecast', () => {
  const {
    getStore,
    upsertRecord,
    upsertForecastItem,
    upsertFixedForecastTemplate,
    loadFixedForecastTemplatesIntoMonth,
    upsertBudgetMonthConfig,
    buildBudgetMonthView
  } = require('../miniprogram/utils/expenses-store');

  let store = getStore();
  store = upsertBudgetMonthConfig(store, '2026-04', {
    totalBudget: 3000,
    categoryBudgets: {
      food: 1200,
      fun: 600
    }
  });

  store = upsertRecord(store, {
    amount: 120,
    date: '2026-04-03',
    categoryId: 'food',
    note: '午饭'
  });

  store = upsertFixedForecastTemplate(store, {
    title: '每月吃饭',
    amount: 900,
    categoryId: 'food',
    recurringDay: 1,
    note: '月度餐饮'
  });
  store = loadFixedForecastTemplatesIntoMonth(store, '2026-04');

  store = upsertForecastItem(store, {
    title: '剧本杀',
    amount: 356,
    categoryId: 'fun',
    month: '2026-04',
    kind: 'one_off',
    plannedDate: '2026-04-12',
    note: '朋友局',
    status: 'planned'
  });
  store = upsertForecastItem(store, {
    title: '住宿',
    amount: 50,
    categoryId: 'housing',
    month: '2026-04',
    kind: 'one_off',
    plannedDate: '2026-04-12',
    note: '过夜',
    status: 'skipped'
  });

  const view = buildBudgetMonthView(store, '2026-04');

  assert.equal(view.month, '2026-04');
  assert.equal(view.summary.totalBudget, 3000);
  assert.equal(view.summary.actualTotal, 120);
  assert.equal(view.summary.plannedForecastTotal, 1256);
  assert.equal(view.summary.committedTotal, 1376);
  assert.equal(view.summary.remaining, 1624);
  assert.equal(view.categoryRows.length, 2);
  assert.equal(view.categoryRows[0].categoryId, 'food');
  assert.equal(view.categoryRows[0].usedTotal, 1020);
  assert.equal(view.categoryRows[0].remaining, 180);
  assert.equal(view.categoryRows[1].categoryId, 'fun');
  assert.equal(view.categoryRows[1].usedTotal, 356);
  assert.equal(view.categoryRows[1].remaining, 244);
});

test('monthly budget page view only counts planned items in the selected month', () => {
  const {
    getStore,
    upsertBudgetMonthConfig,
    upsertForecastItem,
    upsertRecord
  } = require('../miniprogram/utils/expenses-store');
  const { buildBudgetPageView } = require('../miniprogram/utils/budget-page');
  const { formatCurrency } = require('../miniprogram/utils/common');

  let store = getStore();
  store = upsertBudgetMonthConfig(store, '2026-04', {
    totalBudget: 3000,
    categoryBudgets: {
      food: 1200,
      fun: 600
    }
  });

  store = upsertRecord(store, {
    amount: 80,
    date: '2026-04-02',
    categoryId: 'food',
    note: '早餐和晚饭'
  });

  store = upsertForecastItem(store, {
    title: '剧本杀',
    amount: 356,
    categoryId: 'fun',
    month: '2026-04',
    kind: 'one_off',
    plannedDate: '2026-04-12',
    note: '朋友局',
    status: 'planned'
  });
  store = upsertForecastItem(store, {
    title: '住宿',
    amount: 50,
    categoryId: 'housing',
    month: '2026-04',
    kind: 'one_off',
    plannedDate: '2026-04-12',
    note: '过夜',
    status: 'skipped'
  });
  store = upsertForecastItem(store, {
    title: 'BTC 定投',
    amount: 500,
    categoryId: 'fun',
    month: '2026-04',
    kind: 'fixed',
    recurringDay: 15,
    note: '长期定投',
    status: 'done'
  });
  store = upsertForecastItem(store, {
    title: '五月旅行',
    amount: 1000,
    categoryId: 'fun',
    month: '2026-05',
    kind: 'one_off',
    plannedDate: '2026-05-03',
    note: '跨月隔离',
    status: 'planned'
  });

  const view = buildBudgetPageView(store, '2026-04');

  assert.equal(view.month, '2026-04');
  assert.equal(view.summary.actualTotal, 80);
  assert.equal(view.summary.plannedForecastTotal, 356);
  assert.equal(view.summary.remaining, 2564);
  assert.equal(view.pendingItems.length, 1);
  assert.equal(view.pendingItems[0].title, '剧本杀');
  assert.equal(view.pendingItems[0].amountText, formatCurrency(356));
  assert.equal(view.compareRows.length, 2);
  assert.equal(view.compareRows[0].categoryId, 'fun');
  assert.equal(view.compareRows[0].plannedSpent, 356);
  assert.equal(view.compareRows[0].remaining, 244);
});

test('monthly budget page view tracks category budget totals and month navigation helpers', () => {
  const {
    getStore,
    upsertBudgetMonthConfig
  } = require('../miniprogram/utils/expenses-store');
  const { buildBudgetPageView, shiftMonthKey } = require('../miniprogram/utils/budget-page');

  let store = getStore();
  store = upsertBudgetMonthConfig(store, '2026-04', {
    totalBudget: 3000,
    categoryBudgets: {
      food: 1200,
      fun: 600
    }
  });
  store = upsertBudgetMonthConfig(store, '2026-05', {
    totalBudget: 2000,
    categoryBudgets: {
      housing: 800
    }
  });

  const aprilView = buildBudgetPageView(store, '2026-04');
  const mayView = buildBudgetPageView(store, '2026-05');

  assert.equal(aprilView.summary.categoryBudgetTotal, 1800);
  assert.equal(aprilView.summary.unallocatedBudget, 1200);
  assert.equal(mayView.summary.categoryBudgetTotal, 800);
  assert.equal(mayView.summary.unallocatedBudget, 1200);
  assert.equal(shiftMonthKey('2026-01', -1), '2025-12');
  assert.equal(shiftMonthKey('2026-12', 1), '2027-01');
});
