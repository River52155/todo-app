const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT_DIR = path.resolve(__dirname, '..');

function readFile(relativePath) {
  return fs.readFileSync(path.join(ROOT_DIR, relativePath), 'utf8');
}

const H5_NAV_PAGES = [
  ['index.html', '每日计划'],
  ['recent.html', '近期计划'],
  ['goals.html', '长期目标'],
  ['budget.html', '月度花销'],
  ['expenses.html', '消费记录'],
  ['freedom.html', '自由天数'],
  ['moments.html', '回顾时刻']
];

test('h5 pages use the shared top navigation outside the hero header', () => {
  H5_NAV_PAGES.forEach(([page, activeLabel]) => {
    const html = readFile(page);
    const topNavIndex = html.indexOf('class="site-top-nav"');
    const headerIndex = html.indexOf('<header');
    const heroIndex = html.indexOf('class="hero-section"');
    const mainIndex = html.indexOf('<main');
    const firstContentIndex = [headerIndex, heroIndex, mainIndex]
      .filter(index => index !== -1)
      .sort((a, b) => a - b)[0] ?? -1;

    assert.notEqual(topNavIndex, -1, `${page} should have shared top navigation`);
    assert.notEqual(firstContentIndex, -1, `${page} should have a main content entry`);
    assert.equal(topNavIndex < firstContentIndex, true, `${page} navigation should sit before the first content entry`);
    assert.equal(html.includes('styles/page-nav.css'), true, `${page} should load shared nav styles`);
    assert.equal(html.includes('rel="preload" as="image" href="assets/bg.png"'), true, `${page} should preload the shared background image`);
    assert.equal(html.includes('<nav class="page-nav"'), false, `${page} should not keep the old embedded page nav`);
    assert.match(html, new RegExp(`<a class="nav-link active"[^>]*>${activeLabel}</a>`), `${page} should mark the right page active`);
  });
});

test('expenses page moves automatic statistics into the top overview and merges category entry with quick-add', () => {
  const html = readFile('expenses.html');
  const statsIndex = html.indexOf('id="stats"');
  const expenseFormIndex = html.indexOf('id="expenseForm"');
  const analysisIndex = html.indexOf('expense-analysis-panel');
  const recordsIndex = html.indexOf('id="recordsList"');
  const categoryFormIndex = html.indexOf('id="categoryForm"');

  assert.notEqual(statsIndex, -1, 'top statistics anchor should exist');
  assert.notEqual(expenseFormIndex, -1, 'expense form should exist');
  assert.notEqual(analysisIndex, -1, 'merged analysis panel should exist');
  assert.notEqual(recordsIndex, -1, 'records list should exist');
  assert.notEqual(categoryFormIndex, -1, 'category form should exist');
  assert.equal(html.includes('forecast-section'), false);
  assert.equal(html.includes('<section id="stats"'), false, 'automatic stats should not remain a standalone section');
  assert.equal(statsIndex < expenseFormIndex, true, 'statistics should be above quick-add');
  assert.equal(categoryFormIndex > expenseFormIndex, true, 'category form should live in the quick-add workspace');
  assert.equal(categoryFormIndex < analysisIndex, true, 'category form should appear before the analysis workspace');
});

test('expenses page provides compact jump navigation for the main work areas', () => {
  const html = readFile('expenses.html');
  const css = readFile('styles/expenses.css');
  const navIndex = html.indexOf('section-jump-nav');
  const headerEndIndex = html.indexOf('</header>');
  const quickEntryIndex = html.indexOf('id="quick-entry"');

  assert.notEqual(navIndex, -1, 'section jump navigation should exist');
  assert.notEqual(quickEntryIndex, -1, 'quick entry anchor should exist');
  assert.notEqual(headerEndIndex, -1, 'page header should exist');
  assert.equal(html.includes('section-jump-nav--compact'), true, 'jump navigation should use the compact variant');
  assert.equal(html.includes('消费记录目录'), false, 'old large directory title should be removed');
  assert.equal(headerEndIndex < navIndex, true, 'jump navigation should appear after the hero header');
  assert.equal(navIndex < quickEntryIndex, true, 'jump navigation should appear before the first target');
  assert.equal(css.includes('position: sticky'), false, 'jump navigation should not be sticky');

  [
    'stats',
    'range',
    'quick-entry',
    'records'
  ].forEach(anchor => {
    assert.equal(html.includes(`href="#${anchor}"`), true, `${anchor} jump link should exist`);
  });

  [
    'stats',
    'quick-entry',
    'range',
    'category-analysis',
    'trend',
    'category-manager',
    'records'
  ].forEach(anchor => {
    assert.equal(html.includes(`id="${anchor}"`), true, `${anchor} target should exist`);
  });
});

