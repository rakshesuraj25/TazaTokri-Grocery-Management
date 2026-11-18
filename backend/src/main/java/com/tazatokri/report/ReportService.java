package com.tazatokri.report;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.EnumMap;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.tazatokri.catalog.UnitType;
import com.tazatokri.catalog.Vegetable;
import com.tazatokri.catalog.VegetableRepository;
import com.tazatokri.inventory.MovementType;
import com.tazatokri.inventory.StockMovement;
import com.tazatokri.inventory.StockMovementRepository;
import com.tazatokri.order.CustomerOrder;
import com.tazatokri.order.CustomerOrderRepository;
import com.tazatokri.order.OrderItem;
import com.tazatokri.order.OrderPaymentMethod;
import com.tazatokri.pricing.VegetablePrice;
import com.tazatokri.pricing.VegetablePriceRepository;
import com.tazatokri.purchase.PurchaseItem;
import com.tazatokri.purchase.PurchaseItemRepository;
import com.tazatokri.purchase.PurchaseRepository;
import com.tazatokri.sales.Sale;
import com.tazatokri.sales.SaleItem;
import com.tazatokri.sales.SaleItemRepository;
import com.tazatokri.sales.SalePaymentMethod;
import com.tazatokri.sales.SaleRepository;
import com.tazatokri.user.User;
import com.tazatokri.user.UserRepository;

@Service
public class ReportService {

	private static final ZoneId IST = ZoneId.of("Asia/Kolkata");
	private static final BigDecimal HUNDRED = BigDecimal.valueOf(100);

	private final SaleRepository sales;
	private final SaleItemRepository saleItems;
	private final PurchaseRepository purchases;
	private final PurchaseItemRepository purchaseItems;
	private final StockMovementRepository movements;
	private final VegetableRepository vegetables;
	private final UserRepository users;
	private final CustomerOrderRepository customerOrders;
	private final VegetablePriceRepository prices;

	public ReportService(SaleRepository sales, SaleItemRepository saleItems, PurchaseRepository purchases,
			StockMovementRepository movements, VegetableRepository vegetables) {
		this(sales, saleItems, purchases, null, movements, vegetables, null, null, null);
	}

	public ReportService(SaleRepository sales, SaleItemRepository saleItems, PurchaseRepository purchases,
			PurchaseItemRepository purchaseItems, StockMovementRepository movements,
			VegetableRepository vegetables, UserRepository users) {
		this(sales, saleItems, purchases, purchaseItems, movements, vegetables, users, null, null);
	}

	@Autowired
	public ReportService(SaleRepository sales, SaleItemRepository saleItems, PurchaseRepository purchases,
			PurchaseItemRepository purchaseItems, StockMovementRepository movements,
			VegetableRepository vegetables, UserRepository users,
			CustomerOrderRepository customerOrders, VegetablePriceRepository prices) {
		this.sales = sales;
		this.saleItems = saleItems;
		this.purchases = purchases;
		this.purchaseItems = purchaseItems;
		this.movements = movements;
		this.vegetables = vegetables;
		this.users = users;
		this.customerOrders = customerOrders;
		this.prices = prices;
	}

