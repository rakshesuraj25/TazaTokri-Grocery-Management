package com.tazatokri.ai;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import tools.jackson.databind.JsonNode;
import com.tazatokri.ai.AiDtos.AiStatusResponse;
import com.tazatokri.ai.AiDtos.PurchaseInvoiceDraftDto;
import com.tazatokri.ai.AiDtos.PurchaseInvoiceDraftLineDto;
import com.tazatokri.ai.AiDtos.QuickSaleDraftDto;
import com.tazatokri.ai.AiDtos.QuickSaleDraftLineDto;
import com.tazatokri.catalog.UnitType;
import com.tazatokri.catalog.Vegetable;
import com.tazatokri.catalog.VegetableRepository;
import com.tazatokri.common.BadRequestException;
import com.tazatokri.inventory.StockMovementRepository;
import com.tazatokri.pricing.VegetablePrice;
import com.tazatokri.pricing.VegetablePriceRepository;
import com.tazatokri.purchase.Supplier;
import com.tazatokri.purchase.SupplierRepository;
import com.tazatokri.user.User;
import com.tazatokri.user.UserRepository;

@Service
public class AiAssistantService {

	private static final ZoneId IST = ZoneId.of("Asia/Kolkata");
	private static final BigDecimal THOUSAND = BigDecimal.valueOf(1000);

	/**
	 * Multilingual & phonetic aliases mapped to the 36 canonical English vegetable names.
	 */
	private static final Map<String, String> ALIAS_TO_CANONICAL_EN = buildAliasMap();

	private final GeminiProvider gemini;
	private final VegetableRepository vegetables;
	private final SupplierRepository suppliers;
	private final VegetablePriceRepository prices;
	private final StockMovementRepository movements;
	private final AiExtractionLogRepository logs;
	private final UserRepository users;

	public AiAssistantService(
			GeminiProvider gemini,
			VegetableRepository vegetables,
			SupplierRepository suppliers,
			VegetablePriceRepository prices,
			StockMovementRepository movements,
			AiExtractionLogRepository logs,
			UserRepository users) {
		this.gemini = gemini;
		this.vegetables = vegetables;
		this.suppliers = suppliers;
		this.prices = prices;
		this.movements = movements;
		this.logs = logs;
		this.users = users;
	}

	public AiStatusResponse getStatus() {
		boolean enabled = gemini.isEnabled();
		boolean configured = gemini.isConfigured();
		String message = configured
				? "Gemini AI vision and text assistant is active (" + gemini.getModel() + ")."
				: "Gemini vision API is not configured (set GEMINI_ENABLED=true and GEMINI_API_KEY). Local multilingual text parsing and manual entry are ready.";
		return new AiStatusResponse(
				enabled,
				configured,
				gemini.getModel(),
				gemini.getMaxUploadBytes(),
				List.copyOf(GeminiProvider.SUPPORTED_MIME_TYPES),
				message);
	}

