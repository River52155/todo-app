const test = require('node:test');
const assert = require('node:assert/strict');

const ExpenseRole = require('../scripts/expense-role');

test('expense role infers old records from category when no role exists', () => {
  assert.equal(ExpenseRole.defaultRoleForCategory('food'), 'life_support');
  assert.equal(ExpenseRole.defaultRoleForCategory('transport'), 'life_support');
  assert.equal(ExpenseRole.defaultRoleForCategory('housing'), 'life_support');
  assert.equal(ExpenseRole.defaultRoleForCategory('fun'), 'life_extra');
  assert.equal(ExpenseRole.defaultRoleForCategory('custom-category'), 'life_extra');

  const oldFoodRecord = ExpenseRole.withExpenseRole({ amount: 18, categoryId: 'food' });
  const oldFunRecord = ExpenseRole.withExpenseRole({ amount: 88, categoryId: 'fun' });

  assert.equal(oldFoodRecord.expenseRole, 'life_support');
  assert.equal(oldFunRecord.expenseRole, 'life_extra');
});

test('expense role preserves manual role and totals both ledgers', () => {
  const records = [
    { amount: 12, categoryId: 'food' },
    { amount: 8, categoryId: 'food', expenseRole: 'life_extra' },
    { amount: 30, categoryId: 'fun' },
    { amount: 20, categoryId: 'housing' }
  ];

  const breakdown = ExpenseRole.buildRoleBreakdown(records);

  assert.equal(breakdown.total, 70);
  assert.equal(breakdown.rows[0].role, 'life_support');
  assert.equal(breakdown.rows[0].total, 32);
  assert.equal(breakdown.rows[0].count, 2);
  assert.equal(breakdown.rows[1].role, 'life_extra');
  assert.equal(breakdown.rows[1].total, 38);
  assert.equal(breakdown.rows[1].count, 2);
});

test('expense role trend splits month points into support and extra totals', () => {
  const rangeInfo = {
    start: new Date(2026, 4, 1),
    end: new Date(2026, 4, 31)
  };
  const records = [
    { amount: 10, date: '2026-05-01', categoryId: 'food' },
    { amount: 35, date: '2026-05-01', categoryId: 'fun' },
    { amount: 15, date: '2026-05-02', categoryId: 'transport' }
  ];

  const view = ExpenseRole.buildRoleTrend('month', records, rangeInfo);

  assert.equal(view.points.length, 31);
  assert.equal(view.points[0].supportTotal, 10);
  assert.equal(view.points[0].extraTotal, 35);
  assert.equal(view.points[1].supportTotal, 15);
  assert.equal(view.points[1].extraTotal, 0);
});