	@Transactional(readOnly = true)
	public DailyReport daily(LocalDate date) {
		LocalDate d = (date == null) ? LocalDate.now() : date;
		var from = d.atStartOfDay();
		var to = d.plusDays(1).atStartOfDay();

		List<DailyReport.PaymentLine> byPayment = sales.summarizeByPayment(from, to).stream()
				.map(p -> new DailyReport.PaymentLine(p.getMethod().name(), p.getBills(), p.getTotal())).toList();

		BigDecimal totalSales = byPayment.stream().map(DailyReport.PaymentLine::total).reduce(BigDecimal.ZERO,
				BigDecimal::add);
		long totalBills = byPayment.stream().mapToLong(DailyReport.PaymentLine::bills).sum();
		BigDecimal avg = totalBills == 0 ? BigDecimal.ZERO
				: totalSales.divide(BigDecimal.valueOf(totalBills), 2, RoundingMode.HALF_UP);

		List<DailyReport.ItemLine> top = saleItems.topItems(from, to).stream().limit(10)
				.map(i -> new DailyReport.ItemLine(i.getVegetableId(), i.getName(), i.getQty(), i.getRevenue()))
				.toList();

		List<DailyReport.QtyLine> wastage = movements.wastageBetween(from, to).stream()
				.map(w -> new DailyReport.QtyLine(w.getVegetableId(), w.getName(), w.getQty().negate())).toList();

		List<Vegetable> activeVegetables = vegetables.findByActiveTrueOrderByNameEnAsc();
		Map<Long, BigDecimal> stockById = new HashMap<>();
		if (!activeVegetables.isEmpty()) {
			movements.stockForVegetables(activeVegetables.stream().map(Vegetable::getId).toList())
					.forEach(s -> stockById.put(s.getVegetableId(), s.getQty()));
		}
		List<DailyReport.QtyLine> stock = activeVegetables.stream()
				.map(v -> new DailyReport.QtyLine(v.getId(), v.getNameEn(),
						stockById.getOrDefault(v.getId(), BigDecimal.ZERO)))
				.toList();

		return new DailyReport(d, totalSales, totalBills, avg, byPayment, top, purchases.totalSpendOn(d), wastage,
				stock);
	}

