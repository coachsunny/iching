@echo off
chcp 65001 >nul
title 取消易經占卜開機自動啟動

set "STARTUP_FOLDER=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
set "VBS_FILE=%STARTUP_FOLDER%\易經占卜伺服器.vbs"

echo ========================================================
echo   ☯ 取消「易經占筮與研習記事系統」開機自動啟動
echo ========================================================
echo.

if exist "%VBS_FILE%" (
    del /f /q "%VBS_FILE%"
    echo ✅ 已成功移除開機自動啟動項目！
    echo 日後如需啟動，可雙擊「啟動易經占卜.bat」即可。
) else (
    echo 目前未設定開機自動啟動，無需移除。
)

echo.
pause
