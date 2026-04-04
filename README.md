# todo-app

这个仓库现在分成两块：

- 根目录：旧的网页原型/H5 页面
  - `index.html`
  - `expenses.html`
  - `goals.html`
  - `recent.html`
  - `budget.html`
  - `scripts/`
  - `styles/`
  - `assets/bg.png`
- `miniprogram/`：微信小程序主工程
  - `app.js`
  - `app.json`
  - `app.wxss`
  - `pages/`
  - `utils/`
  - `assets/bg-mini.jpg`

其他目录：

- `tests/`：本地 store 和结构测试
- `docs/`：过程文档/计划文档

## 常用入口

- 网页原型首页：`index.html`
- 微信小程序工程根：`miniprogram/`
- 微信开发者工具项目配置：`project.config.json`

## 说明

- 微信开发者工具通过 `project.config.json` 的 `miniprogramRoot` 指向 `miniprogram/`
- 小程序相关代码以后尽量都放在 `miniprogram/` 下面，不再和网页原型混在根目录
