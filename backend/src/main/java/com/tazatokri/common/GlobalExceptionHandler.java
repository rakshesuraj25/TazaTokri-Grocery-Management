package com.tazatokri.common;

import java.util.LinkedHashMap;
import java.util.Map;

import org.slf4j.MDC;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import jakarta.servlet.http.HttpServletRequest;

@RestControllerAdvice
public class GlobalExceptionHandler {

	private final SentryErrorReporter sentryReporter;

	public GlobalExceptionHandler() {
		this(null);
	}

	@Autowired
	public GlobalExceptionHandler(SentryErrorReporter sentryReporter) {
		this.sentryReporter = sentryReporter;
	}

	private Map<String, Object> baseBody(String message) {
		Map<String, Object> body = new LinkedHashMap<>();
		body.put("message", LogScrubber.scrub(message));
		String corrId = MDC.get(CorrelationIdFilter.MDC_CORRELATION_ID);
		if (corrId != null) {
			body.put("correlationId", corrId);
		}
		return body;
	}

	@ExceptionHandler(MethodArgumentNotValidException.class)
	public ResponseEntity<Map<String, Object>> handleValidation(MethodArgumentNotValidException ex) {
		Map<String, String> fieldErrors = new LinkedHashMap<>();
		ex.getBindingResult().getFieldErrors().forEach(e -> fieldErrors.put(e.getField(), e.getDefaultMessage()));

		Map<String, Object> body = baseBody("Validation failed");
		body.put("errors", fieldErrors);
		return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(body);
	}

	@ExceptionHandler(DuplicateResourceException.class)
	public ResponseEntity<Map<String, Object>> handleDuplicate(DuplicateResourceException ex) {
		return ResponseEntity.status(HttpStatus.CONFLICT).body(baseBody(ex.getMessage()));
	}

	@ExceptionHandler(org.springframework.http.converter.HttpMessageNotReadableException.class)
	public ResponseEntity<Map<String, Object>> handleUnreadable(
			org.springframework.http.converter.HttpMessageNotReadableException ex) {
		return ResponseEntity.status(HttpStatus.BAD_REQUEST)
				.body(baseBody("Malformed JSON or invalid value (check roles: OWNER, STAFF, DELIVERY, CUSTOMER)"));
	}

	@ExceptionHandler(org.springframework.dao.DataIntegrityViolationException.class)
	public ResponseEntity<Map<String, Object>> handleIntegrity(
			org.springframework.dao.DataIntegrityViolationException ex) {
		return ResponseEntity.status(HttpStatus.CONFLICT)
				.body(baseBody("Data conflicts with existing records"));
	}

	@ExceptionHandler(InvalidCredentialsException.class)
	public ResponseEntity<Map<String, Object>> handleInvalidCredentials(InvalidCredentialsException ex) {
		return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(baseBody(ex.getMessage()));
	}

	@ExceptionHandler(ResourceNotFoundException.class)
	public ResponseEntity<Map<String, Object>> handleNotFound(ResourceNotFoundException ex) {
		return ResponseEntity.status(HttpStatus.NOT_FOUND).body(baseBody(ex.getMessage()));
	}

	@ExceptionHandler(BadRequestException.class)
	public ResponseEntity<Map<String, Object>> handleBadRequest(BadRequestException ex) {
		return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(baseBody(ex.getMessage()));
	}

	@ExceptionHandler(InsufficientStockException.class)
	public ResponseEntity<Map<String, Object>> handleInsufficientStock(InsufficientStockException ex) {
		return ResponseEntity.status(HttpStatus.CONFLICT).body(baseBody(ex.getMessage()));
	}

	@ExceptionHandler(InvalidOrderStateException.class)
	public ResponseEntity<Map<String, Object>> handleInvalidState(InvalidOrderStateException ex) {
		return ResponseEntity.status(HttpStatus.CONFLICT).body(baseBody(ex.getMessage()));
	}

	@ExceptionHandler(PaymentGatewayException.class)
	public ResponseEntity<Map<String, Object>> handleGateway(PaymentGatewayException ex, HttpServletRequest req) {
		if (sentryReporter != null) {
			sentryReporter.captureException("PAYMENT_GATEWAY_ERROR", req != null ? req.getRequestURI() : "/api/payments", ex);
		}
		return ResponseEntity.status(HttpStatus.BAD_GATEWAY)
				.body(baseBody("Payment provider error. Please try again"));
	}
}
