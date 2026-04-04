const { getNavItems, navigateTo } = require('../../utils/nav');
const {
  DEFAULT_FILTER,
  DEFAULT_LANE,
  DEFAULT_WINDOW,
  LANE_OPTIONS,
  WINDOW_OPTIONS,
  buildLanes,
  buildStats,
  createCard,
  getStore,
  removeCard: deleteRecentCard,
  saveStore,
  updateCard
} = require('../../utils/recent-store');

function createInitialForm() {
  return {
    title: '',
    note: '',
    lane: DEFAULT_LANE,
    window: DEFAULT_WINDOW
  };
}

Page({
  data: {
    navItems: getNavItems('recent'),
    stats: {
      total: 0,
      focusCount: 0,
      waitingCount: 0,
      laneSummary: []
    },
    lanes: [],
    laneOptions: LANE_OPTIONS,
    windowOptions: WINDOW_OPTIONS.filter(item => item.value !== 'all'),
    filterOptions: WINDOW_OPTIONS,
    currentFilter: DEFAULT_FILTER,
    form: createInitialForm(),
    editingId: '',
    statusText: ''
  },

  onShow() {
    this.refreshPage();
  },

  refreshPage() {
    const store = getStore();
    this.setData({
      navItems: getNavItems('recent'),
      stats: buildStats(store),
      lanes: buildLanes(store, this.data.currentFilter)
    });
  },

  handleNavTap(event) {
    navigateTo(event.currentTarget.dataset.path, '/pages/recent/index');
  },

  handleInput(event) {
    const field = event.currentTarget.dataset.field;
    this.setData({
      [`form.${field}`]: event.detail.value
    });
  },

  handleFilterTap(event) {
    const nextFilter = event.currentTarget.dataset.filter;
    if (!nextFilter || nextFilter === this.data.currentFilter) return;
    this.setData({ currentFilter: nextFilter });
    this.refreshPage();
  },

  handleLaneChange(event) {
    const selected = LANE_OPTIONS[Number(event.detail.value)] || LANE_OPTIONS[0];
    this.setData({
      'form.lane': selected.value
    });
  },

  handleWindowChange(event) {
    const selected = this.data.windowOptions[Number(event.detail.value)] || this.data.windowOptions[0];
    this.setData({
      'form.window': selected.value
    });
  },

  submitCard() {
    const title = this.data.form.title.trim();
    if (!title) {
      wx.showToast({
        title: '先写标题',
        icon: 'none'
      });
      return;
    }

    const store = getStore();
    let nextStore;

    if (this.data.editingId) {
      nextStore = updateCard(store, this.data.editingId, this.data.form);
    } else {
      nextStore = saveStore({
        cards: store.cards.concat(createCard(this.data.form))
      });
    }

    this.setData({
      form: createInitialForm(),
      editingId: '',
      statusText: this.data.editingId ? '近期计划已更新' : '近期计划已新增'
    });

    saveStore(nextStore);
    this.refreshPage();
  },

  editCard(event) {
    const cardId = event.currentTarget.dataset.id;
    const store = getStore();
    const card = store.cards.find(item => item.id === cardId);
    if (!card) return;

    this.setData({
      editingId: card.id,
      form: {
        title: card.title,
        note: card.note,
        lane: card.lane,
        window: card.window
      },
      statusText: `正在编辑：${card.title}`
    });
  },

  cancelEdit() {
    this.setData({
      editingId: '',
      form: createInitialForm(),
      statusText: ''
    });
  },

  moveCard(event) {
    const cardId = event.currentTarget.dataset.id;
    wx.showActionSheet({
      itemList: LANE_OPTIONS.map(item => item.label),
      success: result => {
        const lane = LANE_OPTIONS[result.tapIndex];
        if (!lane) return;
        updateCard(getStore(), cardId, { lane: lane.value });
        this.refreshPage();
      }
    });
  },

  removeCard(event) {
    const cardId = event.currentTarget.dataset.id;
    wx.showModal({
      title: '删除近期计划',
      content: '它会从当前弹性池里移除。',
      success: result => {
        if (!result.confirm) return;
        deleteRecentCard(getStore(), cardId);
        if (this.data.editingId === cardId) {
          this.cancelEdit();
        }
        this.refreshPage();
      }
    });
  }
});
