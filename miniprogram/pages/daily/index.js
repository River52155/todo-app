const { getNavItems, navigateTo } = require('../../utils/nav');
const {
  FILTER_OPTIONS,
  PRIORITY_OPTIONS,
  PROGRESS_OPTIONS,
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
} = require('../../utils/tasks-store');
const { getTodayValue } = require('../../utils/common');

function createInitialForm() {
  return {
    title: '',
    date: getTodayValue(),
    time: '',
    location: '',
    duration: '',
    priority: PRIORITY_OPTIONS[1].value,
    taskType: TASK_TYPE_OPTIONS[0].value,
    taskEndDate: ''
  };
}

Page({
  data: {
    navItems: getNavItems('daily'),
    stats: { total: 0, completed: 0, pending: 0 },
    columns: [],
    historyList: [],
    currentFilter: FILTER_OPTIONS[0].value,
    currentView: VIEW_OPTIONS[0].value,
    filterOptions: FILTER_OPTIONS,
    viewOptions: VIEW_OPTIONS,
    priorityOptions: PRIORITY_OPTIONS,
    taskTypeOptions: TASK_TYPE_OPTIONS,
    progressOptions: PROGRESS_OPTIONS,
    form: createInitialForm()
  },

  onShow() {
    this.refreshPage();
  },

  refreshPage() {
    const tasks = getTasks();
    const currentFilter = this.data.currentFilter;
    this.setData({
      navItems: getNavItems('daily'),
      stats: buildStats(tasks),
      columns: buildColumns(tasks, currentFilter),
      historyList: buildHistoryList(tasks)
    });
  },

  handleNavTap(event) {
    navigateTo(event.currentTarget.dataset.path, '/pages/daily/index');
  },

  handleInput(event) {
    const field = event.currentTarget.dataset.field;
    this.setData({
      [`form.${field}`]: event.detail.value
    });
  },

  handleDateChange(event) {
    this.setData({
      'form.date': event.detail.value
    });
  },

  handleTimeChange(event) {
    this.setData({
      'form.time': event.detail.value
    });
  },

  handlePriorityChange(event) {
    const selected = PRIORITY_OPTIONS[Number(event.detail.value)] || PRIORITY_OPTIONS[1];
    this.setData({
      'form.priority': selected.value
    });
  },

  handleTaskTypeChange(event) {
    const selected = TASK_TYPE_OPTIONS[Number(event.detail.value)] || TASK_TYPE_OPTIONS[0];
    this.setData({
      'form.taskType': selected.value
    });
  },

  handleTaskEndDateChange(event) {
    this.setData({
      'form.taskEndDate': event.detail.value
    });
  },

  handleFilterTap(event) {
    const nextFilter = event.currentTarget.dataset.filter;
    if (!nextFilter || nextFilter === this.data.currentFilter) return;
    this.setData({ currentFilter: nextFilter });
    this.refreshPage();
  },

  handleViewTap(event) {
    const nextView = event.currentTarget.dataset.view;
    if (!nextView || nextView === this.data.currentView) return;
    this.setData({ currentView: nextView });
    this.refreshPage();
  },

  submitTask() {
    if (!this.data.form.title.trim()) {
      wx.showToast({
        title: '先写任务内容',
        icon: 'none'
      });
      return;
    }

    const tasks = getTasks();
    tasks.push(createTask(this.data.form));
    saveTasks(tasks);

    this.setData({
      form: createInitialForm()
    });
    this.refreshPage();

    wx.showToast({
      title: '任务已添加',
      icon: 'success'
    });
  },

  markTaskDone(event) {
    const taskId = event.currentTarget.dataset.id;
    const nextTasks = markTaskCompleted(getTasks(), taskId);
    saveTasks(nextTasks);
    this.refreshPage();

    wx.showToast({
      title: '已标记完成',
      icon: 'success'
    });
  },

  editTaskProgress(event) {
    const taskId = event.currentTarget.dataset.id;
    wx.showActionSheet({
      itemList: PROGRESS_OPTIONS.map(item => item.label),
      success: result => {
        const option = PROGRESS_OPTIONS[result.tapIndex];
        if (!option) return;
        const nextTasks = updateTaskProgress(getTasks(), taskId, option.value);
        saveTasks(nextTasks);
        this.refreshPage();
      }
    });
  },

  removeTask(event) {
    const taskId = event.currentTarget.dataset.id;
    wx.showModal({
      title: '删除任务',
      content: '小程序版先使用确认删除，避免误删。',
      success: result => {
        if (!result.confirm) return;
        const nextTasks = deleteTask(getTasks(), taskId);
        saveTasks(nextTasks);
        this.refreshPage();
      }
    });
  }
});
