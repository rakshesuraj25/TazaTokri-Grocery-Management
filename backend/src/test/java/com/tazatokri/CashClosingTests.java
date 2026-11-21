package com.tazatokri;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.lang.reflect.InvocationHandler;
import java.lang.reflect.Proxy;
import java.math.BigDecimal;
import java.nio.file.Path;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.List;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.security.access.prepost.PreAuthorize;

import com.tazatokri.common.BadRequestException;
import com.tazatokri.common.DuplicateResourceException;
import com.tazatokri.payment.PaymentMethod;
import com.tazatokri.payment.PaymentRepository;
import com.tazatokri.purchase.PurchaseRepository;
import com.tazatokri.report.CashClosingController;
import com.tazatokri.report.CashClosingService;
import com.tazatokri.report.CashClosingService.CloseDayRequest;
import com.tazatokri.report.CashClosingService.DailyCashTallyResponse;
import com.tazatokri.sales.SalePaymentMethod;
import com.tazatokri.sales.SaleRepository;

class CashClosingTests {

    private static final ZoneId IST = ZoneId.of("Asia/Kolkata");

    @SuppressWarnings("unchecked")
    private static <T> T proxy(Class<T> iface, InvocationHandler handler) {
        return (T) Proxy.newProxyInstance(iface.getClassLoader(), new Class<?>[] { iface }, handler);
    }

    private CashClosingService buildService(String storageFile, Clock clock) {
        SaleRepository sales = proxy(SaleRepository.class, (p, m, a) -> {
            if ("summarizeByPayment".equals(m.getName())) {
                SaleRepository.PaymentSummary cash = proxy(SaleRepository.PaymentSummary.class, (p2, m2, a2) ->
                        switch (m2.getName()) {
                            case "getMethod" -> SalePaymentMethod.CASH;
                            case "getBills" -> 5L;
                            case "getTotal" -> new BigDecimal("1200.00");
                            default -> null;
                        });
                SaleRepository.PaymentSummary upi = proxy(SaleRepository.PaymentSummary.class, (p2, m2, a2) ->
                        switch (m2.getName()) {
                            case "getMethod" -> SalePaymentMethod.UPI;
                            case "getBills" -> 3L;
                            case "getTotal" -> new BigDecimal("850.00");
                            default -> null;
                        });
                return List.of(cash, upi);
            }
            return List.of();
        });

        PaymentRepository payments = proxy(PaymentRepository.class, (p, m, a) -> switch (m.getName()) {
            case "sumSuccessfulCollectionsByMethodBetween" -> List.of(
                    proxy(PaymentRepository.MethodTotal.class, (p2, m2, a2) -> switch (m2.getName()) {
                        case "getMethod" -> PaymentMethod.CASH;
                        case "getBills" -> 4L;
                        case "getTotal" -> new BigDecimal("900.00"); // collected by riders today
                        default -> null;
                    }),
                    proxy(PaymentRepository.MethodTotal.class, (p2, m2, a2) -> switch (m2.getName()) {
                        case "getMethod" -> PaymentMethod.UPI_QR;
                        case "getBills" -> 2L;
                        case "getTotal" -> new BigDecimal("400.00");
                        default -> null;
                    }),
                    proxy(PaymentRepository.MethodTotal.class, (p2, m2, a2) -> switch (m2.getName()) {
                        case "getMethod" -> PaymentMethod.RAZORPAY;
                        case "getBills" -> 1L;
                        case "getTotal" -> new BigDecimal("350.00");
                        default -> null;
                    }));
            case "sumCashSettledBetween" -> new BigDecimal("600.00"); // only Rs 600 settled to shop drawer
            case "sumPendingCashTotal" -> new BigDecimal("300.00");   // Rs 300 still held by rider
            case "sumSuccessfulRefundsByMethodBetween" ->
                a[0] == PaymentMethod.CASH ? new BigDecimal("50.00") : new BigDecimal("100.00");
            default -> null;
        });

        PurchaseRepository purchases = proxy(PurchaseRepository.class, (p, m, a) -> {
            if ("totalSpendOn".equals(m.getName())) {
                return new BigDecimal("2500.00");
            }
            return null;
        });

        return new CashClosingService(sales, payments, purchases, clock, storageFile);
    }

