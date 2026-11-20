package com.tazatokri.common;

import ch.qos.logback.classic.pattern.MessageConverter;
import ch.qos.logback.classic.spi.ILoggingEvent;

/**
 * Logback MessageConverter that routes all formatted log messages through LogScrubber.
 */
public class ScrubbingMessageConverter extends MessageConverter {

	@Override
	public String convert(ILoggingEvent event) {
		String formatted = super.convert(event);
		return LogScrubber.scrub(formatted);
	}
}
