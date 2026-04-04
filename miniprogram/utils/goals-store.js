const {
  createId,
  formatDateLabel,
  formatDateTime,
  formatDateValue,
  parseDateValue,
  toText
} = require('./common');
const { getStorageValue, setStorageValue } = require('./storage');

const STORAGE_KEY = 'goalPlans:v1';
const HORIZONS = ['1y', '3y', '4y'];
const DEFAULT_HORIZON = '1y';

const HORIZON_OPTIONS = [
  { value: '1y', label: '1年目标', shortLabel: '1年', icon: '🎯' },
  { value: '3y', label: '3年目标', shortLabel: '3年', icon: '🧭' },
  { value: '4y', label: '4年目标', shortLabel: '4年', icon: '🌱' }
];

const PRIORITY_OPTIONS = [
  { value: 'high', label: '高优先级' },
  { value: 'medium', label: '中优先级' },
  { value: 'low', label: '低优先级' }
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
  return HORIZONS.reduce((result, horizon) => {
    result[horizon] = {
      cards: [createDefaultCard(horizon)],
      milestones: []
    };
    return result;
  }, {});
}

function createDefaultCard(horizon) {
  const meta = getHorizonMeta(horizon);
  return {
    id: 'main',
    title: '',
    icon: meta.icon,
    imageUrl: '',
    summary: '',
    successCriteria: '',
    notes: '',
    targetDate: getDefaultTargetDate(horizon),
    updatedAt: ''
  };
}

function normalizeStore(raw) {
  const source = raw && typeof raw === 'object' ? raw : {};

  return HORIZONS.reduce((result, horizon) => {
    const value = source[horizon] && typeof source[horizon] === 'object' ? source[horizon] : {};
    const card = Array.isArray(value.cards) ? value.cards[0] : value.card;
    const milestones = Array.isArray(value.milestones) ? value.milestones : [];

    result[horizon] = {
      cards: [normalizeCard(horizon, card)],
      milestones: milestones
        .filter(item => item && typeof item === 'object')
        .map(normalizeMilestone)
        .sort(sortMilestones)
    };
    return result;
  }, {});
}

function normalizeCard(horizon, raw) {
  const defaults = createDefaultCard(horizon);
  const source = raw && typeof raw === 'object' ? raw : {};

  return {
    id: 'main',
    title: toText(source.title),
    icon: toText(source.icon) || defaults.icon,
    imageUrl: toText(source.imageUrl),
    summary: toText(source.summary),
    successCriteria: toText(source.successCriteria),
    notes: toText(source.notes),
    targetDate: normalizeTargetDate(source.targetDate) || defaults.targetDate,
    updatedAt: normalizeDateTime(source.updatedAt)
  };
}

function normalizeMilestone(raw) {
  const source = raw && typeof raw === 'object' ? raw : {};
  const createdAt = normalizeDateTime(source.createdAt) || new Date().toISOString();
  const progress = normalizeProgress(source.progress);
  const completed = Boolean(source.completed) || progress >= 100;

  return {
    id: toText(source.id) || createId('goal-milestone'),
    title: toText(source.title),
    description: toText(source.description),
    dueDate: normalizeTargetDate(source.dueDate),
    priority: normalizePriority(source.priority),
    progress,
    completed,
    createdAt,
    completedAt: completed ? normalizeDateTime(source.completedAt) || new Date().toISOString() : ''
  };
}

function buildOverview(store) {
  const normalized = normalizeStore(store);
  const horizons = HORIZONS.map(horizon => {
    const card = normalized[horizon].cards[0];
    const stats = buildMilestoneStats(normalized[horizon].milestones);
    const meta = getHorizonMeta(horizon);
    return {
      horizon,
      label: meta.label,
      shortLabel: meta.shortLabel,
      icon: card.icon || meta.icon,
      title: card.title || `${meta.shortLabel}主目标`,
      summary: card.summary || '还没有写下这个阶段的核心目标。',
      targetDateLabel: formatDateLabel(card.targetDate),
      stats
    };
  });

  const totalMilestones = horizons.reduce((sum, item) => sum + item.stats.total, 0);
  const completedMilestones = horizons.reduce((sum, item) => sum + item.stats.completed, 0);
  const configuredGoals = horizons.filter(item => hasGoalContent(normalized[item.horizon].cards[0]) || item.stats.total > 0).length;
  const averageProgress = totalMilestones
    ? Math.round(horizons.reduce((sum, item) => sum + item.stats.averageProgress * item.stats.total, 0) / totalMilestones)
    : 0;

  return {
    horizons,
    totalMilestones,
    completedMilestones,
    configuredGoals,
    averageProgress
  };
}

function buildHorizonView(store, horizon) {
  const key = normalizeHorizon(horizon);
  const normalized = normalizeStore(store);
  const card = normalized[key].cards[0];
  const milestones = normalized[key].milestones.map(item => ({
    ...item,
    dueDateLabel: item.dueDate ? formatDateLabel(item.dueDate) : '未设置日期',
    completedAtLabel: item.completedAt ? formatDateTime(item.completedAt) : '',
    priorityLabel: getPriorityLabel(item.priority)
  }));

  return {
    horizon: key,
    meta: getHorizonMeta(key),
    card: {
      ...card,
      targetDateLabel: formatDateLabel(card.targetDate),
      updatedLabel: card.updatedAt ? formatDateTime(card.updatedAt) : '尚未保存'
    },
    milestones,
    stats: buildMilestoneStats(milestones)
  };
}

