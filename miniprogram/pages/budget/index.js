const { getNavItems, navigateTo } = require('../../utils/nav');
const {
  buildBudgetMonthView,
  deleteFixedForecastTemplate,
  deleteForecastItem,
  getStore,
  loadFixedForecastTemplatesIntoMonth,
  removeBudgetCategory,
  upsertBudgetMonthConfig,
  upsertFixedForecastTemplate,
  upsertForecastItem
} = require('../../utils/expenses-store');
const { buildBudgetPageView, getCurrentMonthKey, shiftMonthKey } = require('../../utils/budget-page');

function createCategoryBudgetForm(categoryId = '') {
  return {
    categoryId,
    amount: ''
  };
}

function createForecastForm(month, categoryId = '') {
  return {
    title: '',
    amount: '',
    plannedDate: `${month}-01`,
    categoryId,
    note: ''
  };
}

function createFixedTemplateForm(categoryId = '') {
  return {
    title: '',
    amount: '',
    categoryId,
    recurringDay: '',
    note: ''
  };
}

function getCategoryLabel(categories, categoryId) {
  const current = categories.find(item => item.id === categoryId) || categories[0];
  return current ? current.displayName : '请选择分类';
}

function getSelectedCategory(categories, index) {
  return categories[Number(index)] || categories[0] || null;
}

function findForecastItem(view, itemId) {
  return view.planning.fixedItems.concat(view.planning.oneOffItems).find(item => item.id === itemId) || null;
}

