const BudgetApp = (() => {
  const state = {
    month: window.BudgetStore.getCurrentMonthKey(),
    store: null
  };

  function init() {
    if (!document.getElementById('budgetMonthInput')) return;

    state.store = window.BudgetStore.readStore(window.localStorage);
    bindEvents();
    renderAll({ resetForms: true });

    window.addEventListener('storage', event => {
      if (event.key && event.key !== window.BudgetStore.STORAGE_KEY) return;
      state.store = window.BudgetStore.readStore(window.localStorage);
      renderAll({ resetForms: false });
    });
  }

  function bindEvents() {
    document.getElementById('budgetMonthInput')?.addEventListener('change', event => {
      state.month = event.target.value || state.month;
      renderAll({ resetForms: false });
    });

    document.getElementById('budgetPrevMonth')?.addEventListener('click', () => {
      state.month = window.BudgetStore.shiftMonthKey(state.month, -1);
      renderAll({ resetForms: false });
    });

    document.getElementById('budgetNextMonth')?.addEventListener('click', () => {
      state.month = window.BudgetStore.shiftMonthKey(state.month, 1);
      renderAll({ resetForms: false });
    });

    document.getElementById('loadFixedTemplatesBtn')?.addEventListener('click', () => {
      try {
        state.store = window.BudgetStore.loadFixedTemplatesIntoMonth(state.store, state.month);
        persistStore();
        renderAll({ resetForms: false });
        setStatus('budgetStatus', '固定项目已载入本月', true);
      } catch (error) {
        setStatus('budgetStatus', error.message || '载入失败');
      }
    });

    document.getElementById('monthPlanForm')?.addEventListener('submit', event => {
      event.preventDefault();
      saveMonthPlan();
    });

    document.getElementById('fixedTemplateForm')?.addEventListener('submit', event => {
      event.preventDefault();
      saveFixedTemplate();
    });

    document.getElementById('cancelMonthPlanEdit')?.addEventListener('click', () => {
      resetMonthPlanForm();
    });

    document.getElementById('cancelFixedTemplateEdit')?.addEventListener('click', () => {
      resetFixedTemplateForm();
    });

    document.getElementById('monthPlanList')?.addEventListener('click', handleMonthPlanActions);
    document.getElementById('fixedTemplateList')?.addEventListener('click', handleFixedTemplateActions);
  }

  function saveMonthPlan() {
    try {
      state.store = window.BudgetStore.upsertMonthPlan(state.store, {
        id: getValue('monthPlanEditingId'),
        month: state.month,
        title: getValue('monthPlanTitleInput'),
        amount: getValue('monthPlanAmountInput'),
        categoryId: getValue('monthPlanCategoryInput'),
        plannedDate: getValue('monthPlanDateInput'),
        note: getValue('monthPlanNoteInput')
      });
      persistStore();
      renderAll({ resetForms: false });
      resetMonthPlanForm();
      setStatus('monthPlanFormStatus', '本月事项已保存', true);
    } catch (error) {
      setStatus('monthPlanFormStatus', error.message || '保存失败');
    }
  }

  function saveFixedTemplate() {
    try {
      state.store = window.BudgetStore.upsertFixedTemplate(state.store, {
        id: getValue('fixedTemplateEditingId'),
        title: getValue('fixedTemplateTitleInput'),
        amount: getValue('fixedTemplateAmountInput'),
        categoryId: getValue('fixedTemplateCategoryInput'),
        recurringDay: getValue('fixedTemplateRecurringDayInput'),
        note: getValue('fixedTemplateNoteInput')
      });
      persistStore();
      renderAll({ resetForms: false });
      resetFixedTemplateForm();
      setStatus('fixedTemplateFormStatus', '固定项目已保存', true);
    } catch (error) {
      setStatus('fixedTemplateFormStatus', error.message || '保存失败');
    }
  }

  function handleMonthPlanActions(event) {
    const button = event.target.closest('[data-action]');
    if (!button) return;

    const planId = button.dataset.id;
    if (!planId) return;

    if (button.dataset.action === 'edit') {
      editMonthPlan(planId);
      return;
    }

    if (button.dataset.action === 'delete') {
      state.store = window.BudgetStore.deleteMonthPlan(state.store, planId);
      persistStore();
      renderAll({ resetForms: false });
      setStatus('budgetStatus', '事项已删除', true);
      return;
    }

    if (button.dataset.action === 'done') {
      state.store = window.BudgetStore.setMonthPlanStatus(state.store, planId, 'done');
      persistStore();
      renderAll({ resetForms: false });
      setStatus('budgetStatus', '事项已标记为已处理', true);
      return;
    }

    if (button.dataset.action === 'skip') {
      state.store = window.BudgetStore.setMonthPlanStatus(state.store, planId, 'skipped');
      persistStore();
      renderAll({ resetForms: false });
      setStatus('budgetStatus', '事项已跳过', true);
      return;
    }

    if (button.dataset.action === 'restore') {
      state.store = window.BudgetStore.setMonthPlanStatus(state.store, planId, 'planned');
      persistStore();
      renderAll({ resetForms: false });
      setStatus('budgetStatus', '事项已恢复为待发生', true);
    }
  }

  function handleFixedTemplateActions(event) {
    const button = event.target.closest('[data-action]');
    if (!button) return;

    const templateId = button.dataset.id;
    if (!templateId) return;

    if (button.dataset.action === 'edit') {
      editFixedTemplate(templateId);
      return;
    }

    if (button.dataset.action === 'delete') {
      state.store = window.BudgetStore.deleteFixedTemplate(state.store, templateId);
      persistStore();
      renderAll({ resetForms: false });
      setStatus('budgetStatus', '固定项目已删除', true);
    }
  }

  function editMonthPlan(planId) {
    const view = window.BudgetStore.buildMonthView(state.store, state.month);
    const item = view.items.find(entry => entry.id === planId);
    if (!item) return;

    setValue('monthPlanEditingId', item.id);
    setValue('monthPlanTitleInput', item.title);
    setValue('monthPlanAmountInput', item.amount);
    setValue('monthPlanDateInput', item.plannedDate);
    setValue('monthPlanCategoryInput', item.categoryId);
    setValue('monthPlanNoteInput', item.note);
    setText('monthPlanSubmitLabel', '保存修改');
    document.getElementById('cancelMonthPlanEdit')?.removeAttribute('hidden');
    setStatus('monthPlanFormStatus', '正在编辑本月事项');
  }

  function editFixedTemplate(templateId) {
    const view = window.BudgetStore.buildMonthView(state.store, state.month);
    const item = view.templates.find(entry => entry.id === templateId);
    if (!item) return;

    setValue('fixedTemplateEditingId', item.id);
    setValue('fixedTemplateTitleInput', item.title);
    setValue('fixedTemplateAmountInput', item.amount);
    setValue('fixedTemplateCategoryInput', item.categoryId);
    setValue('fixedTemplateRecurringDayInput', item.recurringDay || '');
    setValue('fixedTemplateNoteInput', item.note);
    setText('fixedTemplateSubmitLabel', '保存修改');
    document.getElementById('cancelFixedTemplateEdit')?.removeAttribute('hidden');
    setStatus('fixedTemplateFormStatus', '正在编辑固定项目');
  }

  function renderAll(options = {}) {
    const view = window.BudgetStore.buildMonthView(state.store, state.month);
    state.month = view.month;

    renderCategoryOptions(view.categories);
    renderHeader(view);
    renderSummary(view);
    renderMonthPlanList(view);
    renderFixedTemplateList(view);
    setValue('budgetMonthInput', view.month);

    if (options.resetForms) {
      resetMonthPlanForm();
      resetFixedTemplateForm();
    } else {
      syncDateWithMonth();
    }
  }

  function renderHeader(view) {
    setText('heroMonthLabel', view.monthLabel);
    setText('heroPendingCount', `${view.summary.pendingCount} 项`);
    setText('heroPlannedTotal', window.BudgetStore.formatCurrency(view.summary.plannedTotal));
    setText('heroFixedSplit', window.BudgetStore.formatCurrency(view.summary.fixedTotal));
    setText('heroOneOffSplit', window.BudgetStore.formatCurrency(view.summary.oneOffTotal));
    setText('heroActualTotal', window.BudgetStore.formatCurrency(view.summary.actualTotal));
  }

  function renderSummary(view) {
    setText('summaryPlannedTotal', window.BudgetStore.formatCurrency(view.summary.plannedTotal));
    setText('summaryFixedTotal', window.BudgetStore.formatCurrency(view.summary.fixedTotal));
    setText('summaryOneOffTotal', window.BudgetStore.formatCurrency(view.summary.oneOffTotal));
    setText('summaryActualTotal', window.BudgetStore.formatCurrency(view.summary.actualTotal));
    setText(
      'monthPlanSummary',
      view.items.length
        ? `${view.monthLabel} 一共 ${view.items.length} 项，待发生 ${view.summary.pendingCount} 项`
        : `${view.monthLabel} 还没有预计事项`
    );
    setText(
      'fixedTemplateSummary',
      view.templates.length
        ? `已保存 ${view.templates.length} 个固定项目模板`
        : '你还没有固定项目模板'
    );
  }

  function renderCategoryOptions(categories) {
    renderCategorySelect('monthPlanCategoryInput', categories, getValue('monthPlanCategoryInput'));
    renderCategorySelect('fixedTemplateCategoryInput', categories, getValue('fixedTemplateCategoryInput'));
  }

  function renderCategorySelect(id, categories, preferredValue) {
    const select = document.getElementById(id);
    if (!select) return;

    const currentValue = preferredValue || select.value;
    select.innerHTML = categories.map(category => `
      <option value="${escapeHtml(category.id)}">${escapeHtml(category.icon)} ${escapeHtml(category.name)}</option>
    `).join('');

    const nextValue = categories.some(category => category.id === currentValue)
      ? currentValue
      : categories[0]?.id || 'other';

    select.value = nextValue;
  }

  function renderMonthPlanList(view) {
    const container = document.getElementById('monthPlanList');
    if (!container) return;

    if (!view.items.length) {
      container.innerHTML = `
        <div class="empty-state">
          <strong>这个月还没有预计事项</strong>
          <span>例如剧本杀、住宿、聚餐、买课，先在这里记下来。</span>
        </div>
      `;
      return;
    }

    container.innerHTML = view.items.map(item => `
      <article class="forecast-item ${item.status === 'skipped' ? 'is-skipped' : ''} ${item.status === 'done' ? 'is-done' : ''}">
        <div class="forecast-item-top">
          <div>
            <h4 class="forecast-item-title">${escapeHtml(item.title)}</h4>
            <div class="forecast-item-meta">
              <span class="forecast-tag">${escapeHtml(item.category.icon)} ${escapeHtml(item.category.name)}</span>
              <span class="forecast-tag">${escapeHtml(item.kindLabel)}</span>
              <span class="forecast-tag">${escapeHtml(item.plannedDateLabel)}</span>
              <span class="forecast-status forecast-status--${escapeHtml(item.status)}">${escapeHtml(item.statusLabel)}</span>
            </div>
          </div>
          <div class="forecast-item-amount">${escapeHtml(item.amountText)}</div>
        </div>
        ${item.note ? `<p class="forecast-item-note">${escapeHtml(item.note)}</p>` : ''}
        <div class="forecast-item-actions">
          <button class="btn-secondary btn-small" type="button" data-action="edit" data-id="${escapeHtml(item.id)}">编辑</button>
          ${item.status === 'planned' ? `<button class="btn-soft-success btn-small" type="button" data-action="done" data-id="${escapeHtml(item.id)}">标记已处理</button>` : ''}
          ${item.status === 'planned' ? `<button class="btn-soft-warning btn-small" type="button" data-action="skip" data-id="${escapeHtml(item.id)}">跳过</button>` : ''}
          ${item.status !== 'planned' ? `<button class="btn-ghost btn-small" type="button" data-action="restore" data-id="${escapeHtml(item.id)}">恢复待发生</button>` : ''}
          <button class="btn-danger btn-small" type="button" data-action="delete" data-id="${escapeHtml(item.id)}">删除</button>
        </div>
      </article>
    `).join('');
  }

  function renderFixedTemplateList(view) {
    const container = document.getElementById('fixedTemplateList');
    if (!container) return;

    if (!view.templates.length) {
      container.innerHTML = `
        <div class="empty-state">
          <strong>还没有固定项目模板</strong>
          <span>先把每月吃饭、BTC 定投之类的固定支出存成模板。</span>
        </div>
      `;
      return;
    }

    container.innerHTML = view.templates.map(item => `
      <article class="forecast-template-item">
        <div class="forecast-template-top">
          <div>
            <h4 class="forecast-template-title">${escapeHtml(item.title)}</h4>
            <div class="forecast-template-meta">
              <span class="forecast-tag">${escapeHtml(item.category.icon)} ${escapeHtml(item.category.name)}</span>
              <span class="forecast-tag">${escapeHtml(item.recurringLabel)}</span>
            </div>
          </div>
          <div class="forecast-template-amount">${escapeHtml(item.amountText)}</div>
        </div>
        ${item.note ? `<p class="forecast-template-note">${escapeHtml(item.note)}</p>` : ''}
        <div class="forecast-template-actions">
          <button class="btn-secondary btn-small" type="button" data-action="edit" data-id="${escapeHtml(item.id)}">编辑</button>
          <button class="btn-danger btn-small" type="button" data-action="delete" data-id="${escapeHtml(item.id)}">删除</button>
        </div>
      </article>
    `).join('');
  }

  function resetMonthPlanForm() {
    setValue('monthPlanEditingId', '');
    setValue('monthPlanTitleInput', '');
    setValue('monthPlanAmountInput', '');
    setValue('monthPlanNoteInput', '');
    syncDateWithMonth(true);
    setText('monthPlanSubmitLabel', '保存本月事项');
    document.getElementById('cancelMonthPlanEdit')?.setAttribute('hidden', 'hidden');
    setStatus('monthPlanFormStatus', '');
  }

  function resetFixedTemplateForm() {
    setValue('fixedTemplateEditingId', '');
    setValue('fixedTemplateTitleInput', '');
    setValue('fixedTemplateAmountInput', '');
    setValue('fixedTemplateRecurringDayInput', '');
    setValue('fixedTemplateNoteInput', '');
    setText('fixedTemplateSubmitLabel', '保存固定项目');
    document.getElementById('cancelFixedTemplateEdit')?.setAttribute('hidden', 'hidden');
    setStatus('fixedTemplateFormStatus', '');
  }

  function syncDateWithMonth(force = false) {
    const input = document.getElementById('monthPlanDateInput');
    if (!input) return;

    const currentValue = input.value;
    const monthPrefix = `${state.month}-`;
    if (!force && currentValue && currentValue.startsWith(monthPrefix)) {
      return;
    }

    const day = currentValue ? currentValue.slice(8, 10) : '01';
    input.value = `${state.month}-${day}`;
  }

  function persistStore() {
    state.store = window.BudgetStore.saveStore(window.localStorage, state.store);
  }

  function setStatus(id, text, success = false) {
    const element = document.getElementById(id);
    if (!element) return;
    element.textContent = text || '';
    element.classList.toggle('success', Boolean(text) && success);
  }

  function setText(id, value) {
    const element = document.getElementById(id);
    if (element) {
      element.textContent = String(value ?? '');
    }
  }

  function setValue(id, value) {
    const element = document.getElementById(id);
    if (element) {
      element.value = String(value ?? '');
    }
  }

  function getValue(id) {
    const element = document.getElementById(id);
    return element ? element.value : '';
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  return { init };
})();

document.addEventListener('DOMContentLoaded', BudgetApp.init);
