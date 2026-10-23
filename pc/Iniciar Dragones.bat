@echo off
chcp 65001 >nul
title Dragones Inestables - Servidor en esta PC
cd /d "%~dp0.."
docker info >nul 2>&1
if errorlevel 1 (
  echo  Abriendo Docker Desktop...
  start "" "%ProgramFiles%\Docker\Docker\Docker Desktop.exe"
  for /l %%n in (1,1,60) do (
    timeout /t 3 /nobreak >nul
    docker info >nul 2>&1 && goto docker_ok
  )
  echo  Docker no respondio. Abrelo a mano y vuelve a intentar.
  pause & exit /b 1
)
:docker_ok
for /f "usebackq delims=" %%i in (`powershell -NoProfile -Command "(Get-NetIPConfiguration | Where-Object { $_.IPv4DefaultGateway -ne $null -and $_.NetAdapter.Status -eq 'Up' } | Select-Object -First 1).IPv4Address.IPAddress"`) do set IP=%%i
if "%IP%"=="" (echo  No estas conectado a ninguna red wifi. & pause & exit /b 1)
set ENLACE_LAN=http://%IP%:3000
echo.
echo  Iniciando Dragones Inestables (la primera vez tarda 1-2 minutos)...
docker compose up -d --build
if errorlevel 1 (pause & exit /b 1)
for /l %%n in (1,1,20) do (
  powershell -NoProfile -Command "try{Invoke-WebRequest http://localhost:3000/api/enlace -UseBasicParsing -TimeoutSec 2 | Out-Null; exit 0}catch{exit 1}" && goto listo
  timeout /t 1 /nobreak >nul
)
:listo
echo %ENLACE_LAN%| clip
echo.
echo  ==========================================================
echo    LISTO. En esta PC:            http://localhost:3000
echo    Para los demas en tu wifi:    %ENLACE_LAN%
echo    (ya esta copiado: pegalo en WhatsApp con Ctrl+V)
echo  ==========================================================
echo.
start "" http://localhost:3000
powershell -NoProfile -WindowStyle Hidden -Command "Add-Type -AssemblyName PresentationFramework; [System.Windows.MessageBox]::Show(\"El juego ya esta abierto.`n`nEnlace para los demas (mismo wifi):`n`n      %ENLACE_LAN%`n`nYa esta copiado: pegalo con Ctrl+V en WhatsApp.`n`nSi no les carga, ejecuta una vez 'Permitir en el firewall.bat'.\", 'Dragones Inestables - Host', 'OK', 'Information') | Out-Null"
