# Publie une nouvelle version de Ronflux :
#   1. monte la version là où elle figure (extension/manifest.base.json, @version et VERSION de
#      src/ronflux.user.js) ;
#   2. construit les paquets (build.ps1) ;
#   3. fait signer la version Firefox par addons.mozilla.org sur le canal « unlisted »
#      (web-ext sign) : AMO signe le paquet sans publier de fiche, le site l'héberge ;
#   4. prépare dist/publication/, à déposer tel quel à la racine du site :
#        updates.json                      manifeste de mise à jour Firefox (update_url)
#        telecharger/ronflux-firefox.xpi   paquet Firefox signé
#        telecharger/ronflux-chrome.zip    paquet Chrome (à envoyer aussi au Chrome Web Store)
#        telecharger/ronflux.user.js       userscript
#
# Clés API AMO : secrets chiffrés par DPAPI, %USERPROFILE%\.secrets\amo-jwt-issuer.dpapi et
# amo-jwt-secret.dpapi (README, section Publication). Elles ne sont déchiffrées qu'au moment de
# signer et passées à web-ext par l'environnement de ce seul processus, jamais en argument :
# elles ne sont ni affichées, ni journalisées, ni écrites ailleurs.
#
#   powershell -ExecutionPolicy Bypass -File .\release.ps1 -DryRun       # montre tout, ne modifie rien
#   powershell -ExecutionPolicy Bypass -File .\release.ps1               # 1.0.2 → 1.0.3
#   powershell -ExecutionPolicy Bypass -File .\release.ps1 -Bump minor   # 1.0.2 → 1.1.0
#   powershell -ExecutionPolicy Bypass -File .\release.ps1 -Version 1.2.0
#   powershell -ExecutionPolicy Bypass -File .\release.ps1 -SignedXpi <fichier.xpi>
#     reprise quand AMO a signé mais que web-ext n'a pas pu récupérer le fichier (téléchargé
#     depuis le Developer Hub) : pas de nouvelle montée de version ni de signature.

param(
  [ValidatePattern('^\d+\.\d+\.\d+$')] [string] $Version,
  [ValidateSet('patch', 'minor', 'major')] [string] $Bump = 'patch',
  [string] $SignedXpi,
  [switch] $DryRun
)

$ErrorActionPreference = 'Stop'
# Chemin donné par l'appelant : le résoudre avant de changer de dossier.
if ($SignedXpi) { $SignedXpi = (Resolve-Path -LiteralPath $SignedXpi).Path }
Set-Location $PSScriptRoot
. .\tools\common.ps1

$SecretNames = @{ key = 'amo-jwt-issuer'; secret = 'amo-jwt-secret' }
$AmoApi = 'https://addons.mozilla.org/api/v5/'

function Get-SecretPath([string] $Name) { Join-Path $env:USERPROFILE ".secrets\$Name.dpapi" }

# Même format que ~/.claude/scripts/secret.ps1 (ConvertFrom-SecureString, DPAPI du compte
# Windows courant). La valeur ne sort de cette fonction que pour aller dans l'environnement de
# web-ext.
function Read-DpapiSecret([string] $Name) {
  $path = Get-SecretPath $Name
  if (-not (Test-Path -LiteralPath $path)) { throw "Clé « $Name » absente ($path) : voir README, section Publication." }
  try {
    $secure = (Get-Content -Raw -LiteralPath $path).Trim() | ConvertTo-SecureString
  } catch {
    throw "Clé « $Name » illisible ($path) : chiffrée par un autre compte Windows ou abîmée, la ranger de nouveau."
  }
  $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  try { [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr) }
  finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }
}

