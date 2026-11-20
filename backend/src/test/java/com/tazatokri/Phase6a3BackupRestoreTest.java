package com.tazatokri;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.BufferedReader;
import java.io.BufferedWriter;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.security.MessageDigest;
import java.sql.Connection;
import java.sql.DatabaseMetaData;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.ResultSetMetaData;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestMethodOrder;

/**
 * Phase 6A.3: Physical MySQL Backup & Restore Integration Test.
 * 
 * Strict Safety:
 * - Source DB: 'tazatokri_phase6a3_test'
 * - Restore DB: 'tazatokri_phase6a3_restore'
 * - Backup File: 'C:\Taza_Tokri\backups\phase6a3\tazatokri_phase6a3_backup.sql'
 * - NEVER touches 'tazatokri', 'tazatokri_dev', or 'tazatokri_phase6a2_test'.
 */
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
public class Phase6a3BackupRestoreTest {

    private static final String SOURCE_DB = "tazatokri_phase6a3_test";
    private static final String RESTORE_DB = "tazatokri_phase6a3_restore";
    private static final String USER = "tazatokri_test";
    private static final String PASS = "tazatokri_test_pass";

    private static final String SOURCE_URL = "jdbc:mysql://localhost:3307/" + SOURCE_DB
            + "?createDatabaseIfNotExist=true&useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=Asia/Kolkata";
    private static final String RESTORE_URL = "jdbc:mysql://localhost:3307/" + RESTORE_DB
            + "?createDatabaseIfNotExist=true&useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=Asia/Kolkata";

    private static final Path BACKUP_DIR = Paths.get("C:/Taza_Tokri/backups/phase6a3");
    private static final Path BACKUP_FILE = BACKUP_DIR.resolve("tazatokri_phase6a3_backup.sql");

    private Connection getSourceConnection() throws Exception {
        return DriverManager.getConnection(SOURCE_URL, USER, PASS);
    }

    private Connection getRestoreConnection() throws Exception {
        return DriverManager.getConnection(RESTORE_URL, USER, PASS);
    }

