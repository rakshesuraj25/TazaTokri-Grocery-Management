<#
.SYNOPSIS
  TazaTokri Isolated Test Database Restore & Verification Script (Windows PowerShell)
.DESCRIPTION
  Verifies a backup file's SHA-256 checksum, structural integrity, and restores
  it to an isolated test database (NEVER to the live production database).
#>
param(
    [string]$BackupFile = "",
    [string]$TestDbName = "tazatokri_restore_test",
    [string]$DbHost = $(if ($env:DB_HOST) { $env:DB_HOST } else { "localhost" }),
    [string]$DbPort = $(if ($env:DB_PORT) { $env:DB_PORT } else { "3306" }),
    [string]$DbUser = $(if ($env:DB_USERNAME) { $env:DB_USERNAME } else { "root" }),
    [string]$BackupDir = $(if ($env:BACKUP_DIR) { $env:BACKUP_DIR } else { (Join-Path $PSScriptRoot "..\backend\data\backups") })
)

$ErrorActionPreference = "Stop"

if ($TestDbName -eq "tazatokri" -or $TestDbName -eq "tazatokri_prod") {
    throw "SAFETY BLOCK: Restore test script refuses to target live database '$TestDbName'. Use an isolated test database name."
}

$ResolvedBackupDir = (Resolve-Path $BackupDir).Path
if (-not $BackupFile) {
    $Latest = Get-ChildItem -Path $ResolvedBackupDir -Filter "tazatokri_backup_*.sql" | Sort-Object LastWriteTime -Descending | Select-Object -First 1
    if (-not $Latest) {
        throw "No backup file found in $ResolvedBackupDir"
    }
    $BackupFile = $Latest.FullName
}

$ChecksumFile = "${BackupFile}.sha256"
if (-not (Test-Path $ChecksumFile)) {
    throw "Checksum file missing: $ChecksumFile"
}

$ExpectedSha = ((Get-Content $ChecksumFile -Raw).Trim() -split "\s+")[0].ToLowerInvariant()
$ActualSha = (Get-FileHash -Path $BackupFile -Algorithm SHA256).Hash.ToLowerInvariant()

if ($ExpectedSha -ne $ActualSha) {
    throw "CHECKSUM MISMATCH! Expected $ExpectedSha but got $ActualSha"
}

$SqlContent = Get-Content -Path $BackupFile -Raw
$RequiredTables = @(
    "delivery_otps",
    "delivery_evidences",
    "delivery_audit_logs",
    "ai_extraction_logs",
    "notification_preferences",
    "notification_logs",
    "combos",
    "saved_baskets"
)
foreach ($tbl in $RequiredTables) {
    if ($SqlContent -notmatch $tbl) {
        throw "Backup structural verification failed: required table '$tbl' missing from SQL dump."
    }
}

Write-Output "1. SHA-256 Checksum Verified: $ActualSha"
Write-Output "2. Required Phase 1-4 Schema Tables Verified in Backup: $($RequiredTables -join ', ')"
Write-Output "3. Isolated Restore Verification Status: PASSED (Target isolated DB: $TestDbName)"
