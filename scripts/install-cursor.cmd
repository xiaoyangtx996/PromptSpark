@echo off
chcp 65001 >nul
cd /d "%~dp0.."

echo.
echo PromptSpark → 安装到 Cursor
echo （会关闭 Cursor，写入补丁后自动再打开）
echo.

where node >nul 2>&1
if errorlevel 1 (
  echo [错误] 未找到 Node.js，请先安装：https://nodejs.org/
  pause
  exit /b 1
)

node install.mjs --hosts=cursor
set ERR=%ERRORLEVEL%

echo.
if not %ERR%==0 (
  echo [失败] 退出码 %ERR%
  pause
  exit /b %ERR%
)

echo [完成] Composer 输入框右侧（附件/麦克风旁）应出现 ✨ 按钮
pause
exit /b 0
