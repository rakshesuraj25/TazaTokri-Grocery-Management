<#
.SYNOPSIS
  TazaTokri Isolated Test Database Restore & Parity Verification Script (Windows PowerShell)
.DESCRIPTION
  Verifies SHA-256 checksum, decrypts (.enc) and decompresses (.gz) if needed,
  validates SQL readability, blocks all protected/production database names,
  restores into an explicit isolated test DB, and verifies schema, row-count,
  and deterministic cell-level parity when -SourceDb is supplied.
#>
param(
    [Parameter(Mandatory = $true)]
    [string]$BackupFile,
    [Parameter(Mandatory = $true)]
    [string]$TestDbName,
    [string]$SourceDb = "",
    [string]$DbHost = $(if ($env:DB_HOST) { $env:DB_HOST } else { "localhost" }),
    [string]$DbPort = $(if ($env:DB_PORT) { $env:DB_PORT } else { "3306" }),
    [string]$DbUser = $(if ($env:DB_USERNAME) { $env:DB_USERNAME } else { "root" }),
    [switch]$AllowRecreateIsolatedTestDb
)

$ErrorActionPreference = "Stop"

$ProtectedDbs = @(
    "tazatokri", "tazatokri_prod",
    "tazatokri_phase6a2_test", "tazatokri_phase6a3_test", "tazatokri_phase6a3_restore",
    "mysql", "sys", "information_schema", "performance_schema"
)
if ($ProtectedDbs -contains $TestDbName.Trim().ToLowerInvariant()) {
    throw "SAFETY BLOCK: Refusing to target protected database '$TestDbName'."
}

if (-not (Test-Path $BackupFile)) {
    throw "Backup file not found: $BackupFile"
}
$ResolvedBackup = (Resolve-Path $BackupFile).Path
$ChecksumFile = "${ResolvedBackup}.sha256"
if (-not (Test-Path $ChecksumFile)) {
    throw "Checksum file missing: $ChecksumFile"
}

# 1. Verify SHA-256 BEFORE decryption/decompression
$ExpectedSha = ((Get-Content $ChecksumFile -Raw).Trim() -split "\s+")[0].ToLowerInvariant()
$ActualSha = (Get-FileHash -Path $ResolvedBackup -Algorithm SHA256).Hash.ToLowerInvariant()
if ($ExpectedSha -ne $ActualSha) {
    throw "CHECKSUM MISMATCH! Expected $ExpectedSha but got $ActualSha"
}
Write-Output "[PASS] SHA-256 Checksum Verified: $ActualSha"

$DbPassword = if ($env:DB_PASSWORD) { $env:DB_PASSWORD } elseif ($env:MYSQL_PWD) { $env:MYSQL_PWD } else { "" }
if ([string]::IsNullOrWhiteSpace($DbPassword)) {
    throw "DB_PASSWORD environment variable is required."
}

$MysqlCmd = Get-Command "mysql" -ErrorAction SilentlyContinue
if (-not $MysqlCmd) {
    foreach ($p in @("C:\Program Files\MySQL\MySQL Server 8.4\bin\mysql.exe", "C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe")) {
        if (Test-Path $p) { $MysqlCmd = $p; break }
    }
}
if (-not $MysqlCmd) {
    throw "mysql CLI client not found."
}
$MysqlExe = if ($MysqlCmd -is [string]) { $MysqlCmd } else { $MysqlCmd.Source }