test('expenses page keeps category square details above the trend chart in the analysis panel', () => {
  const html = readFile('expenses.html');
  const css = readFile('styles/expenses.css');
  const analysisIndex = html.indexOf('expense-analysis-panel');
  const rangeTabsIndex = html.indexOf('id="rangeTabs"');
  const categoryIndex = html.indexOf('id="category-analysis"');
  const trendIndex = html.indexOf('id="trend"');
  const recordsIndex = html.indexOf('id="records"');

  assert.notEqual(analysisIndex, -1, 'analysis panel should exist');
  assert.notEqual(rangeTabsIndex, -1, 'range tabs should exist');
  assert.notEqual(categoryIndex, -1, 'category analysis anchor should exist');
  assert.notEqual(trendIndex, -1, 'trend anchor should exist');
  assert.equal(analysisIndex < rangeTabsIndex, true);
  assert.equal(rangeTabsIndex < categoryIndex, true);
  assert.equal(categoryIndex < trendIndex, true);
  assert.equal(trendIndex < recordsIndex, true);
  assert.equal(css.includes('.category-legend {\n  display: grid;'), true);
  assert.equal(css.includes('grid-template-columns: repeat(auto-fit, minmax(128px, 1fr));'), true);
  assert.equal(css.includes('.category-item {\n  min-height: 112px;'), true);
  assert.equal(css.includes('.analysis-trend {\n  margin-top: 18px;'), true);
});

test('expenses page provides monthly day-card records view containers', () => {
  const html = readFile('expenses.html');
  const script = readFile('scripts/expenses.js');

  [
    'id="recordsMonthInput"',
    'id="recordsPrevMonth"',
    'id="recordsNextMonth"',
    'id="recordsMonthTotal"',
    'id="recordsMonthCount"',
    'id="recordsActiveDays"',
    'id="recordsMonthGrid"',
    'id="recordsDayDetail"',
    'id="recordsList"'
  ].forEach(marker => {
    assert.equal(html.includes(marker), true, `${marker} should exist`);
  });

  assert.equal(script.includes('selectedRecordsMonth'), true);
  assert.equal(script.includes('selectedRecordDate'), true);
  assert.equal(script.includes('function buildRecordsMonthView'), true);
  assert.equal(script.includes('function renderRecordsMonthView'), true);
  assert.equal(script.includes('function renderDayRecords'), true);
});

test('expenses trend chart uses range-specific views without jumpy shell swaps', () => {
  const script = readFile('scripts/expenses.js');
  const css = readFile('styles/expenses.css');
  const html = readFile('expenses.html');
  const mobileCss = css.slice(css.indexOf('@media (max-width: 720px)'));

  assert.equal(script.includes('function buildTrendView'), true);
  assert.equal(script.includes('layout: "month-squares"'), true);
  assert.equal(script.includes('expenseRole'), true);
  assert.equal(script.includes('function renderRoleAnalysis'), true);
  assert.equal(script.includes('function renderTrendYearOverview'), true);
  assert.equal(script.includes('animateSwap(document.getElementById("trendChartShell")'), false);
  assert.equal(html.includes('name="expenseRoleInput"'), true);
  assert.equal(html.includes('id="role-analysis"'), true);
  assert.equal(css.includes('.trend-chart-shell--year'), true);
  assert.equal(css.includes('.expense-role-toggle'), true);
  assert.equal(css.includes('.role-analysis-panel'), true);
  assert.equal(css.includes('.trend-year-grid'), true);
  assert.equal(css.includes('.trend-year-cell'), true);
  assert.equal(css.includes('.trend-grid--day'), true);
  assert.equal(css.includes('--trend-shell-height: 210px;'), true);
  assert.equal(css.includes('@media (min-width: 721px)'), true);
  assert.equal(css.includes('.trend-grid--month .trend-value {\n    display: none;'), true);
  assert.equal(css.includes('grid-template-columns: repeat(3, minmax(0, 1fr));'), true);
  assert.equal(html.includes('<link rel="icon" href="data:," />'), true);
  assert.equal(mobileCss.includes('.range-tabs,\n  .analysis-header .range-tabs'), true);
  assert.equal(mobileCss.includes('.range-tab {\n    flex: 0 0 auto;'), true);
  assert.equal(mobileCss.includes('--trend-shell-height: 168px;'), true);
  assert.equal(mobileCss.includes('.trend-grid--month .trend-value'), true);
  assert.equal(/\.nav-link,\s*\.range-tab,[\s\S]*?width:\s*100%;/.test(css), false);
});

