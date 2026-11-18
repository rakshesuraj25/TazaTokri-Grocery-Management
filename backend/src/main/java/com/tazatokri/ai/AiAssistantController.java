package com.tazatokri.ai;

import java.io.IOException;

import org.springframework.http.MediaType;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import com.tazatokri.ai.AiDtos.AiStatusResponse;
import com.tazatokri.ai.AiDtos.PurchaseInvoiceDraftDto;
import com.tazatokri.ai.AiDtos.QuickSaleDraftDto;
import com.tazatokri.ai.AiDtos.RawTextExtractRequest;
import com.tazatokri.common.BadRequestException;

@RestController
@RequestMapping("/api/ai")
@PreAuthorize("hasAnyRole('OWNER','STAFF')")
public class AiAssistantController {

	private final AiAssistantService service;

	public AiAssistantController(AiAssistantService service) {
		this.service = service;
	}

	@GetMapping("/status")
	public AiStatusResponse status() {
		return service.getStatus();
	}

	@PostMapping(value = "/purchase-invoice/extract", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
	public PurchaseInvoiceDraftDto extractPurchaseInvoiceMultipart(
			@RequestParam(value = "file", required = false) MultipartFile file,
			@RequestParam(value = "rawText", required = false) String rawText,
			Authentication auth) {
		byte[] bytes = readFileBytes(file);
		String fileName = file != null ? file.getOriginalFilename() : null;
		String mimeType = file != null ? file.getContentType() : null;
		String actor = auth != null ? auth.getName() : null;
		return service.extractPurchaseInvoice(bytes, fileName, mimeType, rawText, actor);
	}

	@PostMapping(value = "/purchase-invoice/extract-text", consumes = MediaType.APPLICATION_JSON_VALUE)
	public PurchaseInvoiceDraftDto extractPurchaseInvoiceText(
			@RequestBody RawTextExtractRequest req,
			Authentication auth) {
		String actor = auth != null ? auth.getName() : null;
		return service.extractPurchaseInvoice(null, null, null, req != null ? req.rawText() : null, actor);
	}

	@PostMapping(value = "/quick-sale/extract", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
	public QuickSaleDraftDto extractQuickSaleMultipart(
			@RequestParam(value = "file", required = false) MultipartFile file,
			@RequestParam(value = "rawText", required = false) String rawText,
			Authentication auth) {
		byte[] bytes = readFileBytes(file);
		String fileName = file != null ? file.getOriginalFilename() : null;
		String mimeType = file != null ? file.getContentType() : null;
		String actor = auth != null ? auth.getName() : null;
		return service.extractQuickSaleList(bytes, fileName, mimeType, rawText, actor);
	}

	@PostMapping(value = "/quick-sale/extract-text", consumes = MediaType.APPLICATION_JSON_VALUE)
	public QuickSaleDraftDto extractQuickSaleText(
			@RequestBody RawTextExtractRequest req,
			Authentication auth) {
		String actor = auth != null ? auth.getName() : null;
		return service.extractQuickSaleList(null, null, null, req != null ? req.rawText() : null, actor);
	}

	private static byte[] readFileBytes(MultipartFile file) {
		if (file == null || file.isEmpty()) {
			return null;
		}
		try {
			return file.getBytes();
		} catch (IOException e) {
			throw new BadRequestException("Failed to read uploaded file.");
		}
	}
}
