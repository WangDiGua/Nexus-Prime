@echo off
setlocal EnableExtensions

cd /d "%~dp0"

set "PORT=3001"
set "URL=http://localhost:%PORT%"
set "LAN_URL=http://192.168.2.28:%PORT%"

for /f "tokens=5" %%P in ('netstat -ano ^| findstr /R /C:":%PORT% .*LISTENING"') do (
  echo Port %PORT% is already in use by PID %%P.
  echo If you want to restart the dev server, run restart-lan-dev.bat instead.
  echo Opening the existing site in your browser...
  start "" "%URL%"
  exit /b 0
)

echo Starting LAN-accessible dev server on port %PORT%...
echo Local: %URL%
echo LAN:   %LAN_URL%
start "" "%URL%"
npm run dev