    @Test
    void controllerEnforcesOwnerRoleOnly() {
        PreAuthorize ann = CashClosingController.class.getAnnotation(PreAuthorize.class);
        assertNotNull(ann);
        assertEquals("hasRole('OWNER')", ann.value());
    }

    @Test
    void calculatesExpectedCashExcludingUnsettledCodAndDigitalPayments() {
        Instant nowIst = ZonedDateTime.of(2026, 11, 21, 20, 15, 0, 0, IST).toInstant();
        Clock clock = Clock.fixed(nowIst, IST);
        CashClosingService service = buildService("", clock);

        LocalDate today = LocalDate.of(2026, 11, 21);
        DailyCashTallyResponse openTally = service.getTally(today);
        assertEquals("OPEN", openTally.status());
        assertEquals(new BigDecimal("1200.00"), openTally.shopCashSales());
        assertEquals(new BigDecimal("850.00"), openTally.posUpiSales());
        assertEquals(new BigDecimal("900.00"), openTally.codCashCollected());
        assertEquals(new BigDecimal("600.00"), openTally.codCashSettledToShop());
        assertEquals(new BigDecimal("300.00"), openTally.codCashPendingSettlement());
        assertEquals(new BigDecimal("400.00"), openTally.deliveryUpiCollections());
        assertEquals(new BigDecimal("350.00"), openTally.razorpayCollections());
        assertEquals(new BigDecimal("50.00"), openTally.cashRefunds());
        assertTrue(openTally.hasTransactions());

        // Expected cash = 500 (opening) + 1200 (shop cash) + 600 (COD settled) - 150 (expenses) - 50 (cash refund) = 2100.00
        // Actual counted = 2050.00 -> Difference = -50.00 (short)
        DailyCashTallyResponse closed = service.closeDay(
                new CloseDayRequest(
                        today,
                        new BigDecimal("500.00"),
                        new BigDecimal("150.00"),
                        "Ice & bags",
                        new BigDecimal("2050.00"),
                        "Rs 50 short"),
                "9999999999");

        assertEquals("CLOSED", closed.status());
        assertEquals(new BigDecimal("2100.00"), closed.expectedCash());
        assertEquals(new BigDecimal("2050.00"), closed.actualCashCounted());
        assertEquals(new BigDecimal("-50.00"), closed.difference());
        assertEquals("9999999999", closed.closedBy());
    }

    @Test
    void preventsDuplicateClosingRejectsFutureDatesAndPersistsCarryForward(@TempDir Path tempDir) {
        Instant nowIst = ZonedDateTime.of(2026, 11, 21, 21, 0, 0, 0, IST).toInstant();
        Clock clock = Clock.fixed(nowIst, IST);
        String file = tempDir.resolve("cash-closing.properties").toString();

        CashClosingService service = buildService(file, clock);
        LocalDate today = LocalDate.of(2026, 11, 21);

        service.closeDay(
                new CloseDayRequest(
                        today,
                        new BigDecimal("300.00"),
                        new BigDecimal("100.00"),
                        "Transport",
                        new BigDecimal("1960.00"),
                        null),
                "9999999999");

        // Duplicate close rejected
        assertThrows(DuplicateResourceException.class, () -> service.closeDay(
                new CloseDayRequest(
                        today,
                        new BigDecimal("300.00"),
                        BigDecimal.ZERO,
                        null,
                        new BigDecimal("1960.00"),
                        null),
                "9999999999"));

        // Future date rejected
        assertThrows(BadRequestException.class, () -> service.closeDay(
                new CloseDayRequest(
                        today.plusDays(1),
                        BigDecimal.ZERO,
                        BigDecimal.ZERO,
                        null,
                        BigDecimal.ZERO,
                        null),
                "9999999999"));

        // Reload from persisted file & verify next day suggested opening cash
        Clock nextDayClock = Clock.fixed(
                ZonedDateTime.of(2026, 11, 22, 9, 0, 0, 0, IST).toInstant(), IST);
        CashClosingService reloaded = buildService(file, nextDayClock);
        assertEquals(1, reloaded.history().size());
        DailyCashTallyResponse nextDay = reloaded.getTally(today.plusDays(1));
        assertEquals("OPEN", nextDay.status());
        assertEquals(new BigDecimal("1960.00"), nextDay.suggestedOpeningCash());
    }
}
