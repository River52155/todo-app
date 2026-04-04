const NAV_ITEMS = [
  { key: 'daily', label: '每日计划', path: '/pages/daily/index' },
  { key: 'recent', label: '近期计划', path: '/pages/recent/index' },
  { key: 'goals', label: '长期目标', path: '/pages/goals/index' },
  { key: 'budget', label: '月度花销', path: '/pages/budget/index' },
  { key: 'expenses', label: '消费记录', path: '/pages/expenses/index' }
];

function getNavItems(current) {
  return NAV_ITEMS.map(item => ({
    ...item,
    active: item.key === current
  }));
}

function navigateTo(path, currentPath) {
  if (!path || path === currentPath) return;
  wx.reLaunch({ url: path });
}

module.exports = {
  NAV_ITEMS,
  getNavItems,
  navigateTo
};
