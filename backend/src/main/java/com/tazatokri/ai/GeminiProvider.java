package com.tazatokri.ai;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import com.tazatokri.common.BadRequestException;

@Component
public class GeminiProvider {

	public static final Set<String> SUPPORTED_MIME_TYPES = Set.of(
			"image/jpeg",
			"image/png",
			"image/webp",
			"application/pdf");

	private final boolean enabled;
	private final String apiKey;
	private final String model;
	private final long maxUploadBytes;
	private final ObjectMapper objectMapper;
	private volatile HttpClient httpClient;

	public GeminiProvider(
			@Value("${app.gemini.enabled:false}") boolean enabled,
			@Value("${app.gemini.api-key:}") String apiKey,
			@Value("${app.gemini.model:gemini-4-hydrogen}") String model,
			@Value("${app.gemini.max-upload-bytes:5242880}") long maxUploadBytes,
			ObjectMapper objectMapper) {
		this.enabled = enabled;
		this.apiKey = apiKey != null ? apiKey.trim() : "";
		this.model = (model == null || model.isBlank()) ? "gemini-4-hydrogen" : model.trim();
		this.maxUploadBytes = maxUploadBytes > 0 ? maxUploadBytes : 5242880L;
		this.objectMapper = objectMapper;
	}

	private HttpClient client() {
		HttpClient c = this.httpClient;
		if (c == null) {
			c = HttpClient.newBuilder()
					.connectTimeout(Duration.ofSeconds(10))
					.build();
			this.httpClient = c;
		}
		return c;
	}

	public boolean isEnabled() {
		return enabled;
	}

	public boolean isConfigured() {
		return enabled && !apiKey.isBlank();
	}

	public String getModel() {
		return model;
	}

	public long getMaxUploadBytes() {
		return maxUploadBytes;
	}

	public void validateUpload(String mimeType, long sizeBytes) {
		if (sizeBytes <= 0) {
			throw new BadRequestException("Uploaded file is empty.");
		}
		if (sizeBytes > maxUploadBytes) {
			throw new BadRequestException("Uploaded file exceeds the maximum allowed size of "
					+ (maxUploadBytes / (1024 * 1024)) + " MB.");
		}
		String normalizedMime = mimeType == null ? "" : mimeType.trim().toLowerCase();
		if (!SUPPORTED_MIME_TYPES.contains(normalizedMime)) {
			throw new BadRequestException("Unsupported file type: " + mimeType
					+ ". Allowed formats: JPEG, PNG, WebP, and PDF.");
		}
	}

	/**
	 * Calls the Gemini API with a system/user prompt and optional inline binary (image or PDF)
	 * and returns the parsed JSON tree from the model's response.
	 */
	public JsonNode generateStructuredJson(String prompt, byte[] fileBytes, String mimeType) {
		if (!isConfigured()) {
			throw new BadRequestException(
					"Gemini AI vision is not enabled or GEMINI_API_KEY is not configured on the server. "
							+ "You can still paste invoice/list text or enter items manually.");
		}

		try {
			Map<String, Object> textPart = Map.of("text", prompt);
			List<Map<String, Object>> parts;
			if (fileBytes != null && fileBytes.length > 0 && mimeType != null && !mimeType.isBlank()) {
				validateUpload(mimeType, fileBytes.length);
				String base64 = Base64.getEncoder().encodeToString(fileBytes);
				Map<String, Object> inlineData = Map.of(
						"mime_type", mimeType.trim().toLowerCase(),
						"data", base64);
				parts = List.of(Map.of("inline_data", inlineData), textPart);
			} else {
				parts = List.of(textPart);
			}

			Map<String, Object> payload = new LinkedHashMap<>();
			payload.put("contents", List.of(Map.of("parts", parts)));
			payload.put("generationConfig", Map.of(
					"responseMimeType", "application/json",
					"temperature", 0.1));

			String requestJson = objectMapper.writeValueAsString(payload);
			URI endpoint = URI.create(
					"https://generativelanguage.googleapis.com/v1beta/models/" + model + ":generateContent");

			HttpRequest request = HttpRequest.newBuilder(endpoint)
					.timeout(Duration.ofSeconds(25))
					.header("Content-Type", "application/json")
					.header("x-goog-api-key", apiKey)
					.POST(HttpRequest.BodyPublishers.ofString(requestJson))
					.build();

			HttpResponse<String> response = client().send(request, HttpResponse.BodyHandlers.ofString());
			int status = response.statusCode();
			if (status == 429) {
				throw new BadRequestException(
						"Gemini AI quota or rate limit reached (HTTP 429). Please wait a moment or continue with manual entry.");
			}
			if (status < 200 || status >= 300) {
				throw new BadRequestException(
						"Gemini AI extraction failed (HTTP " + status + "). Please use pasted text or manual entry.");
			}

			JsonNode root = objectMapper.readTree(response.body());
			JsonNode textNode = root.path("candidates").path(0).path("content").path("parts").path(0).path("text");
			if (textNode.isMissingNode() || textNode.asText().isBlank()) {
				throw new BadRequestException("Gemini AI returned an empty response. Please try a clearer image or enter items manually.");
			}
			String rawJson = stripMarkdownFences(textNode.asText());
			return objectMapper.readTree(rawJson);
		} catch (BadRequestException e) {
			throw e;
		} catch (Exception e) {
			throw new BadRequestException(
					"Unable to process document with Gemini AI (" + e.getClass().getSimpleName()
							+ "). Please use pasted text or manual entry.");
		}
	}

	static String stripMarkdownFences(String text) {
		String trimmed = text.trim();
		if (trimmed.startsWith("```")) {
			int firstNewline = trimmed.indexOf('\n');
			if (firstNewline > 0) {
				trimmed = trimmed.substring(firstNewline + 1);
			}
			if (trimmed.endsWith("```")) {
				trimmed = trimmed.substring(0, trimmed.length() - 3);
			}
		}
		return trimmed.trim();
	}
}
