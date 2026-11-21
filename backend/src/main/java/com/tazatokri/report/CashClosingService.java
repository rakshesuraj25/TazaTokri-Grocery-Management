package com.tazatokri.report;

import java.io.IOException;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Properties;
import java.util.concurrent.ConcurrentHashMap;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.tazatokri.common.BadRequestException;
import com.tazatokri.common.DuplicateResourceException;
import com.tazatokri.payment.PaymentMethod;
import com.tazatokri.payment.PaymentRepository;
import com.tazatokri.purchase.PurchaseRepository;
import com.tazatokri.sales.SalePaymentMethod;
import com.tazatokri.sales.SaleRepository;

@Service
public class CashClosingService {

    private static final Logger log = LoggerFactory.getLogger(CashClosingService.class);
    public static final ZoneId IST = ZoneId.of("Asia/Kolkata");

    public record DailyCashTallyResponse(
            LocalDate date,
            String status,
            BigDecimal openingCash,
            BigDecimal suggestedOpeningCash,
            BigDecimal shopCashSales,
            long shopCashBills,
            BigDecimal posUpiSales,
            long posUpiBills,
            BigDecimal codCashCollected,
            long codCashBills,
            BigDecimal codCashSettledToShop,
            BigDecimal codCashPendingSettlement,
            BigDecimal deliveryUpiCollections,
            BigDecimal razorpayCollections,
            BigDecimal cashRefunds,
            BigDecimal digitalRefunds,
            BigDecimal purchaseSpend,
            BigDecimal cashExpenses,
            String expenseNote,
            BigDecimal expectedCash,
            BigDecimal actualCashCounted,
            BigDecimal difference,
            String note,
            String closedBy,
            LocalDateTime closedAt,
            boolean hasTransactions) {}

    public record CloseDayRequest(
            LocalDate date,
            BigDecimal openingCash,
            BigDecimal cashExpenses,
            String expenseNote,
            BigDecimal actualCashCounted,
            String note) {}

    public record ClosedRecord(
            LocalDate date,
            BigDecimal openingCash,
            BigDecimal shopCashSales,
            BigDecimal codCashSettledToShop,
            BigDecimal cashExpenses,
            String expenseNote,
            BigDecimal cashRefunds,
            BigDecimal expectedCash,
            BigDecimal actualCashCounted,
            BigDecimal difference,
            String note,
            String closedBy,
            LocalDateTime closedAt) {}

    private final SaleRepository sales;
    private final PaymentRepository payments;
    private final PurchaseRepository purchases;
    private final Clock clock;
    private final Path storagePath;
    private final Map<LocalDate, ClosedRecord> closedByDate = new ConcurrentHashMap<>();

    public CashClosingService(
            SaleRepository sales,
            PaymentRepository payments,
            PurchaseRepository purchases,
            Clock clock) {
        this(sales, payments, purchases, clock, "");
    }

    @Autowired
    public CashClosingService(
            SaleRepository sales,
            PaymentRepository payments,
            PurchaseRepository purchases,
            Clock clock,
            @Value("${app.cash-closing.file:}") String storageFile) {
        this.sales = sales;
        this.payments = payments;
        this.purchases = purchases;
        this.clock = clock != null ? clock : Clock.system(IST);
        this.storagePath = (storageFile != null && !storageFile.isBlank())
                ? Paths.get(storageFile).toAbsolutePath().normalize()
                : null;
        loadPersisted();
    }

