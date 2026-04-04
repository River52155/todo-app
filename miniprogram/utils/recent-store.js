const { createId, formatDateTime, toText } = require('./common');
const { getStorageValue, setStorageValue } = require('./storage');

const STORAGE_KEY = 'recentPlan:v1';
const DEFAULT_FILTER = 'all';
const DEFAULT_LANE = 'focus';
const DEFAULT_WINDOW = 'this_week';

const LANE_OPTIONS = [
  { value: 'focus', label: '本周关注', summary: '放最近几天最想盯住的弹性事项' },
  { value: 'in_progress', label: '进行中', summary: '已经在推进，但细节还会变化' },
  { value: 'waiting', label: '等待中', summary: '先等回复、时机或外部条件' },
  { value: 'later', label: '以后再看', summary: '先记下来，暂时不急着推进' }
];

const WINDOW_OPTIONS = [
  { value: 'all', label: '全部' },
  { value: 'this_week', label: '本周' },
  { value: 'next_week', label: '下周' },
  { value: 'this_month', label: '本月' },
  { value: 'unscheduled', label: '未排期' }
];

function getStore() {
  const source = getStorageValue(STORAGE_KEY, { cards: [] });
  const normalized = normalizeStore(source);
  setStorageValue(STORAGE_KEY, normalized);
  return normalized;
}

function saveStore(store) {
  const normalized = normalizeStore(store);
  setStorageValue(STORAGE_KEY, normalized);
  return normalized;
}

function normalizeStore(raw) {
  const source = raw && typeof raw === 'object' ? raw : {};
  return {
    cards: Array.isArray(source.cards)
      ? source.cards.filter(card => card && typeof card === 'object').map(normalizeCard)
      : []
  };
}

function normalizeCard(card) {
  const createdAt = toText(card.createdAt) || new Date().toISOString();
  const updatedAt = toText(card.updatedAt) || createdAt;
  return {
    id: toText(card.id) || createId('recent'),
    title: toText(card.title),
    note: toText(card.note),
    lane: normalizeLane(card.lane),
    window: normalizeWindow(card.window),
    createdAt,
    updatedAt
  };
}

function createCard(payload) {
  const now = new Date().toISOString();
  return normalizeCard({
    id: createId('recent'),
    title: payload.title,
    note: payload.note,
    lane: payload.lane,
    window: payload.window,
    createdAt: now,
    updatedAt: now
  });
}

function buildStats(store) {
  return {
    total: store.cards.length,
    focusCount: store.cards.filter(card => card.lane === 'focus').length,
    waitingCount: store.cards.filter(card => card.lane === 'waiting').length,
    laneSummary: LANE_OPTIONS.map(option => ({
      ...option,
      count: store.cards.filter(card => card.lane === option.value).length
    }))
  };
}

function buildLanes(store, filter) {
  return LANE_OPTIONS.map((lane, laneIndex) => {
    const items = store.cards
      .filter(card => card.lane === lane.value)
      .filter(card => filter === 'all' ? true : card.window === filter)
      .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''))
      .map(card => ({
        ...card,
        laneIndex,
        windowLabel: getWindowLabel(card.window),
        updatedLabel: formatDateTime(card.updatedAt || card.createdAt)
      }));

    return {
      ...lane,
      count: items.length,
      items
    };
  });
}

function updateCard(store, id, payload) {
  const targetId = toText(id);
  return saveStore({
    cards: store.cards.map(card => {
      if (card.id !== targetId) return card;
      return normalizeCard({
        ...card,
        ...payload,
        updatedAt: new Date().toISOString()
      });
    })
  });
}

function removeCard(store, id) {
  const targetId = toText(id);
  return saveStore({
    cards: store.cards.filter(card => card.id !== targetId)
  });
}

function getFilterLabel(filter) {
  const option = WINDOW_OPTIONS.find(item => item.value === filter);
  return option ? option.label : WINDOW_OPTIONS[0].label;
}

function getWindowLabel(value) {
  const option = WINDOW_OPTIONS.find(item => item.value === value);
  return option ? option.label : WINDOW_OPTIONS[1].label;
}

function normalizeLane(value) {
  return LANE_OPTIONS.some(item => item.value === value) ? value : DEFAULT_LANE;
}

function normalizeWindow(value) {
  return WINDOW_OPTIONS.some(item => item.value === value && value !== 'all') ? value : DEFAULT_WINDOW;
}

module.exports = {
  DEFAULT_FILTER,
  DEFAULT_LANE,
  DEFAULT_WINDOW,
  LANE_OPTIONS,
  STORAGE_KEY,
  WINDOW_OPTIONS,
  buildLanes,
  buildStats,
  createCard,
  getFilterLabel,
  getStore,
  removeCard,
  saveStore,
  updateCard
};
