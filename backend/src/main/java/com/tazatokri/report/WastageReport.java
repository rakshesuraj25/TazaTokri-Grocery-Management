package com.tazatokri.report;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

import com.tazatokri.catalog.UnitType;

public record WastageReport(
        LocalDate date,
        LocalDate weekStart,
        PeriodSummary daily,
        PeriodSummary weekly,
        List<EntryLine> entries) {

    public record PeriodSummary(
            int totalEntries,
            BigDecimal totalEstimatedLoss,
            List<ReasonLine> byReason,
            List<VegetableLine> byVegetable) {}

    public record ReasonLine(
            String reason,
            int entries,
            BigDecimal totalQuantity,
            BigDecimal estimatedLoss) {}

    public record VegetableLine(
            Long vegetableId,
            String nameEn,
            String nameMr,
            String nameHi,
            UnitType baseUnit,
            BigDecimal quantity,
            BigDecimal avgPurchaseCostPerUnit,
            BigDecimal estimatedLoss) {}

    public record EntryLine(
            Long id,
            Long vegetableId,
            String vegetableName,
            UnitType baseUnit,
            BigDecimal quantity,
            String reason,
            String note,
            Long createdBy,
            String createdByName,
            LocalDateTime createdAt,
            BigDecimal unitPurchaseCost,
            BigDecimal estimatedLoss) {}
}
