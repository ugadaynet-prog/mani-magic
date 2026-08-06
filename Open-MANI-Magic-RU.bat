@echo off
chcp 65001 >nul
cd /d "%~dp0"

rem --- 1) Node.js (recommended: full PWA mode with service worker) ---
where node >nul 2>nul
if not errorlevel 1 (
  start "MANI Magic RU server - do not close" cmd /k node server.js
  timeout /t 2 >nul
  start "" "http://localhost:8000"
  exit /b
)

rem --- 2) Python fallback ---
where python >nul 2>nul
if not errorlevel 1 (
  start "MANI Magic RU server - do not close" cmd /k python -m http.server 8000
  timeout /t 2 >nul
  start "" "http://localhost:8000"
  exit /b
)

rem --- 3) No Node/Python: open the file directly (app works, service worker off) ---
start "" "%~dp0index.html"