	@Transactional(readOnly = true)
	public BusinessIntelligenceReport intelligence(LocalDate from, LocalDate to) {
		LocalDate todayIst = LocalDate.now(IST);
		LocalDate resolvedTo = (to == null) ? todayIst : to;
		LocalDate resolvedFrom = (from == null) ? resolvedTo.minusDays(6) : from;
		if (resolvedFrom.isAfter(resolvedTo)) {
			LocalDate tmp = resolvedFrom;
			resolvedFrom = resolvedTo;
			resolvedTo = tmp;
		}

		LocalDateTime periodStart = resolvedFrom.atStartOfDay();
		LocalDateTime periodEnd = resolvedTo.plusDays(1).atStartOfDay();

		List<Vegetable> activeVegetables = vegetables.findByActiveTrueOrderByNameEnAsc();
		List<Long> vegIds = activeVegetables.stream().map(Vegetable::getId).toList();

		Map<Long, BigDecimal> stockById = new HashMap<>();
		if (!vegIds.isEmpty()) {
			movements.stockForVegetables(vegIds)
					.forEach(s -> stockById.put(s.getVegetableId(), s.getQty()));
		}

		Map<Long, BigDecimal> avgCostByVegId = new HashMap<>();
		if (purchaseItems != null && !vegIds.isEmpty()) {
			for (PurchaseItemRepository.VegetableCostSummary cs : purchaseItems.summarizeForVegetables(vegIds)) {
				if (cs.getTotalCost() != null && cs.getTotalQty() != null && cs.getTotalQty().signum() > 0) {
					BigDecimal unitCost = cs.getTotalCost().divide(cs.getTotalQty(), 4, RoundingMode.HALF_UP);
					avgCostByVegId.put(cs.getVegetableId(), unitCost);
				}
			}
		}

		// 1. Inventory Valuation
		BigDecimal totalEstimatedValue = BigDecimal.ZERO;
		int costedCount = 0;
		int uncostedCount = 0;
		List<BusinessIntelligenceReport.ValuationLine> valuationItems = new ArrayList<>();

		for (Vegetable v : activeVegetables) {
			BigDecimal currentStock = stockById.getOrDefault(v.getId(), BigDecimal.ZERO);
			BigDecimal rawCost = avgCostByVegId.get(v.getId());
			BigDecimal unitCost = null;
			BigDecimal estVal = null;
			if (rawCost != null) {
				unitCost = rawCost.setScale(2, RoundingMode.HALF_UP);
				estVal = currentStock.max(BigDecimal.ZERO).multiply(rawCost).setScale(2, RoundingMode.HALF_UP);
				totalEstimatedValue = totalEstimatedValue.add(estVal);
				costedCount++;
			} else {
				uncostedCount++;
			}
			valuationItems.add(new BusinessIntelligenceReport.ValuationLine(
					v.getId(),
					v.getNameEn(),
					v.getNameMr(),
					v.getNameHi(),
					v.getBaseUnit(),
					currentStock,
					unitCost,
					estVal));
		}

		BusinessIntelligenceReport.InventoryValuation inventoryValuation =
				new BusinessIntelligenceReport.InventoryValuation(
						totalEstimatedValue.setScale(2, RoundingMode.HALF_UP),
						costedCount,
						uncostedCount,
						valuationItems);

		// 2. Stock Movements for [periodStart, periodEnd)
		Map<Long, BigDecimal> openingById = new HashMap<>();
		Map<Long, Map<MovementType, BigDecimal>> periodByVegAndType = new HashMap<>();
		if (!vegIds.isEmpty()) {
			movements.stockForVegetablesBefore(vegIds, periodStart)
					.forEach(s -> openingById.put(s.getVegetableId(), s.getQty()));
			for (StockMovementRepository.VegetableTypeQty row : movements.movementsForVegetablesBetween(vegIds, periodStart, periodEnd)) {
				periodByVegAndType
						.computeIfAbsent(row.getVegetableId(), k -> new EnumMap<>(MovementType.class))
						.put(row.getType(), row.getQty() != null ? row.getQty() : BigDecimal.ZERO);
			}
		}

		List<BusinessIntelligenceReport.StockMovementLine> movementLines = new ArrayList<>();
		BigDecimal periodWastageCost = BigDecimal.ZERO;

		for (Vegetable v : activeVegetables) {
			BigDecimal opening = openingById.getOrDefault(v.getId(), BigDecimal.ZERO);
			Map<MovementType, BigDecimal> byType = periodByVegAndType.getOrDefault(v.getId(), Map.of());

			BigDecimal purchaseSigned = byType.getOrDefault(MovementType.PURCHASE, BigDecimal.ZERO);
			BigDecimal onlineSaleSigned = byType.getOrDefault(MovementType.ONLINE_SALE, BigDecimal.ZERO);
			BigDecimal onlineReturnSigned = byType.getOrDefault(MovementType.ONLINE_CANCEL_RETURN, BigDecimal.ZERO);
			BigDecimal shopSaleSigned = byType.getOrDefault(MovementType.SHOP_SALE, BigDecimal.ZERO);
			BigDecimal wastageSigned = byType.getOrDefault(MovementType.WASTAGE, BigDecimal.ZERO);
			BigDecimal adjustmentSigned = byType.getOrDefault(MovementType.ADJUSTMENT, BigDecimal.ZERO);

			BigDecimal purchasesQty = purchaseSigned.max(BigDecimal.ZERO);
			BigDecimal onlineNetSigned = onlineSaleSigned.add(onlineReturnSigned);
			BigDecimal onlineSalesNetQty = onlineNetSigned.negate().max(BigDecimal.ZERO);
			BigDecimal quickSalesQty = shopSaleSigned.negate().max(BigDecimal.ZERO);
			BigDecimal wastageQty = wastageSigned.negate().max(BigDecimal.ZERO);

			BigDecimal closing = opening
					.add(purchaseSigned)
					.add(onlineNetSigned)
					.add(shopSaleSigned)
					.add(wastageSigned)
					.add(adjustmentSigned);

			BigDecimal rawCost = avgCostByVegId.get(v.getId());
			if (rawCost != null && wastageQty.signum() > 0) {
				periodWastageCost = periodWastageCost.add(wastageQty.multiply(rawCost));
			}

			movementLines.add(new BusinessIntelligenceReport.StockMovementLine(
					v.getId(),
					v.getNameEn(),
					v.getNameMr(),
					v.getNameHi(),
					v.getBaseUnit(),
					opening,
					purchasesQty,
					onlineSalesNetQty,
					quickSalesQty,
					wastageQty,
					adjustmentSigned,
					closing));
		}

		// 3. Sales Performance & Profitability
		List<Sale> periodSales = sales.findByCreatedAtGreaterThanEqualAndCreatedAtLessThanOrderByIdDesc(periodStart, periodEnd);
		List<CustomerOrder> periodOrders = customerOrders != null
				? customerOrders.findValidOrdersBetween(periodStart, periodEnd)
				: List.of();

		BigDecimal counterRevenue = BigDecimal.ZERO;
		long counterCashCount = 0;
		BigDecimal counterCashAmt = BigDecimal.ZERO;
		long counterUpiCount = 0;
		BigDecimal counterUpiAmt = BigDecimal.ZERO;

		BigDecimal costedMerchRevenue = BigDecimal.ZERO;
		BigDecimal estimatedCogs = BigDecimal.ZERO;
		Set<Long> uncostedSoldVegIds = new HashSet<>();

		class VegSalesAgg {
			final Long id;
			final String nameEn;
			final UnitType unit;
			BigDecimal qty = BigDecimal.ZERO;
			BigDecimal revenue = BigDecimal.ZERO;

			VegSalesAgg(Long id, String nameEn, UnitType unit) {
				this.id = id;
				this.nameEn = nameEn;
				this.unit = unit;
			}
		}
		Map<Long, VegSalesAgg> bestSellersMap = new HashMap<>();

		for (Sale s : periodSales) {
			BigDecimal saleAmt = s.getTotalAmount() != null ? s.getTotalAmount() : BigDecimal.ZERO;
			counterRevenue = counterRevenue.add(saleAmt);
			if (s.getPaymentMethod() == SalePaymentMethod.CASH) {
				counterCashCount++;
				counterCashAmt = counterCashAmt.add(saleAmt);
			} else if (s.getPaymentMethod() == SalePaymentMethod.UPI) {
				counterUpiCount++;
				counterUpiAmt = counterUpiAmt.add(saleAmt);
			}

			for (SaleItem item : s.getItems()) {
				Vegetable v = item.getVegetable();
				BigDecimal qty = item.getQuantity() != null ? item.getQuantity() : BigDecimal.ZERO;
				BigDecimal lineTotal = item.getLineTotal() != null ? item.getLineTotal() : BigDecimal.ZERO;

				VegSalesAgg agg = bestSellersMap.computeIfAbsent(
						v.getId(), id -> new VegSalesAgg(v.getId(), v.getNameEn(), v.getBaseUnit()));
				agg.qty = agg.qty.add(qty);
				agg.revenue = agg.revenue.add(lineTotal);

				BigDecimal unitCost = avgCostByVegId.get(v.getId());
				if (unitCost != null) {
					costedMerchRevenue = costedMerchRevenue.add(lineTotal);
					estimatedCogs = estimatedCogs.add(qty.multiply(unitCost));
				} else {
					uncostedSoldVegIds.add(v.getId());
				}
			}
		}

		BigDecimal onlineRevenue = BigDecimal.ZERO;
		BigDecimal onlineMerchRevenue = BigDecimal.ZERO;
		BigDecimal deliveryFeesCollected = BigDecimal.ZERO;
		long onlineCodCount = 0;
		BigDecimal onlineCodAmt = BigDecimal.ZERO;
		long onlineUpiCount = 0;
		BigDecimal onlineUpiAmt = BigDecimal.ZERO;

		for (CustomerOrder o : periodOrders) {
			BigDecimal orderTotal = o.getFinalTotal() != null ? o.getFinalTotal() : o.getEstimatedTotal();
			if (orderTotal == null) {
				orderTotal = BigDecimal.ZERO;
			}
			BigDecimal delFee = o.getDeliveryFee() != null ? o.getDeliveryFee() : BigDecimal.ZERO;
			onlineRevenue = onlineRevenue.add(orderTotal);
			deliveryFeesCollected = deliveryFeesCollected.add(delFee);

			if (o.getPaymentMethod() == OrderPaymentMethod.COD) {
				onlineCodCount++;
				onlineCodAmt = onlineCodAmt.add(orderTotal);
			} else if (o.getPaymentMethod() == OrderPaymentMethod.ONLINE) {
				onlineUpiCount++;
				onlineUpiAmt = onlineUpiAmt.add(orderTotal);
			}

			for (OrderItem item : o.getItems()) {
				Vegetable v = item.getVegetable();
				BigDecimal qty = item.getActualQuantity() != null ? item.getActualQuantity() : item.getQuantity();
				BigDecimal lineTotal = item.getFinalLineTotal() != null
						? item.getFinalLineTotal()
						: item.getEstimatedLineTotal();
				if (qty == null) qty = BigDecimal.ZERO;
				if (lineTotal == null) lineTotal = BigDecimal.ZERO;

				onlineMerchRevenue = onlineMerchRevenue.add(lineTotal);

				VegSalesAgg agg = bestSellersMap.computeIfAbsent(
						v.getId(), id -> new VegSalesAgg(v.getId(), v.getNameEn(), v.getBaseUnit()));
				agg.qty = agg.qty.add(qty);
				agg.revenue = agg.revenue.add(lineTotal);

				BigDecimal unitCost = avgCostByVegId.get(v.getId());
				if (unitCost != null) {
					costedMerchRevenue = costedMerchRevenue.add(lineTotal);
					estimatedCogs = estimatedCogs.add(qty.multiply(unitCost));
				} else {
					uncostedSoldVegIds.add(v.getId());
				}
			}
		}

		long counterCount = periodSales.size();
		long onlineCount = periodOrders.size();
		BigDecimal periodTotalRevenue = counterRevenue.add(onlineRevenue).setScale(2, RoundingMode.HALF_UP);
		long periodTotalTransactions = counterCount + onlineCount;
		BigDecimal averageTransactionValue = periodTotalTransactions == 0
				? BigDecimal.ZERO
				: periodTotalRevenue.divide(BigDecimal.valueOf(periodTotalTransactions), 2, RoundingMode.HALF_UP);

		List<BusinessIntelligenceReport.PaymentMethodLine> paymentBreakdown = List.of(
				new BusinessIntelligenceReport.PaymentMethodLine("COUNTER", "CASH", counterCashCount, counterCashAmt.setScale(2, RoundingMode.HALF_UP)),
				new BusinessIntelligenceReport.PaymentMethodLine("COUNTER", "UPI", counterUpiCount, counterUpiAmt.setScale(2, RoundingMode.HALF_UP)),
				new BusinessIntelligenceReport.PaymentMethodLine("ONLINE", "COD", onlineCodCount, onlineCodAmt.setScale(2, RoundingMode.HALF_UP)),
				new BusinessIntelligenceReport.PaymentMethodLine("ONLINE", "ONLINE", onlineUpiCount, onlineUpiAmt.setScale(2, RoundingMode.HALF_UP)));

		List<BusinessIntelligenceReport.BestSellerLine> bestSellers = bestSellersMap.values().stream()
				.sorted(Comparator.comparing((VegSalesAgg a) -> a.revenue).reversed())
				.limit(10)
				.map(a -> new BusinessIntelligenceReport.BestSellerLine(
						a.id,
						a.nameEn,
						a.unit,
						a.qty,
						a.revenue.setScale(2, RoundingMode.HALF_UP)))
				.toList();

		BigDecimal todayRevenue = computeCombinedRevenue(todayIst.atStartOfDay(), todayIst.plusDays(1).atStartOfDay());
		BigDecimal weekRevenue = computeCombinedRevenue(todayIst.minusDays(6).atStartOfDay(), todayIst.plusDays(1).atStartOfDay());
		BigDecimal monthRevenue = computeCombinedRevenue(todayIst.minusDays(29).atStartOfDay(), todayIst.plusDays(1).atStartOfDay());

		BusinessIntelligenceReport.SalesPerformance salesPerformance =
				new BusinessIntelligenceReport.SalesPerformance(
						todayRevenue,
						weekRevenue,
						monthRevenue,
						periodTotalRevenue,
						periodTotalTransactions,
						averageTransactionValue,
						counterRevenue.setScale(2, RoundingMode.HALF_UP),
						counterCount,
						onlineRevenue.setScale(2, RoundingMode.HALF_UP),
						onlineCount,
						paymentBreakdown,
						bestSellers);

		BigDecimal merchandiseRevenue = counterRevenue.add(onlineMerchRevenue).setScale(2, RoundingMode.HALF_UP);
		BigDecimal scaledCostedRevenue = costedMerchRevenue.setScale(2, RoundingMode.HALF_UP);
		BigDecimal scaledCogs = estimatedCogs.setScale(2, RoundingMode.HALF_UP);
		BigDecimal estimatedGrossProfit = scaledCostedRevenue.subtract(scaledCogs).setScale(2, RoundingMode.HALF_UP);
		BigDecimal grossMarginPercent = scaledCostedRevenue.signum() > 0
				? estimatedGrossProfit.multiply(HUNDRED).divide(scaledCostedRevenue, 2, RoundingMode.HALF_UP)
				: BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
		BigDecimal scaledWastageCost = periodWastageCost.setScale(2, RoundingMode.HALF_UP);
		BigDecimal estimatedNetContribution = estimatedGrossProfit.subtract(scaledWastageCost).setScale(2, RoundingMode.HALF_UP);

		BusinessIntelligenceReport.ProfitabilitySummary profitability =
				new BusinessIntelligenceReport.ProfitabilitySummary(
						merchandiseRevenue,
						deliveryFeesCollected.setScale(2, RoundingMode.HALF_UP),
						scaledCostedRevenue,
						scaledCogs,
						estimatedGrossProfit,
						grossMarginPercent,
						scaledWastageCost,
						estimatedNetContribution,
						uncostedSoldVegIds.size(),
						true);

		// 4. Freshness / Purchase Batches (FIFO allocation of currentStock across recent batches)
		Map<Long, BigDecimal> priceByVegId = new HashMap<>();
		if (prices != null) {
			for (VegetablePrice vp : prices.findAllCurrent()) {
				priceByVegId.put(vp.getVegetable().getId(), vp.getPricePerUnit());
			}
		}

		List<BusinessIntelligenceReport.PurchaseBatchLine> freshnessBatches = new ArrayList<>();
		if (purchaseItems != null) {
			Map<Long, BigDecimal> remainingStockPool = new HashMap<>();
			for (Vegetable v : activeVegetables) {
				remainingStockPool.put(v.getId(), stockById.getOrDefault(v.getId(), BigDecimal.ZERO).max(BigDecimal.ZERO));
			}

			for (PurchaseItem pi : purchaseItems.findAllActiveBatchesDesc()) {
				Long vId = pi.getVegetable().getId();
				BigDecimal pool = remainingStockPool.getOrDefault(vId, BigDecimal.ZERO);
				BigDecimal received = pi.getQuantity() != null ? pi.getQuantity() : BigDecimal.ZERO;
				BigDecimal estRemaining = pool.min(received).max(BigDecimal.ZERO);
				remainingStockPool.put(vId, pool.subtract(estRemaining).max(BigDecimal.ZERO));

				LocalDate pDate = pi.getPurchase().getPurchaseDate();
				long daysSince = Math.max(0L, ChronoUnit.DAYS.between(pDate, todayIst));
				String supplierName = pi.getPurchase().getSupplier() != null
						? pi.getPurchase().getSupplier().getName()
						: "Direct Purchase";

				freshnessBatches.add(new BusinessIntelligenceReport.PurchaseBatchLine(
						pi.getId(),
						pi.getPurchase().getId(),
						pDate,
						daysSince,
						supplierName,
						vId,
						pi.getVegetable().getNameEn(),
						pi.getVegetable().getBaseUnit(),
						received,
						estRemaining,
						pi.getLandedCostPerUnit().setScale(2, RoundingMode.HALF_UP),
						priceByVegId.get(vId)));
				if (freshnessBatches.size() >= 60) {
					break;
				}
			}
		}

		return new BusinessIntelligenceReport(
				resolvedFrom,
				resolvedTo,
				inventoryValuation,
				movementLines,
				salesPerformance,
				profitability,
				freshnessBatches);
	}

