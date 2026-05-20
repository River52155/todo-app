@echo off
setlocal
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js 没有安装或没有加入 PATH。
  echo 先安装 Node.js，再重新双击 start-classroom-demo.cmd。
  pause
  exit /b 1
)

title todo-app classroom demo
echo.
echo 正在启动 todo-app 课堂展示服务...
echo 请保持这个窗口开启，课堂结束后按 Ctrl+C 停止。
echo.

node "scripts\classroom-server.js"
