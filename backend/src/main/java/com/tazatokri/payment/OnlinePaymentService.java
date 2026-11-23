package com.tazatokri.payment;

import java.math.BigDecimal;
import java.util.Optional;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.tazatokri.common.BadRequestException;
import com.tazatokri.common.InvalidOrderStateException;
import com.tazatokri.common.ResourceNotFoundException;
import com.tazatokri.order.CustomerOrder;
import com.tazatokri.order.CustomerOrderRepository;
import com.tazatokri.order.OrderStatus;
import com.tazatokri.user.UserRepository;

@Service
public class OnlinePaymentService {

    private static final Logger log = LoggerFactory.getLogger(OnlinePaymentService.class);

    public record PaymentInit(Long orderId, String keyId, String razorpayOrderId,
                              long amountPaise, String currency) {}

    public record VerifyResult(Long orderId, OrderStatus status) {}

    private final PaymentRepository payments;
    private final CustomerOrderRepository orders;
    private final UserRepository users;
    private final RazorpayGateway gateway;
    private final PaymentService paymentService;

    public OnlinePaymentService(PaymentRepository payments, CustomerOrderRepository orders,
                                UserRepository users, RazorpayGateway gateway,
                                PaymentService paymentService) {
        this.payments = payments;
        this.orders = orders;
        this.users = users;
        this.gateway = gateway;
        this.paymentService = paymentService;
    }

    @Transactional
    public PaymentInit start(Long orderId, String customerPhone) {
        if (!gateway.isConfigured()) {
            throw new BadRequestException("Online payment is not available right now");
        }
        CustomerOrder o = lockOwned(orderId, customerPhone);
        if (o.getStatus() != OrderStatus.PENDING_PAYMENT) {
            throw new InvalidOrderStateException("Order is " + o.getStatus() + ", payment not needed");
        }

        long paise = RazorpayGateway.toPaise(o.getEstimatedTotal());
        if (paise < 100) {
            throw new BadRequestException("Online payment requires an order total of at least ₹1.00");
        }

        // customer tapped "Pay" again: reuse the open Razorpay order
        Optional<Payment> open = payments.findFirstByOrderIdAndMethodAndKindAndStatus(
                orderId, PaymentMethod.RAZORPAY, PaymentKind.COLLECTION, PaymentStatus.PENDING);
        if (open.isPresent()) {
            return new PaymentInit(orderId, gateway.keyId(), open.get().getReference(), paise, "INR");
        }

        String rzpOrderId = gateway.createOrder(paise, "order-" + orderId);

        Payment p = new Payment();
        p.setOrderId(orderId);
        p.setKind(PaymentKind.COLLECTION);
        p.setMethod(PaymentMethod.RAZORPAY);
        p.setStatus(PaymentStatus.PENDING);
        p.setAmount(o.getEstimatedTotal());
        p.setReference(rzpOrderId);
        payments.save(p);
        return new PaymentInit(orderId, gateway.keyId(), rzpOrderId, paise, "INR");
    }

    @Transactional
    public VerifyResult verify(Long orderId, VerifyRequest req, String customerPhone) {
        CustomerOrder o = lockOwned(orderId, customerPhone);
        Payment p = payments.findFirstByMethodAndKindAndReference(
                        PaymentMethod.RAZORPAY, PaymentKind.COLLECTION, req.razorpayOrderId())
                .filter(x -> x.getOrderId().equals(orderId))
                .orElseThrow(() -> new BadRequestException("Unknown payment"));

        if (!gateway.verifyPaymentSignature(req.razorpayOrderId(), req.razorpayPaymentId(), req.razorpaySignature())) {
            throw new BadRequestException("Invalid payment signature");
        }
        applyPaid(o, p, req.razorpayPaymentId());
        return new VerifyResult(o.getId(), o.getStatus());
    }

    /** Records a client-reported Razorpay payment failure so the customer can retry with a fresh order. */
    @Transactional
    public VerifyResult markFailed(Long orderId, String rzpOrderId, String rzpPaymentId,
                                   String reason, String customerPhone) {
        CustomerOrder o = lockOwned(orderId, customerPhone);
        Optional<Payment> found = payments.findFirstByMethodAndKindAndReference(
                        PaymentMethod.RAZORPAY, PaymentKind.COLLECTION, rzpOrderId)
                .filter(x -> x.getOrderId().equals(orderId));
        if (found.isPresent()) {
            applyFailed(o, found.get(), rzpPaymentId, reason);
        }
        return new VerifyResult(o.getId(), o.getStatus());
    }

