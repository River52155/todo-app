const {
  addDays,
  createId,
  formatDateInfo,
  formatDateLabel,
  formatDateTime,
  getTodayValue,
  parseDateValue,
  startOfDay,
  toText
} = require('./common');
const { getStorageValue, setStorageValue } = require('./storage');

const STORAGE_KEY = 'tasks';
const DEFAULT_TASK_TYPE = 'daily';
const DEFAULT_PRIORITY = 'medium';

const PRIORITY_OPTIONS = [
  { value: 'high', label: '高优先级', short: '高', color: '#fb7185' },
  { value: 'medium', label: '中优先级', short: '中', color: '#fbbf24' },
  { value: 'low', label: '低优先级', short: '低', color: '#4ade80' }
];

const TASK_TYPE_OPTIONS = [
  { value: 'daily', label: '日任务' },
  { value: 'weekly', label: '周任务' },
  { value: 'monthly', label: '月任务' },
  { value: 'halfYear', label: '阶段任务' }
];

const FILTER_OPTIONS = [
  { value: 'all', label: '全部' },
  { value: 'today', label: '今天' },
  { value: 'week', label: '本周' },
  { value: 'month', label: '本月' }
];

const VIEW_OPTIONS = [
  { value: 'tasks', label: '今日任务' },
  { value: 'history', label: '历史记录' }
];

const PROGRESS_OPTIONS = [0, 25, 50, 75, 100].map(value => ({
  value,
  label: `进度 ${value}%`
}));

function getTasks() {
  const source = getStorageValue(STORAGE_KEY, []);
  const normalized = Array.isArray(source)
    ? source.filter(item => item && typeof item === 'object').map(normalizeTask)
    : [];
  setStorageValue(STORAGE_KEY, normalized);
  return normalized;
}

function saveTasks(tasks) {
  const normalized = Array.isArray(tasks) ? tasks.map(normalizeTask) : [];
  setStorageValue(STORAGE_KEY, normalized);
  return normalized;
}

function normalizeTask(task) {
  const createdAt = toText(task.createdAt) || new Date().toISOString();
  const progress = normalizeProgress(task.progress);
  const completed = Boolean(task.completed) || progress >= 100;

  return {
    id: toText(task.id) || createId('task'),
    title: toText(task.title),
    date: toText(task.date) || getTodayValue(),
    time: toText(task.time),
    location: toText(task.location),
    duration: toText(task.duration),
    priority: normalizePriority(task.priority),
    taskType: normalizeTaskType(task.taskType),
    taskEndDate: toText(task.taskEndDate),
    progress,
    progressHistory: Array.isArray(task.progressHistory)
      ? task.progressHistory
          .filter(item => item && typeof item === 'object')
          .map(item => ({ value: normalizeProgress(item.value), time: toText(item.time) || createdAt }))
      : [],
    completed,
    completedAt: completed ? toText(task.completedAt) || new Date().toISOString() : '',
    createdAt
  };
}

function buildStats(tasks) {
  const total = tasks.length;
  const completed = tasks.filter(task => task.completed).length;
  return {
    total,
    completed,
    pending: Math.max(total - completed, 0)
  };
}

function buildColumns(tasks, filter) {
  const filtered = filterPendingTasks(tasks, filter);
  const columns = [
    { key: 'daily', label: '日任务', emptyText: '当前范围内暂无日任务' },
    { key: 'weekly', label: '周任务', emptyText: '当前范围内暂无周任务' },
    { key: 'monthly', label: '月 / 阶段任务', emptyText: '当前范围内暂无月任务或阶段任务' }
  ];

  return columns.map(column => {
    const items = filtered.filter(task => getColumnKey(task.taskType) === column.key);
    return {
      ...column,
      count: items.length,
      groups: buildDateGroups(items)
    };
  });
}

function buildHistoryList(tasks) {
  return tasks
    .filter(task => task.completed)
    .sort((a, b) => new Date(b.completedAt || b.createdAt) - new Date(a.completedAt || a.createdAt))
    .map(mapTaskForView);
}

function buildDateGroups(tasks) {
  if (!tasks.length) return [];
  const grouped = {};

  sortTasks(tasks).forEach(task => {
    const dateKey = task.date || '未指定日期';
    if (!grouped[dateKey]) grouped[dateKey] = [];
    grouped[dateKey].push(task);
  });

  return Object.keys(grouped)
    .sort((a, b) => {
      if (a === '未指定日期') return 1;
      if (b === '未指定日期') return -1;
      return new Date(a) - new Date(b);
    })
    .map(dateKey => {
      const info = formatDateInfo(dateKey);
      return {
        date: dateKey,
        label: info.label,
        fullDate: info.fullDate,
        weekday: info.weekday,
        tasks: grouped[dateKey].map(mapTaskForView)
      };
    });
}

