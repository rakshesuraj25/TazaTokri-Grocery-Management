<#
.SYNOPSIS
  TazaTokri Automated Fail-Safe MySQL Backup Script (Windows PowerShell)
.DESCRIPTION
  Produces a consistent compressed & encrypted MySQL 8.4 backup using a
  protected temporary option file, verifies gzip and SHA-256 integrity,
  writes backup-status.json, and performs safe retention pruning.
#>
param(
    [string]$DbHost = $(if ($env:DB_HOST) { $env:DB_HOST } else { "localhost" }),
    [string]$DbPort = $(if ($env:DB_PORT) { $env:DB_PORT } else { "3306" }),
    [string]$DbName = $(if ($env:DB_NAME) { $env:DB_NAME } else { "tazatokri" }),
    [string]$DbUser = $(if ($env:DB_USERNAME) { $env:DB_USERNAME } else { "root" }),
    [string]$BackupDir = $(if ($env:BACKUP_DIR) { $env:BACKUP_DIR } else { (Join-Path $PSScriptRoot "..\backend\data\backups") }),
    [string]$BackupEnv = $(if ($env:BACKUP_ENV) { $env:BACKUP_ENV } else { "production" }),
    [int]$RetentionDays = $(if ($env:BACKUP_RETENTION_DAYS) { [int]$env:BACKUP_RETENTION_DAYS } else { 14 }),
    [switch]$AllowUnencryptedNonProd,
    [switch]$RetentionDryRun
)

$ErrorActionPreference = "Stop"
$StartTime = Get-Date
$BackupVersion = "6B.5.2"

New-Item -ItemType Directory -Force -Path $BackupDir | Out-Null
$ResolvedBackupDir = (Resolve-Path $BackupDir).Path

$Timestamp = $StartTime.ToString("yyyyMMdd_HHmmss")
$IsoTimestamp = $StartTime.ToString("yyyy-MM-ddTHH:mm:ssK")
$BackupId = "bkp_${Timestamp}_$PID"
$BackupType = if ($DbName -like "*test*") { "TEST_LOGICAL" } else { "FULL_LOGICAL" }

$RawSqlFileName = "tazatokri_backup_${Timestamp}.sql"
$GzFileName = "${RawSqlFileName}.gz"
$EncFileName = "${GzFileName}.enc"
$LogFilePath = Join-Path $ResolvedBackupDir "backup.log"
$StatusJsonPath = Join-Path $ResolvedBackupDir "backup-status.json"
$LockFilePath = Join-Path $ResolvedBackupDir ".backup.lock"

