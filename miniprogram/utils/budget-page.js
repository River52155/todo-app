const { buildBudgetMonthView, buildForecastMonthView } = require('./expenses-store');
const { formatCurrency, getTodayValue, pad2, roundAmount, toText } = require('./common');

const EMPTY_CATEGORY = {
  id: 'unknown',
  name: '未分类',
  icon: '•',
  color: '#60a5fa'
};

function normalizeMonthKey(value) {
  const text = toText(value);
  if (!/^\d{4}-\d{2}$/.test(text)) return '';
  const [year, month] = text.split('-').map(item => Number.parseInt(item, 10));
  if (!year || !month || month < 1 || month > 12) return '';
  return `${year}-${pad2(month)}`;
}

function getCurrentMonthKey() {
  return getTodayValue().slice(0, 7);
}

function shiftMonthKey(value, offset) {
  const monthKey = normalizeMonthKey(value) || getCurrentMonthKey();
  const [year, month] = monthKey.split('-').map(item => Number.parseInt(item, 10));
  const date = new Date(year, month - 1 + Number(offset || 0), 1);
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}`;
}

function formatMonthLabel(value) {
  const monthKey = normalizeMonthKey(value) || getCurrentMonthKey();
  const [year, month] = monthKey.split('-');
  return `${year}年${Number(month)}月`;
}

function getStatusLabel(status) {
  if (status === 'done') return '已发生';
  if (status === 'skipped') return '已跳过';
  return '待发生';
}

function decorateForecastItem(item, categoryMap) {
  const category = item.category || categoryMap.get(item.categoryId) || EMPTY_CATEGORY;
  return {
    ...item,
    amountText: formatCurrency(item.amount),
    category,
    statusLabel: getStatusLabel(item.status),
    isPlanned: item.status === 'planned'
  };
}

function buildBudgetPageView(store, month) {
  const targetMonth = normalizeMonthKey(month) || getCurrentMonthKey();
  const budgetView = buildBudgetMonthView(store, targetMonth);
  const forecastView = buildForecastMonthView(store, targetMonth);
  const categories = Array.isArray(store?.categories) ? store.categories.slice() : [];
  const categoryMap = new Map(categories.map(category => [category.id, category]));

  const summary = {
    ...budgetView.summary,
    totalBudgetText: formatCurrency(budgetView.summary.totalBudget),
    actualTotalText: formatCurrency(budgetView.summary.actualTotal),
    plannedForecastTotalText: formatCurrency(budgetView.summary.plannedForecastTotal),
    committedTotalText: formatCurrency(budgetView.summary.committedTotal),
    remainingText: formatCurrency(budgetView.summary.remaining),
    categoryBudgetTotalText: formatCurrency(budgetView.summary.categoryBudgetTotal),
    unallocatedBudget: roundAmount(budgetView.summary.totalBudget - budgetView.summary.categoryBudgetTotal),
    unallocatedBudgetText: formatCurrency(roundAmount(budgetView.summary.totalBudget - budgetView.summary.categoryBudgetTotal))
  };

  const compareRows = budgetView.categoryRows.map(row => ({
    ...row,
    budgetAmountText: formatCurrency(row.budgetAmount),
    actualSpentText: formatCurrency(row.actualSpent),
    plannedSpentText: formatCurrency(row.plannedSpent),
    usedTotalText: formatCurrency(row.usedTotal),
    remainingText: formatCurrency(row.remaining),
    actualWidth: row.budgetAmount > 0 ? Math.min(Math.round((row.actualSpent / row.budgetAmount) * 1000) / 10, 100) : 0,
    totalWidth: row.budgetAmount > 0 ? Math.min(Math.round((row.usedTotal / row.budgetAmount) * 1000) / 10, 100) : 0,
    progressWidth: Math.min(row.progressPercent, 100),
    overflowPercent: Math.max(row.progressPercent - 100, 0)
  }));

  const pendingItems = forecastView.items
    .filter(item => item.status === 'planned')
    .map(item => decorateForecastItem(item, categoryMap));

  return {
    month: targetMonth,
    monthLabel: formatMonthLabel(targetMonth),
    categories: categories.map(category => ({
      ...category,
      displayName: `${category.icon} ${category.name}`
    })),
    summary,
    compareRows,
    pendingItems,
    planning: {
      categoryBudgetRows: compareRows,
      fixedItems: forecastView.groups.fixed.map(item => decorateForecastItem(item, categoryMap)),
      oneOffItems: forecastView.groups.oneOff.map(item => decorateForecastItem(item, categoryMap)),
      fixedTemplates: forecastView.fixedTemplates.map(template => ({
        ...template,
        amountText: formatCurrency(template.amount),
        category: categoryMap.get(template.categoryId) || EMPTY_CATEGORY,
        recurringLabel: template.recurringDay ? `每月 ${template.recurringDay} 号` : '每月固定项目'
      }))
    }
  };
}

module.exports = {
  buildBudgetPageView,
  formatMonthLabel,
  getCurrentMonthKey,
  normalizeMonthKey,
  shiftMonthKey
};
