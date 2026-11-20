package com.tazatokri.common;

import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.sql.Connection;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.LinkedHashMap;
import java.util.Map;

import javax.sql.DataSource;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import com.tazatokri.ai.GeminiProvider;
import com.tazatokri.delivery.ProofStorageProvider;
import com.tazatokri.notification.WhatsAppCloudApiProvider;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

@RestController
public class OperationalHealthController {

	private static final ZoneId IST = ZoneId.of("Asia/Kolkata");

	private final DataSource dataSource;
	private final WhatsAppCloudApiProvider whatsappProvider;
	private final GeminiProvider geminiProvider;
	private final ProofStorageProvider storageProvider;
	private final SentryErrorReporter sentryReporter;
	private final ObjectMapper objectMapper;
	private final String appVersion;
	private final String razorpayKeyId;
	private final String backupStatusFile;

	@Autowired
	public OperationalHealthController(
			DataSource dataSource,
			WhatsAppCloudApiProvider whatsappProvider,
			GeminiProvider geminiProvider,
			ProofStorageProvider storageProvider,
			SentryErrorReporter sentryReporter,
			ObjectMapper objectMapper,
			@Value("${app.version:0.4.0}") String appVersion,
			@Value("${app.razorpay.key-id:}") String razorpayKeyId,
			@Value("${app.backup.status-file:./data/backups/backup-status.json}") String backupStatusFile) {
		this.dataSource = dataSource;
		this.whatsappProvider = whatsappProvider;
		this.geminiProvider = geminiProvider;
		this.storageProvider = storageProvider;
		this.sentryReporter = sentryReporter;
		this.objectMapper = objectMapper;
		this.appVersion = appVersion;
		this.razorpayKeyId = razorpayKeyId != null ? razorpayKeyId.trim() : "";
		this.backupStatusFile = backupStatusFile;
	}

	/**
	 * Public liveness probe for container healthchecks.
	 * Verifies only that the Spring Boot application process is responding (independent of MySQL).
	 */
	@GetMapping("/actuator/health/liveness")
	public ResponseEntity<Map<String, String>> liveness() {
		Map<String, String> body = new LinkedHashMap<>();
		body.put("status", "UP");
		return ResponseEntity.ok(body);
	}

	/**
	 * Public readiness & aggregate health probe for load balancers & orchestrators.
	 * Checks required MySQL connectivity without exposing credentials, SQL, or stack traces.
	 */
	@GetMapping({ "/actuator/health", "/actuator/health/readiness" })
	public ResponseEntity<Map<String, String>> readiness() {
		boolean dbUp = checkDatabaseConnectivity();
		Map<String, String> body = new LinkedHashMap<>();
		body.put("status", dbUp ? "UP" : "DOWN");
		return ResponseEntity.status(dbUp ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE).body(body);
	}

	/**
	 * Restricted operational health summary for OWNER and STAFF.
	 * Reports database status, application version, last backup metadata, and provider configuration flags
	 * without exposing any secrets or credentials.
	 */
	@GetMapping("/api/ops/health")
	@PreAuthorize("hasAnyRole('OWNER','STAFF')")
	public Map<String, Object> operationalHealth() {
		boolean dbConnected = checkDatabaseConnectivity();

		Map<String, Object> providers = new LinkedHashMap<>();
		providers.put("whatsappCloudConfigured", whatsappProvider != null && whatsappProvider.isConfiguredAndEnabled());
		providers.put("geminiAiConfigured", geminiProvider != null && geminiProvider.isConfigured());
		providers.put("razorpayConfigured", !razorpayKeyId.isBlank());
		providers.put("sentryConfigured", sentryReporter != null && sentryReporter.isEnabled());
		providers.put("proofStorageProvider", storageProvider != null ? storageProvider.getProviderMode() : "LOCAL");

		Map<String, Object> backupInfo = readBackupStatus();

		Map<String, Object> result = new LinkedHashMap<>();
		result.put("status", dbConnected ? "UP" : "DEGRADED");
		result.put("databaseConnected", dbConnected);
		result.put("applicationVersion", appVersion);
		result.put("environment", sentryReporter != null ? sentryReporter.getEnvironment() : "development");
		result.put("timestampIst", LocalDateTime.now(IST).toString());
		result.put("providers", providers);
		result.put("lastBackup", backupInfo);
		return result;
	}

	private boolean checkDatabaseConnectivity() {
		if (dataSource == null) return false;
		try (Connection conn = dataSource.getConnection()) {
			return conn != null && conn.isValid(2);
		} catch (Exception e) {
			return false;
		}
	}

	private Map<String, Object> readBackupStatus() {
		Map<String, Object> fallback = new LinkedHashMap<>();
		fallback.put("available", false);
		fallback.put("status", "NOT_RUN_YET");
		fallback.put("lastBackupAt", null);
		fallback.put("backupFileName", null);

		if (backupStatusFile == null || backupStatusFile.isBlank()) {
			return fallback;
		}
		try {
			Path p = Paths.get(backupStatusFile).toAbsolutePath().normalize();
			if (!Files.exists(p) || !Files.isRegularFile(p)) {
				return fallback;
			}
			String raw = Files.readString(p);
			if (objectMapper != null) {
				JsonNode node = objectMapper.readTree(raw);
				Map<String, Object> parsed = new LinkedHashMap<>();
				parsed.put("available", true);
				parsed.put("status", node.path("status").asText("SUCCESS"));
				parsed.put("lastBackupAt", node.path("timestamp").asText(null));
				parsed.put("backupFileName", node.path("fileName").asText(null));
				parsed.put("fileSizeBytes", node.path("fileSizeBytes").asLong(0L));
				parsed.put("sha256Checksum", node.path("sha256").asText(null));
				return parsed;
			}
		} catch (Exception ignored) {
		}
		return fallback;
	}
}
