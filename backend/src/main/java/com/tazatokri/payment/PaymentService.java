package com.tazatokri.payment;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import com.tazatokri.common.BadRequestException;
import com.tazatokri.common.InvalidOrderStateException;
import com.tazatokri.order.CustomerOrder;
import com.tazatokri.user.User;
import com.tazatokri.user.UserRepository;

@Service
public class PaymentService {

    private final PaymentRepository payments;
    private final UserRepository users;

    public PaymentService(PaymentRepository payments, UserRepository users) {
        this.payments = payments;
        this.users = users;
    }

    /** Called by DeliveryService inside the order-locked transaction. */
    @Transactional(propagation = Propagation.MANDATORY)
    public void collectOnDelivery(CustomerOrder o, Long collectorId, CollectionRequest req) {
        if (o.getFinalTotal() == null) {
            throw new InvalidOrderStateException("Order has no final total yet");
        }
        BigDecimal due = o.getFinalTotal().subtract(payments.netPaid(o.getId()));

        if (due.signum() < 0) {
            // prepaid and now cheaper: the refund flow arrives in step 21
            throw new InvalidOrderStateException("A refund of Rs "
                    + due.negate().toPlainString() + " is pending. Ask the owner");
        }
        if (due.signum() == 0) {
            return;                                   // already paid in full
        }

        if (req == null || req.method() == null || req.amountCollected() == null) {
            throw new BadRequestException("Collect Rs " + due.toPlainString()
                    + " and send the payment method and amount");
        }
        if (req.method() == PaymentMethod.RAZORPAY) {
            throw new BadRequestException("Online payments are not collected at the door");
        }
        if (req.amountCollected().compareTo(due) != 0) {
            throw new InvalidOrderStateException("Amount due is Rs " + due.toPlainString());
        }
        String ref = (req.reference() == null || req.reference().isBlank()) ? null : req.reference().trim();
        if (req.method() == PaymentMethod.UPI_QR && ref == null) {
            throw new BadRequestException("Enter the UPI transaction reference");
        }

        Payment p = new Payment();
        p.setOrderId(o.getId());
        p.setKind(PaymentKind.COLLECTION);
        p.setMethod(req.method());
        p.setStatus(PaymentStatus.SUCCESS);
        p.setAmount(due);                             // our number, not the client's
        p.setCollectedBy(collectorId);
        p.setReference(ref);
        payments.save(p);
    }

    @Transactional(readOnly = true)
    public List<PaymentResponse> forOrder(Long orderId) {
        return payments.findByOrderIdOrderByIdAsc(orderId).stream().map(PaymentResponse::from).toList();
    }

    @Transactional(readOnly = true)
    public List<PendingCashResponse> pendingCash() {
        List<PaymentRepository.PendingCash> rows = payments.pendingCash();
        Map<Long, User> byId = users.findAllById(
                        rows.stream().map(PaymentRepository.PendingCash::getCollectedBy).toList())
                .stream().collect(Collectors.toMap(User::getId, Function.identity()));
        return rows.stream()
                .map(r -> new PendingCashResponse(r.getCollectedBy(),
                        byId.get(r.getCollectedBy()).getFullName(), r.getTotal(), r.getBills()))
                .toList();
    }

    @Transactional
    public SettlementResponse settle(Long deliveryUserId, BigDecimal received, String ownerPhone) {
        Long ownerId = users.findByPhone(ownerPhone)
                .orElseThrow(() -> new BadRequestException("Unknown user")).getId();

        List<Payment> pending = payments.lockUnsettledCash(deliveryUserId);   // FOR UPDATE
        if (pending.isEmpty()) {
            throw new BadRequestException("No cash pending from this person");
        }
        BigDecimal sum = pending.stream().map(Payment::getAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        if (sum.compareTo(received) != 0) {
            throw new InvalidOrderStateException("Cash pending is Rs " + sum.toPlainString()
                    + ", not Rs " + received.toPlainString());
        }
        LocalDateTime now = LocalDateTime.now();
        for (Payment p : pending) {
            p.setSettledAt(now);
            p.setSettledBy(ownerId);
        }
        return new SettlementResponse(deliveryUserId, sum, pending.size(), now);
    }
    
    /** Queue a refund for anything paid above what the customer should keep. */
    @Transactional(propagation = Propagation.MANDATORY)
    public void queueRefund(Long orderId, BigDecimal keep) {
        BigDecimal excess = payments.netPaid(orderId).subtract(keep);
        if (excess.signum() <= 0) {
            return;
        }
        Payment r = new Payment();
        r.setOrderId(orderId);
        r.setKind(PaymentKind.REFUND);
        r.setMethod(PaymentMethod.RAZORPAY);
        r.setStatus(PaymentStatus.PENDING);
        r.setAmount(excess);
        payments.save(r);
    }
}