function mapTaskForView(task) {
  const priorityMeta = PRIORITY_OPTIONS.find(item => item.value === task.priority) || PRIORITY_OPTIONS[1];
  const typeMeta = TASK_TYPE_OPTIONS.find(item => item.value === task.taskType) || TASK_TYPE_OPTIONS[0];

  return {
    ...task,
    timeText: task.time || '全天',
    dateText: formatDateLabel(task.date),
    priorityLabel: priorityMeta.label,
    priorityShort: priorityMeta.short,
    priorityColor: priorityMeta.color,
    typeLabel: typeMeta.label,
    durationText: task.duration ? `${task.duration} 分钟` : '',
    showProgress: task.taskType !== 'daily' || Number(task.progress || 0) > 0,
    progressText: `${Number(task.progress || 0)}%`,
    completedTimeText: task.completedAt ? formatDateTime(task.completedAt) : formatDateTime(task.createdAt)
  };
}

function filterPendingTasks(tasks, filter) {
  const today = startOfDay(new Date());
  const weekLater = addDays(today, 7);
  const monthLater = new Date(today.getFullYear(), today.getMonth() + 1, today.getDate());

  return sortTasks(tasks.filter(task => !task.completed).filter(task => {
    const taskDate = startOfDay(parseDateValue(task.date) || today);

    if (filter === 'today') return taskDate.getTime() === today.getTime();
    if (filter === 'week') return taskDate >= today && taskDate <= weekLater;
    if (filter === 'month') return taskDate >= today && taskDate <= monthLater;
    return true;
  }));
}

function sortTasks(tasks) {
  return tasks.slice().sort((a, b) => {
    const dateDiff = new Date(a.date) - new Date(b.date);
    if (dateDiff !== 0) return dateDiff;
    if (!a.time && !b.time) return 0;
    if (!a.time) return 1;
    if (!b.time) return -1;
    return a.time.localeCompare(b.time);
  });
}

function createTask(payload) {
  return normalizeTask({
    id: createId('task'),
    title: toText(payload.title),
    date: toText(payload.date) || getTodayValue(),
    time: toText(payload.time),
    location: toText(payload.location),
    duration: toText(payload.duration),
    priority: normalizePriority(payload.priority),
    taskType: normalizeTaskType(payload.taskType),
    taskEndDate: toText(payload.taskEndDate),
    progress: 0,
    progressHistory: [],
    completed: false,
    createdAt: new Date().toISOString()
  });
}

function markTaskCompleted(tasks, id) {
  const targetId = toText(id);
  return tasks.map(task => {
    if (toText(task.id) !== targetId) return task;
    return normalizeTask({
      ...task,
      completed: true,
      completedAt: new Date().toISOString(),
      progress: Math.max(Number(task.progress || 0), 100)
    });
  });
}

function updateTaskProgress(tasks, id, progress) {
  const targetId = toText(id);
  return tasks.map(task => {
    if (toText(task.id) !== targetId) return task;
    const value = normalizeProgress(progress);
    const history = Array.isArray(task.progressHistory) ? task.progressHistory.slice() : [];
    history.push({ value, time: new Date().toISOString() });
    return normalizeTask({
      ...task,
      progress: value,
      progressHistory: history,
      completed: value >= 100,
      completedAt: value >= 100 ? new Date().toISOString() : task.completedAt
    });
  });
}

function deleteTask(tasks, id) {
  const targetId = toText(id);
  return tasks.filter(task => toText(task.id) !== targetId);
}

function normalizePriority(value) {
  return PRIORITY_OPTIONS.some(item => item.value === value) ? value : DEFAULT_PRIORITY;
}

function normalizeTaskType(value) {
  return TASK_TYPE_OPTIONS.some(item => item.value === value) ? value : DEFAULT_TASK_TYPE;
}

function normalizeProgress(value) {
  const number = Number(value);
  if (Number.isNaN(number)) return 0;
  return Math.max(0, Math.min(100, Math.round(number)));
}

function getColumnKey(taskType) {
  if (taskType === 'weekly') return 'weekly';
  if (taskType === 'monthly' || taskType === 'halfYear') return 'monthly';
  return 'daily';
}

module.exports = {
  FILTER_OPTIONS,
  PRIORITY_OPTIONS,
  PROGRESS_OPTIONS,
  STORAGE_KEY,
  TASK_TYPE_OPTIONS,
  VIEW_OPTIONS,
  buildColumns,
  buildHistoryList,
  buildStats,
  createTask,
  deleteTask,
  getTasks,
  markTaskCompleted,
  saveTasks,
  updateTaskProgress
};
