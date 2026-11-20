package com.tazatokri.common;

import ch.qos.logback.classic.pattern.ThrowableProxyConverter;
import ch.qos.logback.classic.spi.IThrowableProxy;

/**
 * Logback ThrowableProxyConverter that preserves exception types and stack trace
 * locations while scrubbing sensitive credentials from exception messages.
 */
public class ScrubbingThrowableProxyConverter extends ThrowableProxyConverter {

	@Override
	protected String throwableProxyToString(IThrowableProxy tp) {
		String formatted = super.throwableProxyToString(tp);
		return LogScrubber.scrub(formatted);
	}
}
