package com.tazatokri.common;

import java.util.regex.Pattern;

/**
 * Utility to scrub sensitive credentials, passwords, JWTs, API keys, cookies,
 * authorization headers, and OTPs from log lines and error tracking payloads.
 */
public final class LogScrubber {

	private static final Pattern BEARER_PATTERN = Pattern.compile(
			"(?i)(Bearer\\s+)[^\\s,;'\"]+");
	private static final Pattern AUTH_HEADER_PATTERN = Pattern.compile(
			"(?i)((?:Authorization|X-Razorpay-Signature)\\s*[:=]\\s*)([^\\r\\n,;]+)");
	private static final Pattern COOKIE_HEADER_PATTERN = Pattern.compile(
			"(?i)((?:Set-Cookie|Cookie)\\s*[:=]\\s*)([^\\r\\n]+)");
	private static final Pattern JSON_SECRET_PATTERN = Pattern.compile(
			"(?i)(\"(?:password|passwordHash|token|accessToken|refreshToken|apiKey|secret|keySecret|webhookSecret|otp|otpHash|razorpaySignature|passphrase)\"\\s*:\\s*\")([^\"]+)(\")");
	private static final Pattern KV_SECRET_PATTERN = Pattern.compile(
			"(?i)((?:password|token|access_token|refresh_token|api_key|api-key|secret|key_secret|webhook_secret|otp|passphrase)\\s*[=:]\\s*)([^\\s,&\"']+)");
	private static final Pattern GOOGLE_KEY_PATTERN = Pattern.compile("AIza[0-9A-Za-z\\-_]{20,}");
	private static final Pattern RAZORPAY_KEY_PATTERN = Pattern.compile("rzp_(?:live|test)_[0-9A-Za-z]+");

	private LogScrubber() {
	}

	public static String scrub(String input) {
		if (input == null || input.isEmpty()) {
			return input;
		}
		String out = BEARER_PATTERN.matcher(input).replaceAll("$1[REDACTED_JWT]");
		out = AUTH_HEADER_PATTERN.matcher(out).replaceAll("$1[REDACTED]");
		out = COOKIE_HEADER_PATTERN.matcher(out).replaceAll("$1[REDACTED]");
		out = JSON_SECRET_PATTERN.matcher(out).replaceAll("$1[REDACTED]$3");
		out = KV_SECRET_PATTERN.matcher(out).replaceAll("$1[REDACTED]");
		out = GOOGLE_KEY_PATTERN.matcher(out).replaceAll("[REDACTED_API_KEY]");
		out = RAZORPAY_KEY_PATTERN.matcher(out).replaceAll("[REDACTED_RAZORPAY_KEY]");
		return out;
	}
}