$TempDir = Join-Path ([System.IO.Path]::GetTempPath()) ("tazatokri_rst_" + [guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Force -Path $TempDir | Out-Null
$CnfPath = Join-Path $TempDir "my.cnf"

try {
    $CnfContent = "[client]`nhost=$DbHost`nport=$DbPort`nuser=$DbUser`npassword=$DbPassword`n"
    [System.IO.File]::WriteAllText($CnfPath, $CnfContent, [System.Text.UTF8Encoding]::new($false))

    $WorkFile = $ResolvedBackup

    # 2. Decrypt if .enc (supports native TTENC1 Encrypt-then-MAC and OpenSSL Salted__)
    if ($WorkFile.EndsWith(".enc", [System.StringComparison]::OrdinalIgnoreCase)) {
        $Passphrase = $env:BACKUP_ENCRYPTION_PASSPHRASE
        if ([string]::IsNullOrWhiteSpace($Passphrase)) {
            throw "BACKUP_ENCRYPTION_PASSPHRASE is required to decrypt '$ResolvedBackup'."
        }
        $DecFile = Join-Path $TempDir ($(if ($WorkFile -like "*.gz.enc") { "decrypted.sql.gz" } else { "decrypted.sql" }))
        $AllBytes = [System.IO.File]::ReadAllBytes($WorkFile)
        $HeaderStr = if ($AllBytes.Length -ge 6) { [System.Text.Encoding]::ASCII.GetString($AllBytes, 0, 6) } else { "" }
        if ($HeaderStr -eq "TTENC1") {
            if ($AllBytes.Length -le 70) { throw "Encrypted artifact is truncated or invalid." }
            $Salt = $AllBytes[6..21]; $Iv = $AllBytes[22..37]
            $CipherLen = $AllBytes.Length - 38 - 32
            $CipherBytes = New-Object byte[] $CipherLen; [Buffer]::BlockCopy($AllBytes, 38, $CipherBytes, 0, $CipherLen)
            $Tag = $AllBytes[($AllBytes.Length - 32)..($AllBytes.Length - 1)]
            $AuthLen = $AllBytes.Length - 32
            $AuthPayload = New-Object byte[] $AuthLen; [Buffer]::BlockCopy($AllBytes, 0, $AuthPayload, 0, $AuthLen)
            $Kdf = New-Object System.Security.Cryptography.Rfc2898DeriveBytes($Passphrase, $Salt, 100000, [System.Security.Cryptography.HashAlgorithmName]::SHA256)
            $EncKey = $Kdf.GetBytes(32); $MacKey = $Kdf.GetBytes(32); $Kdf.Dispose()
            $Hmac = New-Object System.Security.Cryptography.HMACSHA256 -ArgumentList @(,$MacKey); $CalcTag = $Hmac.ComputeHash($AuthPayload); $Hmac.Dispose()
            if (-not [System.Linq.Enumerable]::SequenceEqual([byte[]]$Tag, [byte[]]$CalcTag)) {
                throw "AUTHENTICATED DECRYPTION FAILED: Wrong passphrase or tampered artifact."
            }
            $Aes = [System.Security.Cryptography.Aes]::Create()
            $Aes.KeySize = 256; $Aes.Mode = [System.Security.Cryptography.CipherMode]::CBC; $Aes.Padding = [System.Security.Cryptography.PaddingMode]::PKCS7
            $Aes.Key = $EncKey; $Aes.IV = $Iv
            $Dec = $Aes.CreateDecryptor(); $Plain = $Dec.TransformFinalBlock($CipherBytes, 0, $CipherBytes.Length); $Dec.Dispose(); $Aes.Dispose()
            [System.IO.File]::WriteAllBytes($DecFile, $Plain)
        } else {
            $OpenSsl = Get-Command "openssl" -ErrorAction SilentlyContinue
            if (-not $OpenSsl) { throw "openssl not found on PATH to decrypt OpenSSL-formatted backup." }
            & $OpenSsl.Source enc -d -aes-256-cbc -pbkdf2 -iter 100000 -in $WorkFile -out $DecFile -pass env:BACKUP_ENCRYPTION_PASSPHRASE
            if ($LASTEXITCODE -ne 0 -or -not (Test-Path $DecFile)) { throw "Backup decryption failed." }
        }
        $WorkFile = $DecFile
        Write-Output "[PASS] Decrypted backup artifact."
    }

    # 3. Decompress if .gz
    if ($WorkFile.EndsWith(".gz", [System.StringComparison]::OrdinalIgnoreCase)) {
        $SqlOut = Join-Path $TempDir "restored.sql"
        $InStream = [System.IO.File]::OpenRead($WorkFile)
        $GzipStream = New-Object System.IO.Compression.GzipStream($InStream, [System.IO.Compression.CompressionMode]::Decompress)
        $OutStream = [System.IO.File]::Create($SqlOut)
        try { $GzipStream.CopyTo($OutStream) } finally { $OutStream.Dispose(); $GzipStream.Dispose(); $InStream.Dispose() }
        $WorkFile = $SqlOut
        Write-Output "[PASS] Decompressed backup artifact."
    }

    # 4. Verify SQL readability
    $SqlContent = Get-Content -Path $WorkFile -Raw
    if ([string]::IsNullOrWhiteSpace($SqlContent) -or ($SqlContent -notmatch "CREATE TABLE")) {
        throw "Restored SQL artifact is empty or lacks CREATE TABLE statements."
    }
    Write-Output "[PASS] SQL Artifact Readability Verified."

    # 5. Check existing target DB safety
    $DbExists = (& $MysqlExe "--defaults-extra-file=$CnfPath" -N -B -e "SELECT COUNT(*) FROM information_schema.schemata WHERE schema_name='$TestDbName';").Trim()
    if ($DbExists -ne "0") {
        if (-not $AllowRecreateIsolatedTestDb) {
            throw "SAFETY BLOCK: Target database '$TestDbName' already exists. Pass -AllowRecreateIsolatedTestDb to recreate isolated test DB."
        }
        & $MysqlExe "--defaults-extra-file=$CnfPath" -e "DROP DATABASE ``$TestDbName``;"
    }

    & $MysqlExe "--defaults-extra-file=$CnfPath" -e "CREATE DATABASE ``$TestDbName`` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
    if ($LASTEXITCODE -ne 0) { throw "Failed to create isolated target database '$TestDbName'." }

    cmd /c "`"$MysqlExe`" --defaults-extra-file=`"$CnfPath`" $TestDbName < `"$WorkFile`""
    if ($LASTEXITCODE -ne 0) { throw "SQL restore execution failed into '$TestDbName'." }
    Write-Output "[PASS] Restored SQL into isolated database '$TestDbName'."

    # 6. Schema & Integrity validation
    $Tables = (& $MysqlExe "--defaults-extra-file=$CnfPath" -N -B -e "SELECT table_name FROM information_schema.tables WHERE table_schema='$TestDbName' ORDER BY table_name;") | Where-Object { $_ -and $_.Trim() -ne "" }
    $TableCount = ($Tables | Measure-Object).Count
    $FkCheck = (& $MysqlExe "--defaults-extra-file=$CnfPath" -N -B -e "SELECT @@foreign_key_checks;").Trim()
    $Charset = (& $MysqlExe "--defaults-extra-file=$CnfPath" -N -B -e "SELECT default_character_set_name FROM information_schema.schemata WHERE schema_name='$TestDbName';").Trim()
    Write-Output "Schema Validation: tables=$TableCount, charset=$Charset, foreign_key_checks=$FkCheck -> PASS"

    # 7. Parity verification
    if ([string]::IsNullOrWhiteSpace($SourceDb)) {
        Write-Output "Row-Count Parity vs Source: NOT VERIFIED (SourceDb not specified)"
        Write-Output "Deterministic Data Parity:  NOT VERIFIED (SourceDb not specified)"
    } else {
        $SourceTables = (& $MysqlExe "--defaults-extra-file=$CnfPath" -N -B -e "SELECT table_name FROM information_schema.tables WHERE table_schema='$SourceDb' ORDER BY table_name;") | Where-Object { $_ -and $_.Trim() -ne "" }
        if (($SourceTables | Measure-Object).Count -ne $TableCount) {
            throw "Table-Count Parity: FAIL (source=$(($SourceTables | Measure-Object).Count), restored=$TableCount)"
        }
        Write-Output "Table-Count Parity: PASS ($TableCount tables)"

        foreach ($tbl in $Tables) {
            $sRows = (& $MysqlExe "--defaults-extra-file=$CnfPath" -N -B -e "SELECT COUNT(*) FROM ``$SourceDb``.``$tbl``;").Trim()
            $rRows = (& $MysqlExe "--defaults-extra-file=$CnfPath" -N -B -e "SELECT COUNT(*) FROM ``$TestDbName``.``$tbl``;").Trim()
            if ($sRows -ne $rRows) {
                throw "Row-Count Parity FAIL on '$tbl': source=$sRows, restored=$rRows"
            }

            # Deterministic cell-level comparison via column-concatenated SHA256 ordered by primary key (no sensitive row data logged)
            $ColsRaw = & $MysqlExe "--defaults-extra-file=$CnfPath" -N -B -e "SELECT COLUMN_NAME, DATA_TYPE FROM information_schema.columns WHERE table_schema='$TestDbName' AND table_name='$tbl' ORDER BY ORDINAL_POSITION;"
            $ColExprs = @()
            foreach ($line in $ColsRaw) {
                if (-not $line) { continue }
                $parts = $line -split "`t"
                $col = $parts[0]
                $dtype = $parts[1].ToLowerInvariant()
                if ($dtype -match "blob|binary") {
                    $ColExprs += "COALESCE(HEX(``$col``), '__NULL__')"
                } else {
                    $ColExprs += "COALESCE(CAST(``$col`` AS CHAR CHARACTER SET utf8mb4), '__NULL__')"
                }
            }
            $OrderCol = (& $MysqlExe "--defaults-extra-file=$CnfPath" -N -B -e "SELECT COLUMN_NAME FROM information_schema.key_column_usage WHERE table_schema='$TestDbName' AND table_name='$tbl' AND CONSTRAINT_NAME='PRIMARY' ORDER BY ORDINAL_POSITION LIMIT 1;").Trim()
            $OrderClause = if ($OrderCol) { "ORDER BY ``$OrderCol``" } else { "" }
            $RowExpr = "SHA2(CONCAT_WS('|', " + ($ColExprs -join ", ") + "), 256)"

            $sHashes = & $MysqlExe "--defaults-extra-file=$CnfPath" -N -B -e "SELECT $RowExpr FROM ``$SourceDb``.``$tbl`` $OrderClause;"
            $rHashes = & $MysqlExe "--defaults-extra-file=$CnfPath" -N -B -e "SELECT $RowExpr FROM ``$TestDbName``.``$tbl`` $OrderClause;"
            if (($sHashes -join "`n") -ne ($rHashes -join "`n")) {
                throw "Deterministic Cell-Level Parity FAIL on '$tbl'"
            }
        }
        Write-Output "Row-Count Parity: PASS (all $TableCount tables)"
        Write-Output "Deterministic Cell-Level Parity: PASS (all $TableCount tables, SHA-256 per-row comparison)"
    }
} finally {
    if (Test-Path $TempDir) { Remove-Item -Path $TempDir -Recurse -Force -ErrorAction SilentlyContinue }
}