	@Transactional
	public PurchaseInvoiceDraftDto extractPurchaseInvoice(
			byte[] fileBytes,
			String fileName,
			String mimeType,
			String rawText,
			String actorPhone) {

		boolean hasFile = fileBytes != null && fileBytes.length > 0;
		boolean hasText = rawText != null && !rawText.isBlank();
		if (!hasFile && !hasText) {
			throw new BadRequestException("Provide an invoice image/PDF or paste invoice text to extract.");
		}

		List<Vegetable> activeCatalog = vegetables.findByActiveTrueOrderByNameEnAsc();
		List<Supplier> allSuppliers = suppliers.findAll();

		RawInvoiceExtracted raw;
		String extractionSource;
		if (hasFile) {
			gemini.validateUpload(mimeType, fileBytes.length);
			String prompt = buildPurchaseInvoicePrompt(activeCatalog)
					+ (hasText ? "\nAdditional notes: " + rawText : "");
			JsonNode json = gemini.generateStructuredJson(prompt, fileBytes, mimeType);
			raw = parseInvoiceJson(json);
			extractionSource = "GEMINI_VISION";
		} else if (gemini.isConfigured()) {
			try {
				String prompt = buildPurchaseInvoicePrompt(activeCatalog) + "\nInvoice Text:\n" + rawText;
				JsonNode json = gemini.generateStructuredJson(prompt, null, null);
				raw = parseInvoiceJson(json);
				extractionSource = "GEMINI_TEXT";
			} catch (Exception ex) {
				raw = parseInvoiceTextLocally(rawText);
				extractionSource = "LOCAL_PARSER";
			}
		} else {
			raw = parseInvoiceTextLocally(rawText);
			extractionSource = "LOCAL_PARSER";
		}

		Long matchedSupplierId = null;
		if (raw.supplierName != null && !raw.supplierName.isBlank()) {
			String sNorm = raw.supplierName.trim().toLowerCase(Locale.ROOT);
			for (Supplier s : allSuppliers) {
				if (s.getName() != null && (s.getName().trim().toLowerCase(Locale.ROOT).equals(sNorm)
						|| s.getName().trim().toLowerCase(Locale.ROOT).contains(sNorm)
						|| sNorm.contains(s.getName().trim().toLowerCase(Locale.ROOT)))) {
					matchedSupplierId = s.getId();
					break;
				}
			}
		}

		List<PurchaseInvoiceDraftLineDto> lines = new ArrayList<>();
		List<String> warnings = new ArrayList<>();
		BigDecimal calculatedItemsTotal = BigDecimal.ZERO;
		int unmatchedCount = 0;

		for (RawInvoiceLine rl : raw.items) {
			CatalogMatch match = matchCatalogVegetable(rl.rawName, activeCatalog);
			BigDecimal normalizedQty = rl.quantity != null && rl.quantity.signum() > 0
					? rl.quantity
					: BigDecimal.ONE;
			BigDecimal normalizedRate = rl.ratePerUnit != null && rl.ratePerUnit.signum() >= 0
					? rl.ratePerUnit
					: BigDecimal.ZERO;

			UnitType baseUnit = match.vegetable != null ? match.vegetable.getBaseUnit() : UnitType.KG;
			if (baseUnit == UnitType.KG && isGramUnit(rl.rawUnit)) {
				normalizedQty = normalizedQty.divide(THOUSAND, 3, RoundingMode.HALF_UP);
				if (normalizedRate.signum() > 0 && rl.extractedLineTotal != null && normalizedQty.signum() > 0) {
					normalizedRate = rl.extractedLineTotal.divide(normalizedQty, 2, RoundingMode.HALF_UP);
				}
			} else {
				normalizedQty = normalizedQty.setScale(3, RoundingMode.HALF_UP);
			}
			normalizedRate = normalizedRate.setScale(2, RoundingMode.HALF_UP);

			BigDecimal calcLineTotal = normalizedQty.multiply(normalizedRate).setScale(2, RoundingMode.HALF_UP);
			calculatedItemsTotal = calculatedItemsTotal.add(calcLineTotal);

			boolean lineMismatch = false;
			String lineNote = null;
			if (rl.extractedLineTotal != null && rl.extractedLineTotal.signum() > 0) {
				BigDecimal diff = calcLineTotal.subtract(rl.extractedLineTotal).abs();
				if (diff.compareTo(new BigDecimal("1.00")) >= 0) {
					lineMismatch = true;
					lineNote = "Invoice line total ₹" + rl.extractedLineTotal.setScale(2, RoundingMode.HALF_UP)
							+ " differs from Qty × Rate (₹" + calcLineTotal + ")";
				}
			}

			if (!match.matched) {
				unmatchedCount++;
				lineNote = (lineNote == null ? "" : lineNote + " • ")
						+ "Unmatched item: select a catalog vegetable before saving.";
			}

			lines.add(new PurchaseInvoiceDraftLineDto(
					rl.rawName,
					match.vegetable != null ? match.vegetable.getId() : null,
					match.vegetable != null ? match.vegetable.getNameEn() : null,
					match.vegetable != null ? match.vegetable.getBaseUnit() : null,
					normalizedQty,
					rl.rawUnit != null ? rl.rawUnit : (baseUnit != null ? baseUnit.name() : "KG"),
					normalizedRate,
					rl.extractedLineTotal != null ? rl.extractedLineTotal.setScale(2, RoundingMode.HALF_UP) : null,
					calcLineTotal,
					lineMismatch,
					match.matched,
					match.confidence,
					lineNote));
		}

		BigDecimal transport = raw.transportCost != null && raw.transportCost.signum() >= 0
				? raw.transportCost.setScale(2, RoundingMode.HALF_UP)
				: BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
		calculatedItemsTotal = calculatedItemsTotal.setScale(2, RoundingMode.HALF_UP);
		BigDecimal calculatedGrandTotal = calculatedItemsTotal.add(transport).setScale(2, RoundingMode.HALF_UP);

		boolean totalMismatch = false;
		String totalMismatchWarning = null;
		if (raw.invoiceGrandTotal != null && raw.invoiceGrandTotal.signum() > 0) {
			BigDecimal diff = calculatedGrandTotal.subtract(raw.invoiceGrandTotal).abs();
			if (diff.compareTo(new BigDecimal("1.00")) >= 0) {
				totalMismatch = true;
				totalMismatchWarning = "Extracted invoice total (₹"
						+ raw.invoiceGrandTotal.setScale(2, RoundingMode.HALF_UP)
						+ ") does not match calculated sum of lines + transport (₹"
						+ calculatedGrandTotal + "). Please verify quantities and rates.";
				warnings.add(totalMismatchWarning);
			}
		}

		if (unmatchedCount > 0) {
			warnings.add(unmatchedCount + " extracted item(s) could not be automatically matched to the 36-vegetable catalog. Map or remove them before saving.");
		}
		if (lines.isEmpty()) {
			warnings.add("No vegetable line items were detected. Please review the input or add items manually.");
		}

		recordAuditLog(
				"PURCHASE_INVOICE",
				actorPhone,
				hasFile ? (mimeType != null && mimeType.contains("pdf") ? "PDF" : "IMAGE") : "TEXT",
				fileName,
				mimeType,
				hasFile ? (long) fileBytes.length : null,
				extractionSource,
				unmatchedCount == 0 && !lines.isEmpty() ? "SUCCESS" : "PARTIAL",
				lines.size(),
				lines.size() - unmatchedCount,
				totalMismatchWarning);

		return new PurchaseInvoiceDraftDto(
				raw.supplierName,
				matchedSupplierId,
				raw.invoiceDate != null ? raw.invoiceDate : LocalDate.now(IST),
				raw.invoiceNumber,
				transport,
				raw.invoiceGrandTotal != null ? raw.invoiceGrandTotal.setScale(2, RoundingMode.HALF_UP) : null,
				calculatedItemsTotal,
				calculatedGrandTotal,
				totalMismatch,
				totalMismatchWarning,
				unmatchedCount,
				extractionSource,
				warnings,
				lines);
	}