test('expense visual page exports records with a Saul Bass inspired poster layout', () => {
  const html = readFile('expense-visual.html');
  const css = readFile('styles/expense-visual.css');
  const script = readFile('scripts/expense-visual.js');
  const expensesHtml = readFile('expenses.html');

  assert.equal(html.includes('styles/page-nav.css'), true);
  assert.equal(html.includes('styles/motion.css'), true);
  assert.equal(html.includes('styles/expense-visual.css'), true);
  assert.equal(html.includes('scripts/motion.js'), true);
  assert.equal(html.includes('scripts/expense-role.js'), true);
  assert.equal(html.includes('scripts/expense-visual.js'), true);
  assert.match(html, /<a class="nav-link active"[^>]*>消费记录<\/a>/);

  [
    'id="expenseVisualApp"',
    'id="visualRangeSelect"',
    'id="visualMonthInput"',
    'id="exportExpenseJson"',
    'id="exportExpenseCsv"',
    'id="exportExpenseHtml"',
    'id="printExpenseReport"',
    'id="clearCategoryFocus"',
    'id="insightLead"',
    'id="insightTempo"',
    'id="insightAdvice"',
    'id="insightRisk"',
    'id="bassRoleSummary"',
    'id="bassRoleCuts"',
    'id="categoryFocusLabel"',
    'id="bassCategoryBlocks"',
    'id="bassTimeline"',
    'id="bassLargestRecord"',
    'id="bassRecordTable"'
  ].forEach(marker => {
    assert.equal(html.includes(marker), true, `${marker} should exist`);
  });

  assert.equal(expensesHtml.includes('href="expense-visual.html"'), true);
  assert.equal(script.includes('const STORAGE_KEY = "expenseTracker:v1";'), true);
  assert.equal(script.includes('expenseRole'), true);
  assert.equal(script.includes('function renderRoleCuts'), true);
  assert.equal(script.includes('function exportExpenseRecords'), true);
  assert.equal(script.includes('function exportHtmlReport'), true);
  assert.equal(script.includes('function buildInsights'), true);
  assert.equal(script.includes('function createAdvice'), true);
  assert.equal(script.includes('function renderInsights'), true);
  assert.equal(script.includes('function renderFocusState'), true);
  assert.equal(script.includes('function getVisibleRecords'), true);
  assert.equal(script.includes('function buildCsv'), true);
  assert.equal(script.includes('downloadFile(`river-expenses-${getExportSuffix()}.json`'), true);
  assert.equal(script.includes('downloadFile(`river-expenses-${getExportSuffix()}.csv`'), true);
  assert.equal(script.includes('river-expenses-${getExportSuffix()}-report.html'), true);
  assert.equal(script.includes('window.print()'), true);
  assert.equal(script.includes('data-category-id'), true);
  assert.equal(script.includes('function buildCategoryBreakdown'), true);
  assert.equal(script.includes('function buildMonthlyTimeline'), true);
  assert.equal(script.includes('function buildDailyTimeline'), true);
  assert.equal(css.includes('.poster-hero'), true);
  assert.equal(css.includes('.paper-cut--red'), true);
  assert.equal(css.includes('.insight-marquee'), true);
  assert.equal(css.includes('.insight-card'), true);
  assert.equal(css.includes('.role-poster'), true);
  assert.equal(css.includes('.role-cut'), true);
  assert.equal(css.includes('.category-cut'), true);
  assert.equal(css.includes('.category-cut.is-active'), true);
  assert.equal(css.includes('.month-cut'), true);
  assert.equal(css.includes('clip-path: polygon'), true);
  assert.equal(css.includes('@media print'), true);
  assert.equal(css.includes('@media (max-width: 760px)'), true);
});