	private BigDecimal computeCombinedRevenue(LocalDateTime from, LocalDateTime to) {
		BigDecimal total = sales.summarizeByPayment(from, to).stream()
				.map(SaleRepository.PaymentSummary::getTotal)
				.filter(v -> v != null)
				.reduce(BigDecimal.ZERO, BigDecimal::add);
		if (customerOrders != null) {
			for (CustomerOrder o : customerOrders.findValidOrdersBetween(from, to)) {
				BigDecimal orderAmt = o.getFinalTotal() != null ? o.getFinalTotal() : o.getEstimatedTotal();
				if (orderAmt != null) {
					total = total.add(orderAmt);
				}
			}
		}
		return total.setScale(2, RoundingMode.HALF_UP);
	}

	@Transactional(readOnly = true)
	public WastageReport wastage(LocalDate date) {
		LocalDate targetDate = (date == null) ? LocalDate.now() : date;
		LocalDate weekStart = targetDate.minusDays(6);

		var weekFrom = weekStart.atStartOfDay();
		var weekTo = targetDate.plusDays(1).atStartOfDay();
		var dayFrom = targetDate.atStartOfDay();
		var dayTo = targetDate.plusDays(1).atStartOfDay();

		List<StockMovement> weekMovements = movements.findWastageMovementsBetween(weekFrom, weekTo);
		List<StockMovement> dayMovements = weekMovements.stream()
				.filter(m -> !m.getCreatedAt().isBefore(dayFrom) && m.getCreatedAt().isBefore(dayTo))
				.toList();

		Set<Long> vegIds = weekMovements.stream()
				.map(m -> m.getVegetable().getId())
				.collect(Collectors.toSet());

		Map<Long, BigDecimal> avgCostByVegId = new HashMap<>();
		if (purchaseItems != null && !vegIds.isEmpty()) {
			for (PurchaseItemRepository.VegetableCostSummary cs : purchaseItems.summarizeForVegetables(vegIds)) {
				if (cs.getTotalCost() != null && cs.getTotalQty() != null && cs.getTotalQty().signum() > 0) {
					BigDecimal unitCost = cs.getTotalCost().divide(cs.getTotalQty(), 4, RoundingMode.HALF_UP);
					avgCostByVegId.put(cs.getVegetableId(), unitCost);
				}
			}
		}

		Map<Long, String> userNameById = new HashMap<>();
		if (users != null && !weekMovements.isEmpty()) {
			Set<Long> userIds = weekMovements.stream()
					.map(StockMovement::getCreatedBy)
					.filter(id -> id != null)
					.collect(Collectors.toSet());
			if (!userIds.isEmpty()) {
				for (User u : users.findAllById(userIds)) {
					userNameById.put(u.getId(), u.getFullName());
				}
			}
		}

		WastageReport.PeriodSummary dailySummary = buildPeriodSummary(dayMovements, avgCostByVegId);
		WastageReport.PeriodSummary weeklySummary = buildPeriodSummary(weekMovements, avgCostByVegId);

		List<WastageReport.EntryLine> entries = weekMovements.stream().map(m -> {
			Vegetable v = m.getVegetable();
			BigDecimal qty = m.getQuantity().abs();
			String reason = extractReason(m.getNote());
			BigDecimal unitCost = avgCostByVegId.get(v.getId());
			BigDecimal estLoss = unitCost != null
					? qty.multiply(unitCost).setScale(2, RoundingMode.HALF_UP)
					: null;
			String staffName = userNameById.getOrDefault(m.getCreatedBy(), "Staff #" + m.getCreatedBy());
			return new WastageReport.EntryLine(
					m.getId(),
					v.getId(),
					v.getNameEn(),
					v.getBaseUnit(),
					qty,
					reason,
					m.getNote(),
					m.getCreatedBy(),
					staffName,
					m.getCreatedAt(),
					unitCost != null ? unitCost.setScale(2, RoundingMode.HALF_UP) : null,
					estLoss);
		}).toList();

		return new WastageReport(targetDate, weekStart, dailySummary, weeklySummary, entries);
	}

