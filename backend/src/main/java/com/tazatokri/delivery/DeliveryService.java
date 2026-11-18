package com.tazatokri.delivery;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.tazatokri.common.BadRequestException;
import com.tazatokri.common.InvalidOrderStateException;
import com.tazatokri.common.ResourceNotFoundException;
import com.tazatokri.order.CustomerOrder;
import com.tazatokri.order.CustomerOrderRepository;
import com.tazatokri.order.OrderStatus;
import com.tazatokri.payment.CollectionRequest;
import com.tazatokri.payment.PaymentRepository;
import com.tazatokri.payment.PaymentService;
import com.tazatokri.user.Role;
import com.tazatokri.user.User;
import com.tazatokri.user.UserRepository;

@Service
public class DeliveryService {

	private static final List<DeliveryStatus> ACTIVE = List.of(DeliveryStatus.ASSIGNED,
			DeliveryStatus.OUT_FOR_DELIVERY);

	private final DeliveryAttemptRepository attempts;
	private final CustomerOrderRepository orders;
	private final UserRepository users;
	private final PaymentService paymentService;
	private final PaymentRepository paymentRepo;

	public DeliveryService(DeliveryAttemptRepository attempts, CustomerOrderRepository orders, UserRepository users,
			PaymentService paymentService, PaymentRepository paymentRepo) {
		this.attempts = attempts;
		this.orders = orders;
		this.users = users;
		this.paymentService = paymentService;
		this.paymentRepo = paymentRepo;
	}

	// ---------- staff side ----------

	@Transactional(readOnly = true)
	public List<DeliveryPersonResponse> people() {
		return users.findActiveByRole(Role.DELIVERY).stream()
				.map(u -> new DeliveryPersonResponse(u.getId(), u.getFullName(), u.getPhone())).toList();
	}

	@Transactional
	public AttemptResponse assign(Long orderId, Long deliveryUserId, String actorPhone) {
		Long actorId = userId(actorPhone);
		CustomerOrder o = lock(orderId);
		requireStatus(o, OrderStatus.PACKED);

		users.findById(deliveryUserId).filter(User::isActive).filter(u -> u.getRoles().contains(Role.DELIVERY))
				.orElseThrow(() -> new BadRequestException("Not an active delivery person"));

		// close the previous assignment during reassignment
		LocalDateTime now = LocalDateTime.now();
		attempts.findFirstByOrderIdAndStatusIn(orderId, List.of(DeliveryStatus.ASSIGNED)).ifPresent(old -> {
			old.setStatus(DeliveryStatus.UNASSIGNED);
			old.setFinishedAt(now);
		});

		DeliveryAttempt a = new DeliveryAttempt();
		a.setOrderId(orderId);
		a.setDeliveryUserId(deliveryUserId);
		a.setAssignedBy(actorId);
		return AttemptResponse.from(attempts.save(a));
	}

	@Transactional(readOnly = true)
	public List<AttemptResponse> history(Long orderId) {
		return attempts.findByOrderIdOrderByIdAsc(orderId).stream().map(AttemptResponse::from).toList();
	}

	// ---------- delivery person side ----------

	@Transactional(readOnly = true)
	public List<DeliveryOrderResponse> myOrders(String phone) {
		Long me = userId(phone);
		List<DeliveryAttempt> mine = attempts.findByDeliveryUserIdAndStatusInOrderByIdAsc(me, ACTIVE);
		if (mine.isEmpty()) {
			return List.of();
		}

		Map<Long, DeliveryAttempt> byOrder = mine.stream()
				.collect(Collectors.toMap(DeliveryAttempt::getOrderId, Function.identity(), (first, second) -> second));

		List<CustomerOrder> list = orders.findWithDetailsByIdIn(byOrder.keySet());

		Map<Long, User> customers = users
				.findAllById(list.stream().map(CustomerOrder::getCustomerId).distinct().toList()).stream()
				.collect(Collectors.toMap(User::getId, Function.identity()));

		// payment totals for all assigned orders in one query
		Map<Long, BigDecimal> paid = new HashMap<>();
		paymentRepo.netPaidByOrder(byOrder.keySet()).forEach(x -> paid.put(x.getOrderId(), x.getAmount()));

		// hide cancelled orders and stale assignments
		return list.stream()
				.filter(o -> o.getStatus() == OrderStatus.PACKED || o.getStatus() == OrderStatus.OUT_FOR_DELIVERY)
				.map(o -> {
					BigDecimal due = o.getFinalTotal() == null ? BigDecimal.ZERO
							: o.getFinalTotal().subtract(paid.getOrDefault(o.getId(), BigDecimal.ZERO))
									.max(BigDecimal.ZERO);
					return DeliveryOrderResponse.from(o, byOrder.get(o.getId()), customers.get(o.getCustomerId()), due);
				}).toList();
	}

