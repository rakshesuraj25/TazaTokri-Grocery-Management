package com.tazatokri.common;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CopyOnWriteArrayList;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
public class SentryErrorReporter {

	private static final Logger log = LoggerFactory.getLogger(SentryErrorReporter.class);

	public record CapturedErrorEvent(
			String correlationId,
			String environment,
			String category,
			String endpoint,
			String scrubbedMessage,
			Instant timestamp) {
	}

	private final String dsn;
	private final String environment;
	private final double tracesSampleRate;
	private final List<CapturedErrorEvent> recentEvents = new CopyOnWriteArrayList<>();

	public SentryErrorReporter(
			@Value("${app.sentry.dsn:}") String dsn,
			@Value("${app.sentry.environment:development}") String environment,
			@Value("${app.sentry.traces-sample-rate:0.1}") double tracesSampleRate) {
		this.dsn = dsn != null ? dsn.trim() : "";
		this.environment = (environment == null || environment.isBlank()) ? "development" : environment.trim();
		this.tracesSampleRate = Math.max(0.0, Math.min(1.0, tracesSampleRate));
	}

	public boolean isEnabled() {
		return !dsn.isBlank();
	}

	public String getEnvironment() {
		return environment;
	}

	public double getTracesSampleRate() {
		return tracesSampleRate;
	}

	public CapturedErrorEvent captureException(String category, String endpoint, Throwable ex) {
		String corrId = MDC.get(CorrelationIdFilter.MDC_CORRELATION_ID);
		if (corrId == null) corrId = "none";
		String rawMsg = ex != null && ex.getMessage() != null ? ex.getMessage() : "Unhandled exception";
		String scrubbedMsg = LogScrubber.scrub(rawMsg);
		String scrubbedEndpoint = LogScrubber.scrub(endpoint != null ? endpoint : "unknown");

		CapturedErrorEvent event = new CapturedErrorEvent(
				corrId,
				environment,
				category,
				scrubbedEndpoint,
				scrubbedMsg,
				Instant.now());

		if (recentEvents.size() >= 50) {
			recentEvents.remove(0);
		}
		recentEvents.add(event);

		String exType = ex != null ? ex.getClass().getSimpleName() : "UnknownException";
		log.error("error_event corrId={} env={} category={} endpoint={} exception={} msg={}",
				corrId, environment, category, scrubbedEndpoint, exType, scrubbedMsg, ex);
		return event;
	}

	public List<CapturedErrorEvent> getRecentEvents() {
		return List.copyOf(recentEvents);
	}

	public Map<String, Object> statusSummary() {
		Map<String, Object> m = new LinkedHashMap<>();
		m.put("enabled", isEnabled());
		m.put("environment", environment);
		m.put("tracesSampleRate", tracesSampleRate);
		m.put("recentCapturedCount", recentEvents.size());
		return m;
	}
}