	@Transactional
	public QuickSaleDraftDto extractQuickSaleList(
			byte[] fileBytes,
			String fileName,
			String mimeType,
			String rawText,
			String actorPhone) {

		boolean hasFile = fileBytes != null && fileBytes.length > 0;
		boolean hasText = rawText != null && !rawText.isBlank();
		if (!hasFile && !hasText) {
			throw new BadRequestException("Provide a customer list photo or type/paste grocery list items.");
		}

		List<Vegetable> activeCatalog = vegetables.findByActiveTrueOrderByNameEnAsc();
		List<Long> vegIds = activeCatalog.stream().map(Vegetable::getId).toList();

		Map<Long, BigDecimal> priceByVegId = new HashMap<>();
		for (VegetablePrice vp : prices.findAllCurrent()) {
			priceByVegId.put(vp.getVegetable().getId(), vp.getPricePerUnit());
		}

		Map<Long, BigDecimal> stockByVegId = new HashMap<>();
		if (!vegIds.isEmpty()) {
			movements.stockForVegetables(vegIds)
					.forEach(s -> stockByVegId.put(s.getVegetableId(), s.getQty()));
		}

		List<RawQuickSaleLine> rawLines;
		String extractionSource;
		if (hasFile) {
			gemini.validateUpload(mimeType, fileBytes.length);
			String prompt = buildQuickSalePrompt(activeCatalog)
					+ (hasText ? "\nAdditional customer text: " + rawText : "");
			JsonNode json = gemini.generateStructuredJson(prompt, fileBytes, mimeType);
			rawLines = parseQuickSaleJson(json);
			extractionSource = "GEMINI_VISION";
		} else if (gemini.isConfigured()) {
			try {
				String prompt = buildQuickSalePrompt(activeCatalog) + "\nCustomer Grocery List:\n" + rawText;
				JsonNode json = gemini.generateStructuredJson(prompt, null, null);
				rawLines = parseQuickSaleJson(json);
				extractionSource = "GEMINI_TEXT";
			} catch (Exception ex) {
				rawLines = parseQuickSaleTextLocally(rawText);
				extractionSource = "LOCAL_PARSER";
			}
		} else {
			rawLines = parseQuickSaleTextLocally(rawText);
			extractionSource = "LOCAL_PARSER";
		}

		List<QuickSaleDraftLineDto> items = new ArrayList<>();
		List<String> warnings = new ArrayList<>();
		BigDecimal estimatedSubtotal = BigDecimal.ZERO;
		int matchedCount = 0;
		int unmatchedCount = 0;

		for (RawQuickSaleLine rl : rawLines) {
			CatalogMatch match = matchCatalogVegetable(rl.rawItemName, activeCatalog);
			BigDecimal qty = rl.quantity != null && rl.quantity.signum() > 0 ? rl.quantity : BigDecimal.ONE;

			if (match.matched && match.vegetable != null) {
				matchedCount++;
				Vegetable v = match.vegetable;
				if (v.getBaseUnit() == UnitType.KG && isGramUnit(rl.rawUnit)) {
					qty = qty.divide(THOUSAND, 3, RoundingMode.HALF_UP);
				} else if (v.getBaseUnit() == UnitType.BUNCH || v.getBaseUnit() == UnitType.PIECE) {
					qty = qty.setScale(0, RoundingMode.HALF_UP).max(BigDecimal.ONE);
				} else {
					qty = qty.setScale(3, RoundingMode.HALF_UP);
				}

				BigDecimal unitPrice = priceByVegId.get(v.getId());
				BigDecimal estTotal = unitPrice != null
						? qty.multiply(unitPrice).setScale(2, RoundingMode.HALF_UP)
						: null;
				if (estTotal != null) {
					estimatedSubtotal = estimatedSubtotal.add(estTotal);
				}

				BigDecimal availStock = stockByVegId.getOrDefault(v.getId(), BigDecimal.ZERO);
				boolean stockOk = availStock.compareTo(qty) >= 0;
				String lineWarn = null;
				if (unitPrice == null) {
					lineWarn = "No current selling price set for " + v.getNameEn();
				} else if (availStock.signum() <= 0) {
					lineWarn = v.getNameEn() + " is currently out of stock (0 " + v.getBaseUnit() + ")";
				} else if (!stockOk) {
					lineWarn = "Requested " + qty.stripTrailingZeros().toPlainString() + " " + v.getBaseUnit()
							+ " exceeds available stock (" + availStock.stripTrailingZeros().toPlainString() + " "
							+ v.getBaseUnit() + ")";
				}

				items.add(new QuickSaleDraftLineDto(
						rl.rawLineText,
						rl.rawItemName,
						v.getId(),
						v.getNameEn(),
						v.getNameMr(),
						v.getNameHi(),
						v.getBaseUnit(),
						qty,
						rl.rawUnit != null ? rl.rawUnit : v.getBaseUnit().name(),
						unitPrice,
						estTotal,
						availStock,
						stockOk,
						true,
						match.confidence,
						lineWarn));
			} else {
				unmatchedCount++;
				items.add(new QuickSaleDraftLineDto(
						rl.rawLineText,
						rl.rawItemName,
						null,
						null,
						null,
						null,
						null,
						qty.setScale(3, RoundingMode.HALF_UP),
						rl.rawUnit != null ? rl.rawUnit : "KG",
						null,
						null,
						null,
						false,
						false,
						"UNMATCHED",
						"Could not match '" + rl.rawItemName + "' to catalog. Please select a vegetable or remove."));
			}
		}

		if (unmatchedCount > 0) {
			warnings.add(unmatchedCount + " line(s) need manual vegetable selection before adding to Quick Sale.");
		}

		recordAuditLog(
				"QUICK_SALE_LIST",
				actorPhone,
				hasFile ? "IMAGE" : "TEXT",
				fileName,
				mimeType,
				hasFile ? (long) fileBytes.length : null,
				extractionSource,
				unmatchedCount == 0 && !items.isEmpty() ? "SUCCESS" : "PARTIAL",
				items.size(),
				matchedCount,
				unmatchedCount > 0 ? unmatchedCount + " unmatched lines" : null);

		return new QuickSaleDraftDto(
				extractionSource,
				items.size(),
				matchedCount,
				unmatchedCount,
				estimatedSubtotal.setScale(2, RoundingMode.HALF_UP),
				warnings,
				items);
	}