	@Transactional
	public AttemptResponse start(Long orderId, String phone) {
		Long me = userId(phone);
		CustomerOrder o = lock(orderId);
		DeliveryAttempt a = myActive(orderId, me);
		requireStatus(o, OrderStatus.PACKED);
		requireAttempt(a, DeliveryStatus.ASSIGNED);

		a.setStatus(DeliveryStatus.OUT_FOR_DELIVERY);
		a.setStartedAt(LocalDateTime.now());
		o.setStatus(OrderStatus.OUT_FOR_DELIVERY);
		return AttemptResponse.from(a);
	}

	// collect payment before marking the order as delivered
	@Transactional
	public AttemptResponse deliver(Long orderId, CollectionRequest req, String phone) {
		Long me = userId(phone);
		CustomerOrder o = lock(orderId);
		DeliveryAttempt a = myActive(orderId, me);
		requireStatus(o, OrderStatus.OUT_FOR_DELIVERY);
		requireAttempt(a, DeliveryStatus.OUT_FOR_DELIVERY);

		// any failure here rolls back the whole delivery
		paymentService.collectOnDelivery(o, me, req);

		a.setStatus(DeliveryStatus.DELIVERED);
		a.setFinishedAt(LocalDateTime.now());
		o.setStatus(OrderStatus.DELIVERED);
		return AttemptResponse.from(a);
	}

	@Transactional
	public AttemptResponse fail(Long orderId, String reason, String phone) {
		Long me = userId(phone);
		CustomerOrder o = lock(orderId);
		DeliveryAttempt a = myActive(orderId, me);
		requireStatus(o, OrderStatus.OUT_FOR_DELIVERY);
		requireAttempt(a, DeliveryStatus.OUT_FOR_DELIVERY);

		if (reason == null || reason.isBlank()) {
			throw new BadRequestException("Failure reason is required");
		}

		a.setStatus(DeliveryStatus.FAILED);
		a.setFinishedAt(LocalDateTime.now());
		a.setFailureReason(reason.trim());
		o.setStatus(OrderStatus.PACKED); // back to packed; stock is untouched
		return AttemptResponse.from(a);
	}

	// ---------- helpers ----------

	private CustomerOrder lock(Long id) {
		return orders.findByIdForUpdate(id).orElseThrow(() -> new ResourceNotFoundException("Order not found: " + id));
	}

	private DeliveryAttempt myActive(Long orderId, Long myId) {
		return attempts.findFirstByOrderIdAndStatusIn(orderId, ACTIVE).filter(a -> a.getDeliveryUserId().equals(myId))
				.orElseThrow(() -> new ResourceNotFoundException("Order not found: " + orderId));
	}

	private void requireStatus(CustomerOrder o, OrderStatus expected) {
		if (o.getStatus() != expected) {
			throw new InvalidOrderStateException("Order is " + o.getStatus() + ", expected " + expected);
		}
	}

	private void requireAttempt(DeliveryAttempt a, DeliveryStatus expected) {
		if (a.getStatus() != expected) {
			throw new InvalidOrderStateException("Delivery is " + a.getStatus() + ", expected " + expected);
		}
	}

	private Long userId(String phone) {
		return users.findByPhone(phone).orElseThrow(() -> new BadRequestException("Unknown user")).getId();
	}
}