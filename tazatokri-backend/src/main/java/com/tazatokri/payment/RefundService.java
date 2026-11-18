package com.tazatokri.payment;

import java.util.List;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

import com.tazatokri.common.BadRequestException;

@Service
public class RefundService {

    private static final Logger log = LoggerFactory.getLogger(RefundService.class);

    private final PaymentRepository payments;
    private final RazorpayGateway gateway;
    private final TransactionTemplate tx;

    public RefundService(PaymentRepository payments, RazorpayGateway gateway, TransactionTemplate tx) {
        this.payments = payments;
        this.gateway = gateway;
        this.tx = tx;
    }

    /** Returns how many refunds were completed. One failure does not stop the others. */
    public int processPending() {
        if (!gateway.isConfigured()) {
            throw new BadRequestException("Online payment is not configured");
        }
        List<Long> ids = payments.findByKindAndStatusOrderByIdAsc(PaymentKind.REFUND, PaymentStatus.PENDING)
                .stream().map(Payment::getId).toList();
        int done = 0;
        for (Long id : ids) {
            try {
                tx.executeWithoutResult(status -> refundOne(id));   // one transaction per refund
                done++;
            } catch (Exception e) {
                log.error("Refund {} failed, will retry next run", id, e);
            }
        }
        return done;
    }

    private void refundOne(Long id) {
        Payment r = payments.findByIdForUpdate(id).orElseThrow();
        if (r.getStatus() != PaymentStatus.PENDING) {
            return;
        }
        Payment source = payments.findFirstByOrderIdAndMethodAndKindAndStatus(
                        r.getOrderId(), PaymentMethod.RAZORPAY, PaymentKind.COLLECTION, PaymentStatus.SUCCESS)
                .orElseThrow(() -> new IllegalStateException("No paid Razorpay payment for order " + r.getOrderId()));

        String refundId = gateway.refund(source.getProviderPaymentId(),
                RazorpayGateway.toPaise(r.getAmount()), "refund-" + r.getId());
        r.setStatus(PaymentStatus.SUCCESS);
        r.setReference(refundId);
    }
}