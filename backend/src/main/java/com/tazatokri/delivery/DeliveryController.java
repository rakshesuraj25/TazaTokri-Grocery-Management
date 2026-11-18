package com.tazatokri.delivery;

import java.io.IOException;
import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import com.tazatokri.common.BadRequestException;
import com.tazatokri.delivery.DeliveryDtos.DeliveryEvidenceResponse;
import com.tazatokri.delivery.DeliveryDtos.ManualOtpOverrideRequest;
import com.tazatokri.delivery.DeliveryDtos.OtpIssueResponse;
import com.tazatokri.delivery.DeliveryDtos.OtpVerifyRequest;
import com.tazatokri.delivery.DeliveryDtos.OtpVerifyResponse;
import com.tazatokri.payment.CollectionRequest;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/delivery/orders")
@PreAuthorize("hasAnyRole('DELIVERY','OWNER','STAFF')")
public class DeliveryController {

	private final DeliveryService service;

	public DeliveryController(DeliveryService service) {
		this.service = service;
	}

	@GetMapping
	@PreAuthorize("hasRole('DELIVERY')")
	public List<DeliveryOrderResponse> mine(Authentication auth) {
		return service.myOrders(auth.getName());
	}

	@PostMapping("/{id}/start")
	@PreAuthorize("hasRole('DELIVERY')")
	public AttemptResponse start(@PathVariable Long id, Authentication auth) {
		return service.start(id, auth.getName());
	}

	@PostMapping("/{id}/otp/issue")
	public OtpIssueResponse issueOtp(@PathVariable Long id, Authentication auth) {
		return service.issueOtp(id, auth.getName());
	}

	@PostMapping("/{id}/otp/verify")
	public OtpVerifyResponse verifyOtp(
			@PathVariable Long id,
			@Valid @RequestBody OtpVerifyRequest req,
			Authentication auth) {
		return service.verifyOtp(id, req.otp(), auth.getName());
	}

	@PostMapping("/{id}/otp/manual-override")
	public OtpVerifyResponse manualOtpOverride(
			@PathVariable Long id,
			@Valid @RequestBody ManualOtpOverrideRequest req,
			Authentication auth) {
		return service.manualOtpOverride(id, req.reason(), auth.getName());
	}

	@PostMapping(value = "/{id}/proof", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
	@ResponseStatus(HttpStatus.CREATED)
	public DeliveryEvidenceResponse uploadProof(
			@PathVariable Long id,
			@RequestParam("file") MultipartFile file,
			@RequestParam(value = "note", required = false) String note,
			Authentication auth) {
		if (file == null || file.isEmpty()) {
			throw new BadRequestException("Proof of delivery image file is required");
		}
		byte[] bytes;
		try {
			bytes = file.getBytes();
		} catch (IOException e) {
			throw new BadRequestException("Failed to read uploaded image file");
		}
		return service.uploadProofPhoto(id, bytes, file.getOriginalFilename(), note, auth.getName());
	}

	@PostMapping("/{id}/deliver")
	@PreAuthorize("hasRole('DELIVERY')")
	public AttemptResponse deliver(
			@PathVariable Long id,
			@Valid @RequestBody(required = false) CollectionRequest req,
			Authentication auth) {
		return service.deliver(id, req, auth.getName());
	}

	@PostMapping("/{id}/fail")
	@PreAuthorize("hasRole('DELIVERY')")
	public AttemptResponse fail(
			@PathVariable Long id,
			@Valid @RequestBody FailRequest req,
			Authentication auth) {
		return service.fail(id, req.reason(), auth.getName());
	}
}
