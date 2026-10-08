@echo off
chcp 65001 >nul
title 設定易經占卜開機自動背景啟動

set "STARTUP_FOLDER=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
set "VBS_FILE=%STARTUP_FOLDER%\易經占卜伺服器.vbs"
set "APP_DIR=D:\易經"

echo ========================================================
echo   ☯ 設定「易經占筮與研習記事系統」開機自動啟動
echo ========================================================
echo.
echo 正在建立背景無黑窗啟動腳本...

(
echo Set WshShell = CreateObject("WScript.Shell"^)
echo WshShell.CurrentDirectory = "%APP_DIR%"
echo WshShell.Run "node.exe ""%APP_DIR%\server.js""", 0, False
) > "%VBS_FILE%"

if exist "%VBS_FILE%" (
    echo.
    echo ✅ 設定成功！
    echo 每次電腦開機時，易經占卜伺服器將自動在「背景靜默執行」（無黑色命令視窗）。
    echo 您隨時打開瀏覽器輸入: http://localhost:3000 即可直接使用！
    echo.
    echo （若日後想取消，只需執行資料夾內的「取消開機自動啟動.bat」即可）
) else (
    echo.
    echo ❌ 建立啟動檔案失敗，請以系統管理員身分執行。
)

echo.
pause
