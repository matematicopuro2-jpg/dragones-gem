@echo off
chcp 65001 >nul
:: Descarga la ultima version desde GitHub y reconstruye el juego (tus datos se conservan).
cd /d "%~dp0.."
echo Descargando la ultima version...
powershell -NoProfile -Command "$ErrorActionPreference='Stop'; $z=Join-Path $env:TEMP 'dragones.zip'; $d=Join-Path $env:TEMP 'dragones_upd'; Invoke-WebRequest 'https://github.com/matematicopuro2-jpg/dragones-gem/archive/refs/heads/main.zip' -OutFile $z; if(Test-Path $d){Remove-Item $d -Recurse -Force}; Expand-Archive $z $d; Copy-Item (Join-Path $d 'dragones-gem-main\*') . -Recurse -Force"
if errorlevel 1 (echo No se pudo descargar. & pause & exit /b 1)
call "%~dp0Iniciar Dragones.bat"
