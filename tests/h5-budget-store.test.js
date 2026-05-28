const test = require('node:test');
const assert = require('node:assert/strict');

const {
  readStore,
  saveStore,
  upsertFixedTemplate,
  upsertMonthPlan,
  loadFixedTemplatesIntoMonth,
  buildMonthView
} = require('../scripts/budget-store');

function createMemoryStorage(initialValue = null) {
  const memory = new Map();
  if (initialValue !== null) {
    memory.set('expenseTracker:v1', JSON.stringify(initialValue));
  }

  return {
    getItem(key) {
      return memory.has(key) ? memory.get(key) : null;
    },
    setItem(key, value) {
      memory.set(key, String(value));
    }
  };
}

test('budget store saves monthly plans and fixed templates into the shared local storage', () => {
  const storage = createMemoryStorage({
    records: [
      {
        id: 'expense-1',
        amount: 14,
        date: '2026-04-01',
        categoryId: 'food',
        expenseRole: 'life_support',
        note: '早餐'
      }
    ]
  });

  let store = readStore(storage);
  store = upsertFixedTemplate(store, {
    title: '每月吃饭',
    amount: 900,
    categoryId: 'food',
    recurringDay: 5,
    note: '餐费'
  });
  store = upsertMonthPlan(store, {
    month: '2026-04',
    title: '12号剧本杀',
    amount: 356,
    categoryId: 'fun',
    plannedDate: '2026-04-12',
    note: '朋友局'
  });
  store = loadFixedTemplatesIntoMonth(store, '2026-04');
  saveStore(storage, store);

  const reloadedStore = readStore(storage);
  const view = buildMonthView(reloadedStore, '2026-04');

  assert.equal(view.summary.plannedTotal, 1256);
  assert.equal(view.summary.fixedTotal, 900);
  assert.equal(view.summary.oneOffTotal, 356);
  assert.equal(view.summary.actualTotal, 14);
  assert.equal(reloadedStore.records[0].expenseRole, 'life_support');
  assert.equal(view.items.length, 2);
  assert.equal(view.templates.length, 1);
});

test('loading fixed templates into the same month does not create duplicates', () => {
  const storage = createMemoryStorage();

  let store = readStore(storage);
  store = upsertFixedTemplate(store, {
    title: 'BTC定投',
    amount: 500,
    categoryId: 'other',
    recurringDay: 15,
    note: '每月固定投入'
  });

  store = loadFixedTemplatesIntoMonth(store, '2026-04');
  store = loadFixedTemplatesIntoMonth(store, '2026-04');

  const view = buildMonthView(store, '2026-04');

  assert.equal(view.summary.fixedTotal, 500);
  assert.equal(view.items.filter(item => item.kind === 'fixed').length, 1);
});

test('monthly view only counts planned items as future spend', () => {
  const storage = createMemoryStorage({
    records: [
      {
        id: 'expense-1',
        amount: 20,
        date: '2026-04-02',
        categoryId: 'food',
        note: '午饭'
      }
    ]
  });

  let store = readStore(storage);
  store = upsertMonthPlan(store, {
    month: '2026-04',
    title: '住宿',
    amount: 50,
    categoryId: 'housing',
    plannedDate: '2026-04-12',
    status: 'planned'
  });
  store = upsertMonthPlan(store, {
    month: '2026-04',
    title: '聚餐',
    amount: 120,
    categoryId: 'food',
    plannedDate: '2026-04-15',
    status: 'done'
  });
  store = upsertMonthPlan(store, {
    month: '2026-04',
    title: '电影',
    amount: 60,
    categoryId: 'fun',
    plannedDate: '2026-04-18',
    status: 'skipped'
  });

  const view = buildMonthView(store, '2026-04');

  assert.equal(view.summary.actualTotal, 20);
  assert.equal(view.summary.plannedTotal, 50);
  assert.equal(view.pendingItems.length, 1);
  assert.equal(view.pendingItems[0].title, '住宿');
});
