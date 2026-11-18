package com.tazatokri.report;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import com.tazatokri.catalog.UnitType;

public record BusinessIntelligenceReport(
		LocalDate fromDate,
		LocalDate toDate,
		InventoryValuation inventoryValuation,
		List<StockMovementLine> stockMovements,
		SalesPerformance salesPerformance,
		ProfitabilitySummary profitability,
		List<PurchaseBatchLine> freshnessBatches) {

	public record InventoryValuation(
			BigDecimal totalEstimatedValue,
			int costedVegetablesCount,
			int uncostedVegetablesCount,
			List<ValuationLine> items) {
	}

	public record ValuationLine(
			Long vegetableId,
			String nameEn,
			String nameMr,
			String nameHi,
			UnitType baseUnit,
			BigDecimal currentStock,
			BigDecimal unitLandedCost,
			BigDecimal estimatedValue) {
	}

	public record StockMovementLine(
			Long vegetableId,
			String nameEn,
			String nameMr,
			String nameHi,
			UnitType baseUnit,
			BigDecimal openingStock,
			BigDecimal purchasesQty,
			BigDecimal onlineSalesNetQty,
			BigDecimal quickSalesQty,
			BigDecimal wastageQty,
			BigDecimal adjustmentsQty,
			BigDecimal closingStock) {
	}

	public record SalesPerformance(
			BigDecimal todayRevenue,
			BigDecimal weekRevenue,
			BigDecimal monthRevenue,
			BigDecimal periodTotalRevenue,
			long periodTotalTransactions,
			BigDecimal averageTransactionValue,
			BigDecimal counterSalesRevenue,
			long counterSalesCount,
			BigDecimal onlineOrdersRevenue,
			long onlineOrdersCount,
			List<PaymentMethodLine> paymentBreakdown,
			List<BestSellerLine> bestSellingVegetables) {
	}

	public record PaymentMethodLine(
			String channel,
			String method,
			long transactions,
			BigDecimal amount) {
	}

	public record BestSellerLine(
			Long vegetableId,
			String nameEn,
			UnitType baseUnit,
			BigDecimal totalQtySold,
			BigDecimal totalRevenue) {
	}

	public record ProfitabilitySummary(
			BigDecimal merchandiseRevenue,
			BigDecimal deliveryFeesCollected,
			BigDecimal costedMerchandiseRevenue,
			BigDecimal estimatedCogs,
			BigDecimal estimatedGrossProfit,
			BigDecimal grossMarginPercent,
			BigDecimal wastageCost,
			BigDecimal estimatedNetContribution,
			int uncostedSoldItemsCount,
			boolean isEstimate) {
	}

	public record PurchaseBatchLine(
			Long purchaseItemId,
			Long purchaseId,
			LocalDate purchaseDate,
			long daysSincePurchase,
			String supplierName,
			Long vegetableId,
			String vegetableName,
			UnitType baseUnit,
			BigDecimal receivedQuantity,
			BigDecimal estimatedRemainingQuantity,
			BigDecimal landedCostPerUnit,
			BigDecimal currentSellingPrice) {
	}
}
