package com.tazatokri.report;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.tazatokri.catalog.Vegetable;
import com.tazatokri.catalog.VegetableRepository;
import com.tazatokri.inventory.StockMovementRepository;
import com.tazatokri.purchase.PurchaseRepository;
import com.tazatokri.sales.SaleItemRepository;
import com.tazatokri.sales.SaleRepository;

@Service
public class ReportService {

	private final SaleRepository sales;
	private final SaleItemRepository saleItems;
	private final PurchaseRepository purchases;
	private final StockMovementRepository movements;
	private final VegetableRepository vegetables;

	public ReportService(SaleRepository sales, SaleItemRepository saleItems, PurchaseRepository purchases,
			StockMovementRepository movements, VegetableRepository vegetables) {
		this.sales = sales;
		this.saleItems = saleItems;
		this.purchases = purchases;
		this.movements = movements;
		this.vegetables = vegetables;
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
}