# Vérifie un .xpi signé : signature AMO présente, et contenu identique, fichier par fichier, à
# dist/firefox (ou, sans build, au moins même identifiant et même version).
function Test-SignedXpi([byte[]] $Bytes, [string] $ExpectedVersion, [string] $ExpectedId, [string] $BuiltDir) {
  $entries = Read-ZipEntries $Bytes
  if (-not ($entries.ContainsKey('META-INF/mozilla.rsa') -or $entries.ContainsKey('META-INF/cose.sig'))) {
    throw 'Le .xpi n''est pas signé par AMO (pas de META-INF/mozilla.rsa ni cose.sig).'
  }
  if (-not $entries.ContainsKey('manifest.json')) { throw 'Le .xpi n''a pas de manifest.json.' }
  $manifest = $Utf8NoBom.GetString($entries['manifest.json']).TrimStart([char]0xFEFF) | ConvertFrom-Json
  if ($manifest.version -ne $ExpectedVersion) { throw "Le .xpi signé est en version $($manifest.version), $ExpectedVersion attendue." }
  if ($manifest.browser_specific_settings.gecko.id -ne $ExpectedId) { throw "Le .xpi signé a l'identifiant $($manifest.browser_specific_settings.gecko.id), $ExpectedId attendu." }
  if (-not $BuiltDir) { return }
  $prefix = (Resolve-Path -LiteralPath $BuiltDir).Path.TrimEnd('\') + '\'
  # Fichiers cachés exclus : web-ext les ignore en construisant le paquet et range ici son suivi
  # d'envoi (.amo-upload-uuid).
  $built = @{}
  Get-ChildItem -LiteralPath $BuiltDir -Recurse -File -Force |
    ForEach-Object { $_.FullName.Substring($prefix.Length).Replace('\', '/') } |
    Where-Object { $_ -notmatch '(^|/)\.' } |
    ForEach-Object { $built[$_] = Join-Path $BuiltDir $_ }
  $signedNames = @($entries.Keys | Where-Object { -not $_.StartsWith('META-INF/') })
  $diff = @()
  foreach ($name in $signedNames) {
    if (-not $built.ContainsKey($name)) { $diff += "$name (en trop)"; continue }
    $a = $entries[$name]; $b = [IO.File]::ReadAllBytes($built[$name])
    if ($a.Length -ne $b.Length -or [Convert]::ToBase64String($a) -ne [Convert]::ToBase64String($b)) { $diff += "$name (différent)" }
  }
  foreach ($name in $built.Keys) { if ($signedNames -notcontains $name) { $diff += "$name (absent)" } }
  if ($diff.Count) { throw "Le .xpi signé ne correspond pas à dist/firefox : $($diff -join ', ')." }
}

# --- Version visée ------------------------------------------------------------------------
$current = Get-ProjectVersion
if ($Version) {
  $target = $Version
} elseif ($SignedXpi) {
  $target = $current
} else {
  $v = [version] $current
  $target = switch ($Bump) {
    'major' { '{0}.0.0' -f ($v.Major + 1) }
    'minor' { '{0}.{1}.0' -f $v.Major, ($v.Minor + 1) }
    default { '{0}.{1}.{2}' -f $v.Major, $v.Minor, ($v.Build + 1) }
  }
}
if ((Compare-Version $target $current) -lt 0) { throw "Version $target inférieure à la version actuelle $current." }

$urls = Get-SiteUrls
$firefoxId = Get-FirefoxId
$dist = Join-Path $PSScriptRoot 'dist'
$ffDir = Join-Path $dist 'firefox'
$amoDir = Join-Path $dist 'amo'
$pubDir = Join-Path $dist 'publication'
$webExt = Join-Path $PSScriptRoot 'node_modules\web-ext\bin\web-ext.js'
function Get-PubPath([string] $Key) { Join-Path $pubDir ($PublicPaths[$Key].TrimStart('/').Replace('/', '\')) }
$signArgs = @('sign', '--channel', 'unlisted', '--amo-base-url', $AmoApi, '--source-dir', $ffDir, '--artifacts-dir', $amoDir, '--no-input', '--no-config-discovery')

$signedBytes = $null
if ($SignedXpi) {
  # Lu tout de suite : le fichier peut se trouver dans dist/, que le build et la publication vident.
  $signedBytes = [IO.File]::ReadAllBytes($SignedXpi)
  Test-SignedXpi $signedBytes $target $firefoxId $null
}

$bumpLabel = if ($target -eq $current) { "$current (inchangée)" } else { "$current → $target" }
Write-Host "Ronflux $bumpLabel$(if ($DryRun) { '   [DryRun : rien n''est modifié]' })"
Write-Host "Site    : $($urls.site)"

$dirty = @()
try { $dirty = @(& git status --porcelain 2>$null) } catch { }
if ($dirty.Count) { Write-Warning "$($dirty.Count) fichier(s) modifié(s) non commité(s) : la montée de version s'y ajoutera." }

if ($DryRun) {
  if ($target -ne $current) {
    Write-Host "1. Version : $current → $target dans"
    foreach ($spec in $VersionFiles) { Write-Host "     $($spec.Label)" }
  } else {
    Write-Host '1. Version : inchangée'
  }
  Write-Host '2. Build   : build.ps1'
  if ($SignedXpi) {
    Write-Host "3. Signature : déjà faite, $SignedXpi (signature AMO, identifiant et version vérifiés)"
  } else {
    $wev = if (Test-Path $webExt) { (Get-Content -Raw (Join-Path $PSScriptRoot 'node_modules\web-ext\package.json') | ConvertFrom-Json).version } else { 'non installé (npm ci)' }
    Write-Host "3. Signature : web-ext $wev $($signArgs -join ' ')"
    foreach ($name in $SecretNames.Values) {
      $state = if (Test-Path -LiteralPath (Get-SecretPath $name)) { 'présente' } else { 'ABSENTE : voir README, Publication' }
      Write-Host "     clé $name : $state"
    }
  }
  Write-Host '4. Publication : dist/publication/'
  foreach ($key in $PublicPaths.Keys) { Write-Host ("     {0,-34} → {1}" -f $PublicPaths[$key].TrimStart('/'), $urls.$key) }
  Write-Host "     updates.json : $firefoxId $target → $($urls.firefox) (sha256 du .xpi signé)"
  exit 0
}

if (-not $SignedXpi) {
  foreach ($name in $SecretNames.Values) {
    if (-not (Test-Path -LiteralPath (Get-SecretPath $name))) { throw "Clé « $name » absente ($(Get-SecretPath $name)) : voir README, section Publication. Rien n'a été modifié." }
  }
}

$bumped = $false
try {
  # --- 1. Version ---------------------------------------------------------------------------
  if ($target -ne $current) {
    Set-ProjectVersion $target
    $bumped = $true
    if ((Get-ProjectVersion) -ne $target) { throw 'Montée de version incomplète.' }
    Write-Host "1. Version $target écrite."
  }

  # --- 2. Build -----------------------------------------------------------------------------
  & (Join-Path $PSScriptRoot 'build.ps1')
  if (-not (Test-Path $webExt)) { Invoke-Native 'npm.cmd' @('ci', '--no-audit', '--no-fund') }
  $wev = [version] (Get-Content -Raw (Join-Path $PSScriptRoot 'node_modules\web-ext\package.json') | ConvertFrom-Json).version
  if ($wev.Major -lt 8) { throw "web-ext $wev trop ancien : 8 ou plus (npm ci)." }

  # --- 3. Signature ---------------------------------------------------------------------------
  if ($SignedXpi) {
    Test-SignedXpi $signedBytes $target $firefoxId $ffDir
    Write-Host "3. Signature déjà faite : $SignedXpi"
  } else {
    if (Test-Path $amoDir) { Remove-Item -Recurse -Force $amoDir }
    New-Item -ItemType Directory $amoDir | Out-Null
    Write-Host "3. Signature par AMO (canal unlisted, web-ext $wev) : quelques minutes…"
    # Les WEB_EXT_* déjà présents (autre projet) pourraient détourner l'envoi : on les écarte le
    # temps de la signature et on les remet ensuite, sans jamais afficher de valeur.
    $savedEnv = @{}
    foreach ($item in @(Get-ChildItem Env: | Where-Object { $_.Name -like 'WEB_EXT_*' })) {
      $savedEnv[$item.Name] = $item.Value
      Remove-Item -LiteralPath "Env:\$($item.Name)"
    }
    try {
      $env:WEB_EXT_API_KEY = Read-DpapiSecret $SecretNames.key
      $env:WEB_EXT_API_SECRET = Read-DpapiSecret $SecretNames.secret
      & node $webExt @signArgs
      $code = $LASTEXITCODE
    } finally {
      foreach ($name in @('WEB_EXT_API_KEY', 'WEB_EXT_API_SECRET')) { Remove-Item -LiteralPath "Env:\$name" -ErrorAction SilentlyContinue }
      foreach ($name in $savedEnv.Keys) { Set-Item -LiteralPath "Env:\$name" -Value $savedEnv[$name] }
    }
    if ($code -ne 0) {
      throw "web-ext sign a échoué (code $code). Si AMO a reçu la version, récupérer le .xpi signé sur le Developer Hub puis : release.ps1 -SignedXpi <fichier>."
    }
    $signed = @(Get-ChildItem -LiteralPath $amoDir -Filter '*.xpi' -File)
    if ($signed.Count -ne 1) { throw "$($signed.Count) fichier(s) .xpi dans dist/amo/ après la signature, un seul attendu." }
    $signedBytes = [IO.File]::ReadAllBytes($signed[0].FullName)
    Test-SignedXpi $signedBytes $target $firefoxId $ffDir
    Write-Host "   signé : $($signed[0].Name)"
  }

  # --- 4. Publication -------------------------------------------------------------------------
  if (Test-Path $pubDir) { Remove-Item -Recurse -Force $pubDir }
  foreach ($key in $PublicPaths.Keys) { New-Item -ItemType Directory -Force (Split-Path (Get-PubPath $key)) | Out-Null }

  [IO.File]::WriteAllBytes((Get-PubPath 'firefox'), $signedBytes)
  Copy-Item -LiteralPath (Join-Path $dist 'ronflux-chrome.zip') (Get-PubPath 'chrome')
  Copy-Item -LiteralPath (Join-Path $dist 'ronflux.user.js') (Get-PubPath 'userscript')

  $hash = (Get-FileHash -Algorithm SHA256 -LiteralPath (Get-PubPath 'firefox')).Hash.ToLowerInvariant()
  $update = [ordered]@{ version = $target; update_link = $urls.firefox; update_hash = "sha256:$hash" }
  $minVersion = (Get-Content -Raw -Encoding UTF8 (Join-Path $ffDir 'manifest.json') | ConvertFrom-Json).browser_specific_settings.gecko.strict_min_version
  if ($minVersion) { $update.applications = [ordered]@{ gecko = [ordered]@{ strict_min_version = $minVersion } } }
  $updates = [ordered]@{ addons = [ordered]@{ $firefoxId = [ordered]@{ updates = @($update) } } }
  [IO.File]::WriteAllText((Get-PubPath 'updates'), ($updates | ConvertTo-Json -Depth 10) + "`n", $Utf8NoBom)

  Write-Host ''
  Write-Host "OK : Ronflux $target prêt dans dist/publication/"
  foreach ($key in $PublicPaths.Keys) {
    $file = Get-PubPath $key
    Write-Host ("  {0,-34} {1,8} octets  sha256 {2}" -f $PublicPaths[$key].TrimStart('/'), (Get-Item $file).Length, (Get-FileHash -Algorithm SHA256 -LiteralPath $file).Hash.ToLowerInvariant())
  }
  Write-Host ''
  Write-Host 'À faire ensuite :'
  Write-Host "  - déposer le contenu de dist/publication/ à la racine du site ($($urls.site)) ;"
  Write-Host '  - Chrome Web Store : envoyer telecharger/ronflux-chrome.zip comme nouvelle version (docs/chrome-web-store.md) ;'
  Write-Host "  - committer la version : git commit -am `"Ronflux $target`" puis git tag v$target."
} catch {
  if ($bumped) {
    Write-Warning "Arrêt après la montée de version. Reprendre avec : release.ps1 -Version $target"
  }
  throw
}
