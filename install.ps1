# Rebuild + réinstallation automatique de l'extension dans Zen Browser (ou Firefox avec
# xpinstall.signatures.required=false).
#
#   powershell -ExecutionPolicy Bypass -File .\install.ps1            # Zen (défaut)
#   powershell -ExecutionPolicy Bypass -File .\install.ps1 -Browser firefox
#   powershell -ExecutionPolicy Bypass -File .\install.ps1 -DryRun    # montre ce qui serait fait
#
# Étapes : build.ps1 → fermeture propre du navigateur → copie de dist\ronflux-firefox.xpi (non
# signé) dans <profil>\extensions\{id}.xpi (le navigateur voit le fichier modifié au démarrage et
# met l'extension à jour, elle reste activée) → relance du navigateur en arrière-plan, réduit et
# sans prendre le focus → vérification de la version. Les onglets reviennent grâce à la
# restauration de session.
#
# Pour développer seulement : la version signée publiée sur le site s'installe et se met à jour
# toute seule (voir README).

param(
  [ValidateSet('zen', 'firefox')] [string] $Browser = 'zen',
  [switch] $DryRun,
  [switch] $NoRelaunch
)

$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
. .\tools\common.ps1

$ExtensionId = Get-FirefoxId

switch ($Browser) {
  'zen'     { $appData = Join-Path $env:APPDATA 'zen';             $exeNames = @('zen');     $exePaths = @("$env:ProgramFiles\Zen Browser\zen.exe", "$env:LOCALAPPDATA\Programs\Zen Browser\zen.exe") }
  'firefox' { $appData = Join-Path $env:APPDATA 'Mozilla\Firefox'; $exeNames = @('firefox'); $exePaths = @("$env:ProgramFiles\Mozilla Firefox\firefox.exe", "${env:ProgramFiles(x86)}\Mozilla Firefox\firefox.exe") }
}

# --- 1. Profil : celui que l'installation utilise ([Install…] Default=), sinon celui qui contient
#        déjà l'extension, sinon le profil marqué Default=1.
$ini = Join-Path $appData 'profiles.ini'
if (-not (Test-Path $ini)) { throw "profiles.ini introuvable : $ini ($Browser n'est pas installé ?)" }
$lines = Get-Content $ini
$installDefault = ($lines | Where-Object { $_ -match '^Default=Profiles/' } | Select-Object -First 1) -replace '^Default=', ''
$profilePaths = ($lines | Where-Object { $_ -match '^Path=' }) -replace '^Path=', ''
$candidates = @()
if ($installDefault) { $candidates += $installDefault }
$candidates += $profilePaths
$profile = $null
foreach ($rel in $candidates) {
  $p = Join-Path $appData $rel
  if (Test-Path (Join-Path $p 'extensions.json')) {
    if ((Get-Content -Raw (Join-Path $p 'extensions.json')) -like "*$ExtensionId*") { $profile = $p; break }
  }
}
if (-not $profile -and $installDefault) { $profile = Join-Path $appData $installDefault }
if (-not $profile) { throw 'aucun profil trouvé' }
Write-Host "Profil      : $profile"

# --- 2. Exécutable du navigateur (pour la relance).
$exe = $exePaths | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $exe) {
  $running = Get-Process -Name $exeNames -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($running) { $exe = $running.Path }
}
Write-Host "Navigateur  : $exe"

# --- 3. Build.
if ($DryRun) { Write-Host '[DryRun] build.ps1' } else {
  & powershell -ExecutionPolicy Bypass -File .\build.ps1
  if ($LASTEXITCODE -ne 0) { throw "build.ps1 a échoué (code $LASTEXITCODE) : rien n'a été installé." }
}
$xpi = Join-Path $PSScriptRoot 'dist\ronflux-firefox.xpi'
$version = Get-ProjectVersion
$target = Join-Path $profile "extensions\$ExtensionId.xpi"
Write-Host "Version     : $version"
Write-Host "Destination : $target"
if ($DryRun) { Write-Host '[DryRun] rien n''a été modifié.'; exit 0 }

# --- 4. Fermeture propre du navigateur (session restaurée à la relance).
$procs = Get-Process -Name $exeNames -ErrorAction SilentlyContinue
if ($procs) {
  Write-Host "Fermeture de $Browser…"
  $procs | ForEach-Object { try { $null = $_.CloseMainWindow() } catch {} }
  $deadline = (Get-Date).AddSeconds(20)
  while ((Get-Process -Name $exeNames -ErrorAction SilentlyContinue) -and (Get-Date) -lt $deadline) { Start-Sleep -Milliseconds 500 }
  $left = Get-Process -Name $exeNames -ErrorAction SilentlyContinue
  if ($left) { Write-Host 'Fermeture forcée des processus restants.'; $left | Stop-Process -Force; Start-Sleep -Seconds 2 }
  # Attendre la libération du verrou du profil.
  $deadline = (Get-Date).AddSeconds(10)
  while ((Test-Path (Join-Path $profile 'parent.lock')) -and (Get-Date) -lt $deadline) {
    try { [IO.File]::Open((Join-Path $profile 'parent.lock'), 'Open', 'ReadWrite', 'None').Close(); break } catch { Start-Sleep -Milliseconds 500 }
  }
}

# --- 5. Copie du .xpi + purge du cache de démarrage des extensions (force un nouveau scan).
New-Item -ItemType Directory -Force (Split-Path $target) | Out-Null
Copy-Item $xpi $target -Force
(Get-Item $target).LastWriteTime = Get-Date
Remove-Item (Join-Path $profile 'addonStartup.json.lz4') -Force -ErrorAction SilentlyContinue
Write-Host "xpi copié ($((Get-Item $target).Length) octets)."

if ($NoRelaunch -or -not $exe) { Write-Host 'Relancer le navigateur pour terminer la mise à jour.'; exit 0 }

# --- 6. Relance + vérification de la version enregistrée par le navigateur.
# Style 7 : fenêtre réduite, la fenêtre active le reste (l'utilisateur peut être dans un jeu en
# plein écran). Pas de Start-Process, qui met le navigateur au premier plan.
$null = (New-Object -ComObject WScript.Shell).Run("`"$exe`"", 7, $false)
Write-Host "Relance de $Browser, vérification…"
$deadline = (Get-Date).AddSeconds(40)
$ok = $false
while ((Get-Date) -lt $deadline) {
  Start-Sleep -Seconds 2
  try {
    $json = Get-Content -Raw (Join-Path $profile 'extensions.json') -ErrorAction Stop | ConvertFrom-Json
    $addon = $json.addons | Where-Object { $_.id -eq $ExtensionId }
    if ($addon -and $addon.version -eq $version -and $addon.active) { $ok = $true; break }
  } catch {}
}
if ($ok) { Write-Host "OK : Ronflux $version installé et actif. Recharger les onglets Twitch." -ForegroundColor Green }
else { Write-Warning "Version $version non confirmée dans extensions.json (vérifier about:addons)." }