Page({
  data: {
    navItems: getNavItems('budget'),
    activeView: 'overview',
    currentMonth: getCurrentMonthKey(),
    monthLabel: '',
    view: {
      summary: {
        totalBudget: 0,
        totalBudgetText: '¥0.00',
        actualTotal: 0,
        actualTotalText: '¥0.00',
        plannedForecastTotal: 0,
        plannedForecastTotalText: '¥0.00',
        remaining: 0,
        remainingText: '¥0.00',
        categoryBudgetTotal: 0,
        categoryBudgetTotalText: '¥0.00',
        unallocatedBudget: 0,
        unallocatedBudgetText: '¥0.00'
      },
      compareRows: [],
      pendingItems: [],
      categories: [],
      planning: {
        categoryBudgetRows: [],
        fixedItems: [],
        oneOffItems: [],
        fixedTemplates: []
      }
    },
    totalBudgetInput: '',
    categoryBudgetForm: createCategoryBudgetForm(),
    forecastForm: createForecastForm(getCurrentMonthKey()),
    fixedTemplateForm: createFixedTemplateForm(),
    categoryBudgetCategoryLabel: '请选择分类',
    forecastCategoryLabel: '请选择分类',
    templateCategoryLabel: '请选择分类',
    editingForecastId: '',
    editingTemplateId: '',
    budgetStatusText: '',
    categoryBudgetStatusText: '',
    forecastStatusText: '',
    templateStatusText: ''
  },

  onShow() {
    this.refreshPage();
  },

  refreshPage() {
    const store = getStore();
    const view = buildBudgetPageView(store, this.data.currentMonth);
    const defaultCategoryId = view.categories[0] ? view.categories[0].id : '';
    const nextData = {
      navItems: getNavItems('budget'),
      currentMonth: view.month,
      monthLabel: view.monthLabel,
      view,
      totalBudgetInput: String(view.summary.totalBudget || '')
    };

    if (!this.data.editingForecastId) {
      nextData.forecastForm = createForecastForm(view.month, defaultCategoryId);
      nextData.forecastCategoryLabel = getCategoryLabel(view.categories, defaultCategoryId);
    } else {
      nextData.forecastCategoryLabel = getCategoryLabel(view.categories, this.data.forecastForm.categoryId);
    }

    if (!this.data.editingTemplateId) {
      nextData.fixedTemplateForm = createFixedTemplateForm(defaultCategoryId);
      nextData.templateCategoryLabel = getCategoryLabel(view.categories, defaultCategoryId);
    } else {
      nextData.templateCategoryLabel = getCategoryLabel(view.categories, this.data.fixedTemplateForm.categoryId);
    }

    nextData.categoryBudgetForm = createCategoryBudgetForm(defaultCategoryId);
    nextData.categoryBudgetCategoryLabel = getCategoryLabel(view.categories, defaultCategoryId);

    this.setData(nextData);
  },

  handleNavTap(event) {
    navigateTo(event.currentTarget.dataset.path, '/pages/budget/index');
  },

  switchView(event) {
    const nextView = event.currentTarget.dataset.view;
    if (!nextView || nextView === this.data.activeView) return;
    this.setData({ activeView: nextView });
  },

  goPrevMonth() {
    this.switchMonth(-1);
  },

  goNextMonth() {
    this.switchMonth(1);
  },

  switchMonth(offset) {
    const nextMonth = shiftMonthKey(this.data.currentMonth, offset);
    this.setData({
      currentMonth: nextMonth,
      editingForecastId: '',
      editingTemplateId: '',
      budgetStatusText: '',
      categoryBudgetStatusText: '',
      forecastStatusText: '',
      templateStatusText: ''
    });
    this.refreshPage();
  },

  handleFormInput(event) {
    const form = event.currentTarget.dataset.form;
    const field = event.currentTarget.dataset.field;
    if (!form || !field) return;
    this.setData({
      [`${form}.${field}`]: event.detail.value
    });
  },

  handleCategorySelect(event) {
    const form = event.currentTarget.dataset.form;
    const labelField = event.currentTarget.dataset.labelField;
    const selected = getSelectedCategory(this.data.view.categories, event.detail.value);
    if (!form || !labelField || !selected) return;
    this.setData({
      [`${form}.categoryId`]: selected.id,
      [labelField]: selected.displayName
    });
  },

  handleForecastDateChange(event) {
    this.setData({
      'forecastForm.plannedDate': event.detail.value
    });
  },

  handleTotalBudgetInput(event) {
    this.setData({
      totalBudgetInput: event.detail.value
    });
  },

  saveTotalBudget() {
    const amount = Number(this.data.totalBudgetInput);
    if (Number.isNaN(amount) || amount < 0) {
      wx.showToast({
        title: '预算金额不能小于 0',
        icon: 'none'
      });
      return;
    }

    upsertBudgetMonthConfig(getStore(), this.data.currentMonth, {
      totalBudget: amount
    });
    this.setData({
      budgetStatusText: '本月总预算已保存'
    });
    this.refreshPage();
  },

  saveCategoryBudget() {
    const { categoryId, amount } = this.data.categoryBudgetForm;
    const value = Number(amount);
    if (!categoryId) {
      wx.showToast({
        title: '先选择分类',
        icon: 'none'
      });
      return;
    }

    if (!value || value <= 0) {
      wx.showToast({
        title: '分类预算要大于 0',
        icon: 'none'
      });
      return;
    }

    const currentBudgetView = buildBudgetMonthView(getStore(), this.data.currentMonth);
    const nextCategoryBudgets = {
      ...currentBudgetView.budgetConfig.categoryBudgets,
      [categoryId]: value
    };

    upsertBudgetMonthConfig(getStore(), this.data.currentMonth, {
      categoryBudgets: nextCategoryBudgets
    });
    this.setData({
      categoryBudgetStatusText: '分类预算已保存'
    });
    this.refreshPage();
  },

  removeCategoryBudget(event) {
    const categoryId = event.currentTarget.dataset.id;
    if (!categoryId) return;

    wx.showModal({
      title: '移除分类预算',
      content: '这个分类会从本月预算对比里移除，但不会删除分类本身。',
      success: result => {
        if (!result.confirm) return;
        removeBudgetCategory(getStore(), this.data.currentMonth, categoryId);
        this.setData({
          categoryBudgetStatusText: '分类预算已移除'
        });
        this.refreshPage();
      }
    });
  },

  saveForecastItem() {
    const form = this.data.forecastForm;
    const amount = Number(form.amount);
    if (!form.title.trim()) {
      wx.showToast({
        title: '先写计划项名称',
        icon: 'none'
      });
      return;
    }

    if (!amount || amount <= 0) {
      wx.showToast({
        title: '金额要大于 0',
        icon: 'none'
      });
      return;
    }

    if (!form.categoryId) {
      wx.showToast({
        title: '先选择分类',
        icon: 'none'
      });
      return;
    }

    const existing = this.data.editingForecastId
      ? findForecastItem(this.data.view, this.data.editingForecastId)
      : null;

    upsertForecastItem(getStore(), {
      title: form.title,
      amount,
      categoryId: form.categoryId,
      month: this.data.currentMonth,
      kind: existing ? existing.kind : 'one_off',
      plannedDate: form.plannedDate,
      recurringDay: existing ? existing.recurringDay : null,
      note: form.note,
      status: existing ? existing.status : 'planned'
    }, this.data.editingForecastId);

    this.setData({
      editingForecastId: '',
      forecastStatusText: existing ? '本月计划项已更新' : '本月计划项已保存'
    });
    this.refreshPage();
  },

  editForecastItem(event) {
    const itemId = event.currentTarget.dataset.id;
    const item = this.data.view.planning.oneOffItems.find(entry => entry.id === itemId);
    if (!item) return;

    this.setData({
      editingForecastId: item.id,
      forecastForm: {
        title: item.title,
        amount: String(item.amount),
        plannedDate: item.plannedDate || `${this.data.currentMonth}-01`,
        categoryId: item.categoryId,
        note: item.note || ''
      },
      forecastCategoryLabel: getCategoryLabel(this.data.view.categories, item.categoryId),
      forecastStatusText: `正在编辑：${item.title}`
    });
  },

  cancelForecastEdit() {
    const defaultCategoryId = this.data.view.categories[0] ? this.data.view.categories[0].id : '';
    this.setData({
      editingForecastId: '',
      forecastForm: createForecastForm(this.data.currentMonth, defaultCategoryId),
      forecastCategoryLabel: getCategoryLabel(this.data.view.categories, defaultCategoryId),
      forecastStatusText: ''
    });
  },

  updateForecastStatus(event) {
    const itemId = event.currentTarget.dataset.id;
    const nextStatus = event.currentTarget.dataset.status;
    const item = findForecastItem(this.data.view, itemId);
    if (!item || !nextStatus) return;

    upsertForecastItem(getStore(), {
      ...item,
      status: nextStatus
    }, item.id);

    this.setData({
      forecastStatusText: nextStatus === 'done' ? '计划项已标记为已发生' : nextStatus === 'skipped' ? '计划项已标记为跳过' : '计划项已恢复待发生'
    });
    this.refreshPage();
  },

  removeForecastItem(event) {
    const itemId = event.currentTarget.dataset.id;
    if (!itemId) return;

    wx.showModal({
      title: '删除计划项',
      content: '这个计划项会从当前月份移除，不会影响其他月份。',
      success: result => {
        if (!result.confirm) return;
        deleteForecastItem(getStore(), this.data.currentMonth, itemId);
        if (this.data.editingForecastId === itemId) {
          this.cancelForecastEdit();
        } else {
          this.setData({
            forecastStatusText: '计划项已删除'
          });
          this.refreshPage();
        }
      }
    });
  },

  loadFixedTemplates() {
    loadFixedForecastTemplatesIntoMonth(getStore(), this.data.currentMonth);
    this.setData({
      forecastStatusText: '固定模板已载入到当前月份'
    });
    this.refreshPage();
  },

  saveFixedTemplate() {
    const form = this.data.fixedTemplateForm;
    const amount = Number(form.amount);
    if (!form.title.trim()) {
      wx.showToast({
        title: '先写模板名称',
        icon: 'none'
      });
      return;
    }

    if (!amount || amount <= 0) {
      wx.showToast({
        title: '金额要大于 0',
        icon: 'none'
      });
      return;
    }

    if (!form.categoryId) {
      wx.showToast({
        title: '先选择分类',
        icon: 'none'
      });
      return;
    }

    if (form.recurringDay && (!Number.isInteger(Number(form.recurringDay)) || Number(form.recurringDay) < 1 || Number(form.recurringDay) > 31)) {
      wx.showToast({
        title: '固定日期请填 1 到 31',
        icon: 'none'
      });
      return;
    }

    upsertFixedForecastTemplate(getStore(), {
      title: form.title,
      amount,
      categoryId: form.categoryId,
      recurringDay: form.recurringDay,
      note: form.note
    }, this.data.editingTemplateId);

    this.setData({
      editingTemplateId: '',
      templateStatusText: this.data.editingTemplateId ? '固定模板已更新' : '固定模板已保存'
    });
    this.refreshPage();
  },

  editFixedTemplate(event) {
    const templateId = event.currentTarget.dataset.id;
    const template = this.data.view.planning.fixedTemplates.find(item => item.id === templateId);
    if (!template) return;

    this.setData({
      editingTemplateId: template.id,
      fixedTemplateForm: {
        title: template.title,
        amount: String(template.amount),
        categoryId: template.categoryId,
        recurringDay: template.recurringDay ? String(template.recurringDay) : '',
        note: template.note || ''
      },
      templateCategoryLabel: getCategoryLabel(this.data.view.categories, template.categoryId),
      templateStatusText: `正在编辑：${template.title}`
    });
  },

  cancelFixedTemplateEdit() {
    const defaultCategoryId = this.data.view.categories[0] ? this.data.view.categories[0].id : '';
    this.setData({
      editingTemplateId: '',
      fixedTemplateForm: createFixedTemplateForm(defaultCategoryId),
      templateCategoryLabel: getCategoryLabel(this.data.view.categories, defaultCategoryId),
      templateStatusText: ''
    });
  },

  removeFixedTemplate(event) {
    const templateId = event.currentTarget.dataset.id;
    if (!templateId) return;

    wx.showModal({
      title: '删除固定模板',
      content: '删除后不会自动移除已经载入到本月的固定项。',
      success: result => {
        if (!result.confirm) return;
        deleteFixedForecastTemplate(getStore(), templateId);
        if (this.data.editingTemplateId === templateId) {
          this.cancelFixedTemplateEdit();
        } else {
          this.setData({
            templateStatusText: '固定模板已删除'
          });
          this.refreshPage();
        }
      }
    });
  }
});
