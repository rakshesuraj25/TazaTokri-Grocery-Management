package com.tazatokri.auth;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.HexFormat;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.tazatokri.common.BadRequestException;
import com.tazatokri.common.DuplicateResourceException;
import com.tazatokri.common.InvalidCredentialsException;
import com.tazatokri.user.Role;
import com.tazatokri.user.User;
import com.tazatokri.user.UserRepository;
import com.tazatokri.user.UserResponse;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

@Service
public class AccountSecurityService {

    private static final long RESET_TTL_MINUTES = 15L;
    private static final long VERIFY_TTL_MINUTES = 10L;
    private static final int MAX_OTP_ATTEMPTS = 5;
    private static final String PURPOSE_PASSWORD_RESET = "password_reset";
    private static final String PURPOSE_CHANGE_PHONE = "change_phone";
    private static final String PURPOSE_CHANGE_EMAIL = "change_email";

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final boolean exposeDevOtp;
    private final SecureRandom random = new SecureRandom();
    private final Map<String, Instant> consumedJtis = new ConcurrentHashMap<>();
    private final Map<String, Integer> failedAttempts = new ConcurrentHashMap<>();

    public AccountSecurityService(
            UserRepository userRepository,
            PasswordEncoder passwordEncoder,
            JwtService jwtService,
            @Value("${app.auth.expose-dev-otp:false}") boolean exposeDevOtp) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
        this.exposeDevOtp = exposeDevOtp;
    }

    public record ForgotPasswordRequest(
            @NotBlank(message = "Mobile number is required")
            @Pattern(regexp = "^[6-9]\\d{9}$", message = "Enter a valid 10-digit Indian mobile number")
            String phone) {}

    public record ForgotPasswordResponse(
            String message,
            String resetToken,
            int expiresInMinutes,
            String devOtp) {}

    public record ResetPasswordRequest(
            @NotBlank(message = "Mobile number is required")
            @Pattern(regexp = "^[6-9]\\d{9}$", message = "Enter a valid 10-digit Indian mobile number")
            String phone,

            @NotBlank(message = "Verification code is required")
            @Pattern(regexp = "^\\d{6}$", message = "Verification code must be 6 digits")
            String otp,

            @NotBlank(message = "Reset token is required")
            String resetToken,

            @NotBlank(message = "New password is required")
            @Size(min = 8, max = 64, message = "New password must be 8 to 64 characters")
            @Pattern(
                    regexp = "^(?=.*[A-Za-z])(?=.*\\d).+$",
                    message = "New password must include at least one letter and one number")
            String newPassword) {}

    public record ChangePhoneRequest(
            @NotBlank(message = "New mobile number is required")
            @Pattern(regexp = "^[6-9]\\d{9}$", message = "Enter a valid 10-digit Indian mobile number")
            String newPhone,

            @NotBlank(message = "Current password is required")
            String currentPassword) {}

    public record ConfirmPhoneChangeRequest(
            @NotBlank(message = "New mobile number is required")
            @Pattern(regexp = "^[6-9]\\d{9}$", message = "Enter a valid 10-digit Indian mobile number")
            String newPhone,

            @NotBlank(message = "Verification code is required")
            @Pattern(regexp = "^\\d{6}$", message = "Verification code must be 6 digits")
            String otp,

            @NotBlank(message = "Verification token is required")
            String challengeToken) {}

    public record ChangeEmailRequest(
            @NotBlank(message = "New email is required")
            @Email(message = "Enter a valid email address")
            @Size(max = 150, message = "Email must be at most 150 characters")
            String newEmail,

            @NotBlank(message = "Current password is required")
            String currentPassword) {}

    public record ConfirmEmailChangeRequest(
            @NotBlank(message = "New email is required")
            @Email(message = "Enter a valid email address")
            @Size(max = 150, message = "Email must be at most 150 characters")
            String newEmail,

            @NotBlank(message = "Verification code is required")
            @Pattern(regexp = "^\\d{6}$", message = "Verification code must be 6 digits")
            String otp,

            @NotBlank(message = "Verification token is required")
            String challengeToken) {}

    public record VerificationChallengeResponse(
            String message,
            String challengeToken,
            String maskedTarget,
            int expiresInMinutes,
            String devOtp) {}

    public record PhoneUpdateResponse(
            String message,
            UserResponse user,
            String token,
            long expiresInMinutes) {}

    public record DeleteAccountRequest(
            @NotBlank(message = "Current password is required")
            String currentPassword,

            @NotBlank(message = "Please type DELETE to confirm account deletion")
            String confirmation) {}

    @Transactional(readOnly = true)
    public ForgotPasswordResponse forgotPassword(ForgotPasswordRequest request) {
        pruneExpired();
        String phone = request.phone().trim();
        User user = userRepository.findByPhone(phone).filter(User::isActive).orElse(null);

        String jti = UUID.randomUUID().toString();
        String otp = generateOtp();
        String pwdFp = user != null ? sha256Prefix(user.getPasswordHash()) : UUID.randomUUID().toString().substring(0, 16);
        String token = jwtService.generatePurposeToken(
                phone,
                PURPOSE_PASSWORD_RESET,
                Map.of(
                        "jti", jti,
                        "pwdFp", pwdFp,
                        "otpHash", sha256Hex(otp + ":" + jti)),
                RESET_TTL_MINUTES);

        return new ForgotPasswordResponse(
                "If an active account exists for this mobile number, a verification code has been issued.",
                token,
                (int) RESET_TTL_MINUTES,
                (exposeDevOtp && user != null) ? otp : null);
    }

    @Transactional
    public void resetPassword(ResetPasswordRequest request) {
        pruneExpired();
        Claims claims = parsePurposeToken(request.resetToken(), PURPOSE_PASSWORD_RESET, "Invalid or expired reset token");
        String phone = request.phone().trim();
        if (!phone.equals(claims.getSubject())) {
            throw new BadRequestException("Reset token does not match mobile number");
        }

        String jti = claims.get("jti", String.class);
        String pwdFp = claims.get("pwdFp", String.class);
        String otpHash = claims.get("otpHash", String.class);
        if (jti == null || pwdFp == null || otpHash == null) {
            throw new BadRequestException("Invalid reset token");
        }
        if (consumedJtis.containsKey(jti)) {
            throw new BadRequestException("Reset token has already been used");
        }

        User user = userRepository.findByPhone(phone)
                .filter(User::isActive)
                .orElseThrow(() -> new BadRequestException("Invalid or expired reset token"));

        if (!constantTimeEquals(pwdFp, sha256Prefix(user.getPasswordHash()))) {
            throw new BadRequestException("Reset token has already been used or is no longer valid");
        }

        verifyOtpOrFail(jti, request.otp().trim(), otpHash, claims.getExpiration().toInstant());

        if (passwordEncoder.matches(request.newPassword(), user.getPasswordHash())) {
            throw new BadRequestException("New password must be different from your current password");
        }

        markConsumed(jti, claims.getExpiration().toInstant());
        user.setPasswordHash(passwordEncoder.encode(request.newPassword()));
        userRepository.save(user);
    }

    @Transactional(readOnly = true)
    public UserResponse getProfile(String authenticatedPhone) {
        User user = loadActiveUser(authenticatedPhone);
        return toUserResponse(user);
    }

    @Transactional(readOnly = true)
    public VerificationChallengeResponse requestPhoneVerification(String authenticatedPhone, ChangePhoneRequest request) {
        pruneExpired();
        User user = loadActiveUser(authenticatedPhone);
        verifyCurrentPassword(user, request.currentPassword());

        String newPhone = request.newPhone().trim();
        if (newPhone.equals(user.getPhone())) {
            throw new BadRequestException("New mobile number must be different from your current mobile number");
        }
        if (userRepository.existsByPhone(newPhone)) {
            throw new DuplicateResourceException("Phone already registered");
        }

        String jti = UUID.randomUUID().toString();
        String otp = generateOtp();
        String challengeToken = jwtService.generatePurposeToken(
                user.getPhone(),
                PURPOSE_CHANGE_PHONE,
                Map.of(
                        "jti", jti,
                        "userId", user.getId(),
                        "target", newPhone,
                        "otpHash", sha256Hex(otp + ":" + jti)),
                VERIFY_TTL_MINUTES);

        return new VerificationChallengeResponse(
                "Verification code issued for " + maskPhone(newPhone) + ".",
                challengeToken,
                maskPhone(newPhone),
                (int) VERIFY_TTL_MINUTES,
                exposeDevOtp ? otp : null);
    }

    @Transactional
    public PhoneUpdateResponse confirmPhoneChange(String authenticatedPhone, ConfirmPhoneChangeRequest request) {
        pruneExpired();
        User user = loadActiveUser(authenticatedPhone);
        Claims claims = parsePurposeToken(request.challengeToken(), PURPOSE_CHANGE_PHONE, "Invalid or expired verification token");

        Number userIdNum = claims.get("userId", Number.class);
        String target = claims.get("target", String.class);
        String jti = claims.get("jti", String.class);
        String otpHash = claims.get("otpHash", String.class);
        String newPhone = request.newPhone().trim();

        if (userIdNum == null || userIdNum.longValue() != user.getId()
                || target == null || !target.equals(newPhone)
                || jti == null || otpHash == null) {
            throw new BadRequestException("Verification token does not match this request");
        }
        if (consumedJtis.containsKey(jti)) {
            throw new BadRequestException("Verification code has already been used");
        }

        verifyOtpOrFail(jti, request.otp().trim(), otpHash, claims.getExpiration().toInstant());

        if (userRepository.existsByPhone(newPhone)) {
            throw new DuplicateResourceException("Phone already registered");
        }

        markConsumed(jti, claims.getExpiration().toInstant());
        user.setPhone(newPhone);
        User saved = userRepository.save(user);
        String freshToken = jwtService.generateToken(saved);

        return new PhoneUpdateResponse(
                "Mobile number updated successfully",
                toUserResponse(saved),
                freshToken,
                jwtService.getExpirationMinutes());
    }

    @Transactional(readOnly = true)
    public VerificationChallengeResponse requestEmailVerification(String authenticatedPhone, ChangeEmailRequest request) {
        pruneExpired();
        User user = loadActiveUser(authenticatedPhone);
        verifyCurrentPassword(user, request.currentPassword());

        String normalizedEmail = request.newEmail().trim().toLowerCase(Locale.ROOT);
        if (user.getEmail() != null && normalizedEmail.equalsIgnoreCase(user.getEmail())) {
            throw new BadRequestException("New email must be different from your current email");
        }
        if (userRepository.existsByEmailIgnoreCase(normalizedEmail)) {
            throw new DuplicateResourceException("Email already registered");
        }

        String jti = UUID.randomUUID().toString();
        String otp = generateOtp();
        String challengeToken = jwtService.generatePurposeToken(
                user.getPhone(),
                PURPOSE_CHANGE_EMAIL,
                Map.of(
                        "jti", jti,
                        "userId", user.getId(),
                        "target", normalizedEmail,
                        "otpHash", sha256Hex(otp + ":" + jti)),
                VERIFY_TTL_MINUTES);

        return new VerificationChallengeResponse(
                "Verification code issued for " + maskEmail(normalizedEmail) + ".",
                challengeToken,
                maskEmail(normalizedEmail),
                (int) VERIFY_TTL_MINUTES,
                exposeDevOtp ? otp : null);
    }

    @Transactional
    public UserResponse confirmEmailChange(String authenticatedPhone, ConfirmEmailChangeRequest request) {
        pruneExpired();
        User user = loadActiveUser(authenticatedPhone);
        Claims claims = parsePurposeToken(request.challengeToken(), PURPOSE_CHANGE_EMAIL, "Invalid or expired verification token");

        Number userIdNum = claims.get("userId", Number.class);
        String target = claims.get("target", String.class);
        String jti = claims.get("jti", String.class);
        String otpHash = claims.get("otpHash", String.class);
        String normalizedEmail = request.newEmail().trim().toLowerCase(Locale.ROOT);

        if (userIdNum == null || userIdNum.longValue() != user.getId()
                || target == null || !target.equals(normalizedEmail)
                || jti == null || otpHash == null) {
            throw new BadRequestException("Verification token does not match this request");
        }
        if (consumedJtis.containsKey(jti)) {
            throw new BadRequestException("Verification code has already been used");
        }

        verifyOtpOrFail(jti, request.otp().trim(), otpHash, claims.getExpiration().toInstant());

        if (userRepository.existsByEmailIgnoreCase(normalizedEmail)) {
            throw new DuplicateResourceException("Email already registered");
        }

        markConsumed(jti, claims.getExpiration().toInstant());
        user.setEmail(normalizedEmail);
        User saved = userRepository.save(user);
        return toUserResponse(saved);
    }

    @Transactional
    public void deleteAccount(String authenticatedPhone, DeleteAccountRequest request) {
        User user = loadActiveUser(authenticatedPhone);
        verifyCurrentPassword(user, request.currentPassword());

        if (!"DELETE".equals(request.confirmation().trim())) {
            throw new BadRequestException("Please type DELETE to confirm account deletion");
        }

        if (user.getRoles().contains(Role.OWNER) && userRepository.countActiveByRole(Role.OWNER) <= 1) {
            throw new BadRequestException("Cannot delete the last active owner account");
        }

        // Preserve user row and ID so historical orders, payments, loyalty, and business records remain intact,
        // while anonymizing PII and freeing the phone/email.
        user.setActive(false);
        user.setFullName("Deleted User");
        user.setPhone("DEL" + user.getId());
        user.setEmail(null);
        user.setPasswordHash(passwordEncoder.encode(UUID.randomUUID().toString()));
        userRepository.save(user);
    }

    private User loadActiveUser(String authenticatedPhone) {
        if (authenticatedPhone == null || authenticatedPhone.isBlank()) {
            throw new InvalidCredentialsException();
        }
        return userRepository.findByPhone(authenticatedPhone)
                .filter(User::isActive)
                .orElseThrow(InvalidCredentialsException::new);
    }

    private void verifyCurrentPassword(User user, String currentPassword) {
        if (!passwordEncoder.matches(currentPassword, user.getPasswordHash())) {
            throw new BadRequestException("Current password is incorrect");
        }
    }

    private Claims parsePurposeToken(String token, String expectedPurpose, String errorMessage) {
        try {
            Claims claims = jwtService.parseToken(token);
            String purpose = claims.get("purpose", String.class);
            if (!expectedPurpose.equals(purpose)) {
                throw new BadRequestException(errorMessage);
            }
            return claims;
        } catch (JwtException | IllegalArgumentException ex) {
            throw new BadRequestException(errorMessage);
        }
    }

    private void verifyOtpOrFail(String jti, String otp, String expectedOtpHash, Instant expiry) {
        String actualHash = sha256Hex(otp + ":" + jti);
        if (!constantTimeEquals(actualHash, expectedOtpHash)) {
            int attempts = failedAttempts.merge(jti, 1, Integer::sum);
            if (attempts >= MAX_OTP_ATTEMPTS) {
                markConsumed(jti, expiry);
                throw new BadRequestException("Too many invalid verification attempts. Please request a new code.");
            }
            throw new BadRequestException("Invalid verification code");
        }
    }

    private void markConsumed(String jti, Instant expiry) {
        consumedJtis.put(jti, expiry);
        failedAttempts.remove(jti);
    }

    private void pruneExpired() {
        Instant now = Instant.now();
        consumedJtis.entrySet().removeIf(e -> e.getValue().isBefore(now));
    }

    private String generateOtp() {
        int code = 100000 + random.nextInt(900000);
        return String.valueOf(code);
    }

    private static String sha256Prefix(String value) {
        return sha256Hex(value).substring(0, 16);
    }

    private static String sha256Hex(String value) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] digest = md.digest(value.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }

    private static boolean constantTimeEquals(String a, String b) {
        return MessageDigest.isEqual(
                a.getBytes(StandardCharsets.UTF_8),
                b.getBytes(StandardCharsets.UTF_8));
    }

    private static String maskPhone(String phone) {
        if (phone.length() < 4) return "****";
        return "******" + phone.substring(phone.length() - 4);
    }

    private static String maskEmail(String email) {
        int at = email.indexOf('@');
        if (at <= 1) return "***" + email.substring(Math.max(at, 0));
        return email.charAt(0) + "***" + email.substring(at - 1);
    }

    private static UserResponse toUserResponse(User user) {
        return new UserResponse(user.getId(), user.getFullName(), user.getPhone(), user.getEmail(), user.getRoles());
    }
}
