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

## 课堂展示

如果你要在教室里给同学现场打开 H5 页面，优先用本地局域网方式，不要只依赖 `github.io`。

1. 让电脑和同学手机连接同一个 Wi-Fi，或者直接让手机连你的热点
2. 双击根目录里的 `start-classroom-demo.cmd`
3. 如果 Windows 弹出防火墙提示，勾选“专用网络”并允许访问
4. 启动后，终端会打印：
   - `http://localhost:4173/`
   - `http://你的局域网IP:4173/`
5. 让同学打开局域网地址即可

启动脚本还会在根目录生成 `classroom-demo-links.txt`，里面会把可访问地址再写一份，方便你直接复制给同学。
