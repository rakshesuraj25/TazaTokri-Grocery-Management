package com.tazatokri;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.lang.reflect.Proxy;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Date;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.atomic.AtomicInteger;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.env.MockEnvironment;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

import com.tazatokri.auth.JwtAuthFilter;
import com.tazatokri.auth.JwtService;
import com.tazatokri.common.LogScrubber;
import com.tazatokri.common.ProductionSecurityHardeningValidator;
import com.tazatokri.user.OwnerBootstrap;
import com.tazatokri.user.Role;
import com.tazatokri.user.User;
import com.tazatokri.user.UserRepository;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;

class SecurityConfigHardeningTests {

    private static final String VALID_TEST_SECRET = "TestOnlySecretKeyThatIsOverThirtyTwoBytesLong!";

    private MockEnvironment validProdEnv() {
        MockEnvironment env = new MockEnvironment();
        env.setActiveProfiles("prod");
        Map<String, String> props = new LinkedHashMap<>();
        props.put("spring.datasource.password", "StrongAppDbPass!987");
        props.put("spring.flyway.password", "StrongRootDbPass!987");
        props.put("app.jwt.secret", VALID_TEST_SECRET);
        props.put("app.bootstrap.owner-password", "StrongOwnerPass!987");
        props.put("app.cors.allowed-origins", "https://tazatokri.example.com");
        props.forEach(env::setProperty);
        return env;
    }

    private UserRepository stubUserRepo(boolean ownerExists, AtomicInteger saveCalls) {
        return (UserRepository) Proxy.newProxyInstance(
                UserRepository.class.getClassLoader(),
                new Class<?>[] { UserRepository.class },
                (proxy, method, args) -> {
                    if ("existsByRole".equals(method.getName())) {
                        return ownerExists;
                    }
                    if ("save".equals(method.getName())) {
                        saveCalls.incrementAndGet();
                        return args[0];
                    }
                    return null;
                });
    }

    @Test
    void productionValidatorRejectsMissingOrPlaceholderSecretsAndAllowsValidConfig() {
        ProductionSecurityHardeningValidator.validateConfiguration(validProdEnv());

        MockEnvironment missingJwt = validProdEnv();
        missingJwt.setProperty("app.jwt.secret", "");
        assertThrows(IllegalStateException.class,
                () -> ProductionSecurityHardeningValidator.validateConfiguration(missingJwt));

        MockEnvironment placeholderDb = validProdEnv();
        placeholderDb.setProperty("spring.datasource.password", "PLACEHOLDER_SECURE_APP_DB_PASSWORD");
        assertThrows(IllegalStateException.class,
                () -> ProductionSecurityHardeningValidator.validateConfiguration(placeholderDb));
    }

    @Test
    void jwtServiceRejectsMissingShortAndPlaceholderSecretsAndValidatesTokens() {
        assertThrows(IllegalStateException.class, () -> new JwtService("", 60));
        assertThrows(IllegalStateException.class, () -> new JwtService("too-short-secret", 60));
        assertThrows(IllegalStateException.class,
                () -> new JwtService("PLACEHOLDER_STRONG_JWT_SECRET_MIN_32_CHARS_LONG", 60));

        JwtService jwtService = new JwtService(VALID_TEST_SECRET, 60);
        User user = new User();
        user.setId(42L);
        user.setPhone("9999999999");
        user.setRoles(Set.of(Role.OWNER));

        String token = jwtService.generateToken(user);
        assertNotNull(token);
        assertTrue(jwtService.isValid(token));
        Claims claims = jwtService.parseToken(token);
        assertEquals("9999999999", claims.getSubject());
    }

