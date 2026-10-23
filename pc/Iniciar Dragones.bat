@echo off
chcp 65001 >nul
title Dragones Inestables - Servidor en esta PC
cd /d "%~dp0.."
docker info >nul 2>&1 || (echo. & echo  Abre primero Docker Desktop y espera a que diga "Engine running". & pause & exit /b 1)
for /f "usebackq delims=" %%i in (`powershell -NoProfile -Command "(Get-NetIPConfiguration | Where-Object { $_.IPv4DefaultGateway -ne $null -and $_.NetAdapter.Status -eq 'Up' } | Select-Object -First 1).IPv4Address.IPAddress"`) do set IP=%%i
set ENLACE_LAN=http://%IP%:3000
echo.
echo  Iniciando Dragones Inestables (la primera vez tarda 1-2 minutos)...
docker compose up -d --build
if errorlevel 1 (pause & exit /b 1)
echo.
echo  ==========================================================
echo    LISTO. En esta PC:            http://localhost:3000
echo    Para los demas en tu wifi:    %ENLACE_LAN%
echo  ==========================================================
echo   (Si otros no pueden entrar, ejecuta una vez "Permitir en el firewall.bat")
echo.
start "" http://localhost:3000
pause
