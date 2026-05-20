const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT_DIR = path.resolve(__dirname, '..');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

test('project config points WeChat DevTools at the miniprogram directory', () => {
  const projectConfig = readJson(path.join(ROOT_DIR, 'project.config.json'));

  assert.equal(projectConfig.miniprogramRoot, 'miniprogram/');
});

test('miniprogram runtime files live under the miniprogram directory', () => {
  const expectedFiles = [
    'miniprogram/app.js',
    'miniprogram/app.json',
    'miniprogram/app.wxss',
    'miniprogram/sitemap.json',
    'miniprogram/pages/budget/index.js',
    'miniprogram/pages/expenses/index.js',
    'miniprogram/utils/nav.js',
    'miniprogram/utils/expenses-store.js',
    'miniprogram/assets/bg-mini.jpg'
  ];

  expectedFiles.forEach(relativePath => {
    assert.equal(fs.existsSync(path.join(ROOT_DIR, relativePath)), true, `${relativePath} should exist`);
  });
});

test('legacy web prototype files stay at the repository root', () => {
  const expectedFiles = [
    'index.html',
    'expenses.html',
    'goals.html',
    'recent.html',
    'budget.html',
    'scripts/expenses.js',
    'scripts/classroom-server.js',
    'styles/budget.css',
    'assets/bg.png',
    'assets/fonts/MaShanZheng-Regular.ttf',
    'start-classroom-demo.cmd'
  ];

  expectedFiles.forEach(relativePath => {
    assert.equal(fs.existsSync(path.join(ROOT_DIR, relativePath)), true, `${relativePath} should exist`);
  });
});
