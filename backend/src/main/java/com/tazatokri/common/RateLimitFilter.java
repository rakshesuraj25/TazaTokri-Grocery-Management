package com.tazatokri.common;

import java.io.IOException;
import java.net.InetAddress;
import java.util.List;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

/**
 * Server-side rate limiting filter protecting auth, AI, payment initiation,
 * and public catalog endpoints against abuse while ignoring spoofed forwarded headers
 * from untrusted remote addresses.
 */
@Component
public class RateLimitFilter extends OncePerRequestFilter {

    private record Rule(String bucketPrefix, int maxRequests, long windowSeconds, boolean keyByUserIfPresent) {}

    private final RateLimitService rateLimitService;
    private final boolean enabled;
    private final List<String> trustedProxyPrefixes;

    public RateLimitFilter(
            RateLimitService rateLimitService,
            @Value("${app.rate-limit.enabled:true}") boolean enabled,
            @Value("${app.rate-limit.trusted-proxies:127.0.0.1,::1,0:0:0:0:0:0:0:1,172.,10.,192.168.}") String trustedProxiesCsv) {
        this.rateLimitService = rateLimitService;
        this.enabled = enabled;
        this.trustedProxyPrefixes = java.util.Arrays.stream(
                        (trustedProxiesCsv == null ? "" : trustedProxiesCsv).split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .toList();
    }

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain) throws ServletException, IOException {

        if (!enabled) {
            filterChain.doFilter(request, response);
            return;
        }

        Rule rule = matchRule(request.getMethod(), request.getRequestURI());
        if (rule == null) {
            filterChain.doFilter(request, response);
            return;
        }

        String identity = resolveIdentity(request, rule.keyByUserIfPresent());
        String key = rule.bucketPrefix() + ":" + identity;
        RateLimitService.Decision decision = rateLimitService.tryConsume(key, rule.maxRequests(), rule.windowSeconds());

        response.setHeader("X-RateLimit-Limit", String.valueOf(decision.limit()));
        response.setHeader("X-RateLimit-Remaining", String.valueOf(decision.remaining()));

        if (!decision.allowed()) {
            response.setStatus(429);
            response.setContentType("application/json");
            response.setHeader("Retry-After", String.valueOf(decision.retryAfterSeconds()));
            response.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
            response.getWriter().write("{\"message\":\"Too many requests. Please try again shortly.\"}");
            return;
        }

        filterChain.doFilter(request, response);
    }

    private Rule matchRule(String method, String uri) {
        if (uri == null || method == null) {
            return null;
        }
        if ("POST".equalsIgnoreCase(method) && "/api/auth/login".equals(uri)) {
            return new Rule("auth_login", 10, 60, false);
        }
        if ("POST".equalsIgnoreCase(method) && "/api/auth/signup".equals(uri)) {
            return new Rule("auth_signup", 5, 300, false);
        }
        if ("POST".equalsIgnoreCase(method) && "/api/auth/forgot-password".equals(uri)) {
            return new Rule("auth_forgot_password", 5, 300, false);
        }
        if ("POST".equalsIgnoreCase(method) && "/api/auth/reset-password".equals(uri)) {
            return new Rule("auth_reset_password", 10, 300, false);
        }
        if ("POST".equalsIgnoreCase(method) && uri.startsWith("/api/account/")) {
            return new Rule("account_security", 10, 300, true);
        }
        if ("POST".equalsIgnoreCase(method) && uri.startsWith("/api/ai/")) {
            return new Rule("ai_assist", 10, 60, true);
        }
        if ("POST".equalsIgnoreCase(method)
                && uri.startsWith("/api/customer/orders/")
                && (uri.endsWith("/payment") || uri.endsWith("/payment/verify") || uri.endsWith("/payment/fail"))) {
            return new Rule("payment_init", 15, 60, true);
        }
        if ("GET".equalsIgnoreCase(method) && uri.startsWith("/api/public/")) {
            return new Rule("public_catalog", 120, 60, false);
        }
        return null;
    }

    String resolveIdentity(HttpServletRequest request, boolean keyByUserIfPresent) {
        if (keyByUserIfPresent) {
            Authentication auth = SecurityContextHolder.getContext().getAuthentication();
            if (auth != null && auth.isAuthenticated() && auth.getName() != null && !auth.getName().isBlank()
                    && !"anonymousUser".equals(auth.getName())) {
                return "user:" + auth.getName();
            }
        }
        return "ip:" + resolveClientIp(request);
    }

    String resolveClientIp(HttpServletRequest request) {
        String remoteAddr = request.getRemoteAddr();
        if (remoteAddr == null || remoteAddr.isBlank()) {
            return "unknown";
        }
        if (isTrustedProxy(remoteAddr)) {
            String xff = request.getHeader("X-Forwarded-For");
            if (xff != null && !xff.isBlank()) {
                String[] parts = xff.split(",");
                for (int i = parts.length - 1; i >= 0; i--) {
                    String candidate = parts[i].trim();
                    if (!isTrustedProxy(candidate) && isValidIpLiteral(candidate)) {
                        return candidate;
                    }
                }
            }
            String xRealIp = request.getHeader("X-Real-IP");
            if (xRealIp != null && isValidIpLiteral(xRealIp.trim())) {
                return xRealIp.trim();
            }
        }
        return remoteAddr;
    }

    private boolean isTrustedProxy(String ip) {
        for (String prefix : trustedProxyPrefixes) {
            if (ip.equals(prefix) || ip.startsWith(prefix)) {
                return true;
            }
        }
        return false;
    }

    private boolean isValidIpLiteral(String candidate) {
        if (candidate == null || candidate.isEmpty() || candidate.length() > 45) {
            return false;
        }
        // Reject hostnames / arbitrary strings: only IPv4/IPv6 characters allowed
        if (!candidate.matches("^[0-9a-fA-F.:]+$")) {
            return false;
        }
        try {
            InetAddress.getByName(candidate);
            return true;
        } catch (Exception e) {
            return false;
        }
    }
}
