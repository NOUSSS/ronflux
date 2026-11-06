# Publie une nouvelle version de Ronflux, en une commande :
#   1. monte la version là où elle figure (extension/manifest.base.json, @version et VERSION de
#      src/ronflux.user.js) ;
#   2. construit les paquets (build.ps1) ;
#   3. fait signer la version Firefox par addons.mozilla.org sur le canal « unlisted »
#      (web-ext sign) : AMO signe le paquet sans publier de fiche, le site l'héberge ;
#   4. prépare dist/publication/, avec l'arborescence du site :
#        updates.json                      manifeste de mise à jour Firefox (update_url)
#        telecharger/ronflux-firefox.xpi   paquet Firefox signé
#        telecharger/ronflux-chrome.zip    paquet Chrome (à envoyer aussi au Chrome Web Store)
#        telecharger/ronflux.user.js       userscript
#   5. commite la montée de version et pose l'étiquette vX.Y.Z (sauf -NoCommit) ;
#   6. construit le site (site/), y ajoute dist/publication/ et le déploie sur Cloudflare Pages
#      (wrangler pages deploy), sauf -NoDeploy ou si site/ n'existe pas.
# Seul l'envoi du ZIP au Chrome Web Store reste à faire à la main.
#
# Secrets chiffrés par DPAPI dans %USERPROFILE%\.secrets (README, section Publication) :
# amo-jwt-issuer et amo-jwt-secret (clés API AMO), cloudflare-pages ou, à défaut,
# cloudflare-write (jeton Cloudflare). Ils ne sont déchiffrés qu'au moment de s'en servir et
# passés à web-ext ou wrangler par l'environnement de ce seul processus, jamais en argument :
# ils ne sont ni affichés, ni journalisés, ni écrits ailleurs.
#
#   powershell -ExecutionPolicy Bypass -File .\release.ps1 -DryRun       # montre tout, ne modifie rien
#   powershell -ExecutionPolicy Bypass -File .\release.ps1               # 1.0.2 → 1.0.3
#   powershell -ExecutionPolicy Bypass -File .\release.ps1 -Bump minor   # 1.0.2 → 1.1.0
#   powershell -ExecutionPolicy Bypass -File .\release.ps1 -Version 1.2.0
#   powershell -ExecutionPolicy Bypass -File .\release.ps1 -SignedXpi <fichier.xpi>
#     reprise quand la version est déjà signée (arrêt pendant le déploiement, ou .xpi téléchargé
#     depuis le Developer Hub d'AMO) : ni nouvelle montée de version ni nouvelle signature.

param(
  [ValidatePattern('^\d+\.\d+\.\d+$')] [string] $Version,
  [ValidateSet('patch', 'minor', 'major')] [string] $Bump = 'patch',
  [string] $SignedXpi,
  [switch] $NoCommit,
  [switch] $NoDeploy,
  [switch] $DryRun
)

$ErrorActionPreference = 'Stop'
# Chemin donné par l'appelant : le résoudre avant de changer de dossier.
if ($SignedXpi) { $SignedXpi = (Resolve-Path -LiteralPath $SignedXpi).Path }
Set-Location $PSScriptRoot
. .\tools\common.ps1

$SecretNames = @{ key = 'amo-jwt-issuer'; secret = 'amo-jwt-secret' }
$CloudflareSecretNames = @('cloudflare-pages', 'cloudflare-write')
$AmoApi = 'https://addons.mozilla.org/api/v5/'
# Branche de production du projet Cloudflare Pages : un déploiement sur cette branche est servi
# à l'adresse principale du site.
$PagesBranch = 'main'

function Get-SecretPath([string] $Name) { Join-Path $env:USERPROFILE ".secrets\$Name.dpapi" }

