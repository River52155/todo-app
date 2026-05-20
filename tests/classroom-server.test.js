const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT_DIR = path.resolve(__dirname, '..');
const SERVER_MODULE_PATH = path.join(ROOT_DIR, 'scripts', 'classroom-server.js');
const STARTER_PATH = path.join(ROOT_DIR, 'start-classroom-demo.cmd');

function loadServerModule() {
  assert.equal(fs.existsSync(SERVER_MODULE_PATH), true, 'scripts/classroom-server.js should exist');
  return require(SERVER_MODULE_PATH);
}

test('classroom demo server entry points exist', () => {
  assert.equal(fs.existsSync(SERVER_MODULE_PATH), true, 'scripts/classroom-server.js should exist');
  assert.equal(fs.existsSync(STARTER_PATH), true, 'start-classroom-demo.cmd should exist');
});

test('classroom server resolves safe request paths inside the project root', () => {
  const classroomServer = loadServerModule();
  const indexPath = classroomServer.resolveRequestPath(ROOT_DIR, '/');
  const budgetPath = classroomServer.resolveRequestPath(ROOT_DIR, '/budget.html');

  assert.equal(indexPath, path.join(ROOT_DIR, 'index.html'));
  assert.equal(budgetPath, path.join(ROOT_DIR, 'budget.html'));
  assert.equal(classroomServer.resolveRequestPath(ROOT_DIR, '/../secrets.txt'), null);
});

test('classroom server reports the right content types for static assets', () => {
  const classroomServer = loadServerModule();

  assert.equal(classroomServer.getContentType('index.html'), 'text/html; charset=utf-8');
  assert.equal(classroomServer.getContentType('styles/budget.css'), 'text/css; charset=utf-8');
  assert.equal(classroomServer.getContentType('scripts/budget.js'), 'application/javascript; charset=utf-8');
  assert.equal(classroomServer.getContentType('assets/bg.png'), 'image/png');
  assert.equal(classroomServer.getContentType('README.md'), 'text/plain; charset=utf-8');
});

test('classroom server builds classroom-friendly local and LAN URLs', () => {
  const classroomServer = loadServerModule();
  const urls = classroomServer.buildAccessUrls(4173, ['192.168.0.28', '10.0.0.7']);

  assert.deepEqual(urls, [
    'http://localhost:4173/',
    'http://192.168.0.28:4173/',
    'http://10.0.0.7:4173/'
  ]);
});

test('classroom server can skip auto-opening the browser during scripted runs', () => {
  const classroomServer = loadServerModule();
  const previousValue = process.env.CLASSROOM_NO_OPEN;

  process.env.CLASSROOM_NO_OPEN = '1';
  assert.equal(classroomServer.shouldOpenBrowser(), false);

  delete process.env.CLASSROOM_NO_OPEN;
  assert.equal(classroomServer.shouldOpenBrowser(), true);

  if (previousValue !== undefined) {
    process.env.CLASSROOM_NO_OPEN = previousValue;
  }
});

test('readme explains the classroom startup flow', () => {
  const readme = fs.readFileSync(path.join(ROOT_DIR, 'README.md'), 'utf8');

  assert.equal(readme.includes('start-classroom-demo.cmd'), true);
  assert.equal(readme.includes('同一个 Wi-Fi') || readme.includes('同一個 Wi-Fi'), true);
});
