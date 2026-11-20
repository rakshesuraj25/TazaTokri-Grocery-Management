package com.tazatokri.common;

import java.nio.charset.StandardCharsets;
import java.util.Arrays;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;

/**
 * Validates critical production hardening constraints on application startup.
 * When the "prod" or "production" profile is active, this validator ensures:
 * 1. Database password is set and not the default dev placeholder.
 * 2. Flyway password is set and not the default dev placeholder.
 * 3. JWT secret is set, is at least 32 bytes (256 bits), and is NOT the default dev secret.
 * 4. Bootstrap owner password is set and is NOT the default "Owner@123".
 * 5. Restrictive CORS origins are explicitly configured.
 */
@Component
public class ProductionSecurityHardeningValidator implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(ProductionSecurityHardeningValidator.class);
    public static final String INSECURE_DEV_SECRET = "tazatokri-dev-secret-change-me-in-production-0123456789";
    public static final String DEFAULT_DEV_DB_PASSWORD = "choose-a-long-password";
    public static final String DEFAULT_DEV_FLYWAY_PASSWORD = "root";
    public static final String DEFAULT_DEV_OWNER_PASSWORD = "Owner@123";

    private final Environment env;

    public ProductionSecurityHardeningValidator(Environment env) {
        this.env = env;
    }

    @Override
    public void run(ApplicationArguments args) {
        validateConfiguration(env);
    }

    public static void validateConfiguration(Environment env) {
        if (env == null) {
            return;
        }

        boolean isProd = Arrays.stream(env.getActiveProfiles())
                .anyMatch(p -> p.equalsIgnoreCase("prod") || p.equalsIgnoreCase("production"));

        if (!isProd) {
            return;
        }

        log.info("Verifying production security configuration constraints for active profile(s): {}",
                Arrays.toString(env.getActiveProfiles()));

        // 1. DB App Password
        String dbPassword = env.getProperty("spring.datasource.password");
        if (isMissingOrPlaceholder(dbPassword) || DEFAULT_DEV_DB_PASSWORD.equals(dbPassword)) {
            throw new IllegalStateException(
                    "CRITICAL PRODUCTION CONFIGURATION ERROR: spring.datasource.password must be set to a secure, non-default value in production profile.");
        }

        // 2. Flyway DB Password
        String flywayPassword = env.getProperty("spring.flyway.password");
        if (isMissingOrPlaceholder(flywayPassword) || DEFAULT_DEV_FLYWAY_PASSWORD.equals(flywayPassword)) {
            throw new IllegalStateException(
                    "CRITICAL PRODUCTION CONFIGURATION ERROR: spring.flyway.password must be set to a secure, non-default value in production profile.");
        }

        // 3. JWT Secret validation
        String jwtSecret = env.getProperty("app.jwt.secret");
        if (isMissingOrPlaceholder(jwtSecret)) {
            throw new IllegalStateException(
                    "CRITICAL PRODUCTION CONFIGURATION ERROR: app.jwt.secret is missing or placeholder in production profile.");
        }
        if (INSECURE_DEV_SECRET.equals(jwtSecret.trim())) {
            throw new IllegalStateException(
                    "CRITICAL PRODUCTION CONFIGURATION ERROR: app.jwt.secret cannot use the default development secret in production profile.");
        }
        if (jwtSecret.getBytes(StandardCharsets.UTF_8).length < 32) {
            throw new IllegalStateException(
                    "CRITICAL PRODUCTION CONFIGURATION ERROR: app.jwt.secret must be at least 32 bytes (256 bits) for HMAC-SHA256 in production profile.");
        }

        // 4. Owner Password
        String ownerPassword = env.getProperty("app.bootstrap.owner-password");
        if (isMissingOrPlaceholder(ownerPassword) || DEFAULT_DEV_OWNER_PASSWORD.equals(ownerPassword)) {
            throw new IllegalStateException(
                    "CRITICAL PRODUCTION CONFIGURATION ERROR: app.bootstrap.owner-password must be set and cannot be default 'Owner@123' in production profile.");
        }

        // 5. Restrictive CORS
        String corsOrigins = env.getProperty("app.cors.allowed-origins");
        if (corsOrigins == null || corsOrigins.isBlank() || corsOrigins.contains("your-production-domain.com")) {
            throw new IllegalStateException(
                    "CRITICAL PRODUCTION CONFIGURATION ERROR: app.cors.allowed-origins must be explicitly configured in production profile.");
        }
        for (String origin : corsOrigins.split(",")) {
            String trimmed = origin.trim();
            if ("*".equals(trimmed) || trimmed.contains("*")) {
                throw new IllegalStateException(
                        "CRITICAL PRODUCTION CONFIGURATION ERROR: app.cors.allowed-origins cannot contain wildcard '*' in production profile.");
            }
            if (trimmed.startsWith("http://")) {
                log.warn("PRODUCTION SECURITY WARNING: app.cors.allowed-origins contains non-HTTPS origin '{}'.", trimmed);
            }
        }
        if (corsOrigins.contains("localhost")) {
            log.warn("PRODUCTION SECURITY WARNING: app.cors.allowed-origins contains 'localhost'. Verify that this is intentional.");
        }

        // 6. Razorpay / Online Payment validation (allows COD-only when completely unconfigured)
        boolean razorpayExplicitlyEnabled = "true".equalsIgnoreCase(trimOrEmpty(env.getProperty("app.razorpay.enabled")));
        String razorpayKeyId = trimOrEmpty(env.getProperty("app.razorpay.key-id"));
        String razorpayKeySecret = trimOrEmpty(env.getProperty("app.razorpay.key-secret"));
        String razorpayWebhookSecret = trimOrEmpty(env.getProperty("app.razorpay.webhook-secret"));

        boolean anyRazorpayConfigured = razorpayExplicitlyEnabled
                || !razorpayKeyId.isEmpty()
                || !razorpayKeySecret.isEmpty()
                || !razorpayWebhookSecret.isEmpty();

        if (anyRazorpayConfigured) {
            if (isMissingOrPlaceholder(razorpayKeyId)
                    || isMissingOrPlaceholder(razorpayKeySecret)
                    || isMissingOrPlaceholder(razorpayWebhookSecret)) {
                throw new IllegalStateException(
                        "CRITICAL PRODUCTION CONFIGURATION ERROR: When Razorpay/online payments are enabled, app.razorpay.key-id, app.razorpay.key-secret, and app.razorpay.webhook-secret must all be configured.");
            }
            if (razorpayKeyId.startsWith("rzp_test_")) {
                log.warn("PRODUCTION SECURITY WARNING: app.razorpay.key-id appears to be a Razorpay test key in production profile.");
            }
        } else {
            log.info("Razorpay credentials are not configured; running in COD-only mode.");
        }

        log.info("Production security hardening verification passed successfully.");
    }

    private static boolean isMissingOrPlaceholder(String value) {
        if (value == null || value.isBlank()) {
            return true;
        }
        return value.trim().startsWith("PLACEHOLDER_");
    }

    private static String trimOrEmpty(String value) {
        return value == null ? "" : value.trim();
    }
}