# Même format que ~/.claude/scripts/secret.ps1 (ConvertFrom-SecureString, DPAPI du compte
# Windows courant). La valeur ne sort de cette fonction que pour aller dans l'environnement de
# web-ext ou de wrangler. Ces secrets ne contiennent jamais d'espace : celles qu'apporte un
# copier-coller sont retirées (sinon AMO répond « Error decoding signature »).
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

# Nom du secret Cloudflare à utiliser : un jeton dédié à Pages s'il est rangé, sinon le jeton
# général du compte.
function Get-CloudflareSecretName {
  foreach ($name in $CloudflareSecretNames) { if (Test-Path -LiteralPath (Get-SecretPath $name)) { return $name } }
  $null
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

function Test-GitRepo {
  if (-not (Get-Command git -CommandType Application -ErrorAction SilentlyContinue)) { return $false }
  $inside = Get-NativeOutput 'git' @('rev-parse', '--is-inside-work-tree')
  ($LASTEXITCODE -eq 0) -and ($inside -eq 'true')
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
$pagesProject = Get-PagesProject
$dist = Join-Path $PSScriptRoot 'dist'
$ffDir = Join-Path $dist 'firefox'
$amoDir = Join-Path $dist 'amo'
$pubDir = Join-Path $dist 'publication'
$siteDir = Join-Path $PSScriptRoot 'site'
$siteOut = Join-Path $siteDir 'dist'
$deployDir = Join-Path $PSScriptRoot 'tools\deploy'
$webExt = Join-Path $PSScriptRoot 'node_modules\web-ext\bin\web-ext.js'
$wrangler = Join-Path $deployDir 'node_modules\wrangler\bin\wrangler.js'
$versionPaths = @($VersionFiles | ForEach-Object { $_.Path } | Select-Object -Unique)
function Get-PubPath([string] $Key, [string] $Root = $pubDir) { Join-Path $Root ($PublicPaths[$Key].TrimStart('/').Replace('/', '\')) }
$signArgs = @('sign', '--channel', 'unlisted', '--amo-base-url', $AmoApi, '--source-dir', $ffDir, '--artifacts-dir', $amoDir, '--no-input', '--no-config-discovery')

$commit = -not $NoCommit
if ($commit -and -not (Test-GitRepo)) { Write-Warning 'Pas de dépôt git : commit et étiquette sautés.'; $commit = $false }
$deploy = -not $NoDeploy
$siteMissing = -not (Test-Path (Join-Path $siteDir 'package.json'))
if ($deploy -and $siteMissing) { Write-Warning 'site/ absent : déploiement sauté, dist/publication/ sera à déposer à la main.'; $deploy = $false }
$cloudflareSecret = Get-CloudflareSecretName

$signedBytes = $null
if ($SignedXpi) {
  # Lu tout de suite : le fichier peut se trouver dans dist/, que le build et la publication vident.
  $signedBytes = [IO.File]::ReadAllBytes($SignedXpi)
  Test-SignedXpi $signedBytes $target $firefoxId $null
}

$bumpLabel = if ($target -eq $current) { "$current (inchangée)" } else { "$current → $target" }
Write-Host "Ronflux $bumpLabel$(if ($DryRun) { '   [DryRun : rien n''est modifié]' })"
Write-Host "Site    : $($urls.site)"

if ($commit) {
  $dirty = @(Get-NativeOutput 'git' @('status', '--porcelain'))
  if ($dirty.Count) { Write-Warning "$($dirty.Count) fichier(s) modifié(s) non commité(s) : seuls les fichiers de version seront commités." }
}

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
  if ($commit) {
    Write-Host "5. Commit  : git commit -m `"Ronflux $target`" -- $($versionPaths -join ' ') ; git tag -a v$target"
  } else {
    Write-Host '5. Commit  : sauté'
  }
  if ($deploy) {
    $state = if ($cloudflareSecret) { "clé $cloudflareSecret présente" } else { "ABSENTE ($($CloudflareSecretNames -join ' ou ')) : voir README, Publication" }
    Write-Host "6. Site    : npm run build dans site/, dist/publication/ ajouté à site/dist/,"
    Write-Host "             wrangler pages deploy site/dist --project-name $pagesProject --branch $PagesBranch ($state)"
  } else {
    Write-Host '6. Site    : déploiement sauté'
  }
  exit 0
}

if (-not $SignedXpi) {
  foreach ($name in $SecretNames.Values) {
    if (-not (Test-Path -LiteralPath (Get-SecretPath $name))) { throw "Clé « $name » absente ($(Get-SecretPath $name)) : voir README, section Publication. Rien n'a été modifié." }
  }
}
if ($deploy -and -not $cloudflareSecret) {
  throw "Jeton Cloudflare absent ($($CloudflareSecretNames -join ' ou ')) : voir README, section Publication, ou relancer avec -NoDeploy. Rien n'a été modifié."
}

$bumped = $false
$resume = $null
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
    $resume = "release.ps1 -SignedXpi `"$SignedXpi`""
    Write-Host "3. Signature déjà faite : $SignedXpi"
  } else {
    if (Test-Path $amoDir) { Remove-Item -Recurse -Force $amoDir }
    New-Item -ItemType Directory $amoDir | Out-Null
    Write-Host "3. Signature par AMO (canal unlisted, web-ext $wev) : quelques minutes…"
    $toolEnv = Enter-ToolEnv @('WEB_EXT_') @{
      WEB_EXT_API_KEY    = (Read-DpapiSecret $SecretNames.key)
      WEB_EXT_API_SECRET = (Read-DpapiSecret $SecretNames.secret)
    }
    try {
      $code = Invoke-NativeCode 'node' (@($webExt) + $signArgs)
    } finally {
      Exit-ToolEnv $toolEnv
      $toolEnv = $null
    }
    if ($code -ne 0) {
      throw "web-ext sign a échoué (code $code). Si AMO a reçu la version, récupérer le .xpi signé sur le Developer Hub puis : release.ps1 -SignedXpi <fichier>."
    }
    $signed = @(Get-ChildItem -LiteralPath $amoDir -Filter '*.xpi' -File)
    if ($signed.Count -ne 1) { throw "$($signed.Count) fichier(s) .xpi dans dist/amo/ après la signature, un seul attendu." }
    $signedBytes = [IO.File]::ReadAllBytes($signed[0].FullName)
    Test-SignedXpi $signedBytes $target $firefoxId $ffDir
    $resume = "release.ps1 -SignedXpi `"$($signed[0].FullName)`""
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

  Write-Host "4. Ronflux $target prêt dans dist/publication/"
  foreach ($key in $PublicPaths.Keys) {
    $file = Get-PubPath $key
    Write-Host ("  {0,-34} {1,8} octets  sha256 {2}" -f $PublicPaths[$key].TrimStart('/'), (Get-Item $file).Length, (Get-FileHash -Algorithm SHA256 -LiteralPath $file).Hash.ToLowerInvariant())
  }

  # --- 5. Commit et étiquette -----------------------------------------------------------------
  # Avant le déploiement : la version est signée par AMO, son numéro est pris quoi qu'il arrive.
  # Seuls les fichiers de version sont commités, le reste de l'arbre de travail n'est pas touché.
  if ($commit) {
    $changed = @(Get-NativeOutput 'git' (@('status', '--porcelain', '--') + $versionPaths))
    if ($LASTEXITCODE -ne 0) { throw 'git status a échoué.' }
    if ($changed.Count) {
      Invoke-Native 'git' (@('commit', '--quiet', '-m', "Ronflux $target", '--') + $versionPaths)
    }
    $null = Get-NativeOutput 'git' @('rev-parse', '--quiet', '--verify', "refs/tags/v$target")
    if ($LASTEXITCODE -ne 0) { Invoke-Native 'git' @('tag', '-a', "v$target", '-m', "Ronflux $target") }
    Write-Host "5. Commit et étiquette v$target posés."
  }

  # --- 6. Site --------------------------------------------------------------------------------
  if ($deploy) {
    Write-Host '6. Construction du site…'
    Push-Location $siteDir
    try {
      if (-not (Test-Path 'node_modules\.package-lock.json')) { Invoke-Native 'npm.cmd' @('ci', '--no-audit', '--no-fund') }
      Invoke-Native 'npm.cmd' @('run', 'build')
    } finally { Pop-Location }
    if (-not (Test-Path (Join-Path $siteOut 'index.html'))) { throw "Le build du site n'a pas produit site/dist/index.html." }
    $headers = Join-Path $siteOut '_headers'
    if (-not ((Test-Path $headers) -and (Get-Content -Raw $headers).Contains('application/x-xpinstall'))) {
      throw 'site/dist/_headers ne sert pas le .xpi en application/x-xpinstall : Firefox le téléchargerait au lieu de l''installer.'
    }
    if (-not (Get-Content -Raw -Encoding UTF8 (Join-Path $siteOut 'index.html')).Contains($target)) {
      Write-Warning "La page d'accueil construite ne mentionne pas la version $target."
    }
    foreach ($key in $PublicPaths.Keys) {
      $dest = Get-PubPath $key $siteOut
      New-Item -ItemType Directory -Force (Split-Path $dest) | Out-Null
      Copy-Item -LiteralPath (Get-PubPath $key) $dest -Force
    }

    if (-not (Test-Path $wrangler)) {
      Push-Location $deployDir
      try { Invoke-Native 'npm.cmd' @('ci', '--no-audit', '--no-fund') } finally { Pop-Location }
    }
    $deployArgs = @('pages', 'deploy', $siteOut, '--project-name', $pagesProject, '--branch', $PagesBranch, '--commit-message', "Ronflux $target")
    $head = $null
    if (Test-GitRepo) {
      $head = Get-NativeOutput 'git' @('rev-parse', 'HEAD')
      if ($LASTEXITCODE -ne 0) { $head = $null }
    }
    if ($head) { $deployArgs += @('--commit-hash', $head) }
    $deployArgs += "--commit-dirty=$(if ($commit) { 'false' } else { 'true' })"
    Write-Host "   déploiement sur Cloudflare Pages ($pagesProject, branche $PagesBranch)…"
    # Lancé depuis tools/deploy : ses caches restent dans tools/deploy/node_modules.
    $toolEnv = Enter-ToolEnv @('CLOUDFLARE_', 'CF_', 'WRANGLER_') @{
      CLOUDFLARE_API_TOKEN  = (Read-DpapiSecret $cloudflareSecret)
      WRANGLER_SEND_METRICS = 'false'
    }
    Push-Location $deployDir
    try {
      $code = Invoke-NativeCode 'node' (@($wrangler) + $deployArgs)
    } finally {
      Pop-Location
      Exit-ToolEnv $toolEnv
      $toolEnv = $null
    }
    if ($code -ne 0) { throw "wrangler pages deploy a échoué (code $code)." }
    Write-Host "   en ligne : $($urls.site)"
  }

  Write-Host ''
  Write-Host "OK : Ronflux $target publié."
  Write-Host 'Reste à faire :'
  if (-not $deploy) { Write-Host "  - déposer le contenu de dist/publication/ à la racine du site ($($urls.site)) ;" }
  if (-not $commit) { Write-Host "  - committer la version : git commit -m `"Ronflux $target`" -- $($versionPaths -join ' ') puis git tag -a v$target ;" }
  Write-Host '  - Chrome Web Store : envoyer dist/publication/telecharger/ronflux-chrome.zip comme nouvelle version (docs/chrome-web-store.md).'
} catch {
  if ($resume) {
    Write-Warning "Arrêt après la signature. Reprendre avec : $resume"
  } elseif ($bumped) {
    Write-Warning "Arrêt après la montée de version. Reprendre avec : release.ps1 -Version $target"
  }
  throw
}
