<#
.SYNOPSIS
  TazaTokri Proof-of-Delivery (POD) Uploads Backup Script (Windows PowerShell)
.DESCRIPTION
  Archives local POD uploads preserving relative paths, optionally encrypts with
  OpenSSL AES-256-CBC PBKDF2, and writes a SHA-256 checksum without modifying originals.
#>
param(
    [string]$UploadsDir = $(if ($env:STORAGE_LOCAL_DIR) { $env:STORAGE_LOCAL_DIR } else { (Join-Path $PSScriptRoot "..\backend\data\private-uploads") }),
    [string]$BackupDir = $(if ($env:BACKUP_DIR) { (Join-Path $env:BACKUP_DIR "uploads") } else { (Join-Path $PSScriptRoot "..\backend\data\backups\uploads") })
)

$ErrorActionPreference = "Stop"
if (-not (Test-Path $UploadsDir)) {
    Write-Output "INFO: Uploads directory '$UploadsDir' does not exist; skipping POD upload backup."
    exit 0
}

New-Item -ItemType Directory -Force -Path $BackupDir | Out-Null
$ResolvedBackup = (Resolve-Path $BackupDir).Path
$Timestamp = (Get-Date).ToString("yyyyMMdd_HHmmss")
$TempDir = Join-Path ([System.IO.Path]::GetTempPath()) ("tazatokri_pod_" + [guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Force -Path $TempDir | Out-Null

try {
    $TarName = "tazatokri_uploads_${Timestamp}.tar.gz"
    $TempTar = Join-Path $TempDir $TarName
    tar -C $UploadsDir -czf $TempTar .
    if ($LASTEXITCODE -ne 0 -or -not (Test-Path $TempTar)) {
        throw "Failed to archive uploads directory."
    }

    $FinalName = $TarName
    $FinalTemp = $TempTar
    if ($env:BACKUP_ENCRYPTION_PASSPHRASE) {
        $FinalName = "${TarName}.enc"
        $FinalTemp = Join-Path $TempDir $FinalName
        $Salt = New-Object byte[] 16; $Iv = New-Object byte[] 16
        $Rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
        $Rng.GetBytes($Salt); $Rng.GetBytes($Iv); $Rng.Dispose()
        $Kdf = New-Object System.Security.Cryptography.Rfc2898DeriveBytes($env:BACKUP_ENCRYPTION_PASSPHRASE, $Salt, 100000, [System.Security.Cryptography.HashAlgorithmName]::SHA256)
        $EncKey = $Kdf.GetBytes(32); $MacKey = $Kdf.GetBytes(32); $Kdf.Dispose()
        $PlainBytes = [System.IO.File]::ReadAllBytes($TempTar)
        $Aes = [System.Security.Cryptography.Aes]::Create()
        $Aes.KeySize = 256; $Aes.Mode = [System.Security.Cryptography.CipherMode]::CBC; $Aes.Padding = [System.Security.Cryptography.PaddingMode]::PKCS7
        $Aes.Key = $EncKey; $Aes.IV = $Iv
        $Enc = $Aes.CreateEncryptor(); $Cipher = $Enc.TransformFinalBlock($PlainBytes, 0, $PlainBytes.Length); $Enc.Dispose(); $Aes.Dispose()
        $Magic = [System.Text.Encoding]::ASCII.GetBytes("TTENC1")
        $AuthPayload = New-Object byte[] ($Magic.Length + $Salt.Length + $Iv.Length + $Cipher.Length)
        [Buffer]::BlockCopy($Magic, 0, $AuthPayload, 0, $Magic.Length)
        [Buffer]::BlockCopy($Salt, 0, $AuthPayload, $Magic.Length, $Salt.Length)
        [Buffer]::BlockCopy($Iv, 0, $AuthPayload, $Magic.Length + $Salt.Length, $Iv.Length)
        [Buffer]::BlockCopy($Cipher, 0, $AuthPayload, $Magic.Length + $Salt.Length + $Iv.Length, $Cipher.Length)
        $Hmac = New-Object System.Security.Cryptography.HMACSHA256 -ArgumentList @(,$MacKey); $Tag = $Hmac.ComputeHash($AuthPayload); $Hmac.Dispose()
        $Fs = [System.IO.File]::Create($FinalTemp); try { $Fs.Write($AuthPayload, 0, $AuthPayload.Length); $Fs.Write($Tag, 0, $Tag.Length) } finally { $Fs.Dispose() }
        Remove-Item -Force $TempTar
    }

    $Sha256 = (Get-FileHash -Path $FinalTemp -Algorithm SHA256).Hash.ToLowerInvariant()
    $TempSha = "${FinalTemp}.sha256"
    [System.IO.File]::WriteAllText($TempSha, "$Sha256  $FinalName`n", [System.Text.UTF8Encoding]::new($false))
    Move-Item -Path $FinalTemp -Destination (Join-Path $ResolvedBackup $FinalName) -Force
    Move-Item -Path $TempSha -Destination (Join-Path $ResolvedBackup "${FinalName}.sha256") -Force
    Write-Output "POD upload backup completed: $(Join-Path $ResolvedBackup $FinalName) (sha256=$Sha256)"
} finally {
    if (Test-Path $TempDir) { Remove-Item -Path $TempDir -Recurse -Force -ErrorAction SilentlyContinue }
}
