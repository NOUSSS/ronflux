# Construit dist/ à partir de src/ronflux.user.js (source unique) :
#   dist/firefox/             extension décompressée (extension/* + content.js = userscript sans
#                             son en-tête Tampermonkey)
#   dist/ronflux-firefox.xpi  la même, empaquetée
# dist/ est ignoré par git : ne rien y modifier à la main.
#
#   powershell -ExecutionPolicy Bypass -File .\build.ps1

$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

$dist = Join-Path $PSScriptRoot 'dist'
$out  = Join-Path $dist 'firefox'
if (Test-Path $out) { Remove-Item -Recurse -Force $out }
New-Item -ItemType Directory -Force $out | Out-Null
Copy-Item .\extension\* $out

$src  = Get-Content -Raw -Encoding UTF8 .\src\ronflux.user.js
$core = $src -replace '(?s)^// ==UserScript==.*?// ==/UserScript==\r?\n\r?\n?', ''
$core = "// Généré par build.ps1 à partir de src/ronflux.user.js : modifier le userscript, pas ce fichier.`n" + $core

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText((Join-Path $out 'content.js'), $core, $utf8NoBom)

# Compress-Archive n'accepte que l'extension .zip : on empaquette puis on renomme en .xpi.
$zip = Join-Path $dist 'ronflux-firefox.zip'
$xpi = Join-Path $dist 'ronflux-firefox.xpi'
foreach ($f in @($zip, $xpi)) { if (Test-Path $f) { Remove-Item $f -Force } }
Compress-Archive -Path (Join-Path $out '*') -DestinationPath $zip
Move-Item $zip $xpi

Write-Host "OK : dist/firefox/ et dist/ronflux-firefox.xpi regénérés."
