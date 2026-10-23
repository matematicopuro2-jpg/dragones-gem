@echo off
cd /d "%~dp0.."
docker compose stop
echo Juego detenido. (Overleaf y tus otros contenedores siguen igual.)
pause