test('freedom page turns idle funds into freedom-day blocks', () => {
  const html = readFile('freedom.html');
  const css = readFile('styles/freedom.css');
  const script = readFile('scripts/freedom.js');
  const store = readFile('scripts/freedom-store.js');
  const expensesHtml = readFile('expenses.html');

  assert.equal(html.includes('styles/page-nav.css'), true);
  assert.equal(html.includes('styles/motion.css'), true);
  assert.equal(html.includes('styles/freedom.css'), true);
  assert.equal(html.includes('scripts/expense-role.js'), false);
  assert.equal(html.includes('scripts/freedom-store.js'), true);
  assert.equal(html.includes('scripts/freedom.js'), true);
  assert.match(html, /<a class="nav-link active"[^>]*>自由天数<\/a>/);
  assert.equal(expensesHtml.includes('href="freedom.html"'), true);
  assert.equal(html.includes('看清一笔闲钱'), false);
  assert.equal(html.includes('Freedom days'), false);

  [
    'id="freedomApp"',
    'id="freeDaysText"',
    'id="nextDayGapText"',
    'id="dailyNeedInput"',
    'id="freedomEntryForm"',
    'id="freedomAmountInput"',
    'id="freedomNoteInput"',
    'id="addFundButton"',
    'id="spendFundButton"',
    'value="fund"',
    'value="spend"',
    'id="freedomGridCanvas"',
    'id="freedomEntryList"'
  ].forEach(marker => {
    assert.equal(html.includes(marker), true, `${marker} should exist`);
  });

  [
    'id="useDailySuggestion"',
    'name="freedomEntryType"',
    'id="freedomDateInput"',
    'class="freedom-hero"'
  ].forEach(marker => {
    assert.equal(html.includes(marker), false, `${marker} should be removed`);
  });

  assert.equal(store.includes('const STORAGE_KEY = "riverFreedom:v1";'), true);
  assert.equal(store.includes('function buildFreedomView'), true);
  assert.equal(store.includes('function buildDailyNeedSuggestion'), true);
  assert.equal(store.includes('throw new Error("这笔花费超过了当前闲置资金")'), true);
  assert.equal(script.includes('function drawGrid'), true);
  assert.equal(script.includes('function calculateVisibleDays'), true);
  assert.equal(script.includes('function buildNextDayGapText'), true);
  assert.equal(script.includes('getValue("freedomNoteInput")'), true);
  assert.equal(script.includes('function readCssPixels'), true);
  assert.equal(script.includes('gapX'), true);
  assert.equal(script.includes('FreedomStore.upsertEntry'), true);
  assert.equal(script.includes('FreedomStore.buildDailyNeedSuggestion'), false);
  assert.equal(script.includes('rgba(255, 255, 255, 0.12)'), true);
  assert.equal(script.includes('#fcd34d'), true);
  assert.equal(css.includes('.freedom-core'), true);
  assert.equal(css.includes('#freedomGridCanvas'), true);
  assert.equal(css.includes('.freedom-action-buttons'), true);
  assert.equal(css.includes('.freedom-field--note'), true);
  assert.equal(css.includes('min-height: clamp(230px, 24vw, 320px)'), true);
  assert.equal(css.includes('.freedom-legend'), true);
  assert.equal(css.includes('.freedom-hero'), false);
  assert.equal(css.includes('.freedom-segment'), false);
  assert.equal(css.includes('@media (max-width: 760px)'), true);
});

test('page motion smooths and prefetches top-level page navigation', () => {
  const motion = readFile('scripts/motion.js');
  const css = readFile('styles/motion.css');
  const navCss = readFile('styles/page-nav.css');

  assert.equal(motion.includes('function navigateWithTransition(href, options = {})'), true);
  assert.equal(motion.includes('bindNavigationPrefetch'), true);
  assert.equal(motion.includes('scheduleNavigationPrefetch'), true);
  assert.equal(motion.includes('prepareLayeredEntrance'), true);
  assert.equal(motion.includes('markMotionItems'), true);
  assert.equal(motion.includes('link.rel = "prefetch"'), true);
  assert.equal(motion.includes('isTopNavigation'), true);
  assert.equal(css.includes('--motion-top-nav-leave: 90ms;'), true);
  assert.equal(css.includes('--motion-stage-pop: 420ms;'), true);
  assert.equal(css.includes('body:not(.page-ready) [data-motion-stage]'), true);
  assert.equal(css.includes('translate3d(0, -16px, 0) scale(0.992)'), true);
  assert.equal(css.includes('html.motion-reduce body'), true);
  assert.equal(navCss.includes('--river-surface'), true);
  assert.equal(navCss.includes('--river-blue'), true);
  assert.equal(navCss.includes('body:not(.bass-ledger-page):not(.river-star-page) :where(input, textarea, select):focus'), true);
});

