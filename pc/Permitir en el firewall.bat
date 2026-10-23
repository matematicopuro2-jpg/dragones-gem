@echo off
:: Abre el puerto 3000 solo en redes privadas (tu wifi de casa). Pide permiso de administrador.
net session >nul 2>&1 || (powershell -Command "Start-Process '%~f0' -Verb RunAs" & exit /b)
netsh advfirewall firewall delete rule name="Dragones Inestables 3000" >nul 2>&1
netsh advfirewall firewall add rule name="Dragones Inestables 3000" dir=in action=allow protocol=TCP localport=3000 profile=private
echo Listo: el puerto 3000 esta permitido en redes privadas.
echo Si tu wifi figura como "Publica", cambiala a "Privada" en Configuracion ^> Red e Internet ^> Wi-Fi.
pause