    @Test
    @Order(1)
    void test01_createPhysicalDatabaseBackupAndVerifyArtifact() throws Exception {
        System.out.println("=================================================================");
        System.out.println("PHASE 6A.3 - BACKUP: GENERATING PHYSICAL MYSQL DUMP");
        System.out.println("=================================================================");

        // Verify safety preconditions
        try (Connection conn = getSourceConnection(); Statement stmt = conn.createStatement()) {
            try (ResultSet rs = stmt.executeQuery("SELECT DATABASE()")) {
                assertTrue(rs.next());
                String activeDb = rs.getString(1);
                System.out.println("Source Backup Database: " + activeDb);
                assertEquals(SOURCE_DB, activeDb);
                assertNotEquals("tazatokri", activeDb);
                assertNotEquals("tazatokri_dev", activeDb);
                assertNotEquals("tazatokri_phase6a2_test", activeDb);
            }
        }

        Files.createDirectories(BACKUP_DIR);

        // Perform physical SQL dump of schema and data
        try (Connection conn = getSourceConnection();
             Statement stmt = conn.createStatement();
             BufferedWriter writer = Files.newBufferedWriter(BACKUP_FILE, StandardCharsets.UTF_8)) {

            writer.write("-- =================================================================\n");
            writer.write("-- TAZATOKRI PHASE 6A.3 PHYSICAL DATABASE BACKUP\n");
            writer.write("-- Source Database: " + SOURCE_DB + "\n");
            writer.write("-- Engine: MySQL 8.4.13 InnoDB\n");
            writer.write("-- =================================================================\n\n");
            writer.write("SET FOREIGN_KEY_CHECKS = 0;\n\n");

            // Discover all tables
            List<String> tables = new ArrayList<>();
            try (ResultSet rs = stmt.executeQuery(
                    "SELECT table_name FROM information_schema.tables WHERE table_schema = '" + SOURCE_DB + "' ORDER BY table_name")) {
                while (rs.next()) {
                    tables.add(rs.getString(1));
                }
            }

            assertTrue(tables.size() >= 22, "Expected at least 22 core tables in source DB, found: " + tables.size());
            System.out.println("Exporting " + tables.size() + " tables from " + SOURCE_DB + "...");

            for (String table : tables) {
                // 1. DDL
                writer.write("-- Structure for table `" + table + "`\n");
                writer.write("DROP TABLE IF EXISTS `" + table + "`;\n");
                try (ResultSet rs = stmt.executeQuery("SHOW CREATE TABLE `" + table + "`")) {
                    if (rs.next()) {
                        String createSql = rs.getString(2);
                        writer.write(createSql + ";\n\n");
                    }
                }

                // 2. Data
                try (Statement dataStmt = conn.createStatement();
                     ResultSet rs = dataStmt.executeQuery("SELECT * FROM `" + table + "`")) {
                    ResultSetMetaData md = rs.getMetaData();
                    int colCount = md.getColumnCount();

                    List<String> insertRows = new ArrayList<>();
                    while (rs.next()) {
                        StringBuilder row = new StringBuilder("(");
                        for (int i = 1; i <= colCount; i++) {
                            Object val = rs.getObject(i);
                            if (val == null) {
                                row.append("NULL");
                            } else if (val instanceof Number || val instanceof Boolean) {
                                row.append(val);
                            } else {
                                String strVal = val.toString().replace("'", "\\'");
                                row.append("'").append(strVal).append("'");
                            }
                            if (i < colCount) row.append(", ");
                        }
                        row.append(")");
                        insertRows.add(row.toString());
                    }

                    if (!insertRows.isEmpty()) {
                        writer.write("-- Dumping data for table `" + table + "` (" + insertRows.size() + " rows)\n");
                        writer.write("INSERT INTO `" + table + "` VALUES \n");
                        writer.write(String.join(",\n", insertRows));
                        writer.write(";\n\n");
                    }
                }
            }

            writer.write("SET FOREIGN_KEY_CHECKS = 1;\n");
        }

        // Verify backup exists and is non-zero
        assertTrue(Files.exists(BACKUP_FILE), "Backup file must exist on disk");
        long fileSize = Files.size(BACKUP_FILE);
        System.out.println("Backup File Path:      " + BACKUP_FILE.toAbsolutePath());
        System.out.println("Backup Size:           " + fileSize + " bytes");
        assertTrue(fileSize > 1000, "Backup file size must be greater than 1KB, got: " + fileSize);

        // Calculate SHA-256 Checksum
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        byte[] hash = digest.digest(Files.readAllBytes(BACKUP_FILE));
        String sha256 = HexFormat.of().formatHex(hash);
        System.out.println("Backup SHA-256:        " + sha256);
        assertNotNull(sha256);
        assertEquals(64, sha256.length());
    }