test('moments page presents records as a single immersive planet cosmos', () => {
  const html = readFile('moments.html');
  const script = readFile('scripts/moments.js');
  const css = readFile('styles/moments.css');

  assert.equal(html.includes('styles/moments.css'), true);
  assert.equal(html.includes('styles/page-nav.css'), true);
  assert.equal(html.includes('styles/motion.css'), true);
  assert.equal(html.includes('scripts/motion.js'), true);
  assert.equal(html.includes('scripts/moments-store.js'), true);
  assert.equal(html.includes('scripts/moments.js'), true);
  assert.match(html, /<a class="nav-link active"[^>]*>回顾时刻<\/a>/);

  [
    'id="starControlLayer"',
    'id="cosmosStage"',
    'id="planetLayer"',
    'id="createWeeklyMoment"',
    'id="createYearlyMoment"',
    'id="weeklyDustCount"',
    'id="yearlyDustCount"',
    'id="exportStarsButton"',
    'id="importStarsButton"',
    'id="importStarsInput"',
    'id="starPreviewCard"',
    'id="floatingComposer"',
    'id="composerPanel"',
    'id="composerTextarea"',
    'id="composerType"',
    'id="composerEditingId"',
    'id="composerMoreToggle"',
    'id="composerExtraFields"',
    'id="composerTitle"',
    'id="composerDate"',
    'id="composerScope"',
    'id="composerMoodTags"',
    'id="composerIntensity"',
    'id="memoryPaperOverlay"',
    'id="memoryPaper"',
    'id="favoriteToYear"',
    'id="popoverHideYear"',
    'id="popoverArchiveYear"',
    'id="popoverYearDeleteRequest"',
    'id="yearDeleteDialog"'
  ].forEach(marker => {
    assert.equal(html.includes(marker), true, `${marker} should exist`);
  });

  [
    'id="weeklyUniverse"',
    'id="yearlyUniverse"',
    'id="momentSheet"',
    'id="sheetBackdrop"',
    'id="sheetMomentDate"',
    'id="sheetMomentMood"',
    'class="universe-panel"',
    '本周的小星球',
    '今年的大星球'
  ].forEach(marker => {
    assert.equal(html.includes(marker), false, `${marker} should be removed`);
  });

  assert.equal(html.includes('class="page-header'), false);
  assert.equal(html.includes('class="hero'), false);
  assert.equal(html.includes('class="moment-form"'), false);
  assert.equal(html.includes('id="centralPlanet"'), false);
  assert.equal(html.includes('RIVER 星图'), true);
  assert.equal(html.includes('href="expenses.html">返回消费</a>'), true);
  assert.equal(html.includes('投放星星'), true);
  assert.equal(html.includes('导出'), true);
  assert.equal(html.includes('导入'), true);
  assert.equal(html.includes('这是一颗年度星球'), true);
  assert.equal(readFile('scripts/moments-store.js').includes('const DB_NAME = "riverStarMap";'), true);
  assert.equal(readFile('scripts/moments-store.js').includes('const STORE_NAME = "memories";'), true);
  assert.equal(readFile('scripts/moments-store.js').includes('const LEGACY_STORAGE_KEY = "lifeMoments:v1";'), true);
  assert.equal(readFile('scripts/moments-store.js').includes('function migrateLegacyStore'), true);
  assert.equal(readFile('scripts/moments-store.js').includes('function createExportPayload'), true);
  assert.equal(readFile('scripts/moments-store.js').includes('function parseImportPayload'), true);
  assert.equal(readFile('scripts/moments-store.js').includes('function mergeMemories'), true);
  assert.equal(readFile('scripts/moments-store.js').includes('function buildVisual'), true);
  assert.equal(readFile('scripts/moments-store.js').includes('function sizeLevelToPx'), true);
  assert.equal(readFile('scripts/moments-store.js').includes('function scopeToOrbitSpeed'), true);
  assert.equal(script.includes('const PLANET_LIBRARY ='), false);
  assert.equal(script.includes('function renderUniverse'), true);
  assert.equal(script.includes('function renderPlanet'), true);
  assert.equal(script.includes('function getPlanetLayout'), true);
  assert.equal(script.includes('function themeById'), true);
  assert.equal(script.includes('function buildVisual'), true);
  assert.equal(script.includes('function sizeLevelToPx'), true);
  assert.equal(script.includes('function scopeToOrbitSpeed'), true);
  assert.equal(script.includes('function hashString'), true);
  assert.equal(script.includes('function deriveMomentTitle'), true);
  assert.equal(script.includes('function bindComposerDrag'), true);
  assert.equal(script.includes('function bindPlanetDrag'), true);
  assert.equal(script.includes('function handlePlanetMove'), true);
  assert.equal(script.includes('function endPlanetDrag'), true);
  assert.equal(script.includes('function openStarPreview'), true);
  assert.equal(script.includes('function closeStarPreview'), true);
  assert.equal(script.includes('function openMemoryPaper'), true);
  assert.equal(script.includes('function favoriteSelectedToYear'), true);
  assert.equal(script.includes('function requestYearDeleteConfirmation'), true);
  assert.equal(script.includes('function hideSelectedYearMemory'), true);
  assert.equal(script.includes('function archiveSelectedYearMemory'), true);
  assert.equal(script.includes('function exportStarsBackup'), true);
  assert.equal(script.includes('function importStarsBackup'), true);
  assert.equal(script.includes('data-action="open-planet"'), true);
  assert.equal(script.includes('data-action="delete-weekly"'), true);
  assert.equal(script.includes('delete-yearly'), false);
  assert.equal(script.includes('function getCurrentWeekRange'), true);
  assert.equal(script.includes('function getCurrentYear'), true);
  assert.equal(css.includes('.cosmos-stage'), true);
  assert.equal(css.includes('.star-control-layer'), true);
  assert.equal(css.includes('.zone-tint-week'), true);
  assert.equal(css.includes('.zone-tint-year'), true);
  assert.equal(css.includes('.planet-layer'), true);
  assert.equal(css.includes('.memory-planet'), true);
  assert.equal(css.includes('.planet-layer.has-active-star'), true);
  assert.equal(css.includes('.star-core'), true);
  assert.equal(css.includes('.star-halo'), true);
  assert.equal(css.includes('.orbit-ring'), true);
  assert.equal(css.includes('background-image: var(--planet-image);'), false);
  assert.equal(css.includes('.star-preview-card'), true);
  assert.equal(css.includes('.floating-composer'), true);
  assert.equal(css.includes('.add-memory-panel'), true);
  assert.equal(css.includes('.composer-extra'), true);
  assert.equal(css.includes('.memory-paper-overlay'), true);
  assert.equal(css.includes('.memory-paper'), true);
  assert.equal(css.includes('.paper-bg'), true);
  assert.equal(css.includes('.year-delete-dialog'), true);
  assert.equal(css.includes('@keyframes star-drift'), true);
  assert.equal(css.includes('@keyframes paper-float'), true);
  assert.equal(css.includes('prefers-reduced-motion: reduce'), true);
  assert.equal(css.includes('backdrop-filter: blur'), false);
});

