@echo off
cd /d "%~dp0"
echo.
echo Starting local server (no Python required)...
echo If you see "already running", just open http://127.0.0.1:8765 in browser.
echo Optional: set LONGCAT_API_KEY=your_key_here
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0server.ps1"
if errorlevel 1 pause