	private WastageReport.PeriodSummary buildPeriodSummary(
			List<StockMovement> list,
			Map<Long, BigDecimal> avgCostByVegId) {

		BigDecimal totalLoss = BigDecimal.ZERO;

		Map<String, int[]> reasonCount = new LinkedHashMap<>();
		Map<String, BigDecimal> reasonQty = new LinkedHashMap<>();
		Map<String, BigDecimal> reasonLoss = new LinkedHashMap<>();

		Map<Long, Vegetable> vegMap = new LinkedHashMap<>();
		Map<Long, BigDecimal> vegQty = new LinkedHashMap<>();

		for (StockMovement m : list) {
			Vegetable v = m.getVegetable();
			BigDecimal qty = m.getQuantity().abs();
			String reason = extractReason(m.getNote());
			BigDecimal unitCost = avgCostByVegId.get(v.getId());
			BigDecimal loss = unitCost != null
					? qty.multiply(unitCost).setScale(2, RoundingMode.HALF_UP)
					: BigDecimal.ZERO;

			totalLoss = totalLoss.add(loss);

			reasonCount.computeIfAbsent(reason, k -> new int[] { 0 })[0] += 1;
			reasonQty.merge(reason, qty, BigDecimal::add);
			reasonLoss.merge(reason, loss, BigDecimal::add);

			vegMap.putIfAbsent(v.getId(), v);
			vegQty.merge(v.getId(), qty, BigDecimal::add);
		}

		List<WastageReport.ReasonLine> byReason = new ArrayList<>();
		for (Map.Entry<String, int[]> e : reasonCount.entrySet()) {
			String r = e.getKey();
			byReason.add(new WastageReport.ReasonLine(
					r,
					e.getValue()[0],
					reasonQty.getOrDefault(r, BigDecimal.ZERO),
					reasonLoss.getOrDefault(r, BigDecimal.ZERO)));
		}

		List<WastageReport.VegetableLine> byVeg = vegMap.values().stream()
				.sorted(Comparator.comparing(Vegetable::getNameEn))
				.map(v -> {
					BigDecimal q = vegQty.getOrDefault(v.getId(), BigDecimal.ZERO);
					BigDecimal unitCost = avgCostByVegId.get(v.getId());
					BigDecimal estLoss = unitCost != null
							? q.multiply(unitCost).setScale(2, RoundingMode.HALF_UP)
							: null;
					return new WastageReport.VegetableLine(
							v.getId(),
							v.getNameEn(),
							v.getNameMr(),
							v.getNameHi(),
							v.getBaseUnit(),
							q,
							unitCost != null ? unitCost.setScale(2, RoundingMode.HALF_UP) : null,
							estLoss);
				})
				.toList();

		return new WastageReport.PeriodSummary(
				list.size(),
				totalLoss.setScale(2, RoundingMode.HALF_UP),
				byReason,
				byVeg);
	}

	public static String extractReason(String note) {
		if (note == null || note.isBlank()) {
			return "Spoiled";
		}
		String lower = note.trim().toLowerCase(Locale.ROOT);
		if (lower.startsWith("spoiled") || lower.contains("spoil") || lower.contains("rot")) {
			return "Spoiled";
		}
		if (lower.startsWith("damaged") || lower.contains("damage") || lower.contains("bruise") || lower.contains("crushed")) {
			return "Damaged";
		}
		if (lower.startsWith("expired") || lower.contains("expir") || lower.contains("old") || lower.contains("wilt")) {
			return "Expired";
		}
		if (lower.startsWith("trimmed") || lower.contains("trim")) {
			return "Trimmed";
		}
		if (lower.startsWith("returned") || lower.contains("return")) {
			return "Returned";
		}
		return "Other";
	}
}