	private void recordAuditLog(
			String workflowType,
			String actorPhone,
			String sourceType,
			String fileName,
			String mimeType,
			Long fileSizeBytes,
			String modelUsed,
			String status,
			int extractedCount,
			int matchedCount,
			String warning) {
		try {
			AiExtractionLog log = new AiExtractionLog();
			log.setWorkflowType(workflowType);
			log.setActorPhone(actorPhone);
			if (actorPhone != null && users != null) {
				users.findByPhone(actorPhone).map(User::getId).ifPresent(log::setActorUserId);
			}
			log.setSourceType(sourceType);
			log.setFileName(fileName);
			log.setMimeType(mimeType);
			log.setFileSizeBytes(fileSizeBytes);
			log.setModelUsed(modelUsed);
			log.setStatus(status);
			log.setExtractedLinesCount(extractedCount);
			log.setMatchedLinesCount(matchedCount);
			log.setWarningMessage(warning != null && warning.length() > 500 ? warning.substring(0, 500) : warning);
			logs.save(log);
		} catch (Exception ignored) {
			// Audit logging should never block the extraction draft
		}
	}

	record CatalogMatch(Vegetable vegetable, boolean matched, String confidence) {
	}

	public CatalogMatch matchCatalogVegetable(String rawName, List<Vegetable> catalog) {
		if (rawName == null || rawName.isBlank() || catalog.isEmpty()) {
			return new CatalogMatch(null, false, "UNMATCHED");
		}
		String cleaned = normalizeText(rawName);
		if (cleaned.isEmpty()) {
			return new CatalogMatch(null, false, "UNMATCHED");
		}

		// 1. Exact match on English, Marathi, or Hindi name
		for (Vegetable v : catalog) {
			if (cleaned.equals(normalizeText(v.getNameEn()))
					|| cleaned.equals(normalizeText(v.getNameMr()))
					|| cleaned.equals(normalizeText(v.getNameHi()))) {
				return new CatalogMatch(v, true, "HIGH");
			}
		}

		// 2. Alias dictionary lookup (exact or token match)
		String canonicalTarget = ALIAS_TO_CANONICAL_EN.get(cleaned);
		if (canonicalTarget == null) {
			for (Map.Entry<String, String> entry : ALIAS_TO_CANONICAL_EN.entrySet()) {
				if (cleaned.contains(entry.getKey()) && entry.getKey().length() >= 3) {
					canonicalTarget = entry.getValue();
					break;
				}
			}
		}
		if (canonicalTarget != null) {
			String normCanonical = normalizeText(canonicalTarget);
			for (Vegetable v : catalog) {
				if (normalizeText(v.getNameEn()).equals(normCanonical)
						|| normalizeText(v.getNameEn()).contains(normCanonical)) {
					return new CatalogMatch(v, true, "HIGH");
				}
			}
		}

		// 3. Substring / prefix match against catalog EN / MR / HI names
		for (Vegetable v : catalog) {
			String en = normalizeText(v.getNameEn());
			String mr = normalizeText(v.getNameMr());
			String hi = normalizeText(v.getNameHi());
			String enBase = en.replaceAll("\\(.*?\\)", "").trim();
			if ((!enBase.isEmpty() && (cleaned.contains(enBase) || enBase.contains(cleaned)))
					|| (!mr.isEmpty() && (cleaned.contains(mr) || mr.contains(cleaned)))
					|| (!hi.isEmpty() && (cleaned.contains(hi) || hi.contains(cleaned)))) {
				return new CatalogMatch(v, true, "MEDIUM");
			}
		}

		return new CatalogMatch(null, false, "UNMATCHED");
	}

