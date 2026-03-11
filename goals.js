const GoalsApp = (() => {
  const STORAGE_KEY = "goalPlans:v1";
  const DEFAULT_ROUTE = "overview";
  const HORIZON_ORDER = ["1y", "3y", "4y"];
  const OVERVIEW_META = {
    eyebrow: "Long-term planning",
    heroTitle: "把日计划之外的目标，拉长到一年、三年和四年。",
    heroDescription: "这里不是替代你的每日任务，而是把更远的目标单独沉淀下来。你可以先写愿景，再拆成可追踪的里程碑，让长期目标也像日程一样有节奏地推进。",
    heroHighlight: "📌 目标内容与每日任务分开保存，互不影响。",
    panelTitle: "目标总览",
    panelDescription: "在同一页面里切换总览和各阶段详情，不再重复加载整页。",
    footerNote: "长期规划页使用本地浏览器存储；如果你换浏览器或清空缓存，数据也会一起清掉。"
  };
  const HORIZON_CONFIG = {
    "1y": {
      label: "1年目标",
      icon: "🌱",
      heroTitle: "一年后的你，最想把什么变成现实？",
      heroDescription: "把一年后的结果写具体，然后拆成几个足够清晰的阶段。愿景和进度放在同一页，方便你反复回看。",
      heroHighlight: "📌 先写清一年后的状态，再用里程碑把它变成可以推进的路径。",
      panelTitle: "1年目标详情",
      panelDescription: "同页编辑愿景卡、成功标准和里程碑，不再单独打开详情页。",
      footerNote: "1年目标的数据保存在本地浏览器中，和每日任务互不影响。",
      formDescription: "保存后会写入本地浏览器，刷新页面仍然保留。",
      goalTitlePlaceholder: "例如：一年内完成职业转型并形成稳定作品集",
      summaryPlaceholder: "一年后你想达到什么状态？生活、工作、能力上会有哪些具体变化？",
      successPlaceholder: "用可验证的标准定义成功，例如收入、证书、作品、习惯或生活状态。",
      notesPlaceholder: "记录关键资源、约束、风险、提醒，或者你准备采用的策略。",
      milestoneDescription: "建议把一年目标拆成 3 到 6 个关键阶段，每个阶段都可单独更新进度。",
      milestoneTitlePlaceholder: "例如：完成核心作品集并开始投递",
      milestoneDescriptionPlaceholder: "写清楚这个阶段完成时，你应该产出什么结果。",
      previewTitle: "1年主目标"
    },
    "3y": {
      label: "3年目标",
      icon: "🚀",
      heroTitle: "三年视角更适合搭建体系，而不是只盯着单点结果。",
      heroDescription: "这一页适合写长期方向、核心能力、稳定输出和中期跃迁。把模糊的未来拆成关键节点，会更容易持续行动。",
      heroHighlight: "📌 三年目标更适合看体系、身份、能力和稳定积累，而不只是一次结果。",
      panelTitle: "3年目标详情",
      panelDescription: "总览和详情留在同一页里切换，长期目标的浏览和编辑都会更顺。",
      footerNote: "3年目标的数据保存在本地浏览器中，和每日任务互不影响。",
      formDescription: "三年目标建议写得更系统一些，包含身份、能力、收入、作品和生活方式。",
      goalTitlePlaceholder: "例如：三年内形成稳定个人品牌与可持续业务模式",
      summaryPlaceholder: "三年后你希望自己处在怎样的位置？有哪些外部结果能证明你已经进入这个阶段？",
      successPlaceholder: "写下可衡量的标准，比如项目体量、收入结构、能力层级、团队形态或作品影响力。",
      notesPlaceholder: "记录长期资源、关键关系、阶段性风险和你预想的突破路径。",
      milestoneDescription: "三年目标适合拆成阶段性成果，比如能力建设、资产积累、作品沉淀或业务节点。",
      milestoneTitlePlaceholder: "例如：完成核心业务模型验证并稳定运行",
      milestoneDescriptionPlaceholder: "说明这个里程碑完成时，应当有哪些产出或稳定结果。",
      previewTitle: "3年主目标"
    },
    "4y": {
      label: "4年目标",
      icon: "🏔️",
      heroTitle: "四年目标更像“你想长期维持的生活与能力结构”。",
      heroDescription: "这一层适合思考你真正想变成什么样的人、建立怎样的系统，以及未来几年你愿意持续经营的核心方向。",
      heroHighlight: "📌 这一层更偏向长期生活结构和系统成型，而不是短期冲刺。",
      panelTitle: "4年目标详情",
      panelDescription: "保持同页切换后，查看长期路径和回到总览都会明显更轻一些。",
      footerNote: "4年目标的数据保存在本地浏览器中，和每日任务互不影响。",
      formDescription: "四年目标可以更偏向人生布局，重点写你想长期拥有的能力、环境、作品和生活方式。",
      goalTitlePlaceholder: "例如：四年内建立我真正想长期经营的人生系统",
      summaryPlaceholder: "四年后你最想生活在什么样的状态里？哪些事情会成为你稳定拥有的一部分？",
      successPlaceholder: "定义你判断自己达成目标的依据，例如稳定收入、生活地点、健康状态、影响力或作品体系。",
      notesPlaceholder: "写下你想守住的边界、关键约束、长期策略，或必须提前准备的条件。",
      milestoneDescription: "四年目标适合设置更高层的关键节点，例如系统成型、长期稳定、资产积累和阶段性成果。",
      milestoneTitlePlaceholder: "例如：形成稳定可复制的长期系统并持续运转",
      milestoneDescriptionPlaceholder: "说明这个里程碑完成时，你的长期目标会具体落到什么结果。",
      previewTitle: "4年主目标"
    }
  };
  const shellState = {
    host: null,
    route: DEFAULT_ROUTE
  };

  function init() {
    shellState.host = document.getElementById("goalsViewHost");
    if (!shellState.host) return;

    bindShellEvents();
    ensureValidRoute();
    renderCurrentRoute({ animate: false });

    window.addEventListener("hashchange", () => {
      renderCurrentRoute({ animate: true });
    });

    window.addEventListener("storage", event => {
      if (event.key && event.key !== STORAGE_KEY) return;
      renderCurrentRoute({ animate: false });
    });
  }

  function bindShellEvents() {
    shellState.host.addEventListener("submit", event => {
      const form = event.target;
      const horizon = getActiveHorizon();
      if (!horizon) return;

      if (form.id === "goalForm") {
        event.preventDefault();
        saveGoalCard(horizon);
      }

      if (form.id === "milestoneForm") {
        event.preventDefault();
        saveMilestone(horizon);
      }
    });

    shellState.host.addEventListener("input", event => {
      const horizon = getActiveHorizon();
      if (!horizon || !event.target.closest("#goalForm")) return;

      updatePreviewFromForm(horizon);
      setStatus("goalSaveStatus", "");
    });

    shellState.host.addEventListener("click", event => {
      const horizon = getActiveHorizon();
      const button = event.target.closest("[data-action]");
      if (!button || !horizon) return;

      const action = button.dataset.action;
      const id = button.dataset.id;

      if (action === "cancel-edit") {
        resetMilestoneForm();
        return;
      }

      if (!id) return;
      if (action === "edit") editMilestone(horizon, id);
      if (action === "delete") deleteMilestone(horizon, id);
      if (action === "progress") updateMilestoneProgress(horizon, id);
    });

    shellState.host.addEventListener("error", handleImageError, true);
  }

  function ensureValidRoute() {
    const route = normalizeRoute(window.location.hash);
    replaceRoute(route);
    shellState.route = route;
  }

  function renderCurrentRoute(options = {}) {
    const route = normalizeRoute(window.location.hash);
    const previousRoute = shellState.route;
    const shouldAnimate = Boolean(options.animate && previousRoute !== route && window.PageMotion && shellState.host?.childElementCount);
    const store = getGoalStore();

    replaceRoute(route);
    shellState.route = route;
    updateShellNavigation(route);
    renderShellHero(route, store);
    renderRoutePanel(route);
    setText("pageFooterNote", route === DEFAULT_ROUTE ? OVERVIEW_META.footerNote : HORIZON_CONFIG[route].footerNote);

    const render = () => {
      if (route === DEFAULT_ROUTE) {
        renderOverviewView(store);
        return;
      }
      renderDetailView(route, store);
    };

    if (!shouldAnimate) {
      render();
      return;
    }

    window.PageMotion.animateSwap(shellState.host, render, {
      outMs: 170,
      inMs: 260
    });
  }

  function renderShellHero(route, store, draftCard = null) {
    if (route === DEFAULT_ROUTE) {
      const allMilestones = HORIZON_ORDER.flatMap(horizon => store[horizon].milestones);
      const configuredGoals = HORIZON_ORDER.filter(horizon => {
        const card = store[horizon].cards[0];
        return hasGoalContent(card) || store[horizon].milestones.length > 0;
      }).length;
      const completedMilestones = allMilestones.filter(item => item.completed).length;
      const averageProgress = allMilestones.length
        ? Math.round(allMilestones.reduce((sum, item) => sum + item.progress, 0) / allMilestones.length)
        : 0;

      setText("shellEyebrow", OVERVIEW_META.eyebrow);
      setText("shellHeroTitle", OVERVIEW_META.heroTitle);
      setText("shellHeroDescription", OVERVIEW_META.heroDescription);
      setText("shellHeroHighlight", OVERVIEW_META.heroHighlight);
      setText("shellStatValue1", configuredGoals);
      setText("shellStatLabel1", "已设定目标页");
      setText("shellStatValue2", allMilestones.length);
      setText("shellStatLabel2", "累计里程碑");
      setText("shellStatValue3", `${averageProgress}%`);
      setText("shellStatLabel3", "平均推进度");

      const visual = document.getElementById("shellHeroVisualContent");
      if (visual) {
        visual.innerHTML = `
          <div class="image-placeholder">
            <strong>三段长期规划</strong>
            <span>1 年做出轮廓，3 年建立体系，4 年达到你想长期维持的状态。</span>
            <span>${completedMilestones}</span>
            <small>个里程碑已完成</small>
          </div>
        `;
      }
      return;
    }

    const config = HORIZON_CONFIG[route];
    const card = draftCard || store[route].cards[0];
    const milestones = sortMilestones(store[route].milestones);
    const stats = getMilestoneStats(milestones);
    const visual = document.getElementById("shellHeroVisualContent");
    const title = card.title || config.previewTitle;

    setText("shellEyebrow", config.label);
    setText("shellHeroTitle", config.heroTitle);
    setText("shellHeroDescription", config.heroDescription);
    setText("shellHeroHighlight", config.heroHighlight);
    setText("shellStatValue1", `${stats.averageProgress}%`);
    setText("shellStatLabel1", "总体进度");
    setText("shellStatValue2", stats.completed);
    setText("shellStatLabel2", "已完成里程碑");
    setText("shellStatValue3", stats.remaining);
    setText("shellStatLabel3", "剩余里程碑");
    if (!visual) return;

    const badge = `
      <div class="hero-visual-badge">
        <span>${escapeHtml(config.label)}</span>
        <strong>${escapeHtml(title)}</strong>
      </div>
    `;

    if (!card.imageUrl) {
      visual.innerHTML = `
        <div class="image-placeholder">
          <strong>这里会显示你的目标配图</strong>
          <span>在下方填入图片链接后，这里会实时预览。</span>
          <small>当前已完成 ${stats.completed} / ${stats.total || 0} 个里程碑</small>
        </div>
        ${badge}
      `;
      return;
    }

    visual.innerHTML = `
      ${renderImageMarkup(card.imageUrl, "hero-image")}
      ${badge}
    `;
  }

  function renderRoutePanel(route) {
    if (route === DEFAULT_ROUTE) {
      setText("routePanelTitle", OVERVIEW_META.panelTitle);
      setText("routePanelDescription", OVERVIEW_META.panelDescription);
      return;
    }

    const config = HORIZON_CONFIG[route];
    setText("routePanelTitle", config.panelTitle);
    setText("routePanelDescription", config.panelDescription);
  }

  function updateShellNavigation(route) {
    document.querySelectorAll("[data-shell-route]").forEach(node => {
      node.classList.toggle("active", node.dataset.shellRoute === route);
    });
  }
  function renderOverviewView(store) {
    if (!shellState.host) return;

    shellState.host.innerHTML = `
      <section class="section-card glass-panel" data-motion-item style="--motion-item-order: 0;">
        <div class="section-head">
          <div>
            <h2>目标总览</h2>
            <p>每张卡都对应一个时间维度。先写最重要的主目标，再补充配图、成功标准和里程碑。</p>
          </div>
        </div>
        <div class="overview-grid" id="overviewCards">${renderOverviewCardsMarkup(store)}</div>
      </section>
    `;
  }

  function renderOverviewCardsMarkup(store) {
    return HORIZON_ORDER.map((horizon, index) => {
      const config = HORIZON_CONFIG[horizon];
      const card = store[horizon].cards[0];
      const milestones = sortMilestones(store[horizon].milestones);
      const stats = getMilestoneStats(milestones);
      const isEmpty = !hasGoalContent(card) && milestones.length === 0;
      const imageMarkup = renderImageMarkup(card.imageUrl, "card-image");
      const motionAttr = createMotionItemAttr(index, 3);

      return `
        <article class="overview-card" data-hover-pop ${motionAttr}>
          <div class="overview-card-media">
            ${imageMarkup}
          </div>
          <div class="overview-card-body">
            <div class="overview-card-top">
              <div>
                <span class="goal-chip">${config.label}</span>
                <h2 class="overview-card-title">${escapeHtml(card.title || "尚未设定目标")}</h2>
              </div>
              <span class="goal-icon">${escapeHtml(card.icon || config.icon)}</span>
            </div>
            <p class="overview-summary">${escapeHtml(card.summary || "这里会展示这一阶段最重要的愿景描述、目标方向和你的成功标准。")}</p>
            <div class="meta-list">
              <span class="meta-pill">📅 目标日期 ${escapeHtml(formatDateLabel(card.targetDate))}</span>
              <span class="meta-pill">✅ ${stats.completed}/${stats.total || 0} 个里程碑</span>
              <span class="meta-pill">📈 平均进度 ${stats.averageProgress}%</span>
            </div>
            <div class="progress-block">
              <div class="progress-top">
                <span>${isEmpty ? "尚未开始规划" : "当前推进程度"}</span>
                <strong>${stats.averageProgress}%</strong>
              </div>
              <div class="progress-bar">
                <div class="progress-fill" style="width: ${stats.averageProgress}%"></div>
              </div>
            </div>
            <div class="overview-actions">
              <a class="btn-primary" href="${buildRouteHref(horizon)}">${isEmpty ? "开始规划" : "查看详情"}</a>
            </div>
          </div>
        </article>
      `;
    }).join("");
  }

  function renderDetailView(horizon, store) {
    const config = HORIZON_CONFIG[horizon];
    const card = store[horizon].cards[0];
    const milestones = sortMilestones(store[horizon].milestones);

    if (!shellState.host) return;

    shellState.host.innerHTML = `
      <div class="goals-view-stack">
        <section class="section-card glass-panel detail-grid" data-motion-item style="--motion-item-order: 0;">
          <form id="goalForm">
            <div class="section-head">
              <div>
                <h2>愿景卡设置</h2>
                <p>${escapeHtml(config.formDescription)}</p>
              </div>
            </div>
            <div class="form-grid">
              <div class="field">
                <label for="goalIconInput">图标</label>
                <input id="goalIconInput" type="text" maxlength="4" placeholder="例如：${escapeAttribute(config.icon)}" />
              </div>
              <div class="field">
                <label for="goalTargetDateInput">目标日期</label>
                <input id="goalTargetDateInput" type="date" />
              </div>
              <div class="field full">
                <label for="goalTitleInput">目标标题</label>
                <input id="goalTitleInput" type="text" placeholder="${escapeAttribute(config.goalTitlePlaceholder)}" />
              </div>
              <div class="field full">
                <label for="goalImageInput">图片链接</label>
                <input id="goalImageInput" type="url" placeholder="https://example.com/image.jpg" />
              </div>
              <div class="field full">
                <label for="goalSummaryInput">愿景描述</label>
                <textarea id="goalSummaryInput" placeholder="${escapeAttribute(config.summaryPlaceholder)}"></textarea>
              </div>
              <div class="field full">
                <label for="goalSuccessInput">成功标准</label>
                <textarea id="goalSuccessInput" placeholder="${escapeAttribute(config.successPlaceholder)}"></textarea>
              </div>
              <div class="field full">
                <label for="goalNotesInput">补充备注</label>
                <textarea id="goalNotesInput" placeholder="${escapeAttribute(config.notesPlaceholder)}"></textarea>
              </div>
            </div>
            <div class="form-actions">
              <button type="submit" class="btn-primary">保存目标</button>
              <span class="status-note" id="goalSaveStatus"></span>
            </div>
          </form>

          <aside class="goal-preview-card" data-hover-pop>
            <div class="goal-preview-head">
              <div>
                <p class="eyebrow">Preview</p>
                <h2 class="goal-preview-title"><span id="goalPreviewIcon">${escapeHtml(config.icon)}</span> <span id="goalPreviewTitle">${escapeHtml(config.previewTitle)}</span></h2>
                <div class="goal-preview-date">目标日期：<span id="goalPreviewDate">未设定</span></div>
              </div>
            </div>
            <div class="goal-preview-text">
              <div class="preview-block">
                <h3>愿景描述</h3>
                <p id="goalPreviewSummary"></p>
              </div>
              <div class="preview-block">
                <h3>成功标准</h3>
                <p id="goalPreviewSuccess"></p>
              </div>
              <div class="preview-block">
                <h3>补充备注</h3>
                <p id="goalPreviewNotes"></p>
              </div>
            </div>
          </aside>
        </section>

        <section class="section-card glass-panel milestone-layout" data-motion-item style="--motion-item-order: 1;">
          <form id="milestoneForm">
            <div class="section-head">
              <div>
                <h2>新增里程碑</h2>
                <p>${escapeHtml(config.milestoneDescription)}</p>
              </div>
            </div>
            <input id="milestoneEditingId" type="hidden" />
            <div class="form-grid">
              <div class="field full">
                <label for="milestoneTitleInput">里程碑标题</label>
                <input id="milestoneTitleInput" type="text" placeholder="${escapeAttribute(config.milestoneTitlePlaceholder)}" />
              </div>
              <div class="field">
                <label for="milestoneDueDateInput">截止日期</label>
                <input id="milestoneDueDateInput" type="date" />
              </div>
              <div class="field">
                <label for="milestonePriorityInput">优先级</label>
                <select id="milestonePriorityInput">
                  <option value="high">高优先级</option>
                  <option value="medium" selected>中优先级</option>
                  <option value="low">低优先级</option>
                </select>
              </div>
              <div class="field full">
                <label for="milestoneDescriptionInput">说明</label>
                <textarea id="milestoneDescriptionInput" placeholder="${escapeAttribute(config.milestoneDescriptionPlaceholder)}"></textarea>
              </div>
            </div>
            <div class="form-actions">
              <button type="submit" class="btn-primary" id="milestoneSubmitLabel">添加里程碑</button>
              <button type="button" class="btn-ghost" data-action="cancel-edit" id="cancelMilestoneEdit" hidden>取消编辑</button>
              <span class="status-note" id="milestoneFormStatus"></span>
            </div>
          </form>

          <div>
            <div class="section-head">
              <div>
                <h2>里程碑列表</h2>
                <p>支持编辑、删除和进度更新；进度到 100% 时会自动标记完成。</p>
              </div>
            </div>
            <div class="milestone-list" id="milestoneList">${renderMilestonesMarkup(milestones)}</div>
          </div>
        </section>
      </div>
    `;

    fillGoalForm(card);
    renderGoalPreview(config, card);
  }

  function fillGoalForm(card) {
    setValue("goalIconInput", card.icon);
    setValue("goalTitleInput", card.title);
    setValue("goalTargetDateInput", card.targetDate);
    setValue("goalImageInput", card.imageUrl);
    setValue("goalSummaryInput", card.summary);
    setValue("goalSuccessInput", card.successCriteria);
    setValue("goalNotesInput", card.notes);

    const status = card.updatedAt ? `上次保存：${formatDateTime(card.updatedAt)}` : "尚未保存";
    setStatus("goalSaveStatus", status, Boolean(card.updatedAt));
  }

  function saveGoalCard(horizon) {
    const store = getGoalStore();
    const card = store[horizon].cards[0];
    const nextCard = {
      ...card,
      icon: toText(getValue("goalIconInput")) || HORIZON_CONFIG[horizon].icon,
      title: toText(getValue("goalTitleInput")),
      targetDate: toText(getValue("goalTargetDateInput")) || getDefaultTargetDate(horizon),
      imageUrl: toText(getValue("goalImageInput")),
      summary: toText(getValue("goalSummaryInput")),
      successCriteria: toText(getValue("goalSuccessInput")),
      notes: toText(getValue("goalNotesInput")),
      updatedAt: new Date().toISOString()
    };

    store[horizon].cards = [nextCard];
    saveGoalStore(store);
    renderCurrentRoute({ animate: false });
    setStatus("goalSaveStatus", `已保存：${formatDateTime(nextCard.updatedAt)}`, true);
  }

  function updatePreviewFromForm(horizon) {
    const config = HORIZON_CONFIG[horizon];
    const store = getGoalStore();
    const draftCard = readDraftCard(horizon);

    renderGoalPreview(config, draftCard);
    renderShellHero(horizon, store, draftCard);
  }

  function readDraftCard(horizon) {
    const config = HORIZON_CONFIG[horizon];
    return {
      icon: toText(getValue("goalIconInput")) || config.icon,
      title: toText(getValue("goalTitleInput")),
      targetDate: toText(getValue("goalTargetDateInput")) || getDefaultTargetDate(horizon),
      imageUrl: toText(getValue("goalImageInput")),
      summary: toText(getValue("goalSummaryInput")),
      successCriteria: toText(getValue("goalSuccessInput")),
      notes: toText(getValue("goalNotesInput"))
    };
  }

  function renderGoalPreview(config, card) {
    setText("goalPreviewIcon", card.icon || config.icon);
    setText("goalPreviewTitle", card.title || config.previewTitle);
    setText("goalPreviewDate", formatDateLabel(card.targetDate));
    setText("goalPreviewSummary", card.summary || "在这里写下这一阶段你最想达成的状态、结果和变化。");
    setText("goalPreviewSuccess", card.successCriteria || "你可以写明衡量成功的具体标准，例如收入、技能、作品、生活方式等。");
    setText("goalPreviewNotes", card.notes || "补充你的资源、风险、关键策略，或者你不想忘记的提醒。");
  }

  function renderMilestonesMarkup(milestones) {
    if (!milestones.length) {
      return `
        <div class="empty-state" data-hover-pop>
          <strong>还没有里程碑</strong>
          <span>先拆出 3 到 5 个关键阶段，你的长期目标会更容易推进。</span>
        </div>
      `;
    }

    return milestones.map((milestone, index) => {
      const progress = normalizeProgress(milestone.progress);
      const completedText = milestone.completed && milestone.completedAt
        ? `完成于 ${formatDateTime(milestone.completedAt)}`
        : progress >= 100 ? "已完成" : "进行中";
      const motionAttr = createMotionItemAttr(index, 6);

      return `
        <article class="milestone-card ${milestone.completed ? "completed" : ""}" data-hover-pop ${motionAttr}>
          <div class="milestone-top">
            <div>
              <h3 class="milestone-title">${escapeHtml(milestone.title || "未命名里程碑")}</h3>
              <div class="meta-list">
                <span class="meta-pill ${priorityClassName(milestone.priority)}">${priorityLabel(milestone.priority)}</span>
                <span class="meta-pill">📅 ${escapeHtml(formatDateLabel(milestone.dueDate))}</span>
                <span class="meta-pill">${milestone.completed ? "✅" : "⏳"} ${escapeHtml(completedText)}</span>
              </div>
            </div>
          </div>
          <p class="milestone-desc">${escapeHtml(milestone.description || "建议写下这一阶段需要完成的具体结果。")}</p>
          <div class="progress-block">
            <div class="progress-top">
              <span>当前进度</span>
              <strong>${progress}%</strong>
            </div>
            <div class="progress-bar">
              <div class="progress-fill" style="width: ${progress}%"></div>
            </div>
          </div>
          <div class="milestone-actions">
            <button type="button" class="btn-primary" data-action="progress" data-id="${escapeHtml(milestone.id)}">更新进度</button>
            <button type="button" class="btn-secondary" data-action="edit" data-id="${escapeHtml(milestone.id)}">编辑</button>
            <button type="button" class="btn-danger" data-action="delete" data-id="${escapeHtml(milestone.id)}">删除</button>
          </div>
        </article>
      `;
    }).join("");
  }

  function saveMilestone(horizon) {
    const title = toText(getValue("milestoneTitleInput"));
    if (!title) {
      alert("请输入里程碑标题");
      return;
    }

    const store = getGoalStore();
    const milestones = store[horizon].milestones.slice();
    const editingId = toText(getValue("milestoneEditingId"));
    const dueDate = toText(getValue("milestoneDueDateInput"));
    const priority = normalizePriority(getValue("milestonePriorityInput"));
    const description = toText(getValue("milestoneDescriptionInput"));

    if (editingId) {
      const current = milestones.find(item => item.id === editingId);
      if (!current) return;
      current.title = title;
      current.description = description;
      current.dueDate = dueDate;
      current.priority = priority;
    } else {
      milestones.push({
        id: createId(),
        title,
        description,
        dueDate,
        priority,
        progress: 0,
        completed: false,
        createdAt: new Date().toISOString(),
        completedAt: ""
      });
    }

    store[horizon].milestones = milestones;
    saveGoalStore(store);
    renderCurrentRoute({ animate: false });
  }

  function editMilestone(horizon, id) {
    const store = getGoalStore();
    const milestone = store[horizon].milestones.find(item => item.id === id);
    if (!milestone) return;

    setValue("milestoneEditingId", milestone.id);
    setValue("milestoneTitleInput", milestone.title);
    setValue("milestoneDescriptionInput", milestone.description);
    setValue("milestoneDueDateInput", milestone.dueDate);
    setValue("milestonePriorityInput", milestone.priority);
    setText("milestoneSubmitLabel", "保存里程碑");
    const cancelButton = document.getElementById("cancelMilestoneEdit");
    if (cancelButton) cancelButton.hidden = false;
    setStatus("milestoneFormStatus", `正在编辑：${milestone.title}`, true);
  }

  function deleteMilestone(horizon, id) {
    if (!confirm("确定删除这个里程碑吗？")) return;
    const store = getGoalStore();
    store[horizon].milestones = store[horizon].milestones.filter(item => item.id !== id);
    saveGoalStore(store);
    renderCurrentRoute({ animate: false });
  }

  function updateMilestoneProgress(horizon, id) {
    const store = getGoalStore();
    const milestone = store[horizon].milestones.find(item => item.id === id);
    if (!milestone) return;

    const input = prompt("请输入进度（0-100）", String(milestone.progress || 0));
    if (input === null) return;

    const progress = Number(input);
    if (Number.isNaN(progress) || progress < 0 || progress > 100) {
      alert("请输入 0 到 100 的数字");
      return;
    }

    milestone.progress = normalizeProgress(progress);
    milestone.completed = milestone.progress >= 100;
    milestone.completedAt = milestone.completed ? new Date().toISOString() : "";
    saveGoalStore(store);
    renderCurrentRoute({ animate: false });
  }

  function resetMilestoneForm() {
    setValue("milestoneEditingId", "");
    setValue("milestoneTitleInput", "");
    setValue("milestoneDescriptionInput", "");
    setValue("milestoneDueDateInput", "");
    setValue("milestonePriorityInput", "medium");
    setText("milestoneSubmitLabel", "添加里程碑");
    setStatus("milestoneFormStatus", "");
    const cancelButton = document.getElementById("cancelMilestoneEdit");
    if (cancelButton) cancelButton.hidden = true;
  }
  function createDefaultStore() {
    return HORIZON_ORDER.reduce((store, horizon) => {
      store[horizon] = {
        cards: [createDefaultCard(horizon)],
        milestones: []
      };
      return store;
    }, {});
  }

  function createDefaultCard(horizon) {
    return {
      id: "main",
      title: "",
      icon: HORIZON_CONFIG[horizon].icon,
      imageUrl: "",
      summary: "",
      successCriteria: "",
      notes: "",
      targetDate: getDefaultTargetDate(horizon),
      updatedAt: ""
    };
  }

  function getGoalStore() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      const normalized = normalizeStore(parsed);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
      return normalized;
    } catch (error) {
      const fallback = createDefaultStore();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(fallback));
      return fallback;
    }
  }

  function normalizeStore(raw) {
    const source = raw && typeof raw === "object" ? raw : {};
    const normalized = {};

    for (const horizon of HORIZON_ORDER) {
      const item = source[horizon] && typeof source[horizon] === "object" ? source[horizon] : {};
      const firstCard = Array.isArray(item.cards) ? item.cards[0] : null;
      normalized[horizon] = {
        cards: [normalizeCard(horizon, firstCard)],
        milestones: Array.isArray(item.milestones)
          ? item.milestones.filter(milestone => milestone && typeof milestone === "object").map(normalizeMilestone)
          : []
      };
    }

    return normalized;
  }

  function normalizeCard(horizon, card) {
    const defaults = createDefaultCard(horizon);
    const source = card && typeof card === "object" ? card : {};

    return {
      id: "main",
      title: toText(source.title),
      icon: toText(source.icon) || defaults.icon,
      imageUrl: toText(source.imageUrl),
      summary: toText(source.summary),
      successCriteria: toText(source.successCriteria),
      notes: toText(source.notes),
      targetDate: toText(source.targetDate) || defaults.targetDate,
      updatedAt: toText(source.updatedAt)
    };
  }

  function normalizeMilestone(milestone) {
    const progress = normalizeProgress(milestone.progress);
    const completed = Boolean(milestone.completed) || progress >= 100;

    return {
      id: toText(milestone.id) || createId(),
      title: toText(milestone.title),
      description: toText(milestone.description),
      dueDate: toText(milestone.dueDate),
      priority: normalizePriority(milestone.priority),
      progress,
      completed,
      createdAt: toText(milestone.createdAt) || new Date().toISOString(),
      completedAt: completed ? toText(milestone.completedAt) || new Date().toISOString() : ""
    };
  }

  function saveGoalStore(store) {
    const normalized = normalizeStore(store);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
    return normalized;
  }

  function getMilestoneStats(milestones) {
    const total = milestones.length;
    const completed = milestones.filter(item => item.completed).length;
    const averageProgress = total
      ? Math.round(milestones.reduce((sum, item) => sum + normalizeProgress(item.progress), 0) / total)
      : 0;

    return {
      total,
      completed,
      remaining: Math.max(total - completed, 0),
      averageProgress
    };
  }

  function sortMilestones(milestones) {
    return milestones.slice().sort((a, b) => {
      const dateA = a.dueDate ? parseDateValue(a.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
      const dateB = b.dueDate ? parseDateValue(b.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
      if (dateA !== dateB) return dateA - dateB;
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });
  }

  function renderImageMarkup(imageUrl, imageClass) {
    if (!imageUrl) {
      return `
        <div class="image-placeholder">
          <strong>尚未设置图片</strong>
          <span>填写图片链接后，这里会显示你的长期目标氛围图。</span>
        </div>
      `;
    }

    return `
      <img class="${imageClass}" src="${escapeAttribute(imageUrl)}" alt="目标配图" onerror="GoalsApp.handleImageError(event)">
      <div class="image-placeholder" hidden>
        <strong>图片加载失败</strong>
        <span>请检查图片链接是否可访问，或者换一张图。</span>
      </div>
    `;
  }

  function handleImageError(event) {
    const image = event.target;
    if (!(image instanceof HTMLElement)) return;
    image.classList.add("hidden");
    const placeholder = image.nextElementSibling;
    if (placeholder) placeholder.hidden = false;
  }

  function hasGoalContent(card) {
    return Boolean(
      toText(card.title) ||
      toText(card.summary) ||
      toText(card.successCriteria) ||
      toText(card.notes) ||
      toText(card.imageUrl)
    );
  }

  function getActiveHorizon() {
    return HORIZON_CONFIG[shellState.route] ? shellState.route : "";
  }

  function normalizeRoute(hash) {
    const raw = String(hash || "").replace(/^#/, "").trim();
    return raw === DEFAULT_ROUTE || HORIZON_CONFIG[raw] ? raw : DEFAULT_ROUTE;
  }

  function replaceRoute(route) {
    const url = new URL(window.location.href);
    const nextHash = `#${route}`;
    if (url.hash === nextHash) return;
    url.hash = nextHash;
    window.history.replaceState(null, "", url.href);
  }

  function buildRouteHref(route) {
    return `goals.html#${route}`;
  }

  function normalizePriority(value) {
    return ["high", "medium", "low"].includes(value) ? value : "medium";
  }

  function normalizeProgress(value) {
    const number = Number(value);
    if (Number.isNaN(number)) return 0;
    return Math.max(0, Math.min(100, Math.round(number)));
  }

  function priorityLabel(priority) {
    return {
      high: "🔴 高优先级",
      medium: "🟡 中优先级",
      low: "🟢 低优先级"
    }[priority] || "🟡 中优先级";
  }

  function priorityClassName(priority) {
    return `priority-${normalizePriority(priority)}`;
  }

  function getDefaultTargetDate(horizon) {
    const years = Number.parseInt(horizon, 10) || 1;
    const date = new Date();
    date.setFullYear(date.getFullYear() + years);
    return toDateValue(date);
  }

  function parseDateValue(dateStr) {
    if (!dateStr) return new Date("2999-12-31");
    const [year, month, day] = dateStr.split("-").map(part => Number.parseInt(part, 10));
    return new Date(year, (month || 1) - 1, day || 1);
  }

  function formatDateLabel(dateStr) {
    if (!dateStr) return "未设定";
    const date = parseDateValue(dateStr);
    if (Number.isNaN(date.getTime())) return dateStr;
    return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
  }

  function formatDateTime(value) {
    if (!value) return "未记录";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
  }

  function toDateValue(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  }

  function createId() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      return window.crypto.randomUUID();
    }
    return `goal-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
  }

  function createMotionItemAttr(index, limit) {
    if (index >= limit) return "";
    return `data-motion-item style="--motion-item-order: ${index};"`;
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll("\"", "&quot;")
      .replaceAll("'", "&#39;");
  }

  function escapeAttribute(value) { return escapeHtml(value); }
  function setText(id, value) {
    const node = document.getElementById(id);
    if (node) node.textContent = String(value ?? "");
  }

  function setValue(id, value) {
    const node = document.getElementById(id);
    if (node) node.value = String(value ?? "");
  }

  function getValue(id) {
    const node = document.getElementById(id);
    return node ? node.value : "";
  }

  function setStatus(id, text, success = false) {
    const node = document.getElementById(id);
    if (!node) return;
    node.textContent = text;
    node.classList.toggle("success", Boolean(text) && success);
  }

  function toText(value) {
    return typeof value === "string" ? value.trim() : "";
  }

  return {
    init,
    handleImageError
  };
})();

window.GoalsApp = GoalsApp;
document.addEventListener("DOMContentLoaded", GoalsApp.init);
