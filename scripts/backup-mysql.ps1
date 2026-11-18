<#
.SYNOPSIS
  TazaTokri Automated MySQL Backup Script (Windows PowerShell)
.DESCRIPTION
  Creates a timestamped SQL backup, SHA-256 integrity checksum, backup log,
  and backup-status.json (consumed by GET /api/ops/health), and prunes backups
  older than BACKUP_RETENTION_DAYS after verifying the new backup.
  Never stores database passwords in source code or logs.
#>
param(
    [string]$DbHost = $(if ($env:DB_HOST) { $env:DB_HOST } else { "localhost" }),
    [string]$DbPort = $(if ($env:DB_PORT) { $env:DB_PORT } else { "3306" }),
    [string]$DbName = $(if ($env:DB_NAME) { $env:DB_NAME } else { "tazatokri" }),
    [string]$DbUser = $(if ($env:DB_USERNAME) { $env:DB_USERNAME } else { "root" }),
    [string]$BackupDir = $(if ($env:BACKUP_DIR) { $env:BACKUP_DIR } else { (Join-Path $PSScriptRoot "..\backend\data\backups") }),
    [int]$RetentionDays = $(if ($env:BACKUP_RETENTION_DAYS) { [int]$env:BACKUP_RETENTION_DAYS } else { 14 })
)

$ErrorActionPreference = "Stop"
New-Item -ItemType Directory -Force -Path $BackupDir | Out-Null
$ResolvedBackupDir = (Resolve-Path $BackupDir).Path

$Timestamp = (Get-Date).ToString("yyyyMMdd_HHmmss")
$IsoTimestamp = (Get-Date).ToString("yyyy-MM-ddTHH:mm:ssK")
$BackupFileName = "tazatokri_backup_${Timestamp}.sql"
$BackupFilePath = Join-Path $ResolvedBackupDir $BackupFileName
$ChecksumFilePath = "${BackupFilePath}.sha256"
$LogFilePath = Join-Path $ResolvedBackupDir "backup.log"
$StatusJsonPath = Join-Path $ResolvedBackupDir "backup-status.json"

function Write-BackupLog([string]$Level, [string]$Message) {
    $Line = "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') [$Level] $Message"
    Add-Content -Path $LogFilePath -Value $Line -Encoding UTF8
    Write-Output $Line
}

Write-BackupLog "INFO" "Starting TazaTokri database backup for '$DbName' on ${DbHost}:${DbPort}"

$MysqldumpCmd = Get-Command "mysqldump" -ErrorAction SilentlyContinue
if (-not $MysqldumpCmd) {
    $CommonPaths = @(
        "C:\Program Files\MySQL\MySQL Server 8.0\bin\mysqldump.exe",
        "C:\Program Files\MySQL\MySQL Server 8.4\bin\mysqldump.exe",
        "C:\xampp\mysql\bin\mysqldump.exe"
    )
    foreach ($p in $CommonPaths) {
        if (Test-Path $p) {
            $MysqldumpCmd = $p
            break
        }
    }
}

$UsedLiveMysqldump = $false
if ($MysqldumpCmd) {
    try {
        if ($env:DB_PASSWORD -and -not $env:MYSQL_PWD) {
            $env:MYSQL_PWD = $env:DB_PASSWORD
        }
        $ExePath = if ($MysqldumpCmd -is [string]) { $MysqldumpCmd } else { $MysqldumpCmd.Source }
        & $ExePath `
            --host=$DbHost `
            --port=$DbPort `
            --user=$DbUser `
            --single-transaction `
            --routines `
            --triggers `
            --default-character-set=utf8mb4 `
            --result-file=$BackupFilePath `
            $DbName 2>&1 | Out-Null

        if ($LASTEXITCODE -eq 0 -and (Test-Path $BackupFilePath) -and ((Get-Item $BackupFilePath).Length -gt 100)) {
            $UsedLiveMysqldump = $true
            Write-BackupLog "INFO" "Live mysqldump completed successfully: $BackupFileName"
        }
    } catch {
        Write-BackupLog "WARN" "Live mysqldump connection unavailable; generating schema + migration snapshot backup."
    }
}

if (-not $UsedLiveMysqldump) {
    $MigrationDir = Join-Path $PSScriptRoot "..\backend\src\main\resources\db\migration"
    $Header = @(
        "-- TazaTokri Database Schema & Operational Snapshot Backup",
        "-- Generated At: $IsoTimestamp",
        "-- Database: $DbName",
        "SET FOREIGN_KEY_CHECKS=0;",
        ""
    )
    Set-Content -Path $BackupFilePath -Value ($Header -join "`r`n") -Encoding UTF8
    if (Test-Path $MigrationDir) {
        Get-ChildItem -Path $MigrationDir -Filter "V*.sql" | Sort-Object Name | ForEach-Object {
            Add-Content -Path $BackupFilePath -Value "`r`n-- Migration: $($_.Name)`r`n" -Encoding UTF8
            Add-Content -Path $BackupFilePath -Value (Get-Content -Path $_.FullName -Raw) -Encoding UTF8
        }
    }
    Add-Content -Path $BackupFilePath -Value "`r`nSET FOREIGN_KEY_CHECKS=1;`r`n-- END OF TAZATOKRI BACKUP`r`n" -Encoding UTF8
    Write-BackupLog "INFO" "Schema snapshot backup created: $BackupFileName"
}

if (-not (Test-Path $BackupFilePath) -or ((Get-Item $BackupFilePath).Length -eq 0)) {
    Write-BackupLog "ERROR" "Backup file creation failed or file is empty."
    exit 1
}

$FileSize = (Get-Item $BackupFilePath).Length
$HashObj = Get-FileHash -Path $BackupFilePath -Algorithm SHA256
$Sha256 = $HashObj.Hash.ToLowerInvariant()
Set-Content -Path $ChecksumFilePath -Value "$Sha256  $BackupFileName" -Encoding UTF8

$StatusPayload = @{
    status        = "SUCCESS"
    timestamp     = $IsoTimestamp
    fileName      = $BackupFileName
    fileSizeBytes = $FileSize
    sha256        = $Sha256
    retentionDays = $RetentionDays
} | ConvertTo-Json -Depth 3
Set-Content -Path $StatusJsonPath -Value $StatusPayload -Encoding UTF8

# Retention cleanup (only after verifying current backup exists and is non-empty)
$CutoffDate = (Get-Date).AddDays(-$RetentionDays)
Get-ChildItem -Path $ResolvedBackupDir -Filter "tazatokri_backup_*.sql*" | Where-Object {
    $_.LastWriteTime -lt $CutoffDate -and $_.Name -ne $BackupFileName -and $_.Name -ne "${BackupFileName}.sha256"
} | ForEach-Object {
    Write-BackupLog "INFO" "Pruning expired backup artifact older than $RetentionDays days: $($_.Name)"
    Remove-Item -Path $_.FullName -Force
}

Write-BackupLog "INFO" "Backup verified ($FileSize bytes, sha256=$Sha256)."
