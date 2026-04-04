const { getNavItems, navigateTo } = require('../../utils/nav');
const {
  DEFAULT_RANGE,
  RANGE_OPTIONS,
  addCategory: createExpenseCategory,
  buildRangeView,
  deleteRecord: removeExpenseRecord,
  getStore,
  upsertRecord
} = require('../../utils/expenses-store');
const { getTodayValue } = require('../../utils/common');

function createExpenseForm() {
  return {
    amount: '',
    date: getTodayValue(),
    categoryId: 'food',
    note: ''
  };
}

function createCategoryForm() {
  return {
    name: '',
    icon: '',
    color: '#60a5fa'
  };
}

Page({
  data: {
    navItems: getNavItems('expenses'),
    rangeOptions: RANGE_OPTIONS,
    selectedRange: DEFAULT_RANGE,
    view: {
      stats: {
        total: 0,
        totalText: '¥0.00',
        count: 0,
        average: 0,
        averageText: '¥0.00'
      },
      breakdown: [],
      trend: [],
      records: [],
      categories: []
    },
    expenseForm: createExpenseForm(),
    categoryForm: createCategoryForm(),
    editingId: '',
    statusText: '',
    categoryStatusText: '',
    currentCategoryLabel: '餐饮'
  },

  onShow() {
    this.refreshPage();
  },

  handleNavTap(event) {
    navigateTo(event.currentTarget.dataset.path, '/pages/expenses/index');
  },

  refreshPage() {
    const view = buildRangeView(getStore(), this.data.selectedRange);
    const nextData = {
      navItems: getNavItems('expenses'),
      view,
      currentCategoryLabel: getCurrentCategoryLabel(view.categories, this.data.expenseForm.categoryId)
    };

    if (!this.data.editingId) {
      nextData.expenseForm = {
        ...this.data.expenseForm,
        categoryId: view.categories[0] ? view.categories[0].id : 'food'
      };
      nextData.currentCategoryLabel = getCurrentCategoryLabel(view.categories, nextData.expenseForm.categoryId);
    }

    this.setData(nextData);
  },

  switchRange(event) {
    const nextRange = event.currentTarget.dataset.range;
    if (!nextRange || nextRange === this.data.selectedRange) return;
    this.setData({
      selectedRange: nextRange
    });
    this.refreshPage();
  },

  handleExpenseInput(event) {
    const field = event.currentTarget.dataset.field;
    this.setData({
      [`expenseForm.${field}`]: event.detail.value
    });
  },

  handleExpenseDateChange(event) {
    this.setData({
      'expenseForm.date': event.detail.value
    });
  },

  handleCategorySelect(event) {
    const selected = this.data.view.categories[Number(event.detail.value)] || this.data.view.categories[0];
    if (!selected) return;
    this.setData({
      'expenseForm.categoryId': selected.id,
      currentCategoryLabel: getCurrentCategoryLabel(this.data.view.categories, selected.id)
    });
  },

  saveExpense() {
    const amount = Number(this.data.expenseForm.amount);
    if (!amount || amount <= 0) {
      wx.showToast({
        title: '金额要大于 0',
        icon: 'none'
      });
      return;
    }

    upsertRecord(getStore(), this.data.expenseForm, this.data.editingId);
    this.setData({
      expenseForm: {
        ...createExpenseForm(),
        categoryId: this.data.view.categories[0] ? this.data.view.categories[0].id : 'food'
      },
      editingId: '',
      statusText: '消费记录已保存',
      currentCategoryLabel: getCurrentCategoryLabel(this.data.view.categories, this.data.view.categories[0] ? this.data.view.categories[0].id : 'food')
    });
    this.refreshPage();
  },

  editRecord(event) {
    const recordId = event.currentTarget.dataset.id;
    const record = this.data.view.records.find(item => item.id === recordId);
    if (!record) return;

    this.setData({
      editingId: record.id,
      expenseForm: {
        amount: String(record.amount),
        date: record.date,
        categoryId: record.categoryId,
        note: record.note
      },
      statusText: `正在编辑：${record.amountText}`
    });
  },

  cancelEdit() {
    this.setData({
      editingId: '',
      expenseForm: {
        ...createExpenseForm(),
        categoryId: this.data.view.categories[0] ? this.data.view.categories[0].id : 'food'
      },
      statusText: ''
    });
  },

  removeRecord(event) {
    const recordId = event.currentTarget.dataset.id;
    wx.showModal({
      title: '删除消费记录',
      content: '这条消费会从当前账本中移除。',
      success: result => {
        if (!result.confirm) return;
        removeExpenseRecord(getStore(), recordId);
        if (this.data.editingId === recordId) {
          this.cancelEdit();
        }
        this.refreshPage();
      }
    });
  },

  handleCategoryInput(event) {
    const field = event.currentTarget.dataset.field;
    this.setData({
      [`categoryForm.${field}`]: event.detail.value
    });
  },

  addCategory() {
    if (!this.data.categoryForm.name.trim()) {
      wx.showToast({
        title: '先写分类名',
        icon: 'none'
      });
      return;
    }

    createExpenseCategory(getStore(), this.data.categoryForm);
    this.setData({
      categoryForm: createCategoryForm(),
      categoryStatusText: '分类已添加'
    });
    this.refreshPage();
  }
});

function getCurrentCategoryLabel(categories, categoryId) {
  const current = categories.find(item => item.id === categoryId) || categories[0];
  return current ? `${current.icon} ${current.name}` : '请选择分类';
}