    @Transactional(readOnly = true)
    public DailyCashTallyResponse getTally(LocalDate date) {
        LocalDate d = date != null ? date : LocalDate.now(clock.withZone(IST));
        LiveTotals live = queryLiveTotals(d);

        ClosedRecord prev = closedByDate.get(d.minusDays(1));
        BigDecimal suggestedOpening = prev != null ? prev.actualCashCounted() : zero();

        ClosedRecord closed = closedByDate.get(d);
        if (closed != null) {
            return new DailyCashTallyResponse(
                    d,
                    "CLOSED",
                    closed.openingCash(),
                    suggestedOpening,
                    live.shopCashSales(),
                    live.shopCashBills(),
                    live.posUpiSales(),
                    live.posUpiBills(),
                    live.codCashCollected(),
                    live.codCashBills(),
                    live.codCashSettledToShop(),
                    live.codCashPendingSettlement(),
                    live.deliveryUpiCollections(),
                    live.razorpayCollections(),
                    live.cashRefunds(),
                    live.digitalRefunds(),
                    live.purchaseSpend(),
                    closed.cashExpenses(),
                    closed.expenseNote(),
                    closed.expectedCash(),
                    closed.actualCashCounted(),
                    closed.difference(),
                    closed.note(),
                    closed.closedBy(),
                    closed.closedAt(),
                    live.hasTransactions());
        }

        BigDecimal expected = computeExpectedCash(
                suggestedOpening,
                live.shopCashSales(),
                live.codCashSettledToShop(),
                zero(),
                live.cashRefunds());

        return new DailyCashTallyResponse(
                d,
                "OPEN",
                suggestedOpening,
                suggestedOpening,
                live.shopCashSales(),
                live.shopCashBills(),
                live.posUpiSales(),
                live.posUpiBills(),
                live.codCashCollected(),
                live.codCashBills(),
                live.codCashSettledToShop(),
                live.codCashPendingSettlement(),
                live.deliveryUpiCollections(),
                live.razorpayCollections(),
                live.cashRefunds(),
                live.digitalRefunds(),
                live.purchaseSpend(),
                zero(),
                null,
                expected,
                null,
                null,
                null,
                null,
                null,
                live.hasTransactions());
    }

    @Transactional(readOnly = true)
    public List<ClosedRecord> history() {
        return closedByDate.values().stream()
                .sorted(Comparator.comparing(ClosedRecord::date).reversed())
                .toList();
    }

    @Transactional(readOnly = true)
    public synchronized DailyCashTallyResponse closeDay(CloseDayRequest req, String ownerPhone) {
        if (req == null) {
            throw new BadRequestException("Closing payload is required");
        }
        LocalDate todayIst = LocalDate.now(clock.withZone(IST));
        LocalDate d = req.date() != null ? req.date() : todayIst;
        if (d.isAfter(todayIst)) {
            throw new BadRequestException("Cannot close a future business date");
        }
        if (closedByDate.containsKey(d)) {
            throw new DuplicateResourceException("Daily cash closing is already completed for " + d);
        }

        BigDecimal opening = requireNonNegative(req.openingCash(), "Opening cash");
        BigDecimal expenses = req.cashExpenses() != null
                ? requireNonNegative(req.cashExpenses(), "Cash expenses")
                : zero();
        BigDecimal counted = requireNonNegative(req.actualCashCounted(), "Actual cash counted");

        LiveTotals live = queryLiveTotals(d);
        BigDecimal expected = computeExpectedCash(
                opening,
                live.shopCashSales(),
                live.codCashSettledToShop(),
                expenses,
                live.cashRefunds());
        BigDecimal diff = counted.subtract(expected).setScale(2, RoundingMode.HALF_UP);

        String cleanExpenseNote = trimToNull(req.expenseNote(), 200);
        String cleanNote = trimToNull(req.note(), 300);
        LocalDateTime closedAt = LocalDateTime.now(clock.withZone(IST));

        ClosedRecord record = new ClosedRecord(
                d,
                opening,
                live.shopCashSales(),
                live.codCashSettledToShop(),
                expenses,
                cleanExpenseNote,
                live.cashRefunds(),
                expected,
                counted,
                diff,
                cleanNote,
                ownerPhone != null ? ownerPhone : "OWNER",
                closedAt);

        closedByDate.put(d, record);
        persistAll();
        return getTally(d);
    }