function updateGoalCard(store, horizon, payload) {
  const key = normalizeHorizon(horizon);
  const nextStore = normalizeStore(store);
  const current = nextStore[key].cards[0];

  nextStore[key].cards = [normalizeCard(key, {
    ...current,
    ...payload,
    updatedAt: new Date().toISOString()
  })];

  return saveStore(nextStore);
}

function saveMilestone(store, horizon, payload, editingId = '') {
  const key = normalizeHorizon(horizon);
  const nextStore = normalizeStore(store);
  const targetId = toText(editingId);
  const milestones = nextStore[key].milestones.slice();
  const now = new Date().toISOString();
  const existing = targetId ? milestones.find(item => item.id === targetId) : null;

  const nextMilestone = normalizeMilestone({
    ...existing,
    ...payload,
    id: existing ? existing.id : createId('goal-milestone'),
    createdAt: existing ? existing.createdAt : now
  });

  if (existing) {
    nextStore[key].milestones = milestones.map(item => item.id === targetId ? nextMilestone : item).sort(sortMilestones);
  } else {
    nextStore[key].milestones = milestones.concat(nextMilestone).sort(sortMilestones);
  }

  return saveStore(nextStore);
}

function updateMilestoneProgress(store, horizon, milestoneId, progress) {
  const key = normalizeHorizon(horizon);
  const targetId = toText(milestoneId);
  const value = normalizeProgress(progress);
  const nextStore = normalizeStore(store);

  nextStore[key].milestones = nextStore[key].milestones.map(item => {
    if (item.id !== targetId) return item;
    return normalizeMilestone({
      ...item,
      progress: value,
      completed: value >= 100,
      completedAt: value >= 100 ? new Date().toISOString() : ''
    });
  }).sort(sortMilestones);

  return saveStore(nextStore);
}

function deleteMilestone(store, horizon, milestoneId) {
  const key = normalizeHorizon(horizon);
  const targetId = toText(milestoneId);
  const nextStore = normalizeStore(store);
  nextStore[key].milestones = nextStore[key].milestones.filter(item => item.id !== targetId);
  return saveStore(nextStore);
}

function buildMilestoneStats(milestones) {
  const total = milestones.length;
  const completed = milestones.filter(item => item.completed).length;
  const averageProgress = total
    ? Math.round(milestones.reduce((sum, item) => sum + normalizeProgress(item.progress), 0) / total)
    : 0;

  return {
    total,
    completed,
    remaining: Math.max(total - completed, 0),
    averageProgress
  };
}

function hasGoalContent(card) {
  return Boolean(
    toText(card.title) ||
    toText(card.summary) ||
    toText(card.successCriteria) ||
    toText(card.notes) ||
    toText(card.imageUrl)
  );
}

function getDefaultTargetDate(horizon) {
  const years = Number.parseInt(normalizeHorizon(horizon), 10) || 1;
  const date = new Date();
  date.setFullYear(date.getFullYear() + years);
  return formatDateValue(date);
}

function sortMilestones(a, b) {
  const timeA = a.dueDate ? parseDateValue(a.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
  const timeB = b.dueDate ? parseDateValue(b.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
  if (timeA !== timeB) return timeA - timeB;
  return String(a.createdAt || '').localeCompare(String(b.createdAt || ''));
}

function getHorizonMeta(horizon) {
  return HORIZON_OPTIONS.find(item => item.value === normalizeHorizon(horizon)) || HORIZON_OPTIONS[0];
}

function getPriorityLabel(priority) {
  return (PRIORITY_OPTIONS.find(item => item.value === normalizePriority(priority)) || PRIORITY_OPTIONS[1]).label;
}

function normalizeHorizon(value) {
  return HORIZONS.includes(value) ? value : DEFAULT_HORIZON;
}

function normalizePriority(value) {
  return PRIORITY_OPTIONS.some(item => item.value === value) ? value : 'medium';
}

function normalizeProgress(value) {
  const number = Number(value);
  if (Number.isNaN(number)) return 0;
  return Math.max(0, Math.min(100, Math.round(number)));
}

function normalizeTargetDate(value) {
  const text = toText(value);
  if (!text) return '';
  const date = parseDateValue(text);
  return date ? formatDateValue(date) : '';
}

function normalizeDateTime(value) {
  const text = toText(value);
  if (!text) return '';
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString();
}

module.exports = {
  DEFAULT_HORIZON,
  HORIZON_OPTIONS,
  PRIORITY_OPTIONS,
  STORAGE_KEY,
  buildHorizonView,
  buildOverview,
  buildMilestoneStats,
  deleteMilestone,
  getDefaultTargetDate,
  getStore,
  saveMilestone,
  saveStore,
  updateGoalCard,
  updateMilestoneProgress
};
