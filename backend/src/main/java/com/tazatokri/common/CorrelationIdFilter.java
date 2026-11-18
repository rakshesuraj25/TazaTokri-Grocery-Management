package com.tazatokri.common;

import java.io.IOException;
import java.util.UUID;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class CorrelationIdFilter extends OncePerRequestFilter {

	public static final String CORRELATION_ID_HEADER = "X-Correlation-Id";
	public static final String MDC_CORRELATION_ID = "correlationId";
	private static final Logger log = LoggerFactory.getLogger(CorrelationIdFilter.class);

	@Override
	protected void doFilterInternal(
			HttpServletRequest request,
			HttpServletResponse response,
			FilterChain filterChain) throws ServletException, IOException {

		String incoming = request.getHeader(CORRELATION_ID_HEADER);
		String correlationId = (incoming != null && incoming.matches("^[A-Za-z0-9\\-_]{8,64}$"))
				? incoming
				: UUID.randomUUID().toString();

		long startNanos = System.nanoTime();
		MDC.put(MDC_CORRELATION_ID, correlationId);
		response.setHeader(CORRELATION_ID_HEADER, correlationId);
		// Security headers on every response
		response.setHeader("X-Content-Type-Options", "nosniff");
		response.setHeader("X-Frame-Options", "DENY");
		response.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");

		try {
			filterChain.doFilter(request, response);
		} finally {
			long durationMs = (System.nanoTime() - startNanos) / 1_000_000L;
			String uri = LogScrubber.scrub(request.getRequestURI());
			int status = response.getStatus();
			if (status >= 400) {
				log.warn("http_request corrId={} method={} endpoint={} status={} durationMs={}",
						correlationId, request.getMethod(), uri, status, durationMs);
			} else {
				log.debug("http_request corrId={} method={} endpoint={} status={} durationMs={}",
						correlationId, request.getMethod(), uri, status, durationMs);
			}
			MDC.remove(MDC_CORRELATION_ID);
		}
	}
}
