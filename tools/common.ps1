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

# Identifiant de la fiche Chrome Web Store (release.ps1 y envoie chaque version). Il est public :
# c'est celui de l'adresse de la fiche.
function Get-ChromeWebStoreItem {
  $id = [string] (Read-Json 'distribution.json').chromeWebStoreItemId
  if ($id -notmatch '^[a-p]{32}$') {
    throw "distribution.json : chromeWebStoreItemId doit être l'identifiant de la fiche Chrome Web Store (32 lettres de a à p), reçu « $id »."
  }
  $id
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

# --- Secrets ------------------------------------------------------------------------------
# Chiffrés par DPAPI dans %USERPROFILE%\.secrets (README, section Publication), au format de
# ~/.claude/scripts/secret.ps1 (ConvertFrom-SecureString, DPAPI du compte Windows courant).

# Clé du compte de service Google qui envoie les versions au Chrome Web Store, avec
# l'identifiant d'éditeur : rangée par tools/chrome-web-store.ps1 -SaveKey.
$ChromeWebStoreSecret = 'chrome-web-store'

function Get-SecretPath([string] $Name) { Join-Path $env:USERPROFILE ".secrets\$Name.dpapi" }

# La valeur ne sort de cette fonction que pour aller dans l'environnement de l'outil qui s'en
# sert. Les espaces qu'un copier-coller ajoute aux extrémités sont retirés (sinon AMO répond
# « Error decoding signature »).
function Read-DpapiSecret([string] $Name) {
  $path = Get-SecretPath $Name
  if (-not (Test-Path -LiteralPath $path)) { throw "Clé « $Name » absente ($path) : voir README, section Publication." }
  try {
    $secure = (Get-Content -Raw -LiteralPath $path).Trim() | ConvertTo-SecureString
  } catch {
    throw "Clé « $Name » illisible ($path) : chiffrée par un autre compte Windows ou abîmée, la ranger de nouveau."
  }
  $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  try { $value = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr).Trim() }
  finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }
  if (-not $value) { throw "Clé « $Name » vide : la ranger de nouveau." }
  $value
}

# Environnement d'un outil qui reçoit un secret : les variables qui commencent par l'un des
# préfixes sont écartées (une valeur laissée par un autre projet pourrait détourner l'envoi),
# puis $Values est posé. Exit-ToolEnv remet tout en l'état, sans jamais afficher de valeur.
function Enter-ToolEnv([string[]] $ClearPrefixes, [hashtable] $Values) {
  $saved = @{}
  foreach ($item in @(Get-ChildItem Env:)) {
    foreach ($prefix in $ClearPrefixes) {
      if ($item.Name.StartsWith($prefix, [StringComparison]::OrdinalIgnoreCase)) { $saved[$item.Name] = $item.Value; break }
    }
  }
  $state = @{ Saved = $saved; Set = @($Values.Keys) }
  foreach ($name in $saved.Keys) { Remove-Item -LiteralPath "Env:\$name" }
  foreach ($name in $Values.Keys) { Set-Item -LiteralPath "Env:\$name" -Value $Values[$name] }
  $state
}

function Exit-ToolEnv($State) {
  foreach ($name in $State.Set) { Remove-Item -LiteralPath "Env:\$name" -ErrorAction SilentlyContinue }
  foreach ($name in $State.Saved.Keys) { Set-Item -LiteralPath "Env:\$name" -Value $State.Saved[$name] }
}

# --- Chrome Web Store ---------------------------------------------------------------------
# tools/chrome-web-store.mjs parle à l'API du store ; la clé lui arrive par la variable
# RONFLUX_CWS_KEY, posée le temps de l'appel. Renvoie le code de sortie du script.
function Invoke-ChromeWebStore([string[]] $Arguments) {
  $script = Join-Path $RepoRoot 'tools\chrome-web-store.mjs'
  $toolEnv = Enter-ToolEnv @('RONFLUX_CWS_') @{ RONFLUX_CWS_KEY = (Read-DpapiSecret $ChromeWebStoreSecret) }
  try {
    Invoke-NativeCode 'node' (@($script) + $Arguments)
  } finally {
    Exit-ToolEnv $toolEnv
  }
}

# Envoie un paquet Chrome au store puis le soumet à l'examen. Le paquet doit être celui de la
# version attendue : une fois envoyé, il remplace le brouillon de la fiche. Ne renvoie pas une
# version que le store a déjà (le script le vérifie avant l'envoi).
function Send-ChromeWebStorePackage([string] $ZipPath, [string] $ExpectedVersion) {
  $entries = Read-ZipEntries ([IO.File]::ReadAllBytes($ZipPath))
  if (-not $entries.ContainsKey('manifest.json')) { throw "$ZipPath n'a pas de manifest.json." }
  $version = ($Utf8NoBom.GetString($entries['manifest.json']).TrimStart([char]0xFEFF) | ConvertFrom-Json).version
  if ($version -notmatch '^\d+\.\d+\.\d+$') { throw "Version illisible dans le manifeste de $ZipPath : « $version »." }
  if ($ExpectedVersion -and $version -ne $ExpectedVersion) { throw "$ZipPath est en version $version, $ExpectedVersion attendue." }
  $code = Invoke-ChromeWebStore @('upload', (Get-ChromeWebStoreItem), $ZipPath, $version)
  if ($code -ne 0) { throw "L'envoi au Chrome Web Store a échoué (code $code)." }
}
