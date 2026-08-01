Param(
    [string]$KeystoreFile = "android/keystore/upload-keystore.jks",
    [string]$Alias = "upload",
    [string]$ValidityDays = "10000"
)

# Run from repository root: ./android/setup_release_signing.ps1
$root = Get-Location
$keystorePath = Join-Path $root $KeystoreFile
$keyPropsPath = Join-Path $root "android/key.properties"

if (Test-Path $keystorePath) {
    Write-Error "Keystore already exists: $keystorePath"
    exit 1
}

$keystoreDir = Split-Path -Parent $keystorePath
if (!(Test-Path $keystoreDir)) {
    New-Item -ItemType Directory -Path $keystoreDir -Force | Out-Null
}

$storePassword = Read-Host "Enter keystore password"
$keyPassword = Read-Host "Enter key password (can be same as keystore password)"

# keytool is provided by JDK; Flutter Android builds normally include this dependency.
keytool -genkeypair `
  -v `
  -storetype JKS `
  -keyalg RSA `
  -keysize 2048 `
  -validity $ValidityDays `
  -keystore $keystorePath `
  -alias $Alias `
  -storepass $storePassword `
  -keypass $keyPassword

if ($LASTEXITCODE -ne 0) {
    Write-Error "Failed to generate keystore."
    exit 1
}

$props = @(
    "storePassword=$storePassword"
    "keyPassword=$keyPassword"
    "keyAlias=$Alias"
    "storeFile=../keystore/$(Split-Path -Leaf $keystorePath)"
)

$props -join "`n" | Out-File -FilePath $keyPropsPath -Encoding ascii

Write-Output "Created: $keystorePath"
Write-Output "Created: $keyPropsPath"
Write-Output "IMPORTANT: Backup this keystore and passwords securely before publishing."