    public static BigDecimal computeExpectedCash(
            BigDecimal openingCash,
            BigDecimal shopCashSales,
            BigDecimal codCashSettledToShop,
            BigDecimal cashExpenses,
            BigDecimal cashRefunds) {
        return openingCash
                .add(shopCashSales)
                .add(codCashSettledToShop)
                .subtract(cashExpenses)
                .subtract(cashRefunds)
                .setScale(2, RoundingMode.HALF_UP);
    }

    private LiveTotals queryLiveTotals(LocalDate d) {
        LocalDateTime from = d.atStartOfDay();
        LocalDateTime to = d.plusDays(1).atStartOfDay();

        BigDecimal shopCashSales = zero();
        long shopCashBills = 0;
        BigDecimal posUpiSales = zero();
        long posUpiBills = 0;

        for (SaleRepository.PaymentSummary row : sales.summarizeByPayment(from, to)) {
            if (row.getMethod() == SalePaymentMethod.CASH) {
                shopCashSales = scale(row.getTotal());
                shopCashBills = row.getBills() != null ? row.getBills() : 0L;
            } else if (row.getMethod() == SalePaymentMethod.UPI) {
                posUpiSales = scale(row.getTotal());
                posUpiBills = row.getBills() != null ? row.getBills() : 0L;
            }
        }

        BigDecimal codCashCollected = zero();
        long codCashBills = 0;
        BigDecimal deliveryUpi = zero();
        BigDecimal razorpay = zero();

        for (PaymentRepository.MethodTotal row : payments.sumSuccessfulCollectionsByMethodBetween(from, to)) {
            if (row.getMethod() == PaymentMethod.CASH) {
                codCashCollected = scale(row.getTotal());
                codCashBills = row.getBills() != null ? row.getBills() : 0L;
            } else if (row.getMethod() == PaymentMethod.UPI_QR) {
                deliveryUpi = scale(row.getTotal());
            } else if (row.getMethod() == PaymentMethod.RAZORPAY) {
                razorpay = scale(row.getTotal());
            }
        }

        BigDecimal codSettled = scale(payments.sumCashSettledBetween(from, to));
        BigDecimal codPending = scale(payments.sumPendingCashTotal());
        BigDecimal cashRefunds = scale(payments.sumSuccessfulRefundsByMethodBetween(PaymentMethod.CASH, from, to));
        BigDecimal digitalRefunds = scale(payments.sumSuccessfulRefundsByMethodBetween(PaymentMethod.RAZORPAY, from, to));
        BigDecimal purchaseSpend = scale(purchases.totalSpendOn(d));

        boolean hasTx = shopCashBills > 0
                || posUpiBills > 0
                || codCashBills > 0
                || codSettled.signum() > 0
                || deliveryUpi.signum() > 0
                || razorpay.signum() > 0
                || cashRefunds.signum() > 0
                || purchaseSpend.signum() > 0;

        return new LiveTotals(
                shopCashSales,
                shopCashBills,
                posUpiSales,
                posUpiBills,
                codCashCollected,
                codCashBills,
                codSettled,
                codPending,
                deliveryUpi,
                razorpay,
                cashRefunds,
                digitalRefunds,
                purchaseSpend,
                hasTx);
    }

    private record LiveTotals(
            BigDecimal shopCashSales,
            long shopCashBills,
            BigDecimal posUpiSales,
            long posUpiBills,
            BigDecimal codCashCollected,
            long codCashBills,
            BigDecimal codCashSettledToShop,
            BigDecimal codCashPendingSettlement,
            BigDecimal deliveryUpiCollections,
            BigDecimal razorpayCollections,
            BigDecimal cashRefunds,
            BigDecimal digitalRefunds,
            BigDecimal purchaseSpend,
            boolean hasTransactions) {}

    private static BigDecimal zero() {
        return BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
    }

    private static BigDecimal scale(BigDecimal v) {
        return v == null ? zero() : v.setScale(2, RoundingMode.HALF_UP);
    }

