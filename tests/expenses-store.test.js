const test = require('node:test');
const assert = require('node:assert/strict');

const { formatDateValue } = require('../miniprogram/utils/common');

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
});

test('expenses store normalizes builtin categories', () => {
  const { getStore, BUILTIN_CATEGORIES } = require('../miniprogram/utils/expenses-store');

  const store = getStore();

  assert.equal(store.records.length, 0);
  assert.equal(store.categories.length, BUILTIN_CATEGORIES.length);
  assert.equal(store.categories[0].builtin, true);
});

test('expenses store builds month stats and category breakdown', () => {
  const {
    getStore,
    upsertRecord,
    buildRangeView
  } = require('../miniprogram/utils/expenses-store');

  const today = formatDateValue(new Date());
  const firstDayOfMonth = formatDateValue(new Date(new Date().getFullYear(), new Date().getMonth(), 1));

  let store = getStore();
  store = upsertRecord(store, {
    amount: 32.5,
    date: today,
    categoryId: 'food',
    note: '午饭'
  });
  store = upsertRecord(store, {
    amount: 18,
    date: firstDayOfMonth,
    categoryId: 'transport',
    note: '地铁'
  });

  const view = buildRangeView(store, 'month');

  assert.equal(view.stats.count, 2);
  assert.equal(view.stats.total, 50.5);
  assert.equal(view.breakdown[0].category.id, 'food');
  assert.equal(view.records.length, 2);
});

test('expenses store edits and deletes records', () => {
  const {
    getStore,
    upsertRecord,
    deleteRecord
  } = require('../miniprogram/utils/expenses-store');

  let store = getStore();
  store = upsertRecord(store, {
    amount: 66,
    date: formatDateValue(new Date()),
    categoryId: 'study',
    note: '买书'
  });

  const recordId = store.records[0].id;

  store = upsertRecord(store, {
    amount: 88,
    date: formatDateValue(new Date()),
    categoryId: 'study',
    note: '课程'
  }, recordId);

  assert.equal(store.records[0].amount, 88);
  assert.equal(store.records[0].note, '课程');

  store = deleteRecord(store, recordId);

  assert.equal(store.records.length, 0);
});

test('expenses store initializes forecast collections', () => {
  const { getStore } = require('../miniprogram/utils/expenses-store');

  const store = getStore();

  assert.deepEqual(store.forecastMonths, {});
  assert.deepEqual(store.fixedForecastTemplates, []);
  assert.deepEqual(store.budgetMonths, {});
});

test('expenses store loads fixed templates into a month without duplicates', () => {
  const {
    getStore,
    upsertFixedForecastTemplate,
    loadFixedForecastTemplatesIntoMonth
  } = require('../miniprogram/utils/expenses-store');

  let store = getStore();
  store = upsertFixedForecastTemplate(store, {
    title: 'BTC 定投',
    amount: 500,
    categoryId: 'fun',
    recurringDay: 15,
    note: '长期定投'
  });

  store = loadFixedForecastTemplatesIntoMonth(store, '2026-04');
  assert.equal(store.forecastMonths['2026-04'].length, 1);
  assert.equal(store.forecastMonths['2026-04'][0].kind, 'fixed');

  store = loadFixedForecastTemplatesIntoMonth(store, '2026-04');
  assert.equal(store.forecastMonths['2026-04'].length, 1);
});

test('expenses store builds forecast month totals from planned, done, skipped, and actuals', () => {
  const {
    getStore,
    upsertRecord,
    upsertForecastItem,
    upsertFixedForecastTemplate,
    loadFixedForecastTemplatesIntoMonth,
    buildForecastMonthView
  } = require('../miniprogram/utils/expenses-store');

  let store = getStore();
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

  const btcItem = store.forecastMonths['2026-04'][0];
  store = upsertForecastItem(store, {
    ...btcItem,
    status: 'done'
  }, btcItem.id);

  const view = buildForecastMonthView(store, '2026-04');

  assert.equal(view.month, '2026-04');
  assert.equal(view.stats.total, 1256);
  assert.equal(view.stats.fixedTotal, 900);
  assert.equal(view.stats.oneOffTotal, 356);
  assert.equal(view.stats.actualTotal, 120);
  assert.equal(view.groups.fixed.length, 1);
  assert.equal(view.groups.oneOff.length, 2);
  assert.equal(view.groups.oneOff.find(item => item.title === '住宿').status, 'skipped');
});
