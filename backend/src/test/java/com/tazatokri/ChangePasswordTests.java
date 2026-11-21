package com.tazatokri;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.lang.reflect.Proxy;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

import com.tazatokri.auth.AuthController;
import com.tazatokri.auth.AuthService;
import com.tazatokri.auth.ChangePasswordRequest;
import com.tazatokri.auth.JwtService;
import com.tazatokri.common.BadRequestException;
import com.tazatokri.common.InvalidCredentialsException;
import com.tazatokri.user.Role;
import com.tazatokri.user.User;
import com.tazatokri.user.UserRepository;

import jakarta.validation.Validation;
import jakarta.validation.Validator;

class ChangePasswordTests {

    private static final String VALID_TEST_SECRET = "TestOnlySecretKeyThatIsOverThirtyTwoBytesLong!";
    private final BCryptPasswordEncoder encoder = new BCryptPasswordEncoder();
    private final Validator validator = Validation.buildDefaultValidatorFactory().getValidator();

    private UserRepository inMemoryRepo(Map<String, User> usersByPhone) {
        return (UserRepository) Proxy.newProxyInstance(
                UserRepository.class.getClassLoader(),
                new Class<?>[] { UserRepository.class },
                (proxy, method, args) -> {
                    if ("findByPhone".equals(method.getName())) {
                        return Optional.ofNullable(usersByPhone.get((String) args[0]));
                    }
                    if ("save".equals(method.getName())) {
                        User u = (User) args[0];
                        usersByPhone.put(u.getPhone(), u);
                        return u;
                    }
                    return null;
                });
    }

    @Test
    void successfulPasswordChangeHashesWithBcryptAndPreservesOtherUsers() {
        Map<String, User> store = new ConcurrentHashMap<>();

        User alice = new User();
        alice.setPhone("9876543210");
        alice.setFullName("Alice");
        alice.setRoles(Set.of(Role.CUSTOMER));
        alice.setActive(true);
        String oldHash = encoder.encode("OldPass123");
        alice.setPasswordHash(oldHash);
        store.put(alice.getPhone(), alice);

        User bob = new User();
        bob.setPhone("9999999999");
        bob.setFullName("Owner Bob");
        bob.setRoles(Set.of(Role.OWNER));
        bob.setActive(true);
        String bobHash = encoder.encode("BobSecret99");
        bob.setPasswordHash(bobHash);
        store.put(bob.getPhone(), bob);

        AuthService authService = new AuthService(inMemoryRepo(store), encoder, new JwtService(VALID_TEST_SECRET, 60));
        AuthController controller = new AuthController(null, authService);

        var auth = new UsernamePasswordAuthenticationToken("9876543210", null);
        Map<String, String> res = controller.changePassword(
                new ChangePasswordRequest("OldPass123", "NewStrong456"), auth);

        assertEquals("Password updated successfully", res.get("message"));
        assertNotEquals(oldHash, alice.getPasswordHash());
        assertNotEquals("NewStrong456", alice.getPasswordHash());
        assertTrue(alice.getPasswordHash().startsWith("$2"));
        assertTrue(encoder.matches("NewStrong456", alice.getPasswordHash()));
        assertFalse(encoder.matches("OldPass123", alice.getPasswordHash()));

        // Bob's credentials remain untouched
        assertEquals(bobHash, bob.getPasswordHash());
        assertTrue(encoder.matches("BobSecret99", bob.getPasswordHash()));
    }

    @Test
    void rejectsIncorrectCurrentPasswordSamePasswordAndUnauthenticatedActor() {
        Map<String, User> store = new ConcurrentHashMap<>();
        User alice = new User();
        alice.setPhone("9876543210");
        alice.setRoles(Set.of(Role.STAFF));
        alice.setActive(true);
        alice.setPasswordHash(encoder.encode("CurrentPass1"));
        store.put(alice.getPhone(), alice);

        AuthService authService = new AuthService(inMemoryRepo(store), encoder, new JwtService(VALID_TEST_SECRET, 60));

        assertThrows(BadRequestException.class, () ->
                authService.changePassword("9876543210", new ChangePasswordRequest("WrongPass1", "NewPass123")));

        assertThrows(BadRequestException.class, () ->
                authService.changePassword("9876543210", new ChangePasswordRequest("CurrentPass1", "CurrentPass1")));

        assertThrows(InvalidCredentialsException.class, () ->
                authService.changePassword("", new ChangePasswordRequest("CurrentPass1", "NewPass123")));
        assertThrows(InvalidCredentialsException.class, () ->
                authService.changePassword("9000000000", new ChangePasswordRequest("CurrentPass1", "NewPass123")));
    }

    @Test
    void requestValidationEnforcesLengthComplexityAndRequiredFields() {
        assertFalse(validator.validate(new ChangePasswordRequest("", "ValidPass1")).isEmpty());
        assertFalse(validator.validate(new ChangePasswordRequest("OldPass12", "short1")).isEmpty());
        assertFalse(validator.validate(new ChangePasswordRequest("OldPass12", "onlyletters")).isEmpty());
        assertFalse(validator.validate(new ChangePasswordRequest("OldPass12", "12345678")).isEmpty());
        assertTrue(validator.validate(new ChangePasswordRequest("OldPass12", "ValidPass1")).isEmpty());
    }
}
