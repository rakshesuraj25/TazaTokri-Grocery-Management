package com.tazatokri.delivery;

import java.time.LocalDate;
import java.util.List;

import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.tazatokri.delivery.DeliveryDtos.DeliveryAuditLogResponse;
import com.tazatokri.delivery.DeliveryDtos.DeliveryEvidenceResponse;
import com.tazatokri.delivery.DeliveryDtos.ReturnToStoreRequest;
import com.tazatokri.delivery.DeliveryDtos.StaffDeliveryBoardResponse;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/api")
public class DeliveryAdminController {

	private final DeliveryService service;

	public DeliveryAdminController(DeliveryService service) {
		this.service = service;
	}

	@GetMapping("/delivery/people")
	@PreAuthorize("hasAnyRole('OWNER','STAFF')")
	public List<DeliveryPersonResponse> people() {
		return service.people();
	}

	@GetMapping("/delivery/admin/board")
	@PreAuthorize("hasAnyRole('OWNER','STAFF')")
	public StaffDeliveryBoardResponse board(
			@RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
			@RequestParam(required = false) String stage,
			@RequestParam(required = false) String pincode,
			@RequestParam(required = false) Long deliveryUserId) {
		return service.staffBoard(date, stage, pincode, deliveryUserId);
	}

	@PostMapping("/orders/{id}/assign")
	@PreAuthorize("hasAnyRole('OWNER','STAFF')")
	public AttemptResponse assign(
			@PathVariable Long id,
			@Valid @RequestBody AssignRequest req,
			Authentication auth) {
		return service.assign(id, req.deliveryUserId(), auth.getName());
	}

	@PostMapping("/orders/{id}/unassign")
	@PreAuthorize("hasAnyRole('OWNER','STAFF')")
	public AttemptResponse unassign(
			@PathVariable Long id,
			@Valid @RequestBody(required = false) ReturnToStoreRequest req,
			Authentication auth) {
		return service.unassign(id, req != null ? req.note() : null, auth.getName());
	}

	@PostMapping("/orders/{id}/return-to-store")
	@PreAuthorize("hasAnyRole('OWNER','STAFF')")
	public AttemptResponse returnToStore(
			@PathVariable Long id,
			@Valid @RequestBody(required = false) ReturnToStoreRequest req,
			Authentication auth) {
		return service.returnToStore(id, req != null ? req.note() : null, auth.getName());
	}

	@GetMapping("/orders/{id}/deliveries")
	@PreAuthorize("hasAnyRole('OWNER','STAFF')")
	public List<AttemptResponse> history(@PathVariable Long id) {
		return service.history(id);
	}

	@GetMapping("/orders/{id}/delivery-audit")
	@PreAuthorize("hasAnyRole('OWNER','STAFF')")
	public List<DeliveryAuditLogResponse> auditTrail(@PathVariable Long id) {
		return service.auditTrail(id);
	}

	@GetMapping("/orders/{id}/delivery-evidence")
	@PreAuthorize("hasAnyRole('OWNER','STAFF','DELIVERY','CUSTOMER')")
	public List<DeliveryEvidenceResponse> listEvidence(
			@PathVariable Long id,
			Authentication auth) {
		return service.listEvidences(id, auth.getName());
	}

	@GetMapping("/orders/{id}/delivery-evidence/{evidenceId}/photo")
	@PreAuthorize("hasAnyRole('OWNER','STAFF','DELIVERY','CUSTOMER')")
	public ResponseEntity<byte[]> downloadEvidencePhoto(
			@PathVariable Long id,
			@PathVariable Long evidenceId,
			Authentication auth) {
		DeliveryService.LoadedProofPhoto loaded = service.loadEvidencePhoto(id, evidenceId, auth.getName());
		return ResponseEntity.ok()
				.cacheControl(CacheControl.noStore().mustRevalidate())
				.header(HttpHeaders.PRAGMA, "no-cache")
				.header("X-Content-Type-Options", "nosniff")
				.header("ETag", "\"" + loaded.sha256Checksum() + "\"")
				.contentType(MediaType.parseMediaType(loaded.mimeType()))
				.body(loaded.bytes());
	}
}
