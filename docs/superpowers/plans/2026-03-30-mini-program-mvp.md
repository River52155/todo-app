# Mini Program MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在不破坏现有 H5 页面前提下，为该项目补齐一个可在微信开发者工具中直接预览的原生小程序 MVP。

**Architecture:** 继续保留现有网页入口，新增独立的小程序 `app + pages` 结构。共享的数据结构与本地存储 key 与网页版对齐，页面层只消费 `utils/*-store.js` 输出的标准化视图模型。

**Tech Stack:** 微信小程序原生框架、CommonJS 工具模块、`wx.setStorageSync` 本地存储、Node 内置测试运行器。

---

### Task 1: 补齐共享数据层

**Files:**
- Create: `D:/todo-app/utils/goals-store.js`
- Create: `D:/todo-app/utils/expenses-store.js`
- Test: `D:/todo-app/tests/goals-store.test.js`
- Test: `D:/todo-app/tests/expenses-store.test.js`

- [ ] 写 failing tests，覆盖目标页和消费页的标准化、统计和增删改行为
- [ ] 跑测试确认红灯
- [ ] 实现两个 store 的最小可用版本
- [ ] 再跑测试确认绿灯

### Task 2: 实现 4 个小程序页面

**Files:**
- Create: `D:/todo-app/pages/daily/index.js`
- Create: `D:/todo-app/pages/daily/index.wxml`
- Create: `D:/todo-app/pages/daily/index.wxss`
- Create: `D:/todo-app/pages/daily/index.json`
- Create: `D:/todo-app/pages/recent/index.js`
- Create: `D:/todo-app/pages/recent/index.wxml`
- Create: `D:/todo-app/pages/recent/index.wxss`
- Create: `D:/todo-app/pages/recent/index.json`
- Create: `D:/todo-app/pages/goals/index.js`
- Create: `D:/todo-app/pages/goals/index.wxml`
- Create: `D:/todo-app/pages/goals/index.wxss`
- Create: `D:/todo-app/pages/goals/index.json`
- Create: `D:/todo-app/pages/expenses/index.js`
- Create: `D:/todo-app/pages/expenses/index.wxml`
- Create: `D:/todo-app/pages/expenses/index.wxss`
- Create: `D:/todo-app/pages/expenses/index.json`

- [ ] 每页都接入统一导航
- [ ] 每页都只依赖对应 store 输出的数据
- [ ] 每页都先做可用版，避免沿用网页里的复杂动画和高耦合 DOM 逻辑

### Task 3: 上传前配置和清理

**Files:**
- Modify: `D:/todo-app/app.json`
- Modify: `D:/todo-app/app.wxss`
- Modify: `D:/todo-app/project.config.json`
- Delete: `D:/todo-app/tmp_domain.html`
- Delete: `D:/todo-app/tmp_privacy.html`
- Delete: `D:/todo-app/tmp_privacy_auth.html`
- Delete: `D:/todo-app/tmp_privacy_root.html`
- Delete: `D:/todo-app/tmp_quickstart.html`
- Delete: `D:/todo-app/tmp_storage.html`
- Delete: `D:/todo-app/tmp_webview.html`

- [ ] 保持 `pages` 路由和微信开发者工具配置一致
- [ ] 删除本地调研临时文件，避免项目根目录继续变乱

### Task 4: 验证

**Files:**
- Verify: `D:/todo-app/utils/*.js`
- Verify: `D:/todo-app/pages/**/*.js`

- [ ] 跑 `node --test D:/todo-app/tests/*.test.js`
- [ ] 跑 `node --check` 校验所有新增 JS 文件
- [ ] 复查目录结构，确认 H5 与小程序两套入口互不干扰
