const MomentsApp = (() => {
  const STORAGE_KEY = "lifeMoments:v1";
  const DEFAULT_WEEKLY_MOOD = "幸福";
  const DEFAULT_YEARLY_MOOD = "热泪";
  const WEEKLY_DELETE_MARKER = 'data-action="delete-weekly"';

  const TYPE_META = {
    week: {
      label: "本周星尘",
      composerLabel: "投放一颗本周星星",
      defaultMood: DEFAULT_WEEKLY_MOOD
    },
    year: {
      label: "年度星河",
      composerLabel: "投放一颗年度星星",
      defaultMood: DEFAULT_YEARLY_MOOD
    }
  };

  const STAR_DENSITY = 0.00018;
  const DUST_DENSITY = 0.00004;
  const DRAG_THRESHOLD = 4;

  const state = {
    memories: [],
    selectedId: "",
    hoveredId: "",
    composerDrag: null,
    planetDrag: null,
    starAnimation: 0,
    stars: [],
    dust: [],
    mouse: { x: 0, y: 0, tx: 0, ty: 0 },
    showHidden: false,
    suppressClickUntil: 0
  };

  async function init() {
    if (!document.getElementById("cosmosStage")) return;

    setText("currentYearLabel", String(getCurrentYear()));
    bindEvents();
    bindComposerDrag();
    bindPlanetDrag();
    bindStarInteractions();
    initStarfieldCanvas();

    try {
      state.memories = await RiverStarStore.initStorage();
      setBackupStatus("已连接本地星图");
    } catch (error) {
      state.memories = RiverStarStore.migrateLegacyStore(readLegacyFallback());
      setBackupStatus("IndexedDB 不可用，已临时读取旧备份");
    }

    renderAll();
  }

  function bindEvents() {
    document.getElementById("createWeeklyMoment")?.addEventListener("click", () => openComposer("week"));
    document.getElementById("createYearlyMoment")?.addEventListener("click", () => openComposer("year"));
    document.getElementById("filterToggle")?.addEventListener("click", toggleHiddenFilter);
    document.getElementById("settingsToggle")?.addEventListener("click", () => setBackupStatus("当前只保留本地星图设置"));
    document.getElementById("exportStarsButton")?.addEventListener("click", exportStarsBackup);
    document.getElementById("importStarsButton")?.addEventListener("click", () => document.getElementById("importStarsInput")?.click());
    document.getElementById("importStarsInput")?.addEventListener("change", importStarsBackup);

    document.getElementById("composerClose")?.addEventListener("click", closeComposer);
    document.getElementById("composerCancel")?.addEventListener("click", closeComposer);
    document.getElementById("composerMoreToggle")?.addEventListener("click", toggleComposerExtra);
    document.getElementById("composerIntensity")?.addEventListener("input", event => {
      setText("composerIntensityValue", event.target.value);
    });
    document.getElementById("composerForm")?.addEventListener("submit", event => {
      event.preventDefault();
      saveComposerMoment();
    });

    document.getElementById("planetLayer")?.addEventListener("click", event => {
      if (Date.now() < state.suppressClickUntil) return;
      const planet = event.target instanceof Element ? event.target.closest('[data-action="open-planet"]') : null;
      if (!planet) return;
      openMemoryPaper(planet.dataset.id, planet);
    });

    document.getElementById("paperClose")?.addEventListener("click", closeMemoryPaper);
    document.getElementById("memoryPaperScrim")?.addEventListener("click", closeMemoryPaper);
    document.getElementById("popoverEdit")?.addEventListener("click", openEditorForSelected);
    document.getElementById("popoverDeleteWeekly")?.addEventListener("click", deleteSelectedWeeklyMoment);
    document.getElementById("favoriteToYear")?.addEventListener("click", favoriteSelectedToYear);
    document.getElementById("popoverHideYear")?.addEventListener("click", hideSelectedYearMemory);
    document.getElementById("popoverArchiveYear")?.addEventListener("click", archiveSelectedYearMemory);
    document.getElementById("popoverYearDeleteRequest")?.addEventListener("click", requestYearDeleteConfirmation);
    document.getElementById("yearHideFromDialog")?.addEventListener("click", hideSelectedYearMemory);
    document.getElementById("yearConfirmDelete")?.addEventListener("click", confirmDeleteSelectedYearMemory);
    document.getElementById("yearCancelDelete")?.addEventListener("click", closeYearDeleteDialog);

    window.addEventListener("resize", () => {
      constrainFloatingElement(document.getElementById("composerPanel"));
      positionPreviewForActiveStar();
    });
    window.addEventListener("mousemove", event => {
      state.mouse.tx = (event.clientX / window.innerWidth - 0.5) * 2;
      state.mouse.ty = (event.clientY / window.innerHeight - 0.5) * 2;
    });
    document.addEventListener("keydown", event => {
      if (event.key !== "Escape") return;
      if (!document.getElementById("floatingComposer")?.hidden) closeComposer();
      else if (document.getElementById("yearDeleteDialog")?.open) closeYearDeleteDialog();
      else closeMemoryPaper();
    });
  }

  function renderAll() {
    const visible = getRenderableMemories();
    const week = visible.filter(item => item.scope === "week" && isCurrentWeek(item.date));
    const year = visible.filter(item => item.scope === "year" && item.date.slice(0, 4) === String(getCurrentYear()));

    setText("weeklyDustCount", String(week.length));
    setText("yearlyDustCount", String(year.length));
    renderUniverse(week, year);
  }

  function getRenderableMemories() {
    return state.memories
      .filter(item => !item.status.deleted)
      .filter(item => state.showHidden || (!item.status.hidden && !item.status.archived))
      .sort(compareMemories);
  }

  function renderUniverse(weekMemories, yearMemories) {
    const container = document.getElementById("planetLayer");
    const empty = document.getElementById("cosmosEmptyHint");
    if (!container) return;

    const planets = [
      ...yearMemories.map((item, index) => renderPlanet(item, index)),
      ...weekMemories.map((item, index) => renderPlanet(item, index))
    ];

    container.innerHTML = planets.join("");
    if (empty) empty.hidden = planets.length > 0;
    syncActiveStarClass();
    window.PageMotion?.reconcilePendingRemovals?.();
  }

  function renderPlanet(memory, index) {
    const layout = getPlanetLayout(memory, index);
    const title = deriveMomentTitle(memory.content || memory.title);
    const scopeClass = memory.scope === "year" ? "year" : "week";

    return `
      <button class="memory-planet memory-planet--${scopeClass}" type="button" data-action="open-planet" data-id="${escapeAttribute(memory.id)}" data-moment-id="${escapeAttribute(memory.id)}" style="--core: ${layout.theme.core}; --glow: ${layout.theme.glow}; --halo: ${layout.theme.halo}; --halo-solid: ${layout.theme.accent}; --ring: ${layout.theme.accent}; --glow-opacity: ${layout.glow}; --x: ${layout.x}; --y: ${layout.y}; --size: ${layout.size}px; --drift-duration: ${layout.duration}s; --orbit-duration: ${layout.orbitDuration}s; --drift-delay: ${layout.delay}s;" aria-label="查看${TYPE_META[memory.scope].label}：${escapeAttribute(title)}">
        <span class="star-drift" aria-hidden="true">
          <span class="orbit-ring"></span>
          <span class="star-halo"></span>
          <span class="star-core"></span>
        </span>
      </button>
    `;
  }

  function getPlanetLayout(memory, index = 0) {
    const normalized = RiverStarStore.normalizeMemory(memory);
    const visual = normalized.visual || buildVisual(normalized.moodTags, normalized.intensity, normalized.scope);
    const hash = hashString(`${normalized.scope}:${normalized.id}:${normalized.date}:${normalized.createdAt || ""}`);
    const speed = Number(visual.orbitSpeed || scopeToOrbitSpeed(normalized.scope, normalized.intensity));
    const durationBase = normalized.scope === "year" ? 11.5 : 7.2;

    return {
      x: normalized.position.x,
      y: normalized.position.y,
      size: sizeLevelToPx(visual.sizeLevel, normalized.scope),
      glow: Number(visual.glowLevel || 0.7).toFixed(2),
      duration: Math.max(5.5, durationBase / Math.max(0.22, speed)).toFixed(2),
      orbitDuration: Math.max(160, 320 / Math.max(0.22, speed)).toFixed(1),
      delay: -1 * (((hash + index * 11) % 80) / 10),
      theme: resolveRenderTheme(normalized, visual, hash, index)
    };
  }

  function resolveRenderTheme(memory, visual, hash, index) {
    const themeFamilies = {
      "warm-gold": ["warm-gold", "solar-peach", "candle-gold"],
      "rose-violet": ["rose-violet", "magenta-ember", "violet-silver"],
      "tear-gold": ["tear-gold", "candle-gold", "rose-violet", "violet-silver"],
      "silver-blue": ["silver-blue", "deep-azure", "moon-blue"],
      "white-gold": ["white-gold", "nova-red", "candle-gold"],
      "mint-cyan": ["mint-cyan", "aurora-green", "moon-blue"],
      "violet-silver": ["violet-silver", "rose-violet", "deep-azure"],
      "starlight": ["starlight", "moon-blue", "silver-blue", "mint-cyan"]
    };
    const fallback = memory.scope === "year"
      ? ["warm-gold", "candle-gold", "solar-peach", "rose-violet", "nova-red"]
      : ["moon-blue", "silver-blue", "mint-cyan", "aurora-green", "violet-silver"];
    const family = themeFamilies[visual.colorTheme] || fallback;
    const themeId = family[(hash + index * 17) % family.length];
    return themeById(themeId);
  }

  function bindStarInteractions() {
    const layer = document.getElementById("planetLayer");
    if (!layer) return;

    layer.addEventListener("pointerover", event => {
      const planet = event.target instanceof Element ? event.target.closest(".memory-planet") : null;
      if (!planet || planet.contains(event.relatedTarget)) return;
      openStarPreview(planet.dataset.id, planet);
    });

    layer.addEventListener("pointerout", event => {
      const planet = event.target instanceof Element ? event.target.closest(".memory-planet") : null;
      if (!planet || planet.contains(event.relatedTarget)) return;
      closeStarPreview();
    });

    layer.addEventListener("focusin", event => {
      const planet = event.target instanceof Element ? event.target.closest(".memory-planet") : null;
      if (planet) openStarPreview(planet.dataset.id, planet);
    });

    layer.addEventListener("focusout", closeStarPreview);
  }

  function openStarPreview(id, anchor) {
    const memory = findMemory(id);
    const card = document.getElementById("starPreviewCard");
    if (!memory || !card) return;

    state.hoveredId = id;
    setText("previewType", TYPE_META[memory.scope].label);
    setText("previewDate", formatShortDate(memory.date));
    setText("previewTitle", memory.title || deriveMomentTitle(memory.content));
    setText("previewContent", getMomentPreview(memory));
    renderPreviewTags(memory.moodTags || []);
    card.hidden = false;
    card.setAttribute("aria-hidden", "false");
    card.classList.add("is-visible");
    positionPreview(card, anchor);
    syncActiveStarClass();
  }

  function closeStarPreview() {
    const card = document.getElementById("starPreviewCard");
    state.hoveredId = "";
    if (card) {
      card.classList.remove("is-visible");
      card.setAttribute("aria-hidden", "true");
      window.setTimeout(() => {
        if (!state.hoveredId) card.hidden = true;
      }, 180);
    }
    syncActiveStarClass();
  }

  function renderPreviewTags(tags) {
    const container = document.getElementById("previewTags");
    if (!container) return;
    container.innerHTML = tags.slice(0, 3).map(tag => `<span>${escapeHtml(tag)}</span>`).join("");
  }

  function positionPreview(card, anchor) {
    if (!(anchor instanceof Element)) return;
    const rect = anchor.getBoundingClientRect();
    const cardWidth = 240;
    const offset = 18;
    let left = rect.left + rect.width / 2 + offset;
    let top = rect.top + rect.height / 2 - 20;

    if (left + cardWidth > window.innerWidth - 16) {
      left = rect.left + rect.width / 2 - offset - cardWidth;
    }
    if (top < 24) top = 24;
    if (top + 160 > window.innerHeight - 16) top = window.innerHeight - 176;

    card.style.left = `${Math.max(16, left)}px`;
    card.style.top = `${Math.max(16, top)}px`;
  }

  function positionPreviewForActiveStar() {
    if (!state.hoveredId) return;
    const card = document.getElementById("starPreviewCard");
    const anchor = document.querySelector(`[data-moment-id="${CSS.escape(state.hoveredId)}"]`);
    if (card && anchor) positionPreview(card, anchor);
  }

  function syncActiveStarClass() {
    const layer = document.getElementById("planetLayer");
    if (!layer) return;
    const activeId = state.hoveredId || state.selectedId;
    layer.classList.toggle("has-active-star", Boolean(activeId));
    layer.querySelectorAll(".memory-planet").forEach(planet => {
      planet.classList.toggle("is-active", planet.dataset.id === activeId);
    });
  }

  function openComposer(scope = "week", editingId = "") {
    const nextScope = scope === "year" ? "year" : "week";
    const item = editingId ? findMemory(editingId) : null;
    const resolvedScope = item?.scope || nextScope;

    setValue("composerType", resolvedScope);
    setValue("composerEditingId", editingId || "");
    setValue("composerTextarea", item ? item.content : "");
    setValue("composerTitle", item ? item.title : "");
    setValue("composerDate", item ? item.date : getTodayValue());
    setValue("composerScope", resolvedScope);
    setValue("composerIntensity", String(item?.intensity || 5));
    setText("composerIntensityValue", String(item?.intensity || 5));
    setMoodTagValues(item?.moodTags || []);
    setText("composerModeLabel", item ? `继续写${TYPE_META[resolvedScope].label}` : TYPE_META[resolvedScope].composerLabel);
    setText("composerStatus", "");
    setComposerExtraVisible(false);

    const wrapper = document.getElementById("floatingComposer");
    const panel = document.getElementById("composerPanel");
    if (!wrapper || !panel) return;
    wrapper.hidden = false;
    wrapper.setAttribute("aria-hidden", "false");
    positionComposer(panel);
    document.getElementById("composerTextarea")?.focus();
  }

  function positionComposer(panel) {
    const hasPosition = panel.style.left && panel.style.top;
    if (hasPosition) {
      constrainFloatingElement(panel);
      return;
    }
    const width = Math.min(520, Math.max(300, window.innerWidth - 28));
    panel.style.left = `${Math.max(14, Math.min(window.innerWidth - width - 14, window.innerWidth * 0.14))}px`;
    panel.style.top = `${Math.max(96, window.innerHeight * 0.18)}px`;
  }

  function closeComposer() {
    const wrapper = document.getElementById("floatingComposer");
    if (!wrapper) return;
    clearFocusWithin(wrapper);
    wrapper.hidden = true;
    wrapper.setAttribute("aria-hidden", "true");
    setText("composerStatus", "");
  }

  async function saveComposerMoment() {
    const content = toText(getValue("composerTextarea"));
    if (!content) {
      setText("composerStatus", "先写下一点东西。");
      document.getElementById("composerTextarea")?.focus();
      return;
    }

    const id = toText(getValue("composerEditingId"));
    const current = id ? findMemory(id) : null;
    const scope = getValue("composerScope") === "year" ? "year" : "week";
    const title = toText(getValue("composerTitle")) || deriveMomentTitle(content);
    const moodTags = getSelectedMoodTags();
    const intensity = Number(getValue("composerIntensity")) || 5;
    const now = new Date().toISOString();
    const nextId = id || createId(scope);
    const payload = {
      id: nextId,
      title,
      content,
      date: normalizeDateValue(getValue("composerDate")) || getTodayValue(),
      scope,
      moodTags,
      intensity,
      visual: buildVisual(moodTags, intensity, scope, nextId),
      createdAt: current?.createdAt || now,
      updatedAt: now,
      status: current?.status || { hidden: false, archived: false, deleted: false, favorite: false }
    };
    if (current && current.scope === scope) {
      payload.position = current.position;
    }

    const normalized = RiverStarStore.normalizeMemory(payload, scope);
    state.memories = mergeMemoryIntoState(normalized);
    await persistMemories();
    renderAll();
    closeComposer();
    openMemoryPaper(normalized.id, document.querySelector(`[data-moment-id="${CSS.escape(normalized.id)}"]`));
  }

  function openMemoryPaper(id, anchor) {
    const memory = findMemory(id);
    const overlay = document.getElementById("memoryPaperOverlay");
    if (!memory || !overlay) return;

    closeStarPreview();
    state.selectedId = id;
    setText("paperType", formatDateLabel(memory.date));
    setText("paperStamp", TYPE_META[memory.scope].label);
    setText("paperTitle", memory.title || deriveMomentTitle(memory.content));
    setText("paperContent", memory.content || "这颗星还没有写下细节。");
    renderPaperMeta(memory);

    const isWeek = memory.scope === "week";
    setHidden("favoriteToYear", !isWeek);
    setHidden("popoverDeleteWeekly", !isWeek);
    setHidden("popoverHideYear", isWeek);
    setHidden("popoverArchiveYear", isWeek);
    setHidden("popoverYearDeleteRequest", isWeek);

    const deleteButton = document.getElementById("popoverDeleteWeekly");
    if (deleteButton) {
      deleteButton.dataset.id = id;
      deleteButton.setAttribute("data-action", "delete-weekly");
      deleteButton.dataset.marker = WEEKLY_DELETE_MARKER;
    }

    overlay.hidden = false;
    overlay.setAttribute("aria-hidden", "false");
    syncActiveStarClass();
  }

  function renderPaperMeta(memory) {
    const meta = document.getElementById("paperMeta");
    if (!meta) return;
    const tags = memory.moodTags?.length ? memory.moodTags : ["未标记"];
    meta.innerHTML = [
      `<span>${escapeHtml(memory.scope === "week" ? "本周" : "年度")}</span>`,
      `<span>强度 ${escapeHtml(memory.intensity)}</span>`,
      ...tags.map(tag => `<span>${escapeHtml(tag)}</span>`)
    ].join("");
  }

  function closeMemoryPaper() {
    const overlay = document.getElementById("memoryPaperOverlay");
    if (!overlay) return;
    clearFocusWithin(overlay);
    overlay.hidden = true;
    overlay.setAttribute("aria-hidden", "true");
    state.selectedId = "";
    syncActiveStarClass();
  }

  function openEditorForSelected() {
    const memory = findMemory(state.selectedId);
    if (!memory) return;
    closeMemoryPaper();
    openComposer(memory.scope, memory.id);
  }

  async function favoriteSelectedToYear() {
    const memory = findMemory(state.selectedId);
    if (!memory || memory.scope !== "week") return;
    const now = new Date().toISOString();
    const next = RiverStarStore.normalizeMemory({
      ...memory,
      scope: "year",
      position: undefined,
      visual: buildVisual(memory.moodTags, memory.intensity, "year"),
      status: { ...memory.status, favorite: true },
      updatedAt: now
    }, "year");
    state.memories = mergeMemoryIntoState(next);
    await persistMemories();
    renderAll();
    openMemoryPaper(next.id, document.querySelector(`[data-moment-id="${CSS.escape(next.id)}"]`));
  }

  function deleteSelectedWeeklyMoment() {
    const memory = findMemory(state.selectedId);
    if (!memory || memory.scope !== "week") return;
    deleteWeeklyMoment(memory.id);
  }

  function deleteWeeklyMoment(id) {
    const memory = findMemory(id);
    if (!memory) return;
    const planet = document.querySelector(`[data-moment-id="${CSS.escape(id)}"]`);

    const remove = async () => {
      updateMemoryStatus(id, { deleted: true });
      await persistMemories();
      renderAll();
      closeMemoryPaper();
    };

    const restore = async () => {
      updateMemoryStatus(id, { deleted: false });
      await persistMemories();
      renderAll();
    };

    if (window.PageMotion?.removeWithUndo) {
      PageMotion.removeWithUndo({
        key: `moment-weekly:${id}`,
        element: planet,
        label: memory.title || "本周星尘",
        remove,
        restore,
        timeoutMs: 2200
      });
      return;
    }

    remove();
  }

  async function hideSelectedYearMemory() {
    const memory = findMemory(state.selectedId);
    if (!memory || memory.scope !== "year") return;
    updateMemoryStatus(memory.id, { hidden: true });
    await persistMemories();
    closeYearDeleteDialog();
    closeMemoryPaper();
    renderAll();
    setBackupStatus("已暂时隐藏这颗年度星球");
  }

  async function archiveSelectedYearMemory() {
    const memory = findMemory(state.selectedId);
    if (!memory || memory.scope !== "year") return;
    updateMemoryStatus(memory.id, { archived: true });
    await persistMemories();
    closeMemoryPaper();
    renderAll();
    setBackupStatus("已归档这颗年度星球");
  }

  function requestYearDeleteConfirmation() {
    const dialog = document.getElementById("yearDeleteDialog");
    if (dialog?.showModal) dialog.showModal();
  }

  async function confirmDeleteSelectedYearMemory() {
    const memory = findMemory(state.selectedId);
    if (!memory || memory.scope !== "year") return;
    updateMemoryStatus(memory.id, { deleted: true });
    await persistMemories();
    closeYearDeleteDialog();
    closeMemoryPaper();
    renderAll();
    setBackupStatus("年度星球已删除");
  }

  function closeYearDeleteDialog() {
    const dialog = document.getElementById("yearDeleteDialog");
    if (dialog?.open) dialog.close();
  }

  function toggleHiddenFilter() {
    state.showHidden = !state.showHidden;
    setBackupStatus(state.showHidden ? "正在显示隐藏和归档星球" : "已回到普通星图");
    renderAll();
  }

  async function exportStarsBackup() {
    const payload = RiverStarStore.createExportPayload(state.memories);
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `river-star-map-${getTodayValue()}.json`;
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setBackupStatus("已导出 JSON 备份");
  }

  function importStarsBackup(event) {
    const input = event.target;
    const file = input.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const incoming = RiverStarStore.parseImportPayload(String(reader.result || ""));
        state.memories = RiverStarStore.mergeMemories(state.memories, incoming);
        await persistMemories();
        renderAll();
        setBackupStatus(`已导入 ${incoming.length} 条记录`);
      } catch (error) {
        setBackupStatus("导入失败：JSON 格式不对");
      } finally {
        input.value = "";
      }
    };
    reader.readAsText(file, "utf-8");
  }

  function bindComposerDrag() {
    const panel = document.getElementById("composerPanel");
    const handle = document.getElementById("composerDragHandle");
    if (!panel || !handle) return;

    handle.addEventListener("pointerdown", event => {
      if (event.target.closest("button")) return;
      const rect = panel.getBoundingClientRect();
      state.composerDrag = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        left: rect.left,
        top: rect.top
      };
      safeSetPointerCapture(handle, event.pointerId);
      event.preventDefault();
    });

    handle.addEventListener("pointermove", event => {
      const drag = state.composerDrag;
      if (!drag || drag.pointerId !== event.pointerId) return;
      panel.style.left = `${drag.left + event.clientX - drag.startX}px`;
      panel.style.top = `${drag.top + event.clientY - drag.startY}px`;
      constrainFloatingElement(panel);
    });

    const endDrag = event => {
      if (!state.composerDrag || state.composerDrag.pointerId !== event.pointerId) return;
      safeReleasePointerCapture(handle, event.pointerId);
      state.composerDrag = null;
    };
    handle.addEventListener("pointerup", endDrag);
    handle.addEventListener("pointercancel", endDrag);
  }

  function bindPlanetDrag() {
    const layer = document.getElementById("planetLayer");
    const stage = document.getElementById("cosmosStage");
    if (!layer || !stage) return;

    layer.addEventListener("pointerdown", event => {
      if (event.button !== 0) return;
      const planet = event.target instanceof Element ? event.target.closest(".memory-planet") : null;
      if (!(planet instanceof HTMLElement)) return;
      const memory = findMemory(planet.dataset.id);
      if (!memory) return;
      closeStarPreview();
      state.planetDrag = {
        pointerId: event.pointerId,
        id: memory.id,
        startX: event.clientX,
        startY: event.clientY,
        startPosition: { x: memory.position.x, y: memory.position.y },
        moved: false,
        planet
      };
      planet.classList.add("is-dragging");
      window.addEventListener("pointermove", handlePlanetMove);
      window.addEventListener("pointerup", endPlanetDrag);
      window.addEventListener("pointercancel", endPlanetDrag);
      event.preventDefault();
    });
  }

  function handlePlanetMove(event) {
    const drag = state.planetDrag;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const stage = document.getElementById("cosmosStage");
    const planet = drag.planet;
    if (!stage || !(planet instanceof HTMLElement)) return;

    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    if (!drag.moved && Math.sqrt(dx * dx + dy * dy) < DRAG_THRESHOLD) return;

    drag.moved = true;
    const rect = stage.getBoundingClientRect();
    const x = clamp(((drag.startPosition.x * rect.width) / 100 + dx) / rect.width * 100, 2, 98);
    const y = clamp(((drag.startPosition.y * rect.height) / 100 + dy) / rect.height * 100, 4, 96);
    planet.style.setProperty("--x", x.toFixed(2));
    planet.style.setProperty("--y", y.toFixed(2));
    drag.nextPosition = { x: Number(x.toFixed(2)), y: Number(y.toFixed(2)), z: 0 };
  }

  async function endPlanetDrag(event) {
    const drag = state.planetDrag;
    if (!drag || drag.pointerId !== event.pointerId) return;

    window.removeEventListener("pointermove", handlePlanetMove);
    window.removeEventListener("pointerup", endPlanetDrag);
    window.removeEventListener("pointercancel", endPlanetDrag);
    drag.planet?.classList.remove("is-dragging");
    state.planetDrag = null;

    if (!drag.moved || !drag.nextPosition) {
      state.suppressClickUntil = Date.now() + 250;
      openMemoryPaper(drag.id, drag.planet);
      return;
    }

    const memory = findMemory(drag.id);
    if (!memory) return;
    memory.position = { ...memory.position, ...drag.nextPosition };
    memory.updatedAt = new Date().toISOString();
    state.suppressClickUntil = Date.now() + 250;
    await persistMemories();
  }

  function toggleComposerExtra() {
    const extra = document.getElementById("composerExtraFields");
    setComposerExtraVisible(extra?.hidden);
  }

  function setComposerExtraVisible(visible) {
    const extra = document.getElementById("composerExtraFields");
    const toggle = document.getElementById("composerMoreToggle");
    if (extra) extra.hidden = !visible;
    if (toggle) {
      toggle.setAttribute("aria-expanded", visible ? "true" : "false");
      toggle.textContent = visible ? "收起星光参数" : "更多星光参数";
    }
  }

  function setMoodTagValues(tags) {
    const selected = new Set(tags || []);
    document.querySelectorAll("#composerMoodTags input[type='checkbox']").forEach(input => {
      input.checked = selected.has(input.value);
    });
  }

  function getSelectedMoodTags() {
    return Array.from(document.querySelectorAll("#composerMoodTags input[type='checkbox']:checked")).map(input => input.value);
  }

  function updateMemoryStatus(id, patch) {
    const memory = findMemory(id);
    if (!memory) return;
    memory.status = { ...memory.status, ...patch };
    memory.updatedAt = new Date().toISOString();
  }

  function mergeMemoryIntoState(memory) {
    return RiverStarStore.mergeMemories(state.memories.filter(item => item.id !== memory.id), [memory]);
  }

  async function persistMemories() {
    state.memories = await RiverStarStore.putMemories(state.memories);
  }

  function findMemory(id) {
    return state.memories.find(item => item.id === id);
  }

  function getCurrentWeekRange() {
    const today = new Date();
    const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const offset = (start.getDay() + 6) % 7;
    start.setDate(start.getDate() - offset);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return {
      start: toDateValue(start),
      end: toDateValue(end)
    };
  }

  function isCurrentWeek(date) {
    const range = getCurrentWeekRange();
    return date >= range.start && date <= range.end;
  }

  function getCurrentYear() {
    return new Date().getFullYear();
  }

  function initStarfieldCanvas() {
    const canvas = document.getElementById("starfieldCanvas");
    const stage = document.getElementById("cosmosStage");
    if (!(canvas instanceof HTMLCanvasElement) || !stage) return;

    const context = canvas.getContext("2d");
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (!context) return;

    const resize = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.floor(width * ratio));
      canvas.height = Math.max(1, Math.floor(height * ratio));
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      createStarfield(width, height);
      drawStarfield(context, width, height, 0);
    };

    const animate = timestamp => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      drawStarfield(context, width, height, reduceMotion.matches ? 0 : timestamp / 1000);
      if (!reduceMotion.matches) state.starAnimation = requestAnimationFrame(animate);
    };

    resize();
    window.addEventListener("resize", resize);
    if (!reduceMotion.matches) state.starAnimation = requestAnimationFrame(animate);
  }

  function createStarfield(width, height) {
    const area = width * height;
    const starCount = Math.min(360, Math.max(140, Math.floor(area * STAR_DENSITY)));
    const dustCount = Math.min(80, Math.max(30, Math.floor(area * DUST_DENSITY)));

    state.stars = Array.from({ length: starCount }, () => {
      const z = Math.random();
      return {
        x: Math.random() * width,
        y: Math.random() * height,
        z,
        radius: 0.3 + Math.random() * 1.4 * (0.4 + z * 0.6),
        baseAlpha: 0.18 + Math.random() * 0.5,
        twinkle: Math.random() * Math.PI * 2,
        vx: (Math.random() - 0.5) * 0.012,
        vy: (Math.random() - 0.5) * 0.012,
        hue: 200 + Math.random() * 60
      };
    });

    state.dust = Array.from({ length: dustCount }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.05,
      vy: -0.02 - Math.random() * 0.06,
      radius: 0.5 + Math.random() * 1.4,
      alpha: 0.05 + Math.random() * 0.15
    }));
  }

  function drawStarfield(context, width, height, time) {
    state.mouse.x += (state.mouse.tx - state.mouse.x) * 0.04;
    state.mouse.y += (state.mouse.ty - state.mouse.y) * 0.04;
    const mx = state.mouse.x;
    const my = state.mouse.y;

    context.clearRect(0, 0, width, height);
    const gradient = context.createRadialGradient(width * 0.5, height * 0.5, 0, width * 0.5, height * 0.5, Math.max(width, height) * 0.7);
    gradient.addColorStop(0, "rgba(20, 22, 50, 0)");
    gradient.addColorStop(0.6, "rgba(8, 9, 22, 0)");
    gradient.addColorStop(1, "rgba(0, 0, 0, 0.55)");
    context.fillStyle = gradient;
    context.fillRect(0, 0, width, height);

    state.stars.forEach(star => {
      star.x += star.vx;
      star.y += star.vy;
      if (star.x < -10) star.x = width + 10;
      if (star.x > width + 10) star.x = -10;
      if (star.y < -10) star.y = height + 10;
      if (star.y > height + 10) star.y = -10;

      const parallaxX = mx * (1 - star.z) * 24;
      const parallaxY = my * (1 - star.z) * 24;
      const flicker = 0.5 + 0.5 * Math.sin(star.twinkle + time * (0.6 + star.z));
      const alpha = star.baseAlpha * (0.55 + 0.45 * flicker);
      const cx = star.x + parallaxX;
      const cy = star.y + parallaxY;
      const radius = star.radius * (0.9 + 0.4 * flicker);
      const glow = context.createRadialGradient(cx, cy, 0, cx, cy, radius * 6);
      glow.addColorStop(0, `hsla(${star.hue}, 85%, 92%, ${alpha})`);
      glow.addColorStop(0.4, `hsla(${star.hue}, 70%, 75%, ${alpha * 0.25})`);
      glow.addColorStop(1, `hsla(${star.hue}, 50%, 40%, 0)`);
      context.fillStyle = glow;
      context.beginPath();
      context.arc(cx, cy, radius * 6, 0, Math.PI * 2);
      context.fill();

      context.fillStyle = `hsla(${star.hue}, 100%, 96%, ${Math.min(1, alpha * 1.4)})`;
      context.beginPath();
      context.arc(cx, cy, radius, 0, Math.PI * 2);
      context.fill();
    });

    context.globalCompositeOperation = "lighter";
    state.dust.forEach(dust => {
      dust.x += dust.vx + mx * 0.05;
      dust.y += dust.vy + my * 0.04;
      if (dust.y < -10) {
        dust.y = height + 10;
        dust.x = Math.random() * width;
      }
      if (dust.x < -20) dust.x = width + 20;
      if (dust.x > width + 20) dust.x = -20;

      const glow = context.createRadialGradient(dust.x, dust.y, 0, dust.x, dust.y, dust.radius * 14);
      glow.addColorStop(0, `rgba(220, 230, 255, ${dust.alpha})`);
      glow.addColorStop(1, "rgba(220, 230, 255, 0)");
      context.fillStyle = glow;
      context.beginPath();
      context.arc(dust.x, dust.y, dust.radius * 14, 0, Math.PI * 2);
      context.fill();
    });
    context.globalCompositeOperation = "source-over";
  }

  function constrainFloatingElement(element) {
    if (!(element instanceof HTMLElement) || element.closest("[hidden]")) return;
    const rect = element.getBoundingClientRect();
    const nextLeft = clamp(rect.left, 10, Math.max(10, window.innerWidth - rect.width - 10));
    const nextTop = clamp(rect.top, 74, Math.max(74, window.innerHeight - Math.min(rect.height, window.innerHeight - 88) - 10));
    element.style.left = `${nextLeft}px`;
    element.style.top = `${nextTop}px`;
  }

  function setBackupStatus(value) {
    setText("backupStatus", value);
  }

  function readLegacyFallback() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    } catch (error) {
      return null;
    }
  }

  function compareMemories(a, b) {
    const dateDiff = (b.date || "").localeCompare(a.date || "");
    if (dateDiff !== 0) return dateDiff;
    return (b.updatedAt || "").localeCompare(a.updatedAt || "");
  }

  function getMomentPreview(memory) {
    const text = toText(memory.content || memory.title);
    if (!text) return "这颗星还没有写下细节。";
    const flattened = text.replace(/\s+/g, " ");
    return flattened.length > 46 ? `${flattened.slice(0, 46)}…` : flattened;
  }

  function deriveMomentTitle(content) {
    return RiverStarStore.deriveMomentTitle(content);
  }

  function buildVisual(tags, intensity, scope) {
    return RiverStarStore.buildVisual(tags, intensity, scope);
  }

  function sizeLevelToPx(level, scope) {
    return RiverStarStore.sizeLevelToPx(level, scope);
  }

  function scopeToOrbitSpeed(scope, intensity) {
    return RiverStarStore.scopeToOrbitSpeed(scope, intensity);
  }

  function themeById(id) {
    return RiverStarStore.themeById(id);
  }

  function hashString(value) {
    return RiverStarStore.hashString(value);
  }

  function createId(prefix) {
    return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
  }

  function getTodayValue() {
    return RiverStarStore.getTodayValue();
  }

  function toDateValue(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function normalizeDateValue(value) {
    const text = toText(value);
    return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : "";
  }

  function formatDateLabel(value) {
    const normalized = normalizeDateValue(value);
    if (!normalized) return "未知日期";
    const [year, month, day] = normalized.split("-").map(Number);
    return `${year}.${String(month).padStart(2, "0")}.${String(day).padStart(2, "0")}`;
  }

  function formatShortDate(value) {
    const normalized = normalizeDateValue(value);
    if (!normalized) return "--.--";
    return normalized.slice(5).replace("-", ".");
  }

  function getValue(id) {
    return document.getElementById(id)?.value ?? "";
  }

  function setValue(id, value) {
    const element = document.getElementById(id);
    if (element) element.value = value ?? "";
  }

  function setText(id, value) {
    const element = document.getElementById(id);
    if (element) element.textContent = String(value ?? "");
  }

  function setHidden(id, hidden) {
    const element = document.getElementById(id);
    if (!element) return;
    if (hidden) clearFocusWithin(element);
    element.hidden = hidden;
  }

  function clearFocusWithin(element) {
    const active = document.activeElement;
    if (active instanceof HTMLElement && element.contains(active)) active.blur();
  }

  function safeSetPointerCapture(element, pointerId) {
    try {
      if (typeof element.setPointerCapture === "function") element.setPointerCapture(pointerId);
    } catch (error) {
      // Synthetic pointer events in browser checks can miss the active pointer; dragging still works without capture.
    }
  }

  function safeReleasePointerCapture(element, pointerId) {
    try {
      if (typeof element.hasPointerCapture === "function" && element.hasPointerCapture(pointerId)) {
        element.releasePointerCapture(pointerId);
      }
    } catch (error) {
      // Ignore stale capture state from cancelled or synthetic pointer events.
    }
  }

  function toText(value) {
    return String(value ?? "").trim();
  }

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function escapeAttribute(value) {
    return escapeHtml(value);
  }

  return { init };
})();

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => MomentsApp.init(), { once: true });
} else {
  MomentsApp.init();
}
