package com.tazatokri;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.lang.reflect.Proxy;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.List;
import java.util.Optional;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

import com.tazatokri.common.BadRequestException;
import com.tazatokri.order.CustomerOrder;
import com.tazatokri.order.CustomerOrderRepository;
import com.tazatokri.order.OrderStatus;
import com.tazatokri.payment.OnlinePaymentService;
import com.tazatokri.payment.Payment;
import com.tazatokri.payment.PaymentKind;
import com.tazatokri.payment.PaymentMethod;
import com.tazatokri.payment.PaymentRepository;
import com.tazatokri.payment.PaymentService;
import com.tazatokri.payment.PaymentStatus;
import com.tazatokri.payment.RazorpayGateway;
import com.tazatokri.payment.RazorpayWebhookController;
import com.tazatokri.payment.VerifyRequest;
import com.tazatokri.user.User;
import com.tazatokri.user.UserRepository;

class RazorpayPaymentFlowTests {

    private static final String KEY_SECRET = "rzp_test_secret_1234567890";
    private static final String WEBHOOK_SECRET = "rzp_webhook_secret_1234567890";

    private static String hmacHex(String payload, String secret) throws Exception {
        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
        return HexFormat.of().formatHex(mac.doFinal(payload.getBytes(StandardCharsets.UTF_8)));
    }

    private static RazorpayGateway stubGateway() throws Exception {
        java.util.concurrent.atomic.AtomicInteger seq = new java.util.concurrent.atomic.AtomicInteger(1);
        return new RazorpayGateway("", KEY_SECRET, WEBHOOK_SECRET) {
            @Override public boolean isConfigured() { return true; }
            @Override public String keyId() { return "rzp_test_key"; }
            @Override public String createOrder(long amountPaise, String receipt) {
                return "order_rzp_" + receipt + "_" + seq.getAndIncrement();
            }
        };
    }

    private static User customer(long id, String phone) {
        User u = new User();
        u.setId(id);
        u.setPhone(phone);
        u.setActive(true);
        return u;
    }

    private static CustomerOrder pendingOrder(long id, long customerId, String total) {
        CustomerOrder o = new CustomerOrder();
        o.setId(id);
        o.setCustomerId(customerId);
        o.setStatus(OrderStatus.PENDING_PAYMENT);
        o.setEstimatedTotal(new BigDecimal(total));
        return o;
    }

    @Test
    void startVerifyIdempotencyAndFailureFlow() throws Exception {
        User cust = customer(1L, "9876543210");
        CustomerOrder order = pendingOrder(101L, 1L, "150.00");
        List<Payment> storedPayments = new ArrayList<>();

        UserRepository userRepo = (UserRepository) Proxy.newProxyInstance(
                UserRepository.class.getClassLoader(),
                new Class<?>[] { UserRepository.class },
                (p, m, a) -> "findByPhone".equals(m.getName()) && cust.getPhone().equals(a[0])
                        ? Optional.of(cust) : Optional.empty());

        CustomerOrderRepository orderRepo = (CustomerOrderRepository) Proxy.newProxyInstance(
                CustomerOrderRepository.class.getClassLoader(),
                new Class<?>[] { CustomerOrderRepository.class },
                (p, m, a) -> "findByIdForUpdate".equals(m.getName()) && order.getId().equals(a[0])
                        ? Optional.of(order) : Optional.empty());

        PaymentRepository payRepo = (PaymentRepository) Proxy.newProxyInstance(
                PaymentRepository.class.getClassLoader(),
                new Class<?>[] { PaymentRepository.class },
                (p, m, a) -> switch (m.getName()) {
                    case "findFirstByOrderIdAndMethodAndKindAndStatus" -> storedPayments.stream()
                            .filter(x -> x.getOrderId().equals(a[0]) && x.getMethod() == a[1]
                                    && x.getKind() == a[2] && x.getStatus() == a[3])
                            .findFirst();
                    case "findFirstByMethodAndKindAndReference" -> storedPayments.stream()
                            .filter(x -> x.getMethod() == a[0] && x.getKind() == a[1]
                                    && x.getReference().equals(a[2]))
                            .findFirst();
                    case "save" -> {
                        Payment pay = (Payment) a[0];
                        if (pay.getId() == null) {
                            pay.setId((long) (storedPayments.size() + 1));
                            storedPayments.add(pay);
                        }
                        yield pay;
                    }
                    default -> throw new UnsupportedOperationException(m.getName());
                });

        PaymentService paymentService = new PaymentService(payRepo, userRepo);
        OnlinePaymentService service = new OnlinePaymentService(
                payRepo, orderRepo, userRepo, stubGateway(), paymentService);

        // 1. Start creates a pending Razorpay order; second tap reuses it
        var init1 = service.start(101L, "9876543210");
        var init2 = service.start(101L, "9876543210");
        assertEquals(init1.razorpayOrderId(), init2.razorpayOrderId());
        assertEquals(15000L, init1.amountPaise());
        assertEquals(1, storedPayments.size());

        // 2. Mark failed transitions payment to FAILED while keeping order PENDING_PAYMENT for retry
        service.markFailed(101L, init1.razorpayOrderId(), "pay_fail_1", "Card declined", "9876543210");
        assertEquals(PaymentStatus.FAILED, storedPayments.get(0).getStatus());
        assertEquals(OrderStatus.PENDING_PAYMENT, order.getStatus());

        // 3. Retry creates a fresh PENDING payment
        var retryInit = service.start(101L, "9876543210");
        assertEquals(2, storedPayments.size());

        // 4. Invalid signature rejected
        assertThrows(BadRequestException.class, () -> service.verify(
                101L, new VerifyRequest(retryInit.razorpayOrderId(), "pay_ok_1", "bad-sig"), "9876543210"));

        // 5. Valid signature verifies payment and places order
        String sig = hmacHex(retryInit.razorpayOrderId() + "|pay_ok_1", KEY_SECRET);
        var res = service.verify(101L, new VerifyRequest(retryInit.razorpayOrderId(), "pay_ok_1", sig), "9876543210");
        assertEquals(OrderStatus.PLACED, res.status());
        assertEquals(PaymentStatus.SUCCESS, storedPayments.get(1).getStatus());

        // 6. Idempotent repeat verify + late failure webhook cannot overwrite SUCCESS
        var repeatRes = service.verify(101L, new VerifyRequest(retryInit.razorpayOrderId(), "pay_ok_1", sig), "9876543210");
        assertEquals(OrderStatus.PLACED, repeatRes.status());
        service.handleFailed(retryInit.razorpayOrderId(), "pay_ok_1", "late failure");
        assertEquals(PaymentStatus.SUCCESS, storedPayments.get(1).getStatus());
    }

