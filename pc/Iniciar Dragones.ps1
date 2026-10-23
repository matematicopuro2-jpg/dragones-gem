# Dragones Inestables - iniciar el juego en esta PC y mostrar el enlace para el wifi
Add-Type -AssemblyName System.Windows.Forms, System.Drawing
[System.Windows.Forms.Application]::EnableVisualStyles()
$raiz = Split-Path -Parent $PSScriptRoot
Set-Location $raiz

$f = New-Object System.Windows.Forms.Form
$f.Text = "Dragones Inestables - Host"; $f.Size = New-Object System.Drawing.Size(560, 380); $f.StartPosition = "CenterScreen"
$f.BackColor = [System.Drawing.Color]::FromArgb(15, 31, 54); $f.ForeColor = [System.Drawing.Color]::White; $f.FormBorderStyle = "FixedSingle"; $f.MaximizeBox = $false
$ico = Join-Path $PSScriptRoot "dragones.ico"; if (Test-Path $ico) { $f.Icon = New-Object System.Drawing.Icon($ico) }
function Etiqueta($txt, $y, $tam, $color) {
  $l = New-Object System.Windows.Forms.Label; $l.Text = $txt; $l.AutoSize = $false; $l.Size = New-Object System.Drawing.Size(520, ($tam * 2 + 8)); $l.Location = New-Object System.Drawing.Point(15, $y)
  $l.Font = New-Object System.Drawing.Font("Segoe UI", $tam, [System.Drawing.FontStyle]::Bold); $l.ForeColor = $color; $l.TextAlign = "MiddleCenter"; $f.Controls.Add($l); $l }
$amarillo = [System.Drawing.Color]::FromArgb(255, 205, 60); $naranja = [System.Drawing.Color]::FromArgb(232, 120, 42); $gris = [System.Drawing.Color]::FromArgb(170, 190, 215)
$titulo = Etiqueta "Dragones Inestables" 12 18 $amarillo
$estado = Etiqueta "Preparando..." 70 11 $gris
$ipL = Etiqueta "" 115 12 [System.Drawing.Color]::White
$link = Etiqueta "" 160 20 $naranja
$nota = Etiqueta "" 220 10 $gris
function Boton($txt, $x, $accion) {
  $b = New-Object System.Windows.Forms.Button; $b.Text = $txt; $b.Size = New-Object System.Drawing.Size(160, 40); $b.Location = New-Object System.Drawing.Point($x, 280)
  $b.Font = New-Object System.Drawing.Font("Segoe UI", 10, [System.Drawing.FontStyle]::Bold); $b.BackColor = [System.Drawing.Color]::FromArgb(58, 127, 200); $b.FlatStyle = "Flat"; $b.Enabled = $false
  $b.Add_Click($accion); $f.Controls.Add($b); $b }
$script:enlace = ""
$bCopiar = Boton "Copiar enlace" 20 { [System.Windows.Forms.Clipboard]::SetText($script:enlace); $nota.Text = "Copiado. Pegalo en WhatsApp con Ctrl+V." }
$bAbrir = Boton "Abrir el juego" 195 { Start-Process "http://localhost:3000" }
$bParar = Boton "Detener servidor" 370 { $estado.Text = "Deteniendo..."; [System.Windows.Forms.Application]::DoEvents(); docker compose stop | Out-Null; $estado.Text = "Servidor detenido. Ya puedes cerrar esta ventana."; $bParar.Enabled = $false }
function Paso($t) { $estado.Text = $t; [System.Windows.Forms.Application]::DoEvents() }
function Esperar($seg) { $fin = (Get-Date).AddSeconds($seg); while ((Get-Date) -lt $fin) { Start-Sleep -Milliseconds 150; [System.Windows.Forms.Application]::DoEvents() } }
function Correr($exe, $argumentos) {   # ejecuta sin congelar la ventana
  $p = Start-Process $exe -ArgumentList $argumentos -NoNewWindow -PassThru -RedirectStandardOutput "$env:TEMP\dragones_out.txt" -RedirectStandardError "$env:TEMP\dragones_err.txt"
  while (-not $p.HasExited) { Start-Sleep -Milliseconds 200; [System.Windows.Forms.Application]::DoEvents() }
  return $p.ExitCode }

$f.Add_Shown({
  try {
    # 1) Docker
    Paso "Revisando Docker..."
    if ((Correr "docker" "info") -ne 0) {
      Paso "Abriendo Docker Desktop (puede tardar un minuto)..."
      $dd = Join-Path $env:ProgramFiles "Docker\Docker\Docker Desktop.exe"; if (Test-Path $dd) { Start-Process $dd }
      $ok = $false; for ($i = 0; $i -lt 60; $i++) { Esperar 3; if ((Correr "docker" "info") -eq 0) { $ok = $true; break } }
      if (-not $ok) { Paso "Docker no respondio. Abre Docker Desktop y vuelve a intentar."; return }
    }
    # 2) IP en el wifi
    $ip = (Get-NetIPConfiguration | Where-Object { $_.IPv4DefaultGateway -ne $null -and $_.NetAdapter.Status -eq "Up" } | Select-Object -First 1).IPv4Address.IPAddress
    if (-not $ip) { Paso "No estas conectado a ningun wifi o red."; return }
    $script:enlace = "http://${ip}:3000"; $env:ENLACE_LAN = $script:enlace
    # 3) levantar el juego
    Paso "Iniciando el juego (la primera vez tarda 1-2 minutos)..."
    if ((Correr "docker" "compose up -d --build") -ne 0) { Paso "Error al iniciar. Detalle en: $env:TEMP\dragones_err.txt"; return }
    for ($i = 0; $i -lt 30; $i++) { try { Invoke-WebRequest "http://localhost:3000/api/enlace" -UseBasicParsing -TimeoutSec 2 | Out-Null; break } catch { Esperar 1 } }
    # 4) mostrar enlace
    [System.Windows.Forms.Clipboard]::SetText($script:enlace)
    $estado.Text = "LISTO. Pasa este enlace a los que esten en tu mismo wifi:"; $estado.ForeColor = [System.Drawing.Color]::FromArgb(120, 220, 140)
    $ipL.Text = "IP de tu PC: $ip"; $link.Text = $script:enlace
    $nota.Text = "Ya esta copiado (Ctrl+V en WhatsApp). Si no les carga, ejecuta una vez 'Permitir en el firewall.bat'."
    $bCopiar.Enabled = $true; $bAbrir.Enabled = $true; $bParar.Enabled = $true
    Start-Process "http://localhost:3000"
  } catch { Paso ("Error: " + $_.Exception.Message) }
})
[void]$f.ShowDialog()
