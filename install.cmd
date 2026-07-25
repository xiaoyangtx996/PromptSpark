@echo off
cd /d "%~dp0"
chcp 65001 >nul
node install.mjs %*
exit /b %errorlevel%