	private static String normalizeText(String s) {
		if (s == null) return "";
		String out = convertDevanagariDigits(s.trim().toLowerCase(Locale.ROOT));
		out = out.replaceAll("[.,:;!?'\"\\-_/+]", " ").replaceAll("\\s+", " ").trim();
		return out;
	}

	private static String convertDevanagariDigits(String input) {
		StringBuilder sb = new StringBuilder(input.length());
		for (int i = 0; i < input.length(); i++) {
			char c = input.charAt(i);
			if (c >= '०' && c <= '९') {
				sb.append((char) ('0' + (c - '०')));
			} else {
				sb.append(c);
			}
		}
		return sb.toString();
	}

	private static boolean isGramUnit(String unit) {
		if (unit == null) return false;
		String u = unit.trim().toLowerCase(Locale.ROOT);
		return u.equals("g") || u.equals("gm") || u.equals("gms")
				|| u.equals("gram") || u.equals("grams")
				|| u.equals("ग्रॅम") || u.equals("ग्राम");
	}

	record RawInvoiceExtracted(
			String supplierName,
			LocalDate invoiceDate,
			String invoiceNumber,
			BigDecimal transportCost,
			BigDecimal invoiceGrandTotal,
			List<RawInvoiceLine> items) {
	}

	record RawInvoiceLine(
			String rawName,
			BigDecimal quantity,
			String rawUnit,
			BigDecimal ratePerUnit,
			BigDecimal extractedLineTotal) {
	}

	record RawQuickSaleLine(
			String rawLineText,
			String rawItemName,
			BigDecimal quantity,
			String rawUnit) {
	}

	/**
	 * Deterministic local parser for pasted purchase invoice text.
	 * Supports lines like:
	 *   Supplier: Shri Ganesh Traders
	 *   Date: 2026-11-18
	 *   Transport: 150
	 *   Total: 2650
	 *   Onion | 50 kg | 28 | 1400
	 *   Tomato - 25 kg @ 32 = 800
	 */
	RawInvoiceExtracted parseInvoiceTextLocally(String rawText) {
		String text = convertDevanagariDigits(rawText);
		String[] lines = text.split("\\r?\\n");
		String supplierName = null;
		LocalDate invoiceDate = null;
		String invoiceNumber = null;
		BigDecimal transportCost = BigDecimal.ZERO;
		BigDecimal invoiceGrandTotal = null;
		List<RawInvoiceLine> items = new ArrayList<>();

		Pattern datePattern = Pattern.compile("(\\d{4}-\\d{2}-\\d{2})");
		Pattern linePatternPipe = Pattern.compile(
				"^([^|@=\\-]+?)\\s*[|\\-]\\s*(\\d+(?:\\.\\d+)?)\\s*(kg|g|gm|gram|grams|bunch|bunches|pc|pcs|piece|pieces)?\\s*(?:[|@x×]\\s*(?:rs\\.?|₹)?\\s*(\\d+(?:\\.\\d+)?))?\\s*(?:[|=]\\s*(?:rs\\.?|₹)?\\s*(\\d+(?:\\.\\d+)?))?$",
				Pattern.CASE_INSENSITIVE);

		for (String rawLine : lines) {
			String line = rawLine.trim();
			if (line.isEmpty()) continue;
			String lower = line.toLowerCase(Locale.ROOT);

			if (lower.startsWith("supplier") || lower.startsWith("vendor") || lower.startsWith("from:")) {
				int idx = line.indexOf(':');
				if (idx >= 0 && idx + 1 < line.length()) {
					supplierName = line.substring(idx + 1).trim();
				}
				continue;
			}
			if (lower.startsWith("invoice") || lower.startsWith("bill no") || lower.startsWith("ref")) {
				int idx = line.indexOf(':');
				if (idx >= 0 && idx + 1 < line.length()) {
					invoiceNumber = line.substring(idx + 1).trim();
				}
				continue;
			}
			if (lower.startsWith("date")) {
				Matcher dm = datePattern.matcher(line);
				if (dm.find()) {
					try {
						invoiceDate = LocalDate.parse(dm.group(1));
					} catch (Exception ignored) {
					}
				}
				continue;
			}
			if (lower.startsWith("transport") || lower.startsWith("freight") || lower.startsWith("delivery") || lower.startsWith("hamali")) {
				BigDecimal val = extractLastNumber(line);
				if (val != null) {
					transportCost = transportCost.add(val);
				}
				continue;
			}
			if (lower.startsWith("grand total") || lower.startsWith("total") || lower.startsWith("net total")) {
				BigDecimal val = extractLastNumber(line);
				if (val != null) {
					invoiceGrandTotal = val;
				}
				continue;
			}

			Matcher pm = linePatternPipe.matcher(line);
			if (pm.matches()) {
				String name = pm.group(1).trim();
				BigDecimal qty = parseDecimal(pm.group(2), BigDecimal.ONE);
				String unit = pm.group(3) != null ? pm.group(3).trim() : "KG";
				BigDecimal rate = parseDecimal(pm.group(4), BigDecimal.ZERO);
				BigDecimal lineTotal = parseDecimal(pm.group(5), null);
				if (rate.signum() == 0 && lineTotal != null && qty.signum() > 0) {
					rate = lineTotal.divide(qty, 2, RoundingMode.HALF_UP);
				}
				items.add(new RawInvoiceLine(name, qty, unit, rate, lineTotal));
				continue;
			}

			// Fallback space-separated invoice line: e.g. "Onion 50 kg 28 1400"
			Pattern spacePattern = Pattern.compile(
					"^(.+?)\\s+(\\d+(?:\\.\\d+)?)\\s*(kg|g|gm|gram|grams|bunch|bunches|pc|pcs|piece|pieces)?\\s+(?:@\\s*)?(?:rs\\.?|₹)?(\\d+(?:\\.\\d+)?)(?:\\s+(?:=\\s*)?(?:rs\\.?|₹)?(\\d+(?:\\.\\d+)?))?$",
					Pattern.CASE_INSENSITIVE);
			Matcher sm = spacePattern.matcher(line);
			if (sm.matches()) {
				String name = sm.group(1).trim();
				BigDecimal qty = parseDecimal(sm.group(2), BigDecimal.ONE);
				String unit = sm.group(3) != null ? sm.group(3).trim() : "KG";
				BigDecimal rate = parseDecimal(sm.group(4), BigDecimal.ZERO);
				BigDecimal lineTotal = parseDecimal(sm.group(5), null);
				items.add(new RawInvoiceLine(name, qty, unit, rate, lineTotal));
			}
		}

		return new RawInvoiceExtracted(supplierName, invoiceDate, invoiceNumber, transportCost, invoiceGrandTotal, items);
	}

