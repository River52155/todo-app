const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildVisual,
  createExportPayload,
  mergeMemories,
  migrateLegacyStore,
  normalizeMemory,
  parseImportPayload,
  scopeToOrbitSpeed,
  sizeLevelToPx,
  themeById
} = require('../scripts/moments-store');

test('moments store migrates legacy weekly and yearly records into the star map shape', () => {
  const migrated = migrateLegacyStore({
    weekly: [{
      id: 'weekly-1',
      title: '鹅鸭杀',
      content: '打了一个小时鹅鸭杀，很快乐',
      mood: 'happy',
      date: '2026-05-17',
      createdAt: '2026-05-17T00:00:00.000Z',
      updatedAt: '2026-05-17T00:00:00.000Z'
    }],
    yearly: [{
      id: 'yearly-1',
      title: '剧本杀',
      content: '剧本杀打哭了',
      mood: 'moved',
      date: '2026-05-17',
      createdAt: '2026-05-17T01:00:00.000Z',
      updatedAt: '2026-05-17T01:00:00.000Z'
    }]
  });

  assert.equal(migrated.length, 2);
  assert.equal(migrated[0].scope, 'week');
  assert.equal(migrated[0].moodTags.includes('幸福'), true);
  assert.equal(migrated[1].scope, 'year');
  assert.equal(migrated[1].moodTags.includes('热泪'), true);
  assert.equal(typeof migrated[0].position.x, 'number');
  assert.equal(typeof migrated[1].visual.glowLevel, 'number');
  assert.equal(migrated[1].status.deleted, false);
});

test('moments store export and import preserve records without duplicating newer ids', () => {
  const older = normalizeMemory({
    id: 'memory-1',
    content: '旧文字',
    date: '2026-05-01',
    scope: 'week',
    updatedAt: '2026-05-01T00:00:00.000Z'
  });
  const newer = normalizeMemory({
    id: 'memory-1',
    content: '新文字',
    date: '2026-05-02',
    scope: 'year',
    updatedAt: '2026-05-02T00:00:00.000Z'
  });
  const deleted = normalizeMemory({
    id: 'memory-2',
    content: '删除记录',
    date: '2026-05-02',
    scope: 'year',
    status: { deleted: true }
  });

  const merged = mergeMemories([older], [newer, deleted]);
  assert.equal(merged.length, 2);
  assert.equal(merged.find(item => item.id === 'memory-1').content, '新文字');

  const payload = createExportPayload(merged);
  assert.equal(payload.memories.length, 1);
  assert.equal(payload.memories[0].id, 'memory-1');

  const imported = parseImportPayload(JSON.stringify(payload));
  assert.equal(imported.length, 1);
  assert.equal(imported[0].scope, 'year');
});

test('moments store normalizes star-core visuals by intensity and scope', () => {
  const quietWeek = buildVisual(['幸福'], 3, 'week', 'quiet-week');
  const anotherWeek = buildVisual(['幸福'], 3, 'week', 'another-week');
  const intenseYear = buildVisual(['热泪'], 9, 'year', 'intense-year');

  assert.notEqual(quietWeek.colorTheme, anotherWeek.colorTheme);
  assert.match(themeById(quietWeek.colorTheme).glow, /^#/);
  assert.equal(['tear-gold', 'candle-gold', 'rose-violet', 'violet-silver'].includes(themeById(intenseYear.colorTheme).id), true);
  assert.equal(intenseYear.sizeLevel > quietWeek.sizeLevel, true);
  assert.equal(sizeLevelToPx(intenseYear.sizeLevel, 'year') > sizeLevelToPx(quietWeek.sizeLevel, 'week'), true);
  assert.equal(intenseYear.glowLevel > quietWeek.glowLevel, true);
  assert.equal(scopeToOrbitSpeed('year', 9) < scopeToOrbitSpeed('week', 9), true);
});