    @Test
    void ownerBootstrapSkipsExistingOwnerAndRejectsBlankOrInsecurePasswords() {
        BCryptPasswordEncoder encoder = new BCryptPasswordEncoder();

        AtomicInteger existingSaves = new AtomicInteger();
        UserRepository existingRepo = stubUserRepo(true, existingSaves);
        new OwnerBootstrap(existingRepo, encoder, "Owner", "9999999999", "StrongOwnerPass!987").run(null);
        assertEquals(0, existingSaves.get());

        AtomicInteger emptySaves = new AtomicInteger();
        UserRepository emptyRepo = stubUserRepo(false, emptySaves);
        new OwnerBootstrap(emptyRepo, encoder, "Owner", "9999999999", "").run(null);
        new OwnerBootstrap(emptyRepo, encoder, "Owner", "9999999999", "Owner@123").run(null);
        new OwnerBootstrap(emptyRepo, encoder, "Owner", "9999999999", "PLACEHOLDER_PASS").run(null);
        assertEquals(0, emptySaves.get());

        new OwnerBootstrap(emptyRepo, encoder, "Owner", "9999999999", "StrongOwnerPass!987").run(null);
        assertEquals(1, emptySaves.get());
    }

    @Test
    void logScrubberRedactsSecretsTokensAndPasswords() {
        String raw = "Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.abc.def password=MySecret99 passphrase=VaultKey123";
        String scrubbed = LogScrubber.scrub(raw);
        assertFalse(scrubbed.contains("eyJhbGciOiJIUzI1NiJ9"));
        assertFalse(scrubbed.contains("MySecret99"));
        assertFalse(scrubbed.contains("VaultKey123"));
    }

    @AfterEach
    void clearSecurityContext() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void jwtAuthFilterHandlesMalformedExpiredAndMissingClaimsWithoutNpe() throws Exception {
        JwtService jwtService = new JwtService(VALID_TEST_SECRET, 60);
        JwtAuthFilter filter = new JwtAuthFilter(jwtService);
        var key = Keys.hmacShaKeyFor(VALID_TEST_SECRET.getBytes(StandardCharsets.UTF_8));

        // 1. Valid signed token with missing roles claim does not throw NPE
        String noRolesToken = Jwts.builder()
                .subject("9988776655")
                .issuedAt(Date.from(Instant.now()))
                .expiration(Date.from(Instant.now().plusSeconds(300)))
                .signWith(key)
                .compact();
        MockHttpServletRequest req1 = new MockHttpServletRequest();
        req1.addHeader("Authorization", "Bearer " + noRolesToken);
        filter.doFilter(req1, new MockHttpServletResponse(), new MockFilterChain());
        assertNotNull(SecurityContextHolder.getContext().getAuthentication());
        assertEquals("9988776655", SecurityContextHolder.getContext().getAuthentication().getName());
        assertEquals(List.of(), List.copyOf(SecurityContextHolder.getContext().getAuthentication().getAuthorities()));
        SecurityContextHolder.clearContext();

        // 2. Signed token with blank subject does not authenticate
        String blankSubjectToken = Jwts.builder()
                .subject("   ")
                .claim("roles", List.of("OWNER"))
                .issuedAt(Date.from(Instant.now()))
                .expiration(Date.from(Instant.now().plusSeconds(300)))
                .signWith(key)
                .compact();
        MockHttpServletRequest req2 = new MockHttpServletRequest();
        req2.addHeader("Authorization", "Bearer " + blankSubjectToken);
        filter.doFilter(req2, new MockHttpServletResponse(), new MockFilterChain());
        assertEquals(null, SecurityContextHolder.getContext().getAuthentication());

        // 3. Expired and tampered tokens fail validation and leave SecurityContext empty
        String expiredToken = Jwts.builder()
                .subject("9988776655")
                .claim("roles", List.of("CUSTOMER"))
                .issuedAt(Date.from(Instant.now().minusSeconds(600)))
                .expiration(Date.from(Instant.now().minusSeconds(60)))
                .signWith(key)
                .compact();
        assertFalse(jwtService.isValid(expiredToken));
        assertFalse(jwtService.isValid("not.a.jwt"));

        MockHttpServletRequest req3 = new MockHttpServletRequest();
        req3.addHeader("Authorization", "Bearer " + expiredToken);
        filter.doFilter(req3, new MockHttpServletResponse(), new MockFilterChain());
        assertEquals(null, SecurityContextHolder.getContext().getAuthentication());
    }
}
