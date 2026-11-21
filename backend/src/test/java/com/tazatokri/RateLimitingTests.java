package com.tazatokri;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
import java.util.List;
import java.util.concurrent.atomic.AtomicLong;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;

import com.tazatokri.common.RateLimitFilter;
import com.tazatokri.common.RateLimitService;

class RateLimitingTests {

    private static final class MutableClock extends Clock {
        private final AtomicLong millis;

        MutableClock(long initialMillis) {
            this.millis = new AtomicLong(initialMillis);
        }

        void advanceSeconds(long seconds) {
            millis.addAndGet(seconds * 1000L);
        }

        @Override
        public ZoneId getZone() {
            return ZoneId.of("UTC");
        }

        @Override
        public Clock withZone(ZoneId zone) {
            return this;
        }

        @Override
        public Instant instant() {
            return Instant.ofEpochMilli(millis.get());
        }
    }

    @AfterEach
    void cleanup() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void rateLimitServiceAllowsWithinLimitBlocksOverLimitAndResetsAfterWindow() {
        MutableClock clock = new MutableClock(1_700_000_000_000L);
        RateLimitService service = new RateLimitService(clock);

        for (int i = 0; i < 5; i++) {
            var d = service.tryConsume("k1", 5, 60);
            assertTrue(d.allowed());
            assertEquals(4 - i, d.remaining());
        }

        var blocked = service.tryConsume("k1", 5, 60);
        assertFalse(blocked.allowed());
        assertEquals(0, blocked.remaining());
        assertTrue(blocked.retryAfterSeconds() >= 1);

        // Different key has independent budget
        assertTrue(service.tryConsume("k2", 5, 60).allowed());

        // Advance past 60s window -> counter resets
        clock.advanceSeconds(61);
        var afterReset = service.tryConsume("k1", 5, 60);
        assertTrue(afterReset.allowed());
        assertEquals(4, afterReset.remaining());
    }

    @Test
    void loginAndSignupEnforce429AndRetryAfterPerIp() throws Exception {
        MutableClock clock = new MutableClock(1_700_000_000_000L);
        RateLimitFilter filter = new RateLimitFilter(new RateLimitService(clock), true, "127.0.0.1");

        // Login allows 10/min, 11th returns 429
        for (int i = 0; i < 10; i++) {
            MockHttpServletRequest req = new MockHttpServletRequest("POST", "/api/auth/login");
            req.setRemoteAddr("203.0.113.10");
            MockHttpServletResponse res = new MockHttpServletResponse();
            filter.doFilter(req, res, new MockFilterChain());
            assertEquals(200, res.getStatus());
        }
        MockHttpServletRequest loginBlocked = new MockHttpServletRequest("POST", "/api/auth/login");
        loginBlocked.setRemoteAddr("203.0.113.10");
        MockHttpServletResponse loginBlockedRes = new MockHttpServletResponse();
        filter.doFilter(loginBlocked, loginBlockedRes, new MockFilterChain());
        assertEquals(429, loginBlockedRes.getStatus());
        assertTrue(Integer.parseInt(loginBlockedRes.getHeader("Retry-After")) >= 1);
        assertTrue(loginBlockedRes.getContentAsString().contains("Too many requests"));

        // Signup allows 5/5min, 6th returns 429
        for (int i = 0; i < 5; i++) {
            MockHttpServletRequest req = new MockHttpServletRequest("POST", "/api/auth/signup");
            req.setRemoteAddr("203.0.113.11");
            MockHttpServletResponse res = new MockHttpServletResponse();
            filter.doFilter(req, res, new MockFilterChain());
            assertEquals(200, res.getStatus());
        }
        MockHttpServletRequest signupBlocked = new MockHttpServletRequest("POST", "/api/auth/signup");
        signupBlocked.setRemoteAddr("203.0.113.11");
        MockHttpServletResponse signupBlockedRes = new MockHttpServletResponse();
        filter.doFilter(signupBlocked, signupBlockedRes, new MockFilterChain());
        assertEquals(429, signupBlockedRes.getStatus());
    }

    @Test
    void aiAndPaymentEndpointsKeyByAuthenticatedUserAndWebhookIsUnthrottled() throws Exception {
        MutableClock clock = new MutableClock(1_700_000_000_000L);
        RateLimitFilter filter = new RateLimitFilter(new RateLimitService(clock), true, "127.0.0.1");

        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken("9999999999", null,
                        List.of(new SimpleGrantedAuthority("ROLE_OWNER"))));

