const http = require('node:http');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { exec } = require('node:child_process');

const ROOT_DIR = path.resolve(__dirname, '..');
const DEFAULT_PORT = Number.parseInt(process.env.PORT || '4173', 10);
const LINK_FILE_PATH = path.join(ROOT_DIR, 'classroom-demo-links.txt');

const MIME_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.md': 'text/plain; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.webp': 'image/webp',
  '.wxss': 'text/plain; charset=utf-8',
  '.wxml': 'text/plain; charset=utf-8'
};

function getContentType(filePath) {
  return MIME_TYPES[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
}

function resolveRequestPath(rootDir, requestUrl) {
  const rawPath = String(requestUrl || '/').split('?')[0];
  const decodedRawPath = decodeURIComponent(rawPath);

  if (decodedRawPath.split('/').includes('..')) {
    return null;
  }

  const request = new URL(requestUrl || '/', 'http://localhost');
  let pathname = decodeURIComponent(request.pathname);

  if (pathname === '/') {
    pathname = '/index.html';
  }

  const relativePath = pathname.replace(/^\/+/, '');
  const resolvedPath = path.resolve(rootDir, relativePath);
  const relativeToRoot = path.relative(rootDir, resolvedPath);

  if (!relativeToRoot || relativeToRoot.startsWith('..') || path.isAbsolute(relativeToRoot)) {
    return null;
  }

  return resolvedPath;
}

function getLanAddresses() {
  const networkInterfaces = os.networkInterfaces();
  const addresses = [];

  Object.values(networkInterfaces).forEach(interfaceGroup => {
    (interfaceGroup || []).forEach(details => {
      if (details.family === 'IPv4' && !details.internal) {
        addresses.push(details.address);
      }
    });
  });

  return Array.from(new Set(addresses));
}

function buildAccessUrls(port, addresses) {
  return ['localhost', ...addresses].map(host => `http://${host}:${port}/`);
}

function writeLinkFile(urls) {
  const lines = [
    'todo-app 课堂展示地址',
    '',
    ...urls.map(url => `- ${url}`),
    '',
    '使用说明：',
    '1. 让同学和你的电脑连接同一个 Wi-Fi 或你的手机热点。',
    '2. 如果 Windows 弹出防火墙提示，勾选“专用网络”并允许访问。',
    '3. 让同学优先打开局域网地址，不要依赖 github.io。'
  ];

  fs.writeFileSync(LINK_FILE_PATH, `${lines.join('\n')}\n`, 'utf8');
}

function openBrowser(url) {
  const escapedUrl = url.replace(/&/g, '^&');

  if (process.platform === 'win32') {
    exec(`start "" "${escapedUrl}"`);
    return;
  }

  if (process.platform === 'darwin') {
    exec(`open "${url}"`);
    return;
  }

  exec(`xdg-open "${url}"`);
}

function shouldOpenBrowser() {
  return process.env.CLASSROOM_NO_OPEN !== '1';
}

function sendResponseFile(filePath, response, method) {
  const headers = {
    'Cache-Control': 'no-store',
    'Content-Type': getContentType(filePath)
  };

  response.writeHead(200, headers);

  if (method === 'HEAD') {
    response.end();
    return;
  }

  const stream = fs.createReadStream(filePath);
  stream.on('error', () => {
    response.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('文件读取失败。');
  });
  stream.pipe(response);
}

function startServer(port = DEFAULT_PORT) {
  const server = http.createServer((request, response) => {
    const method = request.method || 'GET';

    if (!['GET', 'HEAD'].includes(method)) {
      response.writeHead(405, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('仅支持 GET / HEAD 请求。');
      return;
    }

    const resolvedPath = resolveRequestPath(ROOT_DIR, request.url || '/');

    if (!resolvedPath) {
      response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('未找到页面。');
      return;
    }

    fs.stat(resolvedPath, (error, stats) => {
      if (error || !stats.isFile()) {
        response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        response.end('未找到页面。');
        return;
      }

      sendResponseFile(resolvedPath, response, method);
    });
  });

  server.on('error', error => {
    if (error.code === 'EADDRINUSE') {
      console.error(`端口 ${port} 已被占用。先关闭占用它的程序，或用 PORT 环境变量换个端口。`);
      process.exitCode = 1;
      return;
    }

    console.error(error);
    process.exitCode = 1;
  });

  server.listen(port, '0.0.0.0', () => {
    const urls = buildAccessUrls(port, getLanAddresses());
    writeLinkFile(urls);

    console.log('');
    console.log('todo-app 课堂展示服务已启动');
    console.log(`项目目录：${ROOT_DIR}`);
    console.log('');
    console.log('可访问地址：');
    urls.forEach(url => console.log(`- ${url}`));
    console.log('');
    console.log(`地址文件已写入：${LINK_FILE_PATH}`);
    console.log('提示：让同学和你的电脑连同一个 Wi-Fi 或你的手机热点。');
    console.log('提示：如果 Windows 弹出防火墙提示，请允许“专用网络”访问。');
    console.log('停止服务：在这个窗口按 Ctrl+C');
    console.log('');

    if (shouldOpenBrowser()) {
      openBrowser(urls[0]);
    }
  });

  return server;
}

if (require.main === module) {
  startServer();
}

module.exports = {
  DEFAULT_PORT,
  ROOT_DIR,
  buildAccessUrls,
  getContentType,
  getLanAddresses,
  resolveRequestPath,
  shouldOpenBrowser,
  startServer
};