test('budget page loads the monthly planning scripts', () => {
  const html = readFile('budget.html');

  assert.equal(html.includes('scripts/budget-store.js'), true);
  assert.equal(html.includes('scripts/budget.js'), true);
});

test('budget page uses the same background treatment as the other H5 pages', () => {
  const css = readFile('styles/budget.css');

  assert.equal(css.includes('background: url("../assets/bg.png") no-repeat center center fixed;'), true);
  assert.equal(css.includes('body::after'), true);
  assert.equal(css.includes('z-index: -1;'), true);
});

test('index page uses the motivational hero copy with a bundled dreamy font and no subtitle period', () => {
  const html = readFile('index.html');

  assert.equal(html.includes('每日任务清单'), false);
  assert.equal(html.includes('我现在的努力，是为了去体验更好的事物'), true);
  assert.equal(html.includes('去用英语交流，去痛快地哭，去体验偏执而真诚的爱，也去靠近那些我真正想要的人生片刻'), true);
  assert.equal(html.includes('片刻。'), false);
  assert.equal(html.includes('@font-face'), true);
  assert.equal(html.includes('font-family: "Ma Shan Zheng";'), true);
  assert.equal(html.includes('src: url("assets/fonts/MaShanZheng-Regular.ttf") format("truetype");'), true);
  assert.equal(html.includes('font-family: "Ma Shan Zheng", "STKaiti", "KaiTi", "Kaiti SC", "Noto Serif SC", serif;'), true);
  assert.equal(html.includes('class="hero-copy"'), true);
  assert.equal(html.includes('class="site-top-nav"'), true);
  assert.equal(html.includes('class="hero-nav-shell"'), false);
  assert.equal(html.includes('hero-eyebrow'), false);
  assert.equal(html.includes('id="taskInput"'), true);
  assert.equal(html.includes('id="totalTasks"'), true);
  assert.equal(html.includes('id="taskList"'), true);
});