        // AI endpoint allows 10/min per user even if IP changes
        for (int i = 0; i < 10; i++) {
            MockHttpServletRequest req = new MockHttpServletRequest("POST", "/api/ai/quick-sale/extract-text");
            req.setRemoteAddr("198.51.100." + i);
            MockHttpServletResponse res = new MockHttpServletResponse();
            filter.doFilter(req, res, new MockFilterChain());
            assertEquals(200, res.getStatus());
        }
        MockHttpServletRequest aiBlocked = new MockHttpServletRequest("POST", "/api/ai/purchase-invoice/extract");
        aiBlocked.setRemoteAddr("198.51.100.99");
        MockHttpServletResponse aiBlockedRes = new MockHttpServletResponse();
        filter.doFilter(aiBlocked, aiBlockedRes, new MockFilterChain());
        assertEquals(429, aiBlockedRes.getStatus());

        // Payment initiation allows 15/min per user across order IDs
        for (int i = 0; i < 15; i++) {
            MockHttpServletRequest req = new MockHttpServletRequest("POST", "/api/customer/orders/" + (100 + i) + "/payment");
            req.setRemoteAddr("198.51.100.1");
            MockHttpServletResponse res = new MockHttpServletResponse();
            filter.doFilter(req, res, new MockFilterChain());
            assertEquals(200, res.getStatus());
        }
        MockHttpServletRequest payBlocked = new MockHttpServletRequest("POST", "/api/customer/orders/999/payment");
        MockHttpServletResponse payBlockedRes = new MockHttpServletResponse();
        filter.doFilter(payBlocked, payBlockedRes, new MockFilterChain());
        assertEquals(429, payBlockedRes.getStatus());

        // Razorpay webhook is not blocked by backend rate limiter
        SecurityContextHolder.clearContext();
        for (int i = 0; i < 30; i++) {
            MockHttpServletRequest req = new MockHttpServletRequest("POST", "/api/payments/razorpay/webhook");
            req.setRemoteAddr("203.0.113.50");
            MockHttpServletResponse res = new MockHttpServletResponse();
            filter.doFilter(req, res, new MockFilterChain());
            assertEquals(200, res.getStatus());
        }
    }

    @Test
    void spoofedAndMalformedForwardedHeadersFromUntrustedClientsAreIgnored() throws Exception {
        MutableClock clock = new MutableClock(1_700_000_000_000L);
        RateLimitFilter filter = new RateLimitFilter(new RateLimitService(clock), true, "127.0.0.1,172.");

        // Untrusted remote IP trying to spoof X-Forwarded-For cannot bypass 10/min login limit
        for (int i = 0; i < 10; i++) {
            MockHttpServletRequest req = new MockHttpServletRequest("POST", "/api/auth/login");
            req.setRemoteAddr("198.51.100.77");
            req.addHeader("X-Forwarded-For", "10.0.0." + i);
            req.addHeader("X-Real-IP", "8.8.8." + i);
            MockHttpServletResponse res = new MockHttpServletResponse();
            filter.doFilter(req, res, new MockFilterChain());
            assertEquals(200, res.getStatus());
        }
        MockHttpServletRequest spoofBlocked = new MockHttpServletRequest("POST", "/api/auth/login");
        spoofBlocked.setRemoteAddr("198.51.100.77");
        spoofBlocked.addHeader("X-Forwarded-For", "1.1.1.1, bad-header-value");
        MockHttpServletResponse spoofRes = new MockHttpServletResponse();
        filter.doFilter(spoofBlocked, spoofRes, new MockFilterChain());
        assertEquals(429, spoofRes.getStatus());

        // Trusted proxy (172.18.0.5) with valid XFF resolves client IP, ignoring malformed rightmost garbage
        MockHttpServletRequest trustedReq = new MockHttpServletRequest("POST", "/api/auth/login");
        trustedReq.setRemoteAddr("172.18.0.5");
        trustedReq.addHeader("X-Forwarded-For", "203.0.113.99, not-an-ip");
        assertEquals("203.0.113.99",
                trustedReq.getHeader("X-Forwarded-For").split(",")[0].trim());
        MockHttpServletResponse trustedRes = new MockHttpServletResponse();
        filter.doFilter(trustedReq, trustedRes, new MockFilterChain());
        assertEquals(200, trustedRes.getStatus());
    }
}
