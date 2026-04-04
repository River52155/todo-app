const { getNavItems, navigateTo } = require('../../utils/nav');
const {
  DEFAULT_HORIZON,
  HORIZON_OPTIONS,
  PRIORITY_OPTIONS,
  buildHorizonView,
  buildOverview,
  deleteMilestone: removeGoalMilestone,
  getDefaultTargetDate,
  getStore,
  saveMilestone: saveGoalMilestone,
  updateGoalCard,
  updateMilestoneProgress: setGoalMilestoneProgress
} = require('../../utils/goals-store');

function createCardForm(horizon) {
  return {
    title: '',
    icon: getHorizonMeta(horizon).icon,
    imageUrl: '',
    summary: '',
    successCriteria: '',
    notes: '',
    targetDate: getDefaultTargetDate(horizon)
  };
}

function createMilestoneForm() {
  return {
    title: '',
    description: '',
    dueDate: '',
    priority: 'medium'
  };
}

function getHorizonMeta(horizon) {
  return HORIZON_OPTIONS.find(item => item.value === horizon) || HORIZON_OPTIONS[0];
}

Page({
  data: {
    navItems: getNavItems('goals'),
    routeOptions: [{ value: 'overview', label: '总览' }].concat(HORIZON_OPTIONS.map(item => ({ value: item.value, label: item.shortLabel }))),
    priorityOptions: PRIORITY_OPTIONS,
    activeRoute: 'overview',
    overview: {
      horizons: [],
      totalMilestones: 0,
      completedMilestones: 0,
      configuredGoals: 0,
      averageProgress: 0
    },
    detail: null,
    cardForm: createCardForm(DEFAULT_HORIZON),
    milestoneForm: createMilestoneForm(),
    editingMilestoneId: '',
    statusText: '',
    milestoneStatusText: ''
  },

  onShow() {
    this.refreshPage();
  },

  handleNavTap(event) {
    navigateTo(event.currentTarget.dataset.path, '/pages/goals/index');
  },

  refreshPage() {
    const store = getStore();
    const overview = buildOverview(store);
    const activeRoute = this.data.activeRoute;
    const detail = activeRoute === 'overview' ? null : buildHorizonView(store, activeRoute);

    const nextData = {
      navItems: getNavItems('goals'),
      overview,
      detail
    };

    if (detail) {
      nextData.cardForm = {
        title: detail.card.title,
        icon: detail.card.icon,
        imageUrl: detail.card.imageUrl,
        summary: detail.card.summary,
        successCriteria: detail.card.successCriteria,
        notes: detail.card.notes,
        targetDate: detail.card.targetDate
      };

      if (!this.data.editingMilestoneId) {
        nextData.milestoneForm = createMilestoneForm();
      }
    }

    this.setData(nextData);
  },

  switchRoute(event) {
    const nextRoute = event.currentTarget.dataset.route;
    if (!nextRoute || nextRoute === this.data.activeRoute) return;
    this.setData({
      activeRoute: nextRoute,
      editingMilestoneId: '',
      milestoneForm: createMilestoneForm(),
      statusText: '',
      milestoneStatusText: ''
    });
    this.refreshPage();
  },

  jumpToHorizon(event) {
    const nextRoute = event.currentTarget.dataset.route;
    this.setData({ activeRoute: nextRoute });
    this.refreshPage();
  },

  handleCardInput(event) {
    const field = event.currentTarget.dataset.field;
    this.setData({
      [`cardForm.${field}`]: event.detail.value
    });
  },

  handleCardDateChange(event) {
    this.setData({
      'cardForm.targetDate': event.detail.value
    });
  },

  saveGoalCard() {
    if (this.data.activeRoute === 'overview') return;
    const title = this.data.cardForm.title.trim();
    if (!title) {
      wx.showToast({
        title: '先写主目标',
        icon: 'none'
      });
      return;
    }

    updateGoalCard(getStore(), this.data.activeRoute, this.data.cardForm);
    this.setData({
      statusText: '主目标已保存'
    });
    this.refreshPage();
  },

  handleMilestoneInput(event) {
    const field = event.currentTarget.dataset.field;
    this.setData({
      [`milestoneForm.${field}`]: event.detail.value
    });
  },

  handleMilestoneDateChange(event) {
    this.setData({
      'milestoneForm.dueDate': event.detail.value
    });
  },

  handleMilestonePriorityChange(event) {
    const selected = PRIORITY_OPTIONS[Number(event.detail.value)] || PRIORITY_OPTIONS[1];
    this.setData({
      'milestoneForm.priority': selected.value
    });
  },

  saveMilestone() {
    if (this.data.activeRoute === 'overview') return;
    const title = this.data.milestoneForm.title.trim();
    if (!title) {
      wx.showToast({
        title: '先写里程碑标题',
        icon: 'none'
      });
      return;
    }

    saveGoalMilestone(getStore(), this.data.activeRoute, this.data.milestoneForm, this.data.editingMilestoneId);
    this.setData({
      milestoneForm: createMilestoneForm(),
      editingMilestoneId: '',
      milestoneStatusText: '里程碑已保存'
    });
    this.refreshPage();
  },

  editMilestone(event) {
    const milestoneId = event.currentTarget.dataset.id;
    const detail = buildHorizonView(getStore(), this.data.activeRoute);
    const milestone = detail.milestones.find(item => item.id === milestoneId);
    if (!milestone) return;

    this.setData({
      editingMilestoneId: milestone.id,
      milestoneForm: {
        title: milestone.title,
        description: milestone.description,
        dueDate: milestone.dueDate,
        priority: milestone.priority
      },
      milestoneStatusText: `正在编辑：${milestone.title}`
    });
  },

  cancelMilestoneEdit() {
    this.setData({
      editingMilestoneId: '',
      milestoneForm: createMilestoneForm(),
      milestoneStatusText: ''
    });
  },

  updateMilestoneProgress(event) {
    const milestoneId = event.currentTarget.dataset.id;
    const options = [0, 25, 50, 75, 100];
    wx.showActionSheet({
      itemList: options.map(value => `进度 ${value}%`),
      success: result => {
        const value = options[result.tapIndex];
        if (typeof value !== 'number') return;
        setGoalMilestoneProgress(getStore(), this.data.activeRoute, milestoneId, value);
        this.refreshPage();
      }
    });
  },

  removeMilestone(event) {
    const milestoneId = event.currentTarget.dataset.id;
    wx.showModal({
      title: '删除里程碑',
      content: '它会从当前阶段的推进列表中移除。',
      success: result => {
        if (!result.confirm) return;
        removeGoalMilestone(getStore(), this.data.activeRoute, milestoneId);
        if (this.data.editingMilestoneId === milestoneId) {
          this.cancelMilestoneEdit();
        }
        this.refreshPage();
      }
    });
  }
});
