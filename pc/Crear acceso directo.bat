@echo off
:: Crea (o repara) el acceso directo "Dragones Inestables" en el Escritorio.
powershell -NoProfile -ExecutionPolicy Bypass -Command "$s=(New-Object -ComObject WScript.Shell).CreateShortcut([Environment]::GetFolderPath('Desktop')+'\Dragones Inestables.lnk'); $s.TargetPath=$env:SystemRoot+'\System32\WindowsPowerShell\v1.0\powershell.exe'; $s.Arguments='-NoProfile -ExecutionPolicy Bypass -STA -WindowStyle Hidden -File \"%~dp0Iniciar Dragones.ps1\"'; $s.WorkingDirectory='%~dp0'; $s.IconLocation='%~dp0dragones.ico,0'; $s.Description='Inicia el juego en esta PC y muestra el enlace para tu wifi'; $s.Save()"
echo Acceso directo creado en el Escritorio.
timeout /t 3 >nul