	/**
	 * Deterministic multilingual grocery list parser for Quick Sale POS.
	 * Handles:
	 *   "2 kg onion"
	 *   "onion 2 kg"
	 *   "500 g tomato"
	 *   "1 bunch kothimbir"
	 *   "२ किलो कांदा"
	 *   "500 ग्रॅम टोमॅटो"
	 */
	List<RawQuickSaleLine> parseQuickSaleTextLocally(String rawText) {
		String normalizedDigits = convertDevanagariDigits(rawText);
		String[] rawLines = normalizedDigits.split("[\\r\\n,;]+");
		List<RawQuickSaleLine> result = new ArrayList<>();

		String unitRegex = "(kg|kilo|किलो|कि\\.?ग्रॅ\\.?|g|gm|gms|gram|grams|ग्रॅम|ग्राम|bunch|bunches|जुडी|गड्डी|pc|pcs|piece|pieces|नग)";
		Pattern qtyFirst = Pattern.compile(
				"^\\s*(?:[-*•]|\\d+\\.)?\\s*(\\d+(?:\\.\\d+)?)\\s*" + unitRegex + "?\\s+(.+?)\\s*$",
				Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE);
		Pattern nameFirst = Pattern.compile(
				"^\\s*(?:[-*•]|\\d+\\.)?\\s*(.+?)\\s*[-:]?\\s*(\\d+(?:\\.\\d+)?)\\s*" + unitRegex + "?\\s*$",
				Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE);

		for (String segment : rawLines) {
			String line = segment.trim();
			if (line.isEmpty()) continue;

			Matcher m1 = qtyFirst.matcher(line);
			if (m1.matches()) {
				BigDecimal qty = parseDecimal(m1.group(1), BigDecimal.ONE);
				String unit = normalizeUnitToken(m1.group(2));
				String name = m1.group(3).trim();
				result.add(new RawQuickSaleLine(line, name, qty, unit));
				continue;
			}

			Matcher m2 = nameFirst.matcher(line);
			if (m2.matches()) {
				String name = m2.group(1).trim();
				BigDecimal qty = parseDecimal(m2.group(2), BigDecimal.ONE);
				String unit = normalizeUnitToken(m2.group(3));
				result.add(new RawQuickSaleLine(line, name, qty, unit));
				continue;
			}

			// Bare item name (defaults to 1 unit)
			result.add(new RawQuickSaleLine(line, line, BigDecimal.ONE, "KG"));
		}

		return result;
	}

	private static String normalizeUnitToken(String rawUnit) {
		if (rawUnit == null || rawUnit.isBlank()) return "KG";
		String u = rawUnit.trim().toLowerCase(Locale.ROOT);
		if (u.equals("g") || u.equals("gm") || u.equals("gms") || u.startsWith("gram")
				|| u.equals("ग्रॅम") || u.equals("ग्राम")) {
			return "G";
		}
		if (u.startsWith("bunch") || u.equals("जुडी") || u.equals("गड्डी")) {
			return "BUNCH";
		}
		if (u.startsWith("pc") || u.startsWith("piece") || u.equals("नग")) {
			return "PIECE";
		}
		return "KG";
	}

	private static BigDecimal extractLastNumber(String line) {
		Matcher m = Pattern.compile("(\\d+(?:\\.\\d+)?)").matcher(line);
		String last = null;
		while (m.find()) {
			last = m.group(1);
		}
		return parseDecimal(last, null);
	}

	private static BigDecimal parseDecimal(String val, BigDecimal fallback) {
		if (val == null || val.isBlank()) return fallback;
		try {
			return new BigDecimal(val.trim());
		} catch (Exception e) {
			return fallback;
		}
	}