    private static BigDecimal requireNonNegative(BigDecimal value, String label) {
        if (value == null) {
            throw new BadRequestException(label + " is required");
        }
        if (value.signum() < 0) {
            throw new BadRequestException(label + " cannot be negative");
        }
        return value.setScale(2, RoundingMode.HALF_UP);
    }

    private static String trimToNull(String value, int maxLen) {
        if (value == null || value.isBlank()) return null;
        String trimmed = value.trim();
        return trimmed.length() > maxLen ? trimmed.substring(0, maxLen) : trimmed;
    }

    private void loadPersisted() {
        if (storagePath == null || !Files.exists(storagePath)) {
            return;
        }
        try {
            Properties props = new Properties();
            try (var in = Files.newInputStream(storagePath)) {
                props.load(in);
            }
            for (String key : props.stringPropertyNames()) {
                if (!key.endsWith(".closedAt")) continue;
                String dateStr = key.substring(0, key.length() - ".closedAt".length());
                LocalDate d = LocalDate.parse(dateStr);
                closedByDate.put(d, new ClosedRecord(
                        d,
                        new BigDecimal(props.getProperty(dateStr + ".openingCash", "0.00")),
                        new BigDecimal(props.getProperty(dateStr + ".shopCashSales", "0.00")),
                        new BigDecimal(props.getProperty(dateStr + ".codCashSettledToShop", "0.00")),
                        new BigDecimal(props.getProperty(dateStr + ".cashExpenses", "0.00")),
                        trimToNull(props.getProperty(dateStr + ".expenseNote"), 200),
                        new BigDecimal(props.getProperty(dateStr + ".cashRefunds", "0.00")),
                        new BigDecimal(props.getProperty(dateStr + ".expectedCash", "0.00")),
                        new BigDecimal(props.getProperty(dateStr + ".actualCashCounted", "0.00")),
                        new BigDecimal(props.getProperty(dateStr + ".difference", "0.00")),
                        trimToNull(props.getProperty(dateStr + ".note"), 300),
                        props.getProperty(dateStr + ".closedBy", "OWNER"),
                        LocalDateTime.parse(props.getProperty(dateStr + ".closedAt"))));
            }
        } catch (Exception ex) {
            log.warn("Could not load persisted cash closing records from {}", storagePath, ex);
        }
    }

    private void persistAll() {
        if (storagePath == null) {
            return;
        }
        try {
            Path parent = storagePath.getParent();
            if (parent != null) {
                Files.createDirectories(parent);
            }
            Properties props = new Properties();
            for (ClosedRecord r : closedByDate.values()) {
                String p = r.date().toString();
                props.setProperty(p + ".openingCash", r.openingCash().toPlainString());
                props.setProperty(p + ".shopCashSales", r.shopCashSales().toPlainString());
                props.setProperty(p + ".codCashSettledToShop", r.codCashSettledToShop().toPlainString());
                props.setProperty(p + ".cashExpenses", r.cashExpenses().toPlainString());
                if (r.expenseNote() != null) props.setProperty(p + ".expenseNote", r.expenseNote());
                props.setProperty(p + ".cashRefunds", r.cashRefunds().toPlainString());
                props.setProperty(p + ".expectedCash", r.expectedCash().toPlainString());
                props.setProperty(p + ".actualCashCounted", r.actualCashCounted().toPlainString());
                props.setProperty(p + ".difference", r.difference().toPlainString());
                if (r.note() != null) props.setProperty(p + ".note", r.note());
                props.setProperty(p + ".closedBy", r.closedBy());
                props.setProperty(p + ".closedAt", r.closedAt().toString());
            }
            Path tmp = storagePath.resolveSibling(storagePath.getFileName() + ".tmp");
            try (var out = Files.newOutputStream(tmp)) {
                props.store(out, "TazaTokri Daily Cash Closing Records");
            }
            Files.move(tmp, storagePath, StandardCopyOption.REPLACE_EXISTING, StandardCopyOption.ATOMIC_MOVE);
        } catch (IOException ex) {
            throw new IllegalStateException("Failed to persist daily cash closing record", ex);
        }
    }
}