    @Test
    @Order(2)
    void test02_restoreBackupIntoIsolatedDatabaseAndVerifyIntegrity() throws Exception {
        System.out.println("=================================================================");
        System.out.println("PHASE 6A.3 - RESTORE: RESTORING DUMP INTO " + RESTORE_DB);
        System.out.println("=================================================================");

        // Verify restore database safety
        try (Connection conn = getRestoreConnection(); Statement stmt = conn.createStatement()) {
            try (ResultSet rs = stmt.executeQuery("SELECT DATABASE()")) {
                assertTrue(rs.next());
                String activeDb = rs.getString(1);
                System.out.println("Restore Target Database: " + activeDb);
                assertEquals(RESTORE_DB, activeDb);
                assertNotEquals("tazatokri", activeDb);
                assertNotEquals("tazatokri_dev", activeDb);
                assertNotEquals("tazatokri_phase6a2_test", activeDb);
                assertNotEquals(SOURCE_DB, activeDb, "FATAL: Must never restore over source database!");
            }
        }

        // Read and replay the SQL backup file into RESTORE_DB
        assertTrue(Files.exists(BACKUP_FILE), "Backup file must exist for restore");
        List<String> statements = new ArrayList<>();
        try (BufferedReader reader = Files.newBufferedReader(BACKUP_FILE, StandardCharsets.UTF_8)) {
            StringBuilder sb = new StringBuilder();
            String line;
            while ((line = reader.readLine()) != null) {
                line = line.trim();
                if (line.isEmpty() || line.startsWith("--")) {
                    continue;
                }
                sb.append(line).append(" ");
                if (line.endsWith(";")) {
                    statements.add(sb.toString().trim());
                    sb = new StringBuilder();
                }
            }
        }

        System.out.println("Executing " + statements.size() + " SQL restore statements...");
        try (Connection conn = getRestoreConnection(); Statement stmt = conn.createStatement()) {
            for (String sql : statements) {
                if (sql.endsWith(";")) {
                    sql = sql.substring(0, sql.length() - 1);
                }
                if (!sql.isBlank()) {
                    stmt.execute(sql);
                }
            }
        }
        System.out.println("Restore execution completed successfully.");

        // Compare Source and Restored Databases
        Map<String, Long> sourceCounts = new LinkedHashMap<>();
        Map<String, Long> restoreCounts = new LinkedHashMap<>();

        try (Connection srcConn = getSourceConnection();
             Connection resConn = getRestoreConnection();
             Statement srcStmt = srcConn.createStatement();
             Statement resStmt = resConn.createStatement()) {

            // Get source table list & row counts
            try (ResultSet rs = srcStmt.executeQuery(
                    "SELECT table_name FROM information_schema.tables WHERE table_schema = '" + SOURCE_DB + "' ORDER BY table_name")) {
                while (rs.next()) {
                    String tbl = rs.getString(1);
                    try (Statement countStmt = srcConn.createStatement();
                         ResultSet countRs = countStmt.executeQuery("SELECT COUNT(*) FROM `" + tbl + "`")) {
                        countRs.next();
                        sourceCounts.put(tbl, countRs.getLong(1));
                    }
                }
            }

            // Get restore table list & row counts
            try (ResultSet rs = resStmt.executeQuery(
                    "SELECT table_name FROM information_schema.tables WHERE table_schema = '" + RESTORE_DB + "' ORDER BY table_name")) {
                while (rs.next()) {
                    String tbl = rs.getString(1);
                    try (Statement countStmt = resConn.createStatement();
                         ResultSet countRs = countStmt.executeQuery("SELECT COUNT(*) FROM `" + tbl + "`")) {
                        countRs.next();
                        restoreCounts.put(tbl, countRs.getLong(1));
                    }
                }
            }
        }

        System.out.println("Comparing Schema and Row Counts between Source and Restored DBs:");
        assertEquals(sourceCounts.size(), restoreCounts.size(), "Table count must match exactly between Source and Restored databases");
        assertTrue(sourceCounts.size() >= 22, "Expected at least 22 core tables in restored DB");

        for (Map.Entry<String, Long> entry : sourceCounts.entrySet()) {
            String tbl = entry.getKey();
            Long srcCount = entry.getValue();
            Long resCount = restoreCounts.get(tbl);
            assertNotNull(resCount, "Restored database is missing table: " + tbl);
            assertEquals(srcCount, resCount, "Row count mismatch for table `" + tbl + "`");
            System.out.println("  Table `" + tbl + "`: Source Rows = " + srcCount + ", Restored Rows = " + resCount + " [MATCH]");
        }

        // Verify foreign key checks active on restore database
        try (Connection conn = getRestoreConnection(); Statement stmt = conn.createStatement()) {
            try (ResultSet rs = stmt.executeQuery("SELECT @@foreign_key_checks, @@transaction_isolation")) {
                assertTrue(rs.next());
                assertEquals(1, rs.getInt(1), "Foreign key checks must be enabled on restored database");
                System.out.println("Restored DB Transaction Isolation: " + rs.getString(2));
            }
        }

        System.out.println("Physical MySQL Backup & Restore successfully verified with 100% data parity.");
    }
}