	private RawInvoiceExtracted parseInvoiceJson(JsonNode root) {
		String supplierName = textOrNull(root, "supplierName");
		LocalDate invoiceDate = null;
		String dateStr = textOrNull(root, "invoiceDate");
		if (dateStr != null) {
			try {
				invoiceDate = LocalDate.parse(dateStr);
			} catch (Exception ignored) {
			}
		}
		String invoiceNumber = textOrNull(root, "invoiceNumber");
		BigDecimal transportCost = decimalOrNull(root, "transportCost");
		BigDecimal grandTotal = decimalOrNull(root, "invoiceGrandTotal");

		List<RawInvoiceLine> items = new ArrayList<>();
		JsonNode arr = root.path("items");
		if (arr.isArray()) {
			for (JsonNode n : arr) {
				String rawName = textOrNull(n, "rawItemName");
				if (rawName == null) rawName = textOrNull(n, "name");
				if (rawName == null || rawName.isBlank()) continue;
				BigDecimal qty = decimalOrNull(n, "quantity");
				String unit = textOrNull(n, "unit");
				BigDecimal rate = decimalOrNull(n, "ratePerUnit");
				BigDecimal lineTotal = decimalOrNull(n, "lineTotal");
				items.add(new RawInvoiceLine(rawName, qty, unit, rate, lineTotal));
			}
		}
		return new RawInvoiceExtracted(supplierName, invoiceDate, invoiceNumber, transportCost, grandTotal, items);
	}

	private List<RawQuickSaleLine> parseQuickSaleJson(JsonNode root) {
		List<RawQuickSaleLine> list = new ArrayList<>();
		JsonNode arr = root.isArray() ? root : root.path("items");
		if (arr.isArray()) {
			for (JsonNode n : arr) {
				String rawName = textOrNull(n, "rawItemName");
				if (rawName == null) rawName = textOrNull(n, "name");
				if (rawName == null || rawName.isBlank()) continue;
				String rawLine = textOrNull(n, "rawLineText");
				BigDecimal qty = decimalOrNull(n, "quantity");
				String unit = textOrNull(n, "unit");
				list.add(new RawQuickSaleLine(
						rawLine != null ? rawLine : rawName,
						rawName,
						qty != null ? qty : BigDecimal.ONE,
						normalizeUnitToken(unit)));
			}
		}
		return list;
	}

	private static String textOrNull(JsonNode node, String field) {
		JsonNode v = node.path(field);
		if (v.isMissingNode() || v.isNull()) return null;
		String s = v.asText().trim();
		return s.isEmpty() ? null : s;
	}

	private static BigDecimal decimalOrNull(JsonNode node, String field) {
		JsonNode v = node.path(field);
		if (v.isMissingNode() || v.isNull()) return null;
		if (v.isNumber()) return v.decimalValue();
		return parseDecimal(v.asText(), null);
	}

	private String buildPurchaseInvoicePrompt(List<Vegetable> catalog) {
		StringBuilder sb = new StringBuilder();
		sb.append("You are an Indian wholesale vegetable purchase invoice extraction assistant for TazaTokri.\n");
		sb.append("Extract the supplier invoice details into strict JSON with this schema:\n");
		sb.append("{\n");
		sb.append("  \"supplierName\": \"string or null\",\n");
		sb.append("  \"invoiceDate\": \"YYYY-MM-DD or null\",\n");
		sb.append("  \"invoiceNumber\": \"string or null\",\n");
		sb.append("  \"transportCost\": number or 0,\n");
		sb.append("  \"invoiceGrandTotal\": number or null,\n");
		sb.append("  \"items\": [\n");
		sb.append("    { \"rawItemName\": \"string\", \"quantity\": number, \"unit\": \"KG|G|BUNCH|PIECE\", \"ratePerUnit\": number, \"lineTotal\": number or null }\n");
		sb.append("  ]\n");
		sb.append("}\n");
		sb.append("Known catalog vegetables: ");
		for (int i = 0; i < catalog.size(); i++) {
			Vegetable v = catalog.get(i);
			if (i > 0) sb.append(", ");
			sb.append(v.getNameEn()).append(" (").append(v.getBaseUnit()).append(")");
		}
		return sb.toString();
	}

	private String buildQuickSalePrompt(List<Vegetable> catalog) {
		StringBuilder sb = new StringBuilder();
		sb.append("You are an Indian retail vegetable shop assistant for TazaTokri.\n");
		sb.append("Extract every vegetable line from the customer's handwritten or typed grocery list (English, Marathi, or Hindi) into strict JSON:\n");
		sb.append("{\n");
		sb.append("  \"items\": [\n");
		sb.append("    { \"rawLineText\": \"original line\", \"rawItemName\": \"vegetable name\", \"quantity\": number, \"unit\": \"KG|G|BUNCH|PIECE\" }\n");
		sb.append("  ]\n");
		sb.append("}\n");
		sb.append("Known catalog vegetables: ");
		for (int i = 0; i < catalog.size(); i++) {
			Vegetable v = catalog.get(i);
			if (i > 0) sb.append(", ");
			sb.append(v.getNameEn());
		}
		return sb.toString();
	}