test('index page wires the hero headline rotator with a single passion toggle control', () => {
  const html = readFile('index.html');

  assert.equal(html.includes('\u6211\u73b0\u5728\u7684\u52aa\u529b\uff0c\u662f\u4e3a\u4e86\u53bb\u4f53\u9a8c\u66f4\u597d\u7684\u4e8b\u7269'), true);
  assert.equal(html.includes('\u7ba1\u4e0d\u597d\u4e8b\uff0c\u5c31\u8981\u88ab\u4e8b\u7ba1'), true);
  assert.equal(html.includes('class="hero-title-rotator"'), true);
  assert.equal(html.includes('class="hero-rotator-dots"'), false);
  assert.equal(html.includes('class="hero-rotator-toggle"'), true);
  assert.equal(html.includes('passion'), true);
  assert.equal(html.includes('const heroSlides = ['), true);
  assert.equal(html.includes('startHeroRotation'), true);
  assert.equal(html.includes('toggleHeroSlide'), true);
});

test('index page provides a search bar that filters tasks and history', () => {
  const html = readFile('index.html');

  assert.equal(html.includes('id="taskSearchBar"'), true);
  assert.equal(html.includes('id="taskSearchInput"'), true);
  assert.equal(html.includes('placeholder="搜索任务、地点或任务类型"'), true);
  assert.equal(html.includes('id="taskSearchClear"'), true);
  assert.equal(html.includes('let currentSearchTerm = "";'), true);
  assert.equal(html.includes('function handleSearchInput(event)'), true);
  assert.equal(html.includes('function clearSearch()'), true);
  assert.equal(html.includes('.filter(matchesCurrentSearch)'), true);
});

test('index page loads tasks defensively from local storage', () => {
  const html = readFile('index.html');

  assert.equal(html.includes('const TASKS_STORAGE_KEY = "tasks";'), true);
  assert.equal(html.includes('let tasks = loadTasks();'), true);
  assert.equal(html.includes('function loadTasks()'), true);
  assert.equal(html.includes('function normalizeTask(task)'), true);
  assert.equal(html.includes('console.warn("任务数据读取失败，已使用空列表。", error);'), true);
  assert.equal(html.includes('JSON.parse(localStorage.getItem("tasks"))'), false);
});

test('index page labels the daily task form controls', () => {
  const html = readFile('index.html');

  [
    'for="taskInput"',
    'for="dateInput"',
    'for="timeInput"',
    'for="locationInput"',
    'for="durationInput"',
    'for="priorityInput"',
    'for="taskTypeInput"',
    'for="taskEndDateInput"'
  ].forEach(labelTarget => {
    assert.equal(html.includes(labelTarget), true, `${labelTarget} should exist`);
  });
});

test('h5 form surfaces use dark high-contrast select and placeholder rules', () => {
  const styleTargets = [
    readFile('styles/expenses.css'),
    readFile('styles/budget.css'),
    readFile('styles/recent.css'),
    readFile('styles/goals.css'),
    readFile('index.html')
  ];

  styleTargets.forEach(source => {
    assert.equal(source.includes('color-scheme: dark;'), true);
    assert.equal(source.includes('option,') || source.includes('select option,'), true);
    assert.equal(source.includes('::placeholder'), true);
  });
});
