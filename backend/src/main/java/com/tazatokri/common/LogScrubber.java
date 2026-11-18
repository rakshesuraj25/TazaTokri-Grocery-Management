package com.tazatokri.common;

import java.util.regex.Pattern;

/**
 * Utility to scrub sensitive credentials, passwords, JWTs, API keys, and OTPs
 * from log lines and error tracking payloads.
 */
public final class LogScrubber {

	private static final Pattern BEARER_PATTERN = Pattern.compile(
			"(?i)(Bearer\\s+)[A-Za-z0-9\\-_]+\\.[A-Za-z0-9\\-_]+\\.[A-Za-z0-9\\-_]+");
	private static final Pattern JSON_SECRET_PATTERN = Pattern.compile(
			"(?i)(\"(?:password|token|accessToken|apiKey|secret|otp|otpHash|razorpaySignature)\"\\s*:\\s*\")([^\"]+)(\")");
	private static final Pattern KV_SECRET_PATTERN = Pattern.compile(
			"(?i)((?:password|token|api_key|api-key|secret|otp)\\s*[=:]\\s*)([^\\s,&\"']+)");
	private static final Pattern GOOGLE_KEY_PATTERN = Pattern.compile("AIza[0-9A-Za-z\\-_]{20,}");

	private LogScrubber() {
	}

	public static String scrub(String input) {
		if (input == null || input.isEmpty()) {
			return input;
		}
		String out = BEARER_PATTERN.matcher(input).replaceAll("$1[REDACTED_JWT]");
		out = JSON_SECRET_PATTERN.matcher(out).replaceAll("$1[REDACTED]$3");
		out = KV_SECRET_PATTERN.matcher(out).replaceAll("$1[REDACTED]");
		out = GOOGLE_KEY_PATTERN.matcher(out).replaceAll("[REDACTED_API_KEY]");
		return out;
	}
}
