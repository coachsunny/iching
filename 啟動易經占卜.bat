@echo off
chcp 65001 >nul
title 易經占筮與研習記事系統
echo ========================================================
echo   ☯ 歡迎使用「易經占筮與研習記事系統」
echo ========================================================
echo.
echo 正在啟動本地伺服器...
start http://localhost:3000
node server.js
pause
