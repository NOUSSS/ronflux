# Fonctions et constantes partagées par build.ps1, release.ps1 et install.ps1 (chargé par « . »).

$RepoRoot = Split-Path $PSScriptRoot -Parent

# Chemins publics, communs au site (site/) et aux paquets : ne pas les changer sans mettre le site
# à jour. Seule l'adresse de base du site se règle, dans distribution.json (siteUrl).
$PublicPaths = [ordered]@{
  firefox    = '/telecharger/ronflux-firefox.xpi'
  chrome     = '/telecharger/ronflux-chrome.zip'
  userscript = '/telecharger/ronflux.user.js'
  updates    = '/updates.json'   # manifeste de mise à jour Firefox (update_url)
}

$Utf8NoBom = New-Object System.Text.UTF8Encoding($false)

function Read-Text([string] $Path) {
  [IO.File]::ReadAllText((Join-Path $RepoRoot $Path), [Text.Encoding]::UTF8)
}

function Write-Text([string] $Path, [string] $Text) {
  [IO.File]::WriteAllText((Join-Path $RepoRoot $Path), $Text, $Utf8NoBom)
}

function Read-Json([string] $Path) {
  (Read-Text $Path).TrimStart([char]0xFEFF) | ConvertFrom-Json
}

# Adresses publiques : siteUrl de distribution.json + chemins fixes ci-dessus.
function Get-SiteUrls {
  $base = [string] (Read-Json 'distribution.json').siteUrl
  if ($base -notmatch '^https://[a-z0-9.-]+(:\d+)?(/[A-Za-z0-9._~/-]*)?$') {
    throw "distribution.json : siteUrl doit être une adresse https sans paramètres ni espaces (reçu « $base »)."
  }
  $base = $base.TrimEnd('/')
  $urls = [ordered]@{ site = $base }
  foreach ($key in $PublicPaths.Keys) { $urls[$key] = $base + $PublicPaths[$key] }
  [pscustomobject] $urls
}

# Projet Cloudflare Pages qui sert le site (release.ps1 y déploie).
function Get-PagesProject {
  $name = [string] (Read-Json 'distribution.json').cloudflarePagesProject
  if ($name -notmatch '^[a-z0-9]([a-z0-9-]{0,56}[a-z0-9])?$') {
    throw "distribution.json : cloudflarePagesProject doit être un nom de projet Pages (minuscules, chiffres, tirets), reçu « $name »."
  }
  $name
}

# Identifiant de l'extension Firefox : celui de extension/manifest.firefox.json. L'installation
# existante se met à jour par cet identifiant, il ne doit jamais changer.
function Get-FirefoxId {
  $id = [string] (Read-Json 'extension/manifest.firefox.json').browser_specific_settings.gecko.id
  if (-not $id) { throw 'extension/manifest.firefox.json : browser_specific_settings.gecko.id absent.' }
  $id
}

# --- Version ------------------------------------------------------------------------------
# Elle figure à trois endroits : "version" de extension/manifest.base.json, @version de l'en-tête
# du userscript et constante VERSION du userscript. release.ps1 les monte ensemble.
$VersionFiles = @(
  @{ Path = 'extension/manifest.base.json'; Label = 'manifest.base.json "version"'; Pattern = '(?m)^(\s*"version"\s*:\s*")([^"]*)(")' }
  @{ Path = 'src/ronflux.user.js';          Label = 'ronflux.user.js @version';     Pattern = '(?m)^(//\s*@version[ \t]+)(\S+)()' }
  @{ Path = 'src/ronflux.user.js';          Label = 'ronflux.user.js VERSION';      Pattern = "(?m)^(\s*const VERSION = ')([^']*)(';)" }
)

function Get-VersionMatch([string] $Text, $Spec) {
  $found = [regex]::Matches($Text, $Spec.Pattern)
  if ($found.Count -ne 1) { throw "$($Spec.Label) : $($found.Count) occurrence(s) dans $($Spec.Path), une seule attendue." }
  $found[0]
}

# Renvoie la version du projet, ou s'arrête si les trois endroits ne concordent pas.
function Get-ProjectVersion {
  $seen = [ordered]@{}
  foreach ($spec in $VersionFiles) { $seen[$spec.Label] = (Get-VersionMatch (Read-Text $spec.Path) $spec).Groups[2].Value }
  $distinct = @($seen.Values | Select-Object -Unique)
  if ($distinct.Count -ne 1) {
    $detail = ($seen.Keys | ForEach-Object { "  $_ = $($seen[$_])" }) -join "`n"
    throw "Versions incohérentes :`n$detail`nLes aligner avec release.ps1 -Version x.y.z (voir README, Publication)."
  }
  if ($distinct[0] -notmatch '^\d+\.\d+\.\d+$') { throw "Version « $($distinct[0]) » invalide : x.y.z attendu." }
  $distinct[0]
}

