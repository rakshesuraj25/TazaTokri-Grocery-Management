package com.tazatokri.order;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

import com.tazatokri.payment.OnlinePaymentService;
import com.tazatokri.payment.Payment;
import com.tazatokri.payment.PaymentKind;
import com.tazatokri.payment.PaymentMethod;
import com.tazatokri.payment.PaymentRepository;
import com.tazatokri.payment.PaymentStatus;
import com.tazatokri.payment.RazorpayGateway;
import com.tazatokri.user.UserRepository;

@Service
public class OrderExpiryService {

	private static final Logger log = LoggerFactory.getLogger(OrderExpiryService.class);

	private final CustomerOrderRepository orders;
	private final PaymentRepository payments;
	private final UserRepository users;
	private final OrderFlowService flow;
	private final OnlinePaymentService online;
	private final RazorpayGateway gateway;
	private final TransactionTemplate tx;
	private final long holdPlusGraceMinutes;

	public OrderExpiryService(CustomerOrderRepository orders, PaymentRepository payments, UserRepository users,
			OrderFlowService flow, OnlinePaymentService online, RazorpayGateway gateway, TransactionTemplate tx,
			@Value("${app.order.payment-hold-minutes}") long holdMinutes,
			@Value("${app.order.expiry-grace-minutes}") long graceMinutes) {
		this.orders = orders;
		this.payments = payments;
		this.users = users;
		this.flow = flow;
		this.online = online;
		this.gateway = gateway;
		this.tx = tx;
		this.holdPlusGraceMinutes = holdMinutes + graceMinutes;
	}

	/**
	 * Returns how many orders were expired. One failure does not stop the others.
	 */
	public int expireUnpaid() {
		LocalDateTime before = LocalDateTime.now().minusMinutes(holdPlusGraceMinutes);
		List<Long> ids = orders.findExpiredPendingIds(before);
		int expired = 0;
		for (Long id : ids) {
			try {
				Boolean result = tx.execute(status -> expireOne(id));
				if (Boolean.TRUE.equals(result)) {
					expired++;
				}
			} catch (Exception e) {
				log.error("Could not expire order {}, will retry next run", id, e);
			}
		}
		return expired;
	}

	private boolean expireOne(Long id) {
		// lock first, then re-check: it may have been paid since the list was read
		CustomerOrder o = orders.findByIdForUpdate(id).orElse(null);
		if (o == null || o.getStatus() != OrderStatus.PENDING_PAYMENT) {
			return false;
		}

		Optional<Payment> open = payments.findFirstByOrderIdAndMethodAndKindAndStatus(id, PaymentMethod.RAZORPAY,
				PaymentKind.COLLECTION, PaymentStatus.PENDING);

		if (open.isPresent() && gateway.isConfigured()) {
			// a failure here throws: we do not cancel when we cannot be sure
			Optional<RazorpayGateway.CapturedPayment> paid = gateway.findCapturedPayment(open.get().getReference());
			if (paid.isPresent()) {
				online.handleCaptured(open.get().getReference(), paid.get().id(), paid.get().amountPaise());
				log.info("Order {} was already paid; applied payment instead of expiring", id);
				return false;
			}
		}

		String phone = users.findById(o.getCustomerId()).orElseThrow().getPhone();
		flow.expireLocked(o, phone);
		log.info("Order {} expired (unpaid)", id);
		return true;
	}
}