	private static Map<String, String> buildAliasMap() {
		Map<String, String> m = new LinkedHashMap<>();
		addAliases(m, "Onion", "onion", "onions", "kanda", "pyaz", "pyaaz", "कांदा", "प्याज");
		addAliases(m, "Potato", "potato", "potatoes", "batata", "aloo", "alu", "बटाटा", "आलू");
		addAliases(m, "Tomato", "tomato", "tomatoes", "tamatar", "tamata", "टोमॅटो", "टमाटर");
		addAliases(m, "Coriander Leaves", "coriander", "coriander leaves", "kothimbir", "dhania", "dhaniya", "कोथिंबीर", "हरा धनिया", "धनिया");
		addAliases(m, "Green Chilli", "green chilli", "chilli", "mirchi", "hari mirch", "हिरवी मिरची", "मिरची", "हरी मिर्च");
		addAliases(m, "Ginger", "ginger", "aale", "ale", "adrak", "आले", "अदरक");
		addAliases(m, "Garlic", "garlic", "lasun", "lehsun", "lahsun", "लसूण", "लहसुन");
		addAliases(m, "Lemon", "lemon", "lime", "limbu", "nimbu", "लिंबू", "नींबू");
		addAliases(m, "Spinach", "spinach", "palak", "पालक");
		addAliases(m, "Fenugreek Leaves (Methi)", "methi", "fenugreek", "fenugreek leaves", "मेथी");
		addAliases(m, "Mint Leaves", "mint", "mint leaves", "pudina", "पुदिना", "पुदीना");
		addAliases(m, "Curry Leaves", "curry leaves", "kadipatta", "kadi patta", "karipatta", "कढीपत्ता", "कड़ी पत्ता");
		addAliases(m, "Spring Onion", "spring onion", "kanda pat", "hara pyaz", "कांदा पात", "हरा प्याज");
		addAliases(m, "Carrot", "carrot", "gajar", "गाजर");
		addAliases(m, "Beetroot", "beetroot", "beet", "बीट", "चुकंदर");
		addAliases(m, "Radish (White)", "radish", "mula", "mooli", "मुळा", "मूली");
		addAliases(m, "Sweet Potato", "sweet potato", "ratala", "shakarkand", "रताळे", "शकरकंद");
		addAliases(m, "Elephant Foot Yam (Suran)", "yam", "suran", "jimikand", "सुरण", "जिमीकंद");
		addAliases(m, "Cucumber", "cucumber", "kakdi", "kheera", "काकडी", "खीरा");
		addAliases(m, "Bottle Gourd", "bottle gourd", "dudhi", "dudhi bhopla", "lauki", "दुधी भोपळा", "दुधी", "लौकी");
		addAliases(m, "Bitter Gourd", "bitter gourd", "karle", "karela", "कारले", "करेला");
		addAliases(m, "Ridge Gourd", "ridge gourd", "dodka", "turai", "दोडका", "तोरई");
		addAliases(m, "Ivy Gourd (Tondli)", "ivy gourd", "tondli", "kundru", "तोंडली", "कुंदरू");
		addAliases(m, "Pumpkin", "pumpkin", "bhopla", "lal bhopla", "kaddu", "लाल भोपळा", "कद्दू");
		addAliases(m, "Capsicum (Green)", "capsicum", "bell pepper", "simla mirch", "shimla mirchi", "ढोबळी मिरची", "शिमला मिर्च");
		addAliases(m, "Cabbage", "cabbage", "kobi", "patta gobi", "कोबी", "पत्ता गोभी");
		addAliases(m, "Cauliflower", "cauliflower", "flower", "phool gobi", "फ्लॉवर", "फूल गोभी");
		addAliases(m, "Brinjal (Eggplant)", "brinjal", "eggplant", "vangi", "baingan", "वांगी", "बैंगन");
		addAliases(m, "Okra (Lady Finger)", "okra", "lady finger", "bhendi", "bhindi", "भेंडी", "भिंडी");
		addAliases(m, "Green Peas", "green peas", "peas", "matar", "watana", "हिरवे वाटाणे", "वाटाणा", "मटर");
		addAliases(m, "French Beans", "french beans", "beans", "farsabi", "फरसबी", "फ्रेंच बीन्स");
		addAliases(m, "Cluster Beans (Gavar)", "cluster beans", "gavar", "guar", "गवार", "ग्वार फली");
		addAliases(m, "Flat Beans", "flat beans", "wal", "papdi", "sem", "वाल पापडी", "पापडी", "सेम फली");
		addAliases(m, "Cowpea Beans", "cowpea", "chavali", "lobia", "चवळी शेंग", "चवळी", "लोबिया फली");
		addAliases(m, "Drumstick", "drumstick", "shevga", "sahjan", "moringa", "शेवगा शेंग", "शेवगा", "सहजन");
		addAliases(m, "Raw Banana", "raw banana", "kaccha kela", "kacchi keli", "कच्ची केळी", "कच्चा केला");
		addAliases(m, "Sweet Corn", "sweet corn", "corn", "makka", "bhutta", "मका कणीस", "मका", "भुट्टा");
		return m;
	}

	private static void addAliases(Map<String, String> map, String canonicalEn, String... aliases) {
		for (String a : aliases) {
			map.put(a.toLowerCase(Locale.ROOT).trim(), canonicalEn);
		}
	}
}
