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
  delete require.cache[require.resolve('../miniprogram/utils/goals-store')];
});

test('goals store normalizes missing data into three horizons', () => {
  const {
    getStore,
    buildOverview
  } = require('../miniprogram/utils/goals-store');

  const store = getStore();
  const overview = buildOverview(store);

  assert.equal(Object.keys(store).length, 3);
  assert.equal(store['1y'].cards.length, 1);
  assert.equal(store['3y'].cards.length, 1);
  assert.equal(store['4y'].cards.length, 1);
  assert.equal(overview.horizons.length, 3);
  assert.equal(overview.totalMilestones, 0);
});

test('goals store saves card content and milestone progress', () => {
  const {
    getStore,
    updateGoalCard,
    saveMilestone,
    updateMilestoneProgress,
    buildHorizonView
  } = require('../miniprogram/utils/goals-store');

  let store = getStore();
  store = updateGoalCard(store, '1y', {
    title: '一年内完成作品集',
    summary: '形成稳定输出节奏',
    targetDate: '2027-03-30'
  });
  store = saveMilestone(store, '1y', {
    title: '完成第一阶段剪辑练习',
    description: '建立稳定练习频率',
    dueDate: '2026-04-15',
    priority: 'high'
  });

  const milestoneId = store['1y'].milestones[0].id;
  store = updateMilestoneProgress(store, '1y', milestoneId, 100);

  const view = buildHorizonView(store, '1y');

  assert.equal(view.card.title, '一年内完成作品集');
  assert.equal(view.milestones.length, 1);
  assert.equal(view.stats.completed, 1);
  assert.equal(view.stats.averageProgress, 100);
  assert.equal(view.milestones[0].completed, true);
});

test('goals store deletes milestone without touching other horizons', () => {
  const {
    getStore,
    saveMilestone,
    deleteMilestone
  } = require('../miniprogram/utils/goals-store');

  let store = getStore();
  store = saveMilestone(store, '3y', { title: '搭建稳定业务结构' });
  store = saveMilestone(store, '4y', { title: '形成长期生活系统' });

  const deleteId = store['3y'].milestones[0].id;
  store = deleteMilestone(store, '3y', deleteId);

  assert.equal(store['3y'].milestones.length, 0);
  assert.equal(store['4y'].milestones.length, 1);
});