    @Test
    void webhookValidatesSignatureAndHandlesCapturedAndFailedEvents() throws Exception {
        RazorpayGateway gateway = stubGateway();
        CustomerOrder order = pendingOrder(202L, 1L, "99.00");
        Payment payment = new Payment();
        payment.setId(1L);
        payment.setOrderId(202L);
        payment.setKind(PaymentKind.COLLECTION);
        payment.setMethod(PaymentMethod.RAZORPAY);
        payment.setStatus(PaymentStatus.PENDING);
        payment.setAmount(new BigDecimal("99.00"));
        payment.setReference("order_rzp_202");

        CustomerOrderRepository orderRepo = (CustomerOrderRepository) Proxy.newProxyInstance(
                CustomerOrderRepository.class.getClassLoader(),
                new Class<?>[] { CustomerOrderRepository.class },
                (p, m, a) -> "findByIdForUpdate".equals(m.getName()) ? Optional.of(order) : Optional.empty());
        PaymentRepository payRepo = (PaymentRepository) Proxy.newProxyInstance(
                PaymentRepository.class.getClassLoader(),
                new Class<?>[] { PaymentRepository.class },
                (p, m, a) -> "findFirstByMethodAndKindAndReference".equals(m.getName())
                        ? Optional.of(payment) : Optional.empty());
        UserRepository userRepo = (UserRepository) Proxy.newProxyInstance(
                UserRepository.class.getClassLoader(),
                new Class<?>[] { UserRepository.class },
                (p, m, a) -> Optional.empty());

        OnlinePaymentService service = new OnlinePaymentService(
                payRepo, orderRepo, userRepo, gateway, new PaymentService(payRepo, userRepo));
        RazorpayWebhookController controller = new RazorpayWebhookController(gateway, service);

        String payload = """
                {"event":"payment.captured","payload":{"payment":{"entity":{"order_id":"order_rzp_202","id":"pay_wh_1","amount":9900}}}}
                """;
        byte[] body = payload.getBytes(StandardCharsets.UTF_8);

        assertFalse(gateway.verifyWebhookSignature(body, "invalid"));
        assertEquals(HttpStatus.BAD_REQUEST, controller.webhook(body, "invalid").getStatusCode());

        String validSig = hmacHex(payload, WEBHOOK_SECRET);
        assertTrue(gateway.verifyWebhookSignature(body, validSig));
        assertEquals(HttpStatus.OK, controller.webhook(body, validSig).getStatusCode());
        assertEquals(PaymentStatus.SUCCESS, payment.getStatus());
        assertEquals(OrderStatus.PLACED, order.getStatus());
    }

    @Test
    void rejectsAmountMismatchAndSubRupeeOrders() throws Exception {
        RazorpayGateway gateway = stubGateway();
        User cust = customer(1L, "9876543210");
        CustomerOrder tinyOrder = pendingOrder(303L, 1L, "0.50");
        Payment payment = new Payment();
        payment.setId(2L);
        payment.setOrderId(303L);
        payment.setKind(PaymentKind.COLLECTION);
        payment.setMethod(PaymentMethod.RAZORPAY);
        payment.setStatus(PaymentStatus.PENDING);
        payment.setAmount(new BigDecimal("99.00"));
        payment.setReference("order_rzp_303");

        UserRepository userRepo = (UserRepository) Proxy.newProxyInstance(
                UserRepository.class.getClassLoader(),
                new Class<?>[] { UserRepository.class },
                (p, m, a) -> Optional.of(cust));
        CustomerOrderRepository orderRepo = (CustomerOrderRepository) Proxy.newProxyInstance(
                CustomerOrderRepository.class.getClassLoader(),
                new Class<?>[] { CustomerOrderRepository.class },
                (p, m, a) -> Optional.of(tinyOrder));
        PaymentRepository payRepo = (PaymentRepository) Proxy.newProxyInstance(
                PaymentRepository.class.getClassLoader(),
                new Class<?>[] { PaymentRepository.class },
                (p, m, a) -> "findFirstByMethodAndKindAndReference".equals(m.getName())
                        ? Optional.of(payment) : Optional.empty());

        OnlinePaymentService service = new OnlinePaymentService(
                payRepo, orderRepo, userRepo, gateway, new PaymentService(payRepo, userRepo));

        // Sub-rupee order (< 100 paise) rejected
        assertThrows(BadRequestException.class, () -> service.start(303L, "9876543210"));

        // Mismatched webhook amount ignored; payment remains PENDING
        service.handleCaptured("order_rzp_303", "pay_bad_amt", 5000L);
        assertEquals(PaymentStatus.PENDING, payment.getStatus());
        assertEquals(OrderStatus.PENDING_PAYMENT, tinyOrder.getStatus());
    }
}
