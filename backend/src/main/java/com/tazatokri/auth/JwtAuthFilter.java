package com.tazatokri.auth;

import java.io.IOException;
import java.util.List;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import com.tazatokri.user.User;
import com.tazatokri.user.UserRepository;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

@Component
public class JwtAuthFilter extends OncePerRequestFilter {

    private final JwtService jwtService;
    private final UserRepository userRepository;

    public JwtAuthFilter(JwtService jwtService) {
        this(jwtService, null);
    }

    @Autowired
    public JwtAuthFilter(JwtService jwtService, UserRepository userRepository) {
        this.jwtService = jwtService;
        this.userRepository = userRepository;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain chain) throws ServletException, IOException {

        String header = request.getHeader("Authorization");

        if (header != null && header.startsWith("Bearer ")) {
            String token = header.substring(7).trim();

            if (!token.isEmpty()) {
                try {
                    Claims claims = jwtService.parseToken(token);
                    String subject = claims.getSubject();
                    String purpose = claims.get("purpose", String.class);
                    if (purpose != null) {
                        // Purpose-scoped tokens (password reset, verification) cannot be used as bearer auth
                        SecurityContextHolder.clearContext();
                    } else if (subject != null && !subject.isBlank() && isUserStillValid(claims, subject)) {
                        List<SimpleGrantedAuthority> authorities = jwtService.extractRoles(claims).stream()
                                .map(role -> new SimpleGrantedAuthority("ROLE_" + role))
                                .toList();

                        UsernamePasswordAuthenticationToken authentication =
                                new UsernamePasswordAuthenticationToken(subject, null, authorities);

                        SecurityContextHolder.getContext().setAuthentication(authentication);
                    }
                } catch (JwtException | IllegalArgumentException ex) {
                    SecurityContextHolder.clearContext();
                }
            }
        }

        chain.doFilter(request, response);
    }

    private boolean isUserStillValid(Claims claims, String subject) {
        if (userRepository == null) {
            return true;
        }
        Number userIdNum = claims.get("userId", Number.class);
        if (userIdNum != null) {
            return userRepository.findById(userIdNum.longValue())
                    .filter(User::isActive)
                    .map(u -> subject.equals(u.getPhone()))
                    .orElse(false);
        }
        return userRepository.findByPhone(subject)
                .map(User::isActive)
                .orElse(false);
    }
}