# Écrit la nouvelle version aux trois endroits (sans autre modification des fichiers).
function Set-ProjectVersion([string] $Version) {
  if ($Version -notmatch '^\d+\.\d+\.\d+$') { throw "Version « $Version » invalide : x.y.z attendu." }
  $texts = @{}
  foreach ($spec in $VersionFiles) {
    if (-not $texts.ContainsKey($spec.Path)) { $texts[$spec.Path] = Read-Text $spec.Path }
    $null = Get-VersionMatch $texts[$spec.Path] $spec
    $texts[$spec.Path] = ([regex] $spec.Pattern).Replace($texts[$spec.Path], '${1}' + $Version + '${3}', 1)
  }
  foreach ($path in $texts.Keys) { Write-Text $path $texts[$path] }
}

function Compare-Version([string] $A, [string] $B) {
  ([version] $A).CompareTo([version] $B)
}

# --- Archives -----------------------------------------------------------------------------
# Compress-Archive de PowerShell 5.1 écrit des chemins avec « \ », que Chrome et AMO refusent :
# on écrit l'archive nous-mêmes, entrées triées, séparateur « / » et date fixe (même contenu,
# même archive).
function New-ZipFromDirectory([string] $SourceDir, [string] $Destination) {
  Add-Type -AssemblyName System.IO.Compression, System.IO.Compression.FileSystem
  if (Test-Path -LiteralPath $Destination) { Remove-Item -LiteralPath $Destination -Force }
  $prefix = (Resolve-Path -LiteralPath $SourceDir).Path.TrimEnd('\') + '\'
  $files = @(Get-ChildItem -LiteralPath $SourceDir -Recurse -File | Sort-Object { $_.FullName.Substring($prefix.Length).Replace('\', '/') })
  $stamp = New-Object DateTimeOffset(2000, 1, 1, 0, 0, 0, [TimeSpan]::Zero)
  $stream = [IO.File]::Open($Destination, [IO.FileMode]::CreateNew)
  try {
    $zip = New-Object IO.Compression.ZipArchive($stream, [IO.Compression.ZipArchiveMode]::Create)
    try {
      foreach ($file in $files) {
        $entry = $zip.CreateEntry($file.FullName.Substring($prefix.Length).Replace('\', '/'), [IO.Compression.CompressionLevel]::Optimal)
        $entry.LastWriteTime = $stamp
        $in = [IO.File]::OpenRead($file.FullName)
        $out = $entry.Open()
        try { $in.CopyTo($out) } finally { $out.Dispose(); $in.Dispose() }
      }
    } finally { $zip.Dispose() }
  } finally { $stream.Dispose() }
}

# Contenu d'une archive lue en mémoire : nom d'entrée → octets.
function Read-ZipEntries([byte[]] $Bytes) {
  Add-Type -AssemblyName System.IO.Compression, System.IO.Compression.FileSystem
  $entries = @{}
  $zip = New-Object IO.Compression.ZipArchive((New-Object IO.MemoryStream(, $Bytes)), [IO.Compression.ZipArchiveMode]::Read)
  try {
    foreach ($entry in $zip.Entries) {
      if ($entry.FullName.EndsWith('/')) { continue }
      $ms = New-Object IO.MemoryStream
      $s = $entry.Open()
      try { $s.CopyTo($ms) } finally { $s.Dispose() }
      $entries[$entry.FullName] = $ms.ToArray()
    }
  } finally { $zip.Dispose() }
  $entries
}

# --- Outils externes ----------------------------------------------------------------------
# git, npm, web-ext et wrangler écrivent avertissements et progression sur stderr. Sous
# PowerShell 5.1, dès que stderr est redirigé (journal, CI, 2>&1), chaque ligne y devient une
# erreur que $ErrorActionPreference = 'Stop' rend fatale (git commit s'arrêtait ainsi sur
# « LF will be replaced by CRLF »). Ces fonctions passent en 'Continue' le temps de l'appel et
# ne jugent l'outil que sur son code de sortie.

# Lance l'outil, sa sortie à l'écran, et renvoie son code de sortie.
function Invoke-NativeCode([string] $Exe, [string[]] $Arguments) {
  $null = Get-Command $Exe -CommandType Application -ErrorAction Stop
  $ErrorActionPreference = 'Continue'
  & $Exe @Arguments | Out-Host
  $LASTEXITCODE
}

# Lance l'outil, sa sortie à l'écran, et s'arrête s'il échoue.
function Invoke-Native([string] $Exe, [string[]] $Arguments) {
  $code = Invoke-NativeCode $Exe $Arguments
  if ($code -ne 0) { throw "$Exe $($Arguments[0]) a échoué (code $code)." }
}

# Lance l'outil et renvoie ses lignes de sortie, stderr écarté ; $LASTEXITCODE dit s'il a réussi.
function Get-NativeOutput([string] $Exe, [string[]] $Arguments) {
  $null = Get-Command $Exe -CommandType Application -ErrorAction Stop
  $ErrorActionPreference = 'Continue'
  & $Exe @Arguments 2>$null
}