$TempDir = Join-Path ([System.IO.Path]::GetTempPath()) ("tazatokri_bkp_" + [guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Force -Path $TempDir | Out-Null
$CnfPath = Join-Path $TempDir "my.cnf"
$TempSqlPath = Join-Path $TempDir $RawSqlFileName
$TempGzPath = Join-Path $TempDir $GzFileName
$TempEncPath = Join-Path $TempDir $EncFileName

$Compressed = $false
$Encrypted = $false
$VerificationStatus = "FAILED"

function Write-BackupLog([string]$Level, [string]$Message) {
    $Line = "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') [$Level] $Message"
    Add-Content -Path $LogFilePath -Value $Line -Encoding UTF8
    Write-Output $Line
}

function Write-StatusJson([string]$Status, [string]$FileName, [long]$SizeBytes, [string]$Sha256, [string]$VerifyStatus, [string]$FailReason) {
    $Duration = [int]((Get-Date) - $StartTime).TotalSeconds
    $Payload = @{
        status             = $Status
        backupId           = $BackupId
        backupType         = $BackupType
        databaseName       = $DbName
        timestamp          = $IsoTimestamp
        lastBackupAt       = $IsoTimestamp
        fileName           = $FileName
        backupFilename     = $FileName
        fileSizeBytes      = $SizeBytes
        sha256             = $Sha256
        sha256Checksum     = $Sha256
        compressed         = $Compressed
        encrypted          = $Encrypted
        durationSeconds    = $Duration
        backupVersion      = $BackupVersion
        verificationStatus = $VerifyStatus
        failureReason      = $FailReason
    } | ConvertTo-Json -Depth 3
    $TempStatus = "${StatusJsonPath}.tmp"
    Set-Content -Path $TempStatus -Value $Payload -Encoding UTF8
    Move-Item -Path $TempStatus -Destination $StatusJsonPath -Force
}

if (Test-Path $LockFilePath) {
    Write-BackupLog "ERROR" "Another backup job is already running ($LockFilePath)."
    throw "Backup lock exists."
}
Set-Content -Path $LockFilePath -Value "$PID" -Encoding ASCII

try {
    $DbPassword = if ($env:DB_PASSWORD) { $env:DB_PASSWORD } elseif ($env:MYSQL_PWD) { $env:MYSQL_PWD } else { "" }
    if ([string]::IsNullOrWhiteSpace($DbPassword)) {
        throw "DB_PASSWORD environment variable is required."
    }

    $Passphrase = if ($env:BACKUP_ENCRYPTION_PASSPHRASE) { $env:BACKUP_ENCRYPTION_PASSPHRASE } else { "" }
    if ([string]::IsNullOrWhiteSpace($Passphrase) -and $BackupEnv -eq "production" -and -not $AllowUnencryptedNonProd) {
        throw "BACKUP_ENCRYPTION_PASSPHRASE is required in production mode."
    }

    $MysqldumpCmd = Get-Command "mysqldump" -ErrorAction SilentlyContinue
    if (-not $MysqldumpCmd) {
        foreach ($p in @("C:\Program Files\MySQL\MySQL Server 8.4\bin\mysqldump.exe", "C:\Program Files\MySQL\MySQL Server 8.0\bin\mysqldump.exe")) {
            if (Test-Path $p) { $MysqldumpCmd = $p; break }
        }
    }
    if (-not $MysqldumpCmd) {
        throw "mysqldump binary not found."
    }
    $ExePath = if ($MysqldumpCmd -is [string]) { $MysqldumpCmd } else { $MysqldumpCmd.Source }

    # Temporary protected MySQL option file (never pass password in CLI args)
    $CnfContent = "[client]`nhost=$DbHost`nport=$DbPort`nuser=$DbUser`npassword=$DbPassword`n"
    [System.IO.File]::WriteAllText($CnfPath, $CnfContent, [System.Text.UTF8Encoding]::new($false))

    Write-BackupLog "INFO" "Starting MySQL 8.4 backup ($BackupId) for '$DbName' on ${DbHost}:${DbPort}"
    $DumpErrFile = Join-Path $TempDir "mysqldump.err"
    $proc = Start-Process -FilePath $ExePath -ArgumentList @(
        "--defaults-extra-file=$CnfPath",
        "--single-transaction",
        "--routines",
        "--triggers",
        "--events",
        "--hex-blob",
        "--set-gtid-purged=OFF",
        "--default-character-set=utf8mb4",
        "--result-file=$TempSqlPath",
        $DbName
    ) -Wait -NoNewWindow -PassThru -RedirectStandardError $DumpErrFile

    if ($proc.ExitCode -ne 0 -or -not (Test-Path $TempSqlPath) -or ((Get-Item $TempSqlPath).Length -lt 100)) {
        $ErrText = if (Test-Path $DumpErrFile) { (Get-Content $DumpErrFile -Raw) -replace "password=[^\s]+", "password=[REDACTED]" } else { "ExitCode=$($proc.ExitCode)" }
        throw "mysqldump failed: $ErrText"
    }

    # Compress to .sql.gz
    $InStream = [System.IO.File]::OpenRead($TempSqlPath)
    $OutStream = [System.IO.File]::Create($TempGzPath)
    $GzipStream = New-Object System.IO.Compression.GzipStream($OutStream, [System.IO.Compression.CompressionLevel]::Optimal)
    try { $InStream.CopyTo($GzipStream) } finally { $GzipStream.Dispose(); $OutStream.Dispose(); $InStream.Dispose() }
    if (-not (Test-Path $TempGzPath) -or ((Get-Item $TempGzPath).Length -eq 0)) {
        throw "Gzip compression produced an empty file."
    }
    $Compressed = $true
    Remove-Item -Force $TempSqlPath

    $FinalFileName = $GzFileName
    $FinalTempPath = $TempGzPath

    # Encrypt with native .NET Authenticated Encryption (AES-256-CBC + PBKDF2-SHA256 + HMAC-SHA256)
    if (-not [string]::IsNullOrWhiteSpace($Passphrase)) {
        $Salt = New-Object byte[] 16
        $Iv = New-Object byte[] 16
        $Rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
        $Rng.GetBytes($Salt); $Rng.GetBytes($Iv); $Rng.Dispose()
        $Kdf = New-Object System.Security.Cryptography.Rfc2898DeriveBytes($Passphrase, $Salt, 100000, [System.Security.Cryptography.HashAlgorithmName]::SHA256)
        $EncKey = $Kdf.GetBytes(32)
        $MacKey = $Kdf.GetBytes(32)
        $Kdf.Dispose()

        $PlainBytes = [System.IO.File]::ReadAllBytes($TempGzPath)
        $Aes = [System.Security.Cryptography.Aes]::Create()
        $Aes.KeySize = 256; $Aes.Mode = [System.Security.Cryptography.CipherMode]::CBC; $Aes.Padding = [System.Security.Cryptography.PaddingMode]::PKCS7
        $Aes.Key = $EncKey; $Aes.IV = $Iv
        $Encryptor = $Aes.CreateEncryptor()
        $CipherBytes = $Encryptor.TransformFinalBlock($PlainBytes, 0, $PlainBytes.Length)
        $Encryptor.Dispose(); $Aes.Dispose()

        $Magic = [System.Text.Encoding]::ASCII.GetBytes("TTENC1")
        $AuthPayload = New-Object byte[] ($Magic.Length + $Salt.Length + $Iv.Length + $CipherBytes.Length)
        [Buffer]::BlockCopy($Magic, 0, $AuthPayload, 0, $Magic.Length)
        [Buffer]::BlockCopy($Salt, 0, $AuthPayload, $Magic.Length, $Salt.Length)
        [Buffer]::BlockCopy($Iv, 0, $AuthPayload, $Magic.Length + $Salt.Length, $Iv.Length)
        [Buffer]::BlockCopy($CipherBytes, 0, $AuthPayload, $Magic.Length + $Salt.Length + $Iv.Length, $CipherBytes.Length)

        $Hmac = New-Object System.Security.Cryptography.HMACSHA256 -ArgumentList @(,$MacKey)
        $Tag = $Hmac.ComputeHash($AuthPayload)
        $Hmac.Dispose()

        $OutFs = [System.IO.File]::Create($TempEncPath)
        try { $OutFs.Write($AuthPayload, 0, $AuthPayload.Length); $OutFs.Write($Tag, 0, $Tag.Length) } finally { $OutFs.Dispose() }
        if (-not (Test-Path $TempEncPath) -or ((Get-Item $TempEncPath).Length -le 70)) {
            throw "Backup encryption failed."
        }
        Remove-Item -Force $TempGzPath
        $FinalFileName = $EncFileName
        $FinalTempPath = $TempEncPath
        $Encrypted = $true
    }

    # Compute and verify SHA-256 before moving to official backup dir
    $Sha256 = (Get-FileHash -Path $FinalTempPath -Algorithm SHA256).Hash.ToLowerInvariant()
    $TempShaPath = "${FinalTempPath}.sha256"
    [System.IO.File]::WriteAllText($TempShaPath, "$Sha256  $FinalFileName`n", [System.Text.UTF8Encoding]::new($false))
    $VerifySha = (Get-FileHash -Path $FinalTempPath -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($VerifySha -ne $Sha256) {
        throw "SHA-256 post-write verification mismatch."
    }

    $DestPath = Join-Path $ResolvedBackupDir $FinalFileName
    $DestShaPath = "${DestPath}.sha256"
    Move-Item -Path $FinalTempPath -Destination $DestPath -Force
    Move-Item -Path $TempShaPath -Destination $DestShaPath -Force

    $FileSize = (Get-Item $DestPath).Length
    $VerificationStatus = "VERIFIED"
    Write-StatusJson "SUCCESS" $FinalFileName $FileSize $Sha256 "VERIFIED" $null

    # Safe retention cleanup (never deletes latest backup, never touches phase6a artifacts, never fails backup)
    if ($RetentionDays -gt 0) {
        try {
            $Cutoff = (Get-Date).AddDays(-$RetentionDays)
            Get-ChildItem -Path $ResolvedBackupDir -File | Where-Object {
                $_.LastWriteTime -lt $Cutoff -and
                $_.Name -ne $FinalFileName -and
                $_.Name -ne "${FinalFileName}.sha256" -and
                $_.Name -notlike "*phase6a*" -and
                $_.Name -match '^tazatokri_backup_\d{8}_\d{6}\.sql(\.gz)?(\.enc)?(\.sha256)?$'
            } | ForEach-Object {
                if ($RetentionDryRun) {
                    Write-BackupLog "INFO" "[DRY-RUN] Would prune expired backup: $($_.Name)"
                } else {
                    Remove-Item -Path $_.FullName -Force
                    Write-BackupLog "INFO" "Pruned expired backup: $($_.Name)"
                }
            }
        } catch {
            Write-BackupLog "WARN" "Retention cleanup warning (backup itself remains valid): $($_.Exception.Message)"
        }
    }

    Write-BackupLog "INFO" "Backup $BackupId completed and verified ($FileSize bytes, sha256=$Sha256, encrypted=$Encrypted)"
} catch {
    $Reason = $_.Exception.Message -replace "password=[^\s]+", "password=[REDACTED]"
    Write-BackupLog "ERROR" "Backup $BackupId FAILED: $Reason"
    Write-StatusJson "FAILED" $null 0 $null "FAILED" $Reason
    exit 1
} finally {
    if (Test-Path $TempDir) { Remove-Item -Path $TempDir -Recurse -Force -ErrorAction SilentlyContinue }
    if (Test-Path $LockFilePath) { Remove-Item -Path $LockFilePath -Force -ErrorAction SilentlyContinue }
}
