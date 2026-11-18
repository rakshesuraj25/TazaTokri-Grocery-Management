package com.tazatokri.report;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

public record DailyReport(LocalDate date, BigDecimal totalSales, long totalBills, BigDecimal averageBill,
		List<PaymentLine> byPayment, List<ItemLine> topItems, BigDecimal purchaseSpend, List<QtyLine> wastage,
		List<QtyLine> stock) {

	public record PaymentLine(String method, long bills, BigDecimal total) {
	}

	public record ItemLine(Long vegetableId, String name, BigDecimal quantity, BigDecimal revenue) {
	}

	public record QtyLine(Long vegetableId, String name, BigDecimal quantity) {
	}
}