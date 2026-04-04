const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT_DIR = path.resolve(__dirname, '..');

function readFile(relativePath) {
  return fs.readFileSync(path.join(ROOT_DIR, relativePath), 'utf8');
}

test('expenses page keeps quick-add above statistics and removes the duplicate monthly forecast section', () => {
  const html = readFile('expenses.html');
  const expenseFormIndex = html.indexOf('id="expenseForm"');
  const kpiIndex = html.indexOf('id="kpiDayTotal"');
  const recordsIndex = html.indexOf('id="recordsList"');
  const categoryFormIndex = html.indexOf('id="categoryForm"');

  assert.notEqual(expenseFormIndex, -1, 'expense form should exist');
  assert.notEqual(kpiIndex, -1, 'kpi section should exist');
  assert.notEqual(recordsIndex, -1, 'records list should exist');
  assert.notEqual(categoryFormIndex, -1, 'category form should exist');
  assert.equal(html.includes('forecast-section'), false);
  assert.equal(expenseFormIndex < kpiIndex, true);
  assert.equal(recordsIndex > categoryFormIndex, true);
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
