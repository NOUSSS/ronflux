# Chrome Web Store, par son API et un compte de service Google (README, section Publication) :
#
#   powershell -ExecutionPolicy Bypass -File .\tools\chrome-web-store.ps1 -SaveKey <clé.json> -PublisherId <id>
#     range la clé JSON du compte de service et l'identifiant d'éditeur, chiffrés par DPAPI dans
#     %USERPROFILE%\.secrets\chrome-web-store.dpapi. Le fichier .json n'est plus utile ensuite.
#   powershell -ExecutionPolicy Bypass -File .\tools\chrome-web-store.ps1 -Status
#     versions publiée et soumise de la fiche, sans rien modifier : vérifie aussi que la clé marche.
#   powershell -ExecutionPolicy Bypass -File .\tools\chrome-web-store.ps1 -Upload <paquet.zip> [-Version x.y.z]
#     envoie le paquet et le soumet à l'examen, comme l'étape 7 de release.ps1 (reprise).

[CmdletBinding(DefaultParameterSetName = 'Status')]
param(
  [Parameter(ParameterSetName = 'SaveKey', Mandatory)] [string] $SaveKey,
  [Parameter(ParameterSetName = 'SaveKey', Mandatory)] [string] $PublisherId,
  [Parameter(ParameterSetName = 'Status')] [switch] $Status,
  [Parameter(ParameterSetName = 'Upload', Mandatory)] [string] $Upload,
  [Parameter(ParameterSetName = 'Upload')] [ValidatePattern('^\d+\.\d+\.\d+$')] [string] $Version
)

$ErrorActionPreference = 'Stop'
# Chemins donnés par l'appelant : les résoudre avant de changer de dossier.
if ($SaveKey) { $SaveKey = (Resolve-Path -LiteralPath $SaveKey).Path }
if ($Upload) { $Upload = (Resolve-Path -LiteralPath $Upload).Path }
. (Join-Path $PSScriptRoot 'common.ps1')
Set-Location $RepoRoot

if ($PSCmdlet.ParameterSetName -eq 'SaveKey') {
  # Ni la clé ni son contenu ne sont affichés : seuls l'adresse du compte de service et le
  # chemin du secret le sont.
  try {
    $key = [IO.File]::ReadAllText($SaveKey, [Text.Encoding]::UTF8).TrimStart([char]0xFEFF) | ConvertFrom-Json
  } catch {
    throw "$SaveKey n'est pas un fichier JSON."
  }
  if ($key.type -ne 'service_account' -or -not $key.client_email -or ([string] $key.private_key) -notmatch '-----BEGIN PRIVATE KEY-----') {
    throw "$SaveKey n'est pas une clé JSON de compte de service Google (« type »: « service_account »)."
  }
  $PublisherId = $PublisherId.Trim()
  if ($PublisherId -notmatch '^[A-Za-z0-9_-]+$') {
    throw "Identifiant d'éditeur invalide : celui de la section « Compte » du tableau de bord du Chrome Web Store (lettres, chiffres et tirets)."
  }
  $value = [ordered]@{
    publisherId    = $PublisherId
    client_email   = [string] $key.client_email
    private_key_id = [string] $key.private_key_id
    private_key    = [string] $key.private_key
  } | ConvertTo-Json -Compress
  $path = Get-SecretPath $ChromeWebStoreSecret
  New-Item -ItemType Directory -Force (Split-Path $path) | Out-Null
  ConvertTo-SecureString -String $value -AsPlainText -Force | ConvertFrom-SecureString | Set-Content -Encoding ascii -LiteralPath $path
  if ((Read-DpapiSecret $ChromeWebStoreSecret) -ne $value) { throw "Relecture de $path différente de la clé rangée." }
  Write-Host "Clé du compte de service $($key.client_email) rangée dans $path."
  Write-Host "Vérification auprès du store…"
  $code = Invoke-ChromeWebStore @('status', (Get-ChromeWebStoreItem))
  if ($code -ne 0) { throw "La clé est rangée, mais le store la refuse (code $code) : voir le message ci-dessus." }
  Write-Host "La clé marche. Supprimez maintenant $SaveKey : Google ne la redonne pas, mais une nouvelle se crée au besoin."
  exit 0
}

if ($PSCmdlet.ParameterSetName -eq 'Upload') {
  Send-ChromeWebStorePackage $Upload $Version
  exit 0
}

$code = Invoke-ChromeWebStore @('status', (Get-ChromeWebStoreItem))
exit $code