    /** Called by the webhook. Unknown or mismatching payments are logged and ignored. */
    @Transactional
    public void handleCaptured(String rzpOrderId, String rzpPaymentId, long amountPaise) {
        Optional<Payment> initial = payments.findFirstByMethodAndKindAndReference(
                PaymentMethod.RAZORPAY, PaymentKind.COLLECTION, rzpOrderId);
        if (initial.isEmpty()) {
            log.warn("Webhook for unknown Razorpay order {}", rzpOrderId);
            return;
        }
        CustomerOrder o = orders.findByIdForUpdate(initial.get().getOrderId())
                .orElseThrow(() -> new ResourceNotFoundException("Order not found: " + initial.get().getOrderId()));
        Payment p = payments.findFirstByMethodAndKindAndReference(
                        PaymentMethod.RAZORPAY, PaymentKind.COLLECTION, rzpOrderId)
                .orElse(initial.get());
        if (RazorpayGateway.toPaise(p.getAmount()) != amountPaise) {
            log.error("Amount mismatch for order {}: expected {} got {}", o.getId(),
                    RazorpayGateway.toPaise(p.getAmount()), amountPaise);
            return;
        }
        applyPaid(o, p, rzpPaymentId);
    }

    /** Called by the webhook on payment.failed. Never overwrites an already-successful payment. */
    @Transactional
    public void handleFailed(String rzpOrderId, String rzpPaymentId, String reason) {
        if (rzpOrderId == null || rzpOrderId.isBlank()) {
            return;
        }
        Optional<Payment> initial = payments.findFirstByMethodAndKindAndReference(
                PaymentMethod.RAZORPAY, PaymentKind.COLLECTION, rzpOrderId);
        if (initial.isEmpty()) {
            log.warn("Failure webhook for unknown Razorpay order {}", rzpOrderId);
            return;
        }
        CustomerOrder o = orders.findByIdForUpdate(initial.get().getOrderId())
                .orElse(null);
        if (o == null) {
            return;
        }
        Payment p = payments.findFirstByMethodAndKindAndReference(
                        PaymentMethod.RAZORPAY, PaymentKind.COLLECTION, rzpOrderId)
                .orElse(initial.get());
        applyFailed(o, p, rzpPaymentId, reason);
    }

    private void applyFailed(CustomerOrder o, Payment p, String rzpPaymentId, String reason) {
        if (p.getStatus() == PaymentStatus.SUCCESS || p.getStatus() == PaymentStatus.FAILED) {
            return;
        }
        p.setStatus(PaymentStatus.FAILED);
        if (rzpPaymentId != null && !rzpPaymentId.isBlank() && p.getProviderPaymentId() == null) {
            p.setProviderPaymentId(rzpPaymentId);
        }
        log.info("Marked Razorpay payment {} for order {} as FAILED ({})",
                p.getReference(), o.getId(), reason != null ? reason : "gateway failure");
    }

    // idempotent: the second caller (verify or webhook) finds SUCCESS and returns
    private void applyPaid(CustomerOrder o, Payment p, String rzpPaymentId) {
        if (p.getStatus() == PaymentStatus.SUCCESS) {
            return;
        }
        p.setStatus(PaymentStatus.SUCCESS);
        p.setProviderPaymentId(rzpPaymentId);

        if (o.getStatus() == OrderStatus.PENDING_PAYMENT) {
            o.setStatus(OrderStatus.PLACED);
        } else if (o.getStatus() == OrderStatus.CANCELLED) {
            paymentService.queueRefund(o.getId(), BigDecimal.ZERO);   // paid too late: give it back
        }
    }

    private CustomerOrder lockOwned(Long orderId, String phone) {
        Long customerId = users.findByPhone(phone)
                .orElseThrow(() -> new BadRequestException("Unknown user")).getId();
        return orders.findByIdForUpdate(orderId)
                .filter(x -> x.getCustomerId().equals(customerId))
                .orElseThrow(() -> new ResourceNotFoundException("Order not found: " + orderId));
    }
}