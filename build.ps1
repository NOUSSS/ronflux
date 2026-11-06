# Construit dist/ à partir de src/ronflux.user.js (source unique du code) et de extension/ :
#   dist/firefox/              extension Firefox décompressée (about:debugging, web-ext lint)
#   dist/chrome/               extension Chrome décompressée (« Charger l'extension non empaquetée »)
#   dist/ronflux-firefox.xpi   paquet Firefox non signé (release.ps1 le fait signer par AMO)
#   dist/ronflux-chrome.zip    paquet Chrome : Chrome Web Store, ou à décompresser en mode développeur
#   dist/ronflux.user.js       userscript avec @updateURL et @downloadURL vers le site
#
# Manifestes : extension/manifest.base.json + manifest.firefox.json / manifest.chrome.json.
# Adresses : distribution.json (siteUrl) et chemins fixes de tools/common.ps1.
# Outils : Node.js 20+ ; les paquets de package.json sont installés (npm ci) au premier build.
# dist/ est ignoré par git : ne rien y modifier à la main. dist/publication/ (release.ps1)
# n'est jamais touché ici.
#
#   powershell -ExecutionPolicy Bypass -File .\build.ps1

$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
. .\tools\common.ps1

if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw 'Node.js 20+ est nécessaire (https://nodejs.org).' }
if (-not (Test-Path .\node_modules\@resvg\resvg-js\package.json)) {
  Write-Host 'Installation des outils de build (npm ci)…'
  Invoke-Native 'npm.cmd' @('ci', '--no-audit', '--no-fund')
}

$version = Get-ProjectVersion
$urls = Get-SiteUrls

$dist = Join-Path $PSScriptRoot 'dist'
$ffDir = Join-Path $dist 'firefox'
$chromeDir = Join-Path $dist 'chrome'
$xpi = Join-Path $dist 'ronflux-firefox.xpi'
$chromeZip = Join-Path $dist 'ronflux-chrome.zip'
$userscriptOut = Join-Path $dist 'ronflux.user.js'

foreach ($dir in @($ffDir, $chromeDir)) {
  if (Test-Path $dir) { Remove-Item -Recurse -Force $dir }
  New-Item -ItemType Directory -Force $dir | Out-Null
}
foreach ($file in @($xpi, $chromeZip, $userscriptOut)) { if (Test-Path $file) { Remove-Item -Force $file } }

# --- Script de contenu : le userscript sans son en-tête Tampermonkey. -----------------------
$src = Read-Text 'src/ronflux.user.js'
$headerEnd = '// ==/UserScript=='
$core = $src -replace '(?s)^// ==UserScript==.*?// ==/UserScript==\r?\n(\r?\n)?', ''
if ($core.Length -eq $src.Length) { throw "src/ronflux.user.js : en-tête « // ==UserScript== … $headerEnd » introuvable en tête de fichier." }
$core = "// Généré par build.ps1 à partir de src/ronflux.user.js : modifier le userscript, pas ce fichier.`n" + $core
foreach ($dir in @($ffDir, $chromeDir)) { [IO.File]::WriteAllText((Join-Path $dir 'content.js'), $core, $Utf8NoBom) }

# --- Manifestes, règles et icônes. -----------------------------------------------------------
Invoke-Native 'node' @('tools/manifest.mjs', 'extension/manifest.base.json', 'extension/manifest.firefox.json', (Join-Path $ffDir 'manifest.json'), "--gecko-update-url=$($urls.updates)")
Invoke-Native 'node' @('tools/manifest.mjs', 'extension/manifest.base.json', 'extension/manifest.chrome.json', (Join-Path $chromeDir 'manifest.json'))
foreach ($dir in @($ffDir, $chromeDir)) { Copy-Item .\extension\rules.json $dir }
Copy-Item .\extension\icon.svg $ffDir
Invoke-Native 'node' @('tools/icons.mjs', 'extension/icon.svg', (Join-Path $chromeDir 'icons'), '16', '32', '48', '128')

# Chaque fichier cité par un manifeste doit exister dans son dossier, et rien d'autre ne doit y
# traîner : le paquet contient exactement ce que le manifeste utilise.
foreach ($dir in @($ffDir, $chromeDir)) {
  $m = Get-Content -Raw -Encoding UTF8 (Join-Path $dir 'manifest.json') | ConvertFrom-Json
  if ($m.version -ne $version) { throw "$dir\manifest.json : version $($m.version) au lieu de $version." }
  $used = @('manifest.json')
  $used += @($m.icons.PSObject.Properties | ForEach-Object { $_.Value })
  $used += @($m.content_scripts | ForEach-Object { $_.js })
  $used += @($m.declarative_net_request.rule_resources | ForEach-Object { $_.path })
  $used = @($used | Select-Object -Unique)
  foreach ($rel in $used) {
    if (-not (Test-Path -LiteralPath (Join-Path $dir $rel) -PathType Leaf)) { throw "$dir : « $rel » cité par le manifeste mais absent." }
  }
  $prefix = (Resolve-Path $dir).Path.TrimEnd('\') + '\'
  $extra = @(Get-ChildItem -LiteralPath $dir -Recurse -File | ForEach-Object { $_.FullName.Substring($prefix.Length).Replace('\', '/') } | Where-Object { $used -notcontains $_ })
  if ($extra.Count) { throw "$dir : fichiers non cités par le manifeste : $($extra -join ', ')." }
}

# --- Paquets. ---------------------------------------------------------------------------------
New-ZipFromDirectory $ffDir $xpi
New-ZipFromDirectory $chromeDir $chromeZip

# --- Userscript distribué : @updateURL et @downloadURL pointent vers le site. ----------------
if ($src -match '(?m)^//\s*@(updateURL|downloadURL)\b') {
  throw 'src/ronflux.user.js déclare déjà @updateURL ou @downloadURL : build.ps1 les ajoute lui-même, les retirer de la source.'
}
$nl = if ($src.Contains("`r`n")) { "`r`n" } else { "`n" }
$at = $src.IndexOf($nl + $headerEnd)
if ($at -lt 0 -or $src.IndexOf($nl + $headerEnd, $at + 1) -ge 0) { throw "src/ronflux.user.js : une seule ligne « $headerEnd » attendue." }
$meta = "$nl// @updateURL    $($urls.userscript)$nl// @downloadURL  $($urls.userscript)"
[IO.File]::WriteAllText($userscriptOut, $src.Insert($at, $meta), $Utf8NoBom)

Write-Host "OK : Ronflux $version construit dans dist/ (site : $($urls.site))"
foreach ($file in @($xpi, $chromeZip, $userscriptOut)) {
  Write-Host ("  {0,-22} {1,8} octets" -f (Split-Path $file -Leaf), (Get-Item $file).Length)
}
