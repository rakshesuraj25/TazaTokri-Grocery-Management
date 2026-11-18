package com.tazatokri.ai;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import com.tazatokri.catalog.UnitType;

public final class AiDtos {

	private AiDtos() {
	}

	public record AiStatusResponse(
			boolean enabled,
			boolean configured,
			String model,
			long maxUploadBytes,
			List<String> supportedMimeTypes,
			String message) {
	}

	public record RawTextExtractRequest(String rawText) {
	}

	public record PurchaseInvoiceDraftDto(
			String supplierName,
			Long matchedSupplierId,
			LocalDate invoiceDate,
			String invoiceNumber,
			BigDecimal transportCost,
			BigDecimal invoiceGrandTotal,
			BigDecimal calculatedItemsTotal,
			BigDecimal calculatedGrandTotal,
			boolean totalMismatch,
			String totalMismatchWarning,
			int unmatchedItemsCount,
			String extractionSource,
			List<String> warnings,
			List<PurchaseInvoiceDraftLineDto> items) {
	}

	public record PurchaseInvoiceDraftLineDto(
			String rawItemName,
			Long vegetableId,
			String matchedVegetableName,
			UnitType baseUnit,
			BigDecimal quantity,
			String rawUnit,
			BigDecimal ratePerUnit,
			BigDecimal extractedLineTotal,
			BigDecimal calculatedLineTotal,
			boolean lineTotalMismatch,
			boolean matched,
			String confidence,
			String note) {
	}

	public record QuickSaleDraftDto(
			String extractionSource,
			int totalExtractedCount,
			int matchedCount,
			int unmatchedCount,
			BigDecimal estimatedSubtotal,
			List<String> warnings,
			List<QuickSaleDraftLineDto> items) {
	}

	public record QuickSaleDraftLineDto(
			String rawLineText,
			String rawItemName,
			Long vegetableId,
			String matchedVegetableName,
			String matchedNameMr,
			String matchedNameHi,
			UnitType baseUnit,
			BigDecimal quantity,
			String rawUnit,
			BigDecimal currentUnitPrice,
			BigDecimal estimatedLineTotal,
			BigDecimal availableStock,
			boolean stockSufficient,
			boolean matched,
			String confidence,
			String warning) {
	}
}
