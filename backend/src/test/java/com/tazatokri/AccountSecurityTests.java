package com.tazatokri;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.lang.reflect.Proxy;
import java.util.HashSet;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.atomic.AtomicReference;

import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

import com.tazatokri.auth.AccountSecurityService;
import com.tazatokri.auth.JwtService;
import com.tazatokri.common.BadRequestException;
import com.tazatokri.common.DuplicateResourceException;
import com.tazatokri.user.Role;
import com.tazatokri.user.User;
import com.tazatokri.user.UserRepository;

class AccountSecurityTests {

    private static final String TEST_SECRET = "test-jwt-secret-key-must-be-at-least-32-bytes-long!";

    private static JwtService jwtService() {
        return new JwtService(TEST_SECRET, 60);
    }

    private static User customer(long id, String phone, String email, String rawPassword, PasswordEncoder encoder) {
        User u = new User();
        u.setId(id);
        u.setFullName("Asha Patil");
        u.setPhone(phone);
        u.setEmail(email);
        u.setPasswordHash(encoder.encode(rawPassword));
        u.setActive(true);
        u.setRoles(new HashSet<>(Set.of(Role.CUSTOMER)));
        return u;
    }

    private static UserRepository repoFor(AtomicReference<User> userRef, boolean duplicatePhone, boolean duplicateEmail, long ownerCount) {
        return (UserRepository) Proxy.newProxyInstance(
                UserRepository.class.getClassLoader(),
                new Class<?>[] { UserRepository.class },
                (proxy, method, args) -> switch (method.getName()) {
                    case "findByPhone" -> {
                        User u = userRef.get();
                        yield (u != null && u.getPhone().equals(args[0])) ? Optional.of(u) : Optional.empty();
                    }
                    case "existsByPhone" -> duplicatePhone;
                    case "existsByEmailIgnoreCase" -> duplicateEmail;
                    case "countActiveByRole" -> ownerCount;
                    case "save" -> {
                        User saved = (User) args[0];
                        userRef.set(saved);
                        yield saved;
                    }
                    default -> throw new UnsupportedOperationException(method.getName());
                });
    }

    @Test
    void forgotAndResetPasswordEnforcesExpiryAndOneTimeUseAndAntiEnumeration() {
        PasswordEncoder encoder = new BCryptPasswordEncoder();
        JwtService jwt = jwtService();
        User user = customer(11L, "9876543210", "asha@example.com", "OldPass123", encoder);
        AtomicReference<User> ref = new AtomicReference<>(user);
        AccountSecurityService service = new AccountSecurityService(repoFor(ref, false, false, 1), encoder, jwt, true);

        // Unknown phone returns generic response without devOtp (anti-enumeration)
        var unknownRes = service.forgotPassword(new AccountSecurityService.ForgotPasswordRequest("9999999999"));
        assertNotNull(unknownRes.resetToken());
        assertNull(unknownRes.devOtp());

        // Known phone issues OTP and reset token
        var forgotRes = service.forgotPassword(new AccountSecurityService.ForgotPasswordRequest("9876543210"));
        assertNotNull(forgotRes.devOtp());
        assertEquals(15, forgotRes.expiresInMinutes());

        // Wrong OTP fails
        assertThrows(BadRequestException.class, () -> service.resetPassword(
                new AccountSecurityService.ResetPasswordRequest("9876543210", "000000", forgotRes.resetToken(), "NewPass123")));

        // Valid OTP resets password
        service.resetPassword(new AccountSecurityService.ResetPasswordRequest(
                "9876543210", forgotRes.devOtp(), forgotRes.resetToken(), "NewPass123"));
        assertTrue(encoder.matches("NewPass123", ref.get().getPasswordHash()));

        // Reusing the same reset token is rejected (one-time-use)
        assertThrows(BadRequestException.class, () -> service.resetPassword(
                new AccountSecurityService.ResetPasswordRequest(
                        "9876543210", forgotRes.devOtp(), forgotRes.resetToken(), "AnotherPass123")));
    }

