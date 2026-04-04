function toText(value) {
  return String(value == null ? '' : value).trim();
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function createId(prefix) {
  return `${prefix || 'id'}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

function pad2(value) {
  return String(value).padStart(2, '0');
}

function parseDateValue(value) {
  const text = toText(value);
  if (!text) return null;
  const normalized = text.replace(/\./g, '-').replace(/\//g, '-');
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDateValue(input) {
  const date = input instanceof Date ? new Date(input) : parseDateValue(input) || new Date();
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function getTodayValue() {
  return formatDateValue(new Date());
}

function startOfDay(input) {
  const date = input instanceof Date ? new Date(input) : parseDateValue(input) || new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function endOfDay(input) {
  const date = startOfDay(input);
  date.setHours(23, 59, 59, 999);
  return date;
}

function addDays(input, days) {
  const date = startOfDay(input);
  date.setDate(date.getDate() + days);
  return date;
}

function startOfWeek(input) {
  const date = startOfDay(input);
  const offset = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - offset);
  return date;
}

function startOfMonth(input) {
  const date = startOfDay(input);
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(input) {
  const date = startOfDay(input);
  return endOfDay(new Date(date.getFullYear(), date.getMonth() + 1, 0));
}

function startOfYear(input) {
  const date = startOfDay(input);
  return new Date(date.getFullYear(), 0, 1);
}

function endOfYear(input) {
  const date = startOfDay(input);
  return endOfDay(new Date(date.getFullYear(), 11, 31));
}

function isSameDay(a, b) {
  return startOfDay(a).getTime() === startOfDay(b).getTime();
}

function formatDateInfo(value) {
  if (!value) {
    return { label: '未指定', fullDate: '未指定日期', weekday: '' };
  }

  const date = parseDateValue(value);
  if (!date) {
    return { label: '异常日期', fullDate: toText(value), weekday: '' };
  }

  const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  const today = startOfDay(new Date());
  const tomorrow = addDays(today, 1);
  const current = startOfDay(date);

  let label = `${date.getMonth() + 1}/${date.getDate()}`;
  if (current.getTime() === today.getTime()) label = '今天';
  if (current.getTime() === tomorrow.getTime()) label = '明天';

  return {
    label,
    fullDate: `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`,
    weekday: weekdays[date.getDay()]
  };
}

function formatDateLabel(value) {
  const date = parseDateValue(value);
  if (!date) return '未指定日期';
  return `${date.getMonth() + 1}月${date.getDate()}日`;
}

function formatDateTime(value) {
  if (!value) return '未知时间';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '未知时间';
  return `${date.getMonth() + 1}月${date.getDate()}日 ${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

function normalizeDateTime(value) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString();
}

function roundAmount(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

function formatCurrency(value) {
  return `¥${roundAmount(value).toFixed(2)}`;
}

module.exports = {
  addDays,
  clone,
  createId,
  endOfDay,
  endOfMonth,
  endOfYear,
  formatCurrency,
  formatDateInfo,
  formatDateLabel,
  formatDateTime,
  formatDateValue,
  getTodayValue,
  isSameDay,
  normalizeDateTime,
  pad2,
  parseDateValue,
  roundAmount,
  startOfDay,
  startOfMonth,
  startOfWeek,
  startOfYear,
  toText
};
