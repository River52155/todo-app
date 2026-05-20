# todo-app Codex 工作规则

本项目指 `C:\Users\35739\Desktop\todo-app`，不是 `D:\我的项目\todo-app`。当前项目是静态 H5 页面 + 微信小程序工程。

## 1. 项目概况

- H5 页面入口：`index.html`、`expenses.html`、`goals.html`、`recent.html`、`budget.html`
- H5 脚本：`scripts/`
- H5 样式：`styles/`
- 微信小程序工程：`miniprogram/`
- 微信开发者工具配置：`project.config.json`，其中 `miniprogramRoot` 指向 `miniprogram/`

## 2. 开发原则

- 只做小 diff，保持当前静态 HTML / 原生 JS / CSS 架构。
- 不把桌面项目和 `D:\我的项目\todo-app` 的 React/Vite 项目混用。
- 不新增网络请求、遥测、登录或云同步，除非 River 明确要求。
- 不改本地存储数据结构，除非任务明确要求并补兼容逻辑。
- 中文文件用 UTF-8 读取和编辑，避免 PowerShell 默认编码造成乱码误判。

## 3. 验证命令

优先使用：

1. `node --test .\tests\*.test.js`

说明：`node --test tests` 在当前 Node v24 环境会把 `tests` 当模块路径执行，不能递归展开测试文件。

## 4. 本地预览

- 双击 `start-classroom-demo.cmd`
- 或运行：`node .\scripts\classroom-server.js`
- 自动化验证时可设置 `CLASSROOM_NO_OPEN=1`，避免启动浏览器窗口。

## 5. 代码删改保护规则

- 删除代码、页面、组件、类型、脚本或配置前，默认先归档，不直接硬删。
- 如果项目还没有归档位置，先建立 `archive/`、`attic/` 或其他明确归档目录，再移动待删除代码。
- 只有在 River 明确确认“这部分真的无用”后，才允许彻底删除已归档代码。
