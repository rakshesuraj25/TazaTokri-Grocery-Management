package com.tazatokri.delivery;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardOpenOption;
import java.security.MessageDigest;
import java.util.HexFormat;
import java.util.UUID;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import com.tazatokri.common.BadRequestException;
import com.tazatokri.common.ResourceNotFoundException;

@Component
public class ProofStorageProvider {

	public record StoredProofFile(
			String storageProvider,
			String storageKey,
			String detectedMimeType,
			long fileSizeBytes,
			String sha256Checksum) {
	}

	private final String providerMode;
	private final Path localRootDir;
	private final long maxUploadBytes;
	private final String s3Bucket;
	private final String s3Endpoint;

	public ProofStorageProvider(
			@Value("${app.storage.provider:LOCAL}") String providerMode,
			@Value("${app.storage.local-dir:./data/private-uploads}") String localDir,
			@Value("${app.delivery.pod.max-upload-bytes:5242880}") long maxUploadBytes,
			@Value("${app.storage.s3.bucket:}") String s3Bucket,
			@Value("${app.storage.s3.endpoint:}") String s3Endpoint) {
		this.providerMode = (providerMode == null || providerMode.isBlank())
				? "LOCAL"
				: providerMode.trim().toUpperCase();
		this.localRootDir = Paths.get(localDir == null || localDir.isBlank()
				? "./data/private-uploads"
				: localDir.trim()).toAbsolutePath().normalize();
		this.maxUploadBytes = maxUploadBytes > 0 ? maxUploadBytes : 5242880L;
		this.s3Bucket = s3Bucket != null ? s3Bucket.trim() : "";
		this.s3Endpoint = s3Endpoint != null ? s3Endpoint.trim() : "";
	}

	public String getProviderMode() {
		return providerMode;
	}

	public long getMaxUploadBytes() {
		return maxUploadBytes;
	}

	public boolean isS3Configured() {
		return ("S3".equals(providerMode) || "R2".equals(providerMode) || "S3_R2".equals(providerMode))
				&& !s3Bucket.isBlank();
	}

	/**
	 * Validates binary magic bytes (never trusts filename extension alone),
	 * enforces size limits, generates a non-guessable UUID storage key,
	 * and writes the file to private storage.
	 */
	public StoredProofFile storeProofImage(byte[] bytes) {
		if (bytes == null || bytes.length == 0) {
			throw new BadRequestException("Proof of delivery image file is empty.");
		}
		if (bytes.length > maxUploadBytes) {
			throw new BadRequestException("Proof of delivery image exceeds maximum allowed size of "
					+ (maxUploadBytes / (1024 * 1024)) + " MB.");
		}

		DetectedImageFormat format = detectImageMagicBytes(bytes);
		String sha256 = sha256Hex(bytes);
		String uuid = UUID.randomUUID().toString();
		String storageKey = "pod/" + uuid + format.extension;

		try {
			Path target = resolveSafeLocalPath(storageKey);
			Files.createDirectories(target.getParent());
			Files.write(target, bytes, StandardOpenOption.CREATE_NEW);
		} catch (IOException e) {
			throw new BadRequestException("Failed to store proof of delivery image securely.");
		}

		String effectiveProvider = isS3Configured() ? "S3_R2" : "LOCAL";
		return new StoredProofFile(
				effectiveProvider,
				storageKey,
				format.mimeType,
				bytes.length,
				sha256);
	}

	public byte[] loadProofImage(String storageKey) {
		Path target = resolveSafeLocalPath(storageKey);
		if (!Files.exists(target) || !Files.isRegularFile(target)) {
			throw new ResourceNotFoundException("Proof of delivery image not found");
		}
		try {
			return Files.readAllBytes(target);
		} catch (IOException e) {
			throw new ResourceNotFoundException("Unable to read proof of delivery image");
		}
	}

	private Path resolveSafeLocalPath(String storageKey) {
		if (storageKey == null || storageKey.isBlank()
				|| storageKey.contains("..")
				|| storageKey.startsWith("/")
				|| storageKey.startsWith("\\")) {
			throw new BadRequestException("Invalid storage key");
		}
		Path resolved = localRootDir.resolve(storageKey).normalize();
		if (!resolved.startsWith(localRootDir)) {
			throw new BadRequestException("Storage path traversal blocked");
		}
		return resolved;
	}

	record DetectedImageFormat(String mimeType, String extension) {
	}

	public static DetectedImageFormat detectImageMagicBytes(byte[] bytes) {
		if (bytes == null || bytes.length < 12) {
			throw new BadRequestException(
					"Invalid image content. Only authentic JPEG, PNG, and WebP photographs are allowed.");
		}
		// 1. JPEG: FF D8 FF
		if ((bytes[0] & 0xFF) == 0xFF
				&& (bytes[1] & 0xFF) == 0xD8
				&& (bytes[2] & 0xFF) == 0xFF) {
			return new DetectedImageFormat("image/jpeg", ".jpg");
		}
		// 2. PNG: 89 50 4E 47 0D 0A 1A 0A
		if ((bytes[0] & 0xFF) == 0x89
				&& bytes[1] == 0x50
				&& bytes[2] == 0x4E
				&& bytes[3] == 0x47
				&& bytes[4] == 0x0D
				&& bytes[5] == 0x0A
				&& bytes[6] == 0x1A
				&& bytes[7] == 0x0A) {
			return new DetectedImageFormat("image/png", ".png");
		}
		// 3. WebP: "RIFF" .... "WEBP"
		if (bytes[0] == 'R' && bytes[1] == 'I' && bytes[2] == 'F' && bytes[3] == 'F'
				&& bytes[8] == 'W' && bytes[9] == 'E' && bytes[10] == 'B' && bytes[11] == 'P') {
			return new DetectedImageFormat("image/webp", ".webp");
		}
		throw new BadRequestException(
				"Unsupported or forged file content. Only authentic JPEG, PNG, and WebP photographs are allowed.");
	}

	private static String sha256Hex(byte[] bytes) {
		try {
			MessageDigest md = MessageDigest.getInstance("SHA-256");
			return HexFormat.of().formatHex(md.digest(bytes));
		} catch (Exception e) {
			throw new IllegalStateException("SHA-256 unavailable", e);
		}
	}
}