    @Test
    void changePhoneRequiresVerificationAndRotatesJwt() {
        PasswordEncoder encoder = new BCryptPasswordEncoder();
        JwtService jwt = jwtService();
        User user = customer(12L, "9876543210", null, "Secret123", encoder);
        AtomicReference<User> ref = new AtomicReference<>(user);
        AccountSecurityService service = new AccountSecurityService(repoFor(ref, false, false, 1), encoder, jwt, true);

        var challenge = service.requestPhoneVerification(
                "9876543210",
                new AccountSecurityService.ChangePhoneRequest("9876500001", "Secret123"));
        assertNotNull(challenge.devOtp());
        assertEquals("******0001", challenge.maskedTarget());

        // Wrong OTP rejected
        assertThrows(BadRequestException.class, () -> service.confirmPhoneChange(
                "9876543210",
                new AccountSecurityService.ConfirmPhoneChangeRequest("9876500001", "111111", challenge.challengeToken())));

        // Correct OTP updates phone and issues fresh JWT
        var updated = service.confirmPhoneChange(
                "9876543210",
                new AccountSecurityService.ConfirmPhoneChangeRequest("9876500001", challenge.devOtp(), challenge.challengeToken()));
        assertEquals("9876500001", updated.user().getPhone());
        assertEquals("9876500001", jwt.parseToken(updated.token()).getSubject());
    }

    @Test
    void changeEmailRequiresVerificationAndRejectsDuplicate() {
        PasswordEncoder encoder = new BCryptPasswordEncoder();
        JwtService jwt = jwtService();
        User user = customer(13L, "9876543210", "old@example.com", "Secret123", encoder);
        AtomicReference<User> ref = new AtomicReference<>(user);

        AccountSecurityService dupService = new AccountSecurityService(repoFor(ref, false, true, 1), encoder, jwt, true);
        assertThrows(DuplicateResourceException.class, () -> dupService.requestEmailVerification(
                "9876543210",
                new AccountSecurityService.ChangeEmailRequest("taken@example.com", "Secret123")));

        AccountSecurityService service = new AccountSecurityService(repoFor(ref, false, false, 1), encoder, jwt, true);
        var challenge = service.requestEmailVerification(
                "9876543210",
                new AccountSecurityService.ChangeEmailRequest("New.User@Example.com", "Secret123"));
        var res = service.confirmEmailChange(
                "9876543210",
                new AccountSecurityService.ConfirmEmailChangeRequest("New.User@Example.com", challenge.devOtp(), challenge.challengeToken()));
        assertEquals("new.user@example.com", res.getEmail());
    }

    @Test
    void deleteAccountAnonymizesPiiPreservesIdAndBlocksLastOwner() {
        PasswordEncoder encoder = new BCryptPasswordEncoder();
        JwtService jwt = jwtService();

        // Block deleting last active OWNER
        User owner = customer(1L, "9876543210", "owner@example.com", "Owner123", encoder);
        owner.setRoles(new HashSet<>(Set.of(Role.OWNER)));
        AtomicReference<User> ownerRef = new AtomicReference<>(owner);
        AccountSecurityService ownerService = new AccountSecurityService(repoFor(ownerRef, false, false, 1), encoder, jwt, true);
        assertThrows(BadRequestException.class, () -> ownerService.deleteAccount(
                "9876543210",
                new AccountSecurityService.DeleteAccountRequest("Owner123", "DELETE")));

        // Customer deletion anonymizes PII while preserving user ID
        User cust = customer(42L, "9876543211", "cust@example.com", "Cust1234", encoder);
        AtomicReference<User> custRef = new AtomicReference<>(cust);
        AccountSecurityService custService = new AccountSecurityService(repoFor(custRef, false, false, 1), encoder, jwt, true);

        custService.deleteAccount("9876543211", new AccountSecurityService.DeleteAccountRequest("Cust1234", "DELETE"));
        User deleted = custRef.get();
        assertEquals(42L, deleted.getId());
        assertFalse(deleted.isActive());
        assertEquals("Deleted User", deleted.getFullName());
        assertEquals("DEL42", deleted.getPhone());
        assertNull(deleted.getEmail());
        assertNotEquals("Cust1234", deleted.getPasswordHash());
    }
}
