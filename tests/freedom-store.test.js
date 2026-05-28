const test = require('node:test');
const assert = require('node:assert/strict');

const FreedomStore = require('../scripts/freedom-store');

function createMemoryStorage(initial = {}) {
  const memory = new Map();
  Object.entries(initial).forEach(([key, value]) => {
    memory.set(key, typeof value === 'string' ? value : JSON.stringify(value));
  });

  return {
    getItem(key) {
      return memory.has(key) ? memory.get(key) : null;
    },
    setItem(key, value) {
      memory.set(key, String(value));
    }
  };
}

test('freedom store calculates free days from funds and daily need', () => {
  let store = FreedomStore.normalizeStore({});
  store = FreedomStore.updateSettings(store, { dailyNeed: 50 });
  store = FreedomStore.upsertEntry(store, {
    type: 'fund',
    amount: 1000,
    date: '2026-05-20',
    note: '闲置资金'
  });
  store = FreedomStore.upsertEntry(store, {
    type: 'spend',
    amount: 150,
    date: '2026-05-21',
    note: '主动花掉'
  });

  const view = FreedomStore.buildFreedomView(store);

  assert.equal(view.totalFund, 1000);
  assert.equal(view.totalSpend, 150);
  assert.equal(view.availableFund, 850);
  assert.equal(view.freeDays, 17);
});

test('freedom store blocks spending more than available funds', () => {
  let store = FreedomStore.normalizeStore({});
  store = FreedomStore.upsertEntry(store, {
    type: 'fund',
    amount: 100,
    date: '2026-05-20'
  });

  assert.throws(() => FreedomStore.upsertEntry(store, {
    type: 'spend',
    amount: 101,
    date: '2026-05-21'
  }), /超过了当前闲置资金/);
});

test('freedom store returns zero free days when daily need is not set', () => {
  let store = FreedomStore.normalizeStore({});
  store = FreedomStore.upsertEntry(store, {
    type: 'fund',
    amount: 800,
    date: '2026-05-20'
  });

  const view = FreedomStore.buildFreedomView(store);

  assert.equal(view.dailyNeed, 0);
  assert.equal(view.freeDays, 0);
  assert.equal(view.availableFund, 800);
});

test('freedom store saves and reloads local data', () => {
  const storage = createMemoryStorage();
  let store = FreedomStore.updateSettings(FreedomStore.readStore(storage), { dailyNeed: 80 });
  store = FreedomStore.upsertEntry(store, { type: 'fund', amount: 400, date: '2026-05-20' });
  FreedomStore.saveStore(storage, store);

  const reloaded = FreedomStore.readStore(storage);
  const view = FreedomStore.buildFreedomView(reloaded);

  assert.equal(view.dailyNeed, 80);
  assert.equal(view.freeDays, 5);
});

test('freedom store suggests daily need from life support expense records', () => {
  const suggestion = FreedomStore.buildDailyNeedSuggestion({
    records: [
      { amount: 20, date: '2026-05-01', categoryId: 'food' },
      { amount: 30, date: '2026-05-02', categoryId: 'housing' },
      { amount: 99, date: '2026-05-03', categoryId: 'fun' }
    ]
  }, new Date(2026, 4, 10));

  assert.equal(suggestion.month, '2026-05');
  assert.equal(suggestion.total, 50);
  assert.equal(suggestion.elapsedDays, 10);
  assert.equal(suggestion.dailyNeed, 5);
});
