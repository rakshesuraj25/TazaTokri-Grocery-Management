package com.tazatokri.delivery;

import java.math.BigDecimal;
import java.security.SecureRandom;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.function.BiConsumer;
import java.util.function.Function;
import java.util.stream.Collectors;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.tazatokri.common.BadRequestException;
import com.tazatokri.common.InvalidOrderStateException;
import com.tazatokri.common.ResourceNotFoundException;
import com.tazatokri.delivery.DeliveryDtos.DeliveryAuditLogResponse;
import com.tazatokri.delivery.DeliveryDtos.DeliveryEvidenceResponse;
import com.tazatokri.delivery.DeliveryDtos.GroupBucket;
import com.tazatokri.delivery.DeliveryDtos.OtpIssueResponse;
import com.tazatokri.delivery.DeliveryDtos.OtpVerifyResponse;
import com.tazatokri.delivery.DeliveryDtos.StaffDeliveryBoardResponse;
import com.tazatokri.delivery.DeliveryDtos.StaffDeliveryOrderItem;
import com.tazatokri.loyalty.LoyaltyService;
import com.tazatokri.notification.WhatsAppCloudApiProvider;
import com.tazatokri.order.CustomerOrder;
import com.tazatokri.order.CustomerOrderRepository;
import com.tazatokri.order.OrderPaymentMethod;
import com.tazatokri.order.OrderStatus;
import com.tazatokri.payment.CollectionRequest;
import com.tazatokri.payment.PaymentRepository;
import com.tazatokri.payment.PaymentService;
import com.tazatokri.user.Role;
import com.tazatokri.user.User;
import com.tazatokri.user.UserRepository;

@Service
public class DeliveryService {

	private static final ZoneId IST = ZoneId.of("Asia/Kolkata");
	private static final List<DeliveryStatus> ACTIVE = List.of(
			DeliveryStatus.ASSIGNED,
			DeliveryStatus.OUT_FOR_DELIVERY);
	private static final SecureRandom SECURE_RANDOM = new SecureRandom();

	private final DeliveryAttemptRepository attempts;
	private final CustomerOrderRepository orders;
	private final UserRepository users;
	private final PaymentService paymentService;
	private final PaymentRepository paymentRepo;
	private final DeliveryOtpRepository otpRepo;
	private final DeliveryEvidenceRepository evidenceRepo;
	private final DeliveryAuditLogRepository auditRepo;
	private final ProofStorageProvider storageProvider;
	private final PasswordEncoder passwordEncoder;
	private final WhatsAppCloudApiProvider whatsappProvider;
	private final int otpTtlMinutes;
	private final int otpMaxAttempts;
	private final boolean requirePodPhoto;

	@Autowired(required = false)
	private LoyaltyService loyaltyService;

	public void setLoyaltyService(LoyaltyService loyaltyService) {
		this.loyaltyService = loyaltyService;
	}

	/**
	 * Package-private listener used strictly by isolated JUnit tests to inspect generated OTP codes
	 * without ever exposing plaintext OTPs in HTTP responses or logs.
	 */
	private BiConsumer<Long, String> testOtpCaptureListener;

	public DeliveryService(
			DeliveryAttemptRepository attempts,
			CustomerOrderRepository orders,
			UserRepository users,
			PaymentService paymentService,
			PaymentRepository paymentRepo) {
		this(attempts, orders, users, paymentService, paymentRepo,
				null, null, null, null, null, null, 30, 5, false);
	}

	@Autowired
	public DeliveryService(
			DeliveryAttemptRepository attempts,
			CustomerOrderRepository orders,
			UserRepository users,
			PaymentService paymentService,
			PaymentRepository paymentRepo,
			DeliveryOtpRepository otpRepo,
			DeliveryEvidenceRepository evidenceRepo,
			DeliveryAuditLogRepository auditRepo,
			ProofStorageProvider storageProvider,
			PasswordEncoder passwordEncoder,
			WhatsAppCloudApiProvider whatsappProvider,
			@Value("${app.delivery.otp.ttl-minutes:30}") int otpTtlMinutes,
			@Value("${app.delivery.otp.max-attempts:5}") int otpMaxAttempts,
			@Value("${app.delivery.pod.require-photo:false}") boolean requirePodPhoto) {
		this.attempts = attempts;
		this.orders = orders;
		this.users = users;
		this.paymentService = paymentService;
		this.paymentRepo = paymentRepo;
		this.otpRepo = otpRepo;
		this.evidenceRepo = evidenceRepo;
		this.auditRepo = auditRepo;
		this.storageProvider = storageProvider;
		this.passwordEncoder = passwordEncoder;
		this.whatsappProvider = whatsappProvider;
		this.otpTtlMinutes = otpTtlMinutes > 0 ? otpTtlMinutes : 30;
		this.otpMaxAttempts = otpMaxAttempts > 0 ? otpMaxAttempts : 5;
		this.requirePodPhoto = requirePodPhoto;
	}

	public void setTestOtpCaptureListener(BiConsumer<Long, String> listener) {
		this.testOtpCaptureListener = listener;
	}

	// ---------- staff side ----------

	@Transactional(readOnly = true)
	public List<DeliveryPersonResponse> people() {
		return users.findActiveByRole(Role.DELIVERY).stream()
				.map(u -> new DeliveryPersonResponse(u.getId(), u.getFullName(), u.getPhone()))
				.toList();
	}

	@Transactional(readOnly = true)
	public StaffDeliveryBoardResponse staffBoard(
			LocalDate date,
			String stageFilter,
			String pincodeFilter,
			Long deliveryUserIdFilter) {

		LocalDate targetDate = (date == null) ? LocalDate.now(IST) : date;
		List<CustomerOrder> dateOrders = orders.findByDeliveryDateOrderByIdDesc(targetDate);
		if (dateOrders.isEmpty()) {
			return new StaffDeliveryBoardResponse(
					targetDate, 0, 0, 0, 0, 0, 0,
					List.of(), List.of(), List.of(), List.of());
		}

		List<Long> orderIds = dateOrders.stream().map(CustomerOrder::getId).toList();

		Map<Long, DeliveryAttempt> latestAttemptByOrder = new HashMap<>();
		for (DeliveryAttempt a : attempts.findByOrderIdInOrderByIdAsc(orderIds)) {
			latestAttemptByOrder.put(a.getOrderId(), a);
		}

		List<Long> userIdsToLoad = new ArrayList<>();
		for (CustomerOrder o : dateOrders) {
			userIdsToLoad.add(o.getCustomerId());
		}
		for (DeliveryAttempt a : latestAttemptByOrder.values()) {
			userIdsToLoad.add(a.getDeliveryUserId());
		}
		Map<Long, User> usersById = users.findAllById(userIdsToLoad.stream().distinct().toList()).stream()
				.collect(Collectors.toMap(User::getId, Function.identity()));

		Map<Long, BigDecimal> paidByOrder = new HashMap<>();
		paymentRepo.netPaidByOrder(orderIds).forEach(x -> paidByOrder.put(x.getOrderId(), x.getAmount()));

		Map<Long, Long> latestEvidenceIdByOrder = new HashMap<>();
		if (evidenceRepo != null) {
			for (DeliveryEvidence ev : evidenceRepo.findByOrderIdInOrderByIdDesc(orderIds)) {
				latestEvidenceIdByOrder.putIfAbsent(ev.getOrderId(), ev.getId());
			}
		}

		int readyCount = 0;
		int assignedCount = 0;
		int outCount = 0;
		int deliveredCount = 0;
		int failedCount = 0;
		int cancelledCount = 0;

		Map<String, Integer> pincodeCounts = new LinkedHashMap<>();
		Map<String, Integer> localityCounts = new LinkedHashMap<>();
		Map<String, Integer> assigneeCounts = new LinkedHashMap<>();
		Map<String, String> assigneeLabels = new LinkedHashMap<>();

		List<StaffDeliveryOrderItem> items = new ArrayList<>();

		for (CustomerOrder o : dateOrders) {
			DeliveryAttempt attempt = latestAttemptByOrder.get(o.getId());
			User customer = usersById.get(o.getCustomerId());
			User deliveryPerson = attempt != null ? usersById.get(attempt.getDeliveryUserId()) : null;

			String stage = resolveDeliveryStage(o, attempt);
			switch (stage) {
				case "READY_FOR_DELIVERY" -> readyCount++;
				case "ASSIGNED" -> assignedCount++;
				case "OUT_FOR_DELIVERY" -> outCount++;
				case "DELIVERED" -> deliveredCount++;
				case "FAILED", "RETURNED_TO_STORE" -> failedCount++;
				case "CANCELLED" -> cancelledCount++;
				default -> {
				}
			}

			BigDecimal orderAmt = o.getFinalTotal() != null ? o.getFinalTotal() : o.getEstimatedTotal();
			if (orderAmt == null) orderAmt = BigDecimal.ZERO;
			BigDecimal netPaid = paidByOrder.getOrDefault(o.getId(), BigDecimal.ZERO);
			BigDecimal due = o.getFinalTotal() == null
					? (o.getPaymentMethod() == OrderPaymentMethod.COD ? orderAmt : BigDecimal.ZERO)
					: o.getFinalTotal().subtract(netPaid).max(BigDecimal.ZERO);
			String paymentStatus = (o.getStatus() == OrderStatus.DELIVERED
					|| o.getPaymentMethod() == OrderPaymentMethod.ONLINE
					|| due.signum() == 0)
					? "PAID"
					: "COD_DUE";

			String locality = extractLocality(o.getDeliveryAddress(), o.getDeliveryPincode());

			if (!"CANCELLED".equals(stage)) {
				pincodeCounts.merge(o.getDeliveryPincode(), 1, Integer::sum);
				localityCounts.merge(locality, 1, Integer::sum);
				String assigneeKey = deliveryPerson != null ? String.valueOf(deliveryPerson.getId()) : "UNASSIGNED";
				String assigneeLabel = deliveryPerson != null ? deliveryPerson.getFullName() : "Unassigned";
				assigneeCounts.merge(assigneeKey, 1, Integer::sum);
				assigneeLabels.put(assigneeKey, assigneeLabel);
			}

			if (stageFilter != null && !stageFilter.isBlank() && !"ALL".equalsIgnoreCase(stageFilter)) {
				if (!stage.equalsIgnoreCase(stageFilter.trim())) {
					continue;
				}
			}
			if (pincodeFilter != null && !pincodeFilter.isBlank()) {
				if (!o.getDeliveryPincode().equals(pincodeFilter.trim())) {
					continue;
				}
			}
			if (deliveryUserIdFilter != null) {
				if (attempt == null || !attempt.getDeliveryUserId().equals(deliveryUserIdFilter)) {
					continue;
				}
			}

			Long evidenceId = latestEvidenceIdByOrder.get(o.getId());
			items.add(new StaffDeliveryOrderItem(
					o.getId(),
					o.getStatus(),
					stage,
					attempt != null ? attempt.getStatus() : null,
					attempt != null ? attempt.getId() : null,
					o.getDeliveryDate(),
					customer != null ? customer.getFullName() : "Customer #" + o.getCustomerId(),
					customer != null ? customer.getPhone() : "",
					o.getDeliveryAddress(),
					o.getDeliveryPincode(),
					locality,
					o.getDeliveryInstructions(),
					orderAmt,
					o.getPaymentMethod(),
					paymentStatus,
					due,
					deliveryPerson != null ? deliveryPerson.getId() : (attempt != null ? attempt.getDeliveryUserId() : null),
					deliveryPerson != null ? deliveryPerson.getFullName() : null,
					deliveryPerson != null ? deliveryPerson.getPhone() : null,
					attempt != null && attempt.isOtpVerified(),
					attempt != null ? attempt.getOtpVerificationMethod() : null,
					evidenceId != null,
					evidenceId,
					attempt != null ? attempt.getFailureReason() : o.getCancelReason()));
		}

		List<GroupBucket> byPincode = pincodeCounts.entrySet().stream()
				.map(e -> new GroupBucket(e.getKey(), "PIN " + e.getKey(), e.getValue()))
				.toList();
		List<GroupBucket> byLocality = localityCounts.entrySet().stream()
				.map(e -> new GroupBucket(e.getKey(), e.getKey(), e.getValue()))
				.toList();
		List<GroupBucket> byAssignee = assigneeCounts.entrySet().stream()
				.map(e -> new GroupBucket(e.getKey(), assigneeLabels.getOrDefault(e.getKey(), e.getKey()), e.getValue()))
				.toList();

		return new StaffDeliveryBoardResponse(
				targetDate,
				readyCount,
				assignedCount,
				outCount,
				deliveredCount,
				failedCount,
				cancelledCount,
				byPincode,
				byLocality,
				byAssignee,
				items);
	}

	@Transactional
	public AttemptResponse assign(Long orderId, Long deliveryUserId, String actorPhone) {
		User actor = findUser(actorPhone);
		CustomerOrder o = lock(orderId);
		if (o.getStatus() != OrderStatus.PACKED && o.getStatus() != OrderStatus.OUT_FOR_DELIVERY) {
			throw new InvalidOrderStateException(
					"Order is " + o.getStatus() + ", expected PACKED or OUT_FOR_DELIVERY for assignment");
		}

		User targetDeliveryUser = users.findById(deliveryUserId)
				.filter(User::isActive)
				.filter(u -> u.getRoles().contains(Role.DELIVERY))
				.orElseThrow(() -> new BadRequestException("Not an active delivery person"));

		LocalDateTime now = LocalDateTime.now();
		boolean wasReassigned = false;

		var previousActive = attempts.findFirstByOrderIdAndStatusIn(orderId, ACTIVE);
		if (previousActive.isPresent()) {
			DeliveryAttempt old = previousActive.get();
			old.setStatus(DeliveryStatus.UNASSIGNED);
			old.setFinishedAt(now);
			wasReassigned = true;
		}
		if (o.getStatus() == OrderStatus.OUT_FOR_DELIVERY) {
			o.setStatus(OrderStatus.PACKED);
		}
		invalidateActiveOtps(orderId);

		DeliveryAttempt a = new DeliveryAttempt();
		a.setOrderId(orderId);
		a.setDeliveryUserId(targetDeliveryUser.getId());
		a.setAssignedBy(actor.getId());
		DeliveryAttempt saved = attempts.save(a);

		recordAudit(
				orderId,
				saved.getId(),
				wasReassigned ? "REASSIGNED" : "ASSIGNED",
				wasReassigned ? "ASSIGNED" : "READY_FOR_DELIVERY",
				DeliveryStatus.ASSIGNED.name(),
				actor,
				(wasReassigned ? "Reassigned to " : "Assigned to ") + targetDeliveryUser.getFullName());

		return AttemptResponse.from(saved);
	}

	@Transactional
	public AttemptResponse unassign(Long orderId, String note, String actorPhone) {
		User actor = findUser(actorPhone);
		CustomerOrder o = lock(orderId);
		DeliveryAttempt active = attempts.findFirstByOrderIdAndStatusIn(orderId, ACTIVE)
				.orElseThrow(() -> new InvalidOrderStateException(
						"No active delivery assignment found for order #" + orderId));

		LocalDateTime now = LocalDateTime.now();
		String prevStatus = active.getStatus().name();
		active.setStatus(DeliveryStatus.UNASSIGNED);
		active.setFinishedAt(now);
		if (note != null && !note.isBlank()) {
			active.setDeliveryNote(note.trim());
		}
		DeliveryAttempt saved = attempts.save(active);

		if (o.getStatus() == OrderStatus.OUT_FOR_DELIVERY) {
			o.setStatus(OrderStatus.PACKED);
		}
		invalidateActiveOtps(orderId);

		recordAudit(
				orderId,
				saved.getId(),
				"UNASSIGNED",
				prevStatus,
				DeliveryStatus.UNASSIGNED.name(),
				actor,
				(note != null && !note.isBlank()) ? note.trim() : "Delivery unassigned by staff");

		return AttemptResponse.from(saved);
	}

	@Transactional
	public AttemptResponse returnToStore(Long orderId, String note, String actorPhone) {
		User actor = findUser(actorPhone);
		CustomerOrder o = lock(orderId);
		DeliveryAttempt latest = attempts.findFirstByOrderIdOrderByIdDesc(orderId)
				.orElseThrow(() -> new ResourceNotFoundException("No delivery attempt found for order: " + orderId));
		if (latest.getStatus() != DeliveryStatus.FAILED) {
			throw new InvalidOrderStateException(
					"Only a FAILED delivery attempt can be marked RETURNED_TO_STORE (current: " + latest.getStatus() + ")");
		}
		latest.setStatus(DeliveryStatus.RETURNED_TO_STORE);
		String cleanNote = (note == null || note.isBlank()) ? "Package returned to store" : note.trim();
		latest.setDeliveryNote(cleanNote);
		DeliveryAttempt saved = attempts.save(latest);

		recordAudit(
				orderId,
				saved.getId(),
				"RETURNED_TO_STORE",
				DeliveryStatus.FAILED.name(),
				DeliveryStatus.RETURNED_TO_STORE.name(),
				actor,
				cleanNote);

		return AttemptResponse.from(saved);
	}

	@Transactional(readOnly = true)
	public List<AttemptResponse> history(Long orderId) {
		return attempts.findByOrderIdOrderByIdAsc(orderId).stream().map(AttemptResponse::from).toList();
	}

	@Transactional(readOnly = true)
	public List<DeliveryAuditLogResponse> auditTrail(Long orderId) {
		if (auditRepo == null) {
			return List.of();
		}
		return auditRepo.findByOrderIdOrderByCreatedAtAscIdAsc(orderId).stream()
				.map(DeliveryAuditLogResponse::from)
				.toList();
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

		Map<Long, BigDecimal> paid = new HashMap<>();
		paymentRepo.netPaidByOrder(byOrder.keySet()).forEach(x -> paid.put(x.getOrderId(), x.getAmount()));

		Map<Long, Long> latestEvidenceIdByOrder = new HashMap<>();
		if (evidenceRepo != null) {
			for (DeliveryEvidence ev : evidenceRepo.findByOrderIdInOrderByIdDesc(byOrder.keySet())) {
				latestEvidenceIdByOrder.putIfAbsent(ev.getOrderId(), ev.getId());
			}
		}

		return list.stream()
				.filter(o -> o.getStatus() == OrderStatus.PACKED || o.getStatus() == OrderStatus.OUT_FOR_DELIVERY)
				.map(o -> {
					BigDecimal due = o.getFinalTotal() == null ? BigDecimal.ZERO
							: o.getFinalTotal().subtract(paid.getOrDefault(o.getId(), BigDecimal.ZERO))
									.max(BigDecimal.ZERO);
					Long evId = latestEvidenceIdByOrder.get(o.getId());
					return DeliveryOrderResponse.from(
							o,
							byOrder.get(o.getId()),
							customers.get(o.getCustomerId()),
							due,
							evId != null,
							evId);
				}).toList();
	}

	@Transactional
	public AttemptResponse start(Long orderId, String phone) {
		User actor = findUser(phone);
		CustomerOrder o = lock(orderId);
		DeliveryAttempt a = myActive(orderId, actor.getId());
		requireStatus(o, OrderStatus.PACKED);
		requireAttempt(a, DeliveryStatus.ASSIGNED);

		a.setStatus(DeliveryStatus.OUT_FOR_DELIVERY);
		a.setStartedAt(LocalDateTime.now());
		o.setStatus(OrderStatus.OUT_FOR_DELIVERY);

		recordAudit(
				orderId,
				a.getId(),
				"STARTED",
				DeliveryStatus.ASSIGNED.name(),
				DeliveryStatus.OUT_FOR_DELIVERY.name(),
				actor,
				"Delivery started by " + actor.getFullName());

		return AttemptResponse.from(a);
	}

	// ---------- Task 2: Delivery OTP Generation, Verification & Manual Override ----------

	@Transactional
	public OtpIssueResponse issueOtp(Long orderId, String actorPhone) {
		if (otpRepo == null || passwordEncoder == null) {
			throw new BadRequestException("OTP service is not configured");
		}
		User actor = findUser(actorPhone);
		CustomerOrder o = lock(orderId);
		if (o.getStatus() == OrderStatus.CANCELLED) {
			throw new InvalidOrderStateException("Cannot issue OTP for a CANCELLED order");
		}
		if (o.getStatus() == OrderStatus.DELIVERED) {
			throw new InvalidOrderStateException("Order is already DELIVERED");
		}

		DeliveryAttempt a = authorizeDeliveryAttemptAccess(orderId, actor);
		if (a.getStatus() != DeliveryStatus.OUT_FOR_DELIVERY && a.getStatus() != DeliveryStatus.ASSIGNED) {
			throw new InvalidOrderStateException("Delivery attempt is not active");
		}
		if (a.isOtpVerified()) {
			throw new BadRequestException("Delivery OTP is already verified for order #" + orderId);
		}

		invalidateActiveOtps(orderId);

		int codeInt = 100000 + SECURE_RANDOM.nextInt(900000);
		String rawOtp = String.valueOf(codeInt);
		String otpHash = passwordEncoder.encode(rawOtp);
		LocalDateTime expiresAt = LocalDateTime.now().plusMinutes(otpTtlMinutes);

		User customer = users.findById(o.getCustomerId()).orElse(null);
		String customerPhone = customer != null ? customer.getPhone() : "";
		String deliveryChannel = "CUSTOMER_FALLBACK";

		if (whatsappProvider != null && whatsappProvider.isConfiguredAndEnabled() && !customerPhone.isBlank()) {
			String msg = "TazaTokri Delivery OTP for Order #" + orderId + ": " + rawOtp
					+ ". Valid for " + otpTtlMinutes + " minutes. Share this code only at your doorstep.";
			var sendResult = whatsappProvider.sendTemplateOrText(customerPhone, msg);
			if (sendResult.status().name().equals("SENT")) {
				deliveryChannel = "WHATSAPP_CLOUD";
			}
		}

		DeliveryOtp entity = new DeliveryOtp();
		entity.setOrderId(orderId);
		entity.setDeliveryAttemptId(a.getId());
		entity.setOtpHash(otpHash);
		entity.setExpiresAt(expiresAt);
		entity.setFailedAttempts(0);
		entity.setMaxAttempts(otpMaxAttempts);
		entity.setStatus("ACTIVE");
		entity.setDeliveryChannel(deliveryChannel);
		entity.setIssuedBy(actor.getId());
		otpRepo.save(entity);

		if (testOtpCaptureListener != null) {
			testOtpCaptureListener.accept(orderId, rawOtp);
		}

		recordAudit(
				orderId,
				a.getId(),
				"OTP_ISSUED",
				a.getStatus().name(),
				a.getStatus().name(),
				actor,
				"6-digit OTP issued via " + deliveryChannel + " (expires at " + expiresAt + ")");

		String maskedPhone = maskPhone(customerPhone);
		String userMessage = "WHATSAPP_CLOUD".equals(deliveryChannel)
				? "6-digit OTP sent to customer's WhatsApp (" + maskedPhone + ")."
				: "6-digit OTP generated for order #" + orderId + " (" + maskedPhone
						+ "). Ask the customer for their code or use an authorized manual exception if customer has no network.";

		return new OtpIssueResponse(
				orderId,
				a.getId(),
				expiresAt,
				otpMaxAttempts,
				deliveryChannel,
				maskedPhone,
				userMessage);
	}

	@Transactional(noRollbackFor = BadRequestException.class)
	public OtpVerifyResponse verifyOtp(Long orderId, String otpCode, String actorPhone) {
		if (otpRepo == null || passwordEncoder == null) {
			throw new BadRequestException("OTP service is not configured");
		}
		User actor = findUser(actorPhone);
		CustomerOrder o = lock(orderId);
		if (o.getStatus() == OrderStatus.CANCELLED) {
			throw new InvalidOrderStateException("Cannot verify OTP for a CANCELLED order");
		}
		if (o.getStatus() == OrderStatus.DELIVERED) {
			throw new InvalidOrderStateException("Order is already DELIVERED");
		}

		DeliveryAttempt a = authorizeDeliveryAttemptAccess(orderId, actor);
		if (a.isOtpVerified()) {
			throw new BadRequestException("Delivery is already verified for order #" + orderId);
		}

		DeliveryOtp otp = otpRepo.findFirstByOrderIdAndStatusOrderByIdDesc(orderId, "ACTIVE")
				.orElseThrow(() -> new BadRequestException(
						"No active OTP found for order #" + orderId + ". Please issue a new OTP."));

		LocalDateTime now = LocalDateTime.now();
		if (now.isAfter(otp.getExpiresAt())) {
			otp.setStatus("EXPIRED");
			otpRepo.save(otp);
			recordAudit(orderId, a.getId(), "OTP_FAILED", a.getStatus().name(), a.getStatus().name(), actor, "OTP expired");
			throw new BadRequestException("Delivery OTP has expired. Please issue a new OTP.");
		}

		if (otp.getFailedAttempts() >= otp.getMaxAttempts()) {
			otp.setStatus("LOCKED");
			otpRepo.save(otp);
			throw new BadRequestException("Maximum OTP verification attempts exceeded. Please issue a new OTP.");
		}

		String cleanedCode = otpCode == null ? "" : otpCode.trim();
		if (!passwordEncoder.matches(cleanedCode, otp.getOtpHash())) {
			int nextFailed = otp.getFailedAttempts() + 1;
			otp.setFailedAttempts(nextFailed);
			int remaining = Math.max(0, otp.getMaxAttempts() - nextFailed);
			if (nextFailed >= otp.getMaxAttempts()) {
				otp.setStatus("LOCKED");
			}
			otpRepo.save(otp);
			recordAudit(
					orderId,
					a.getId(),
					"OTP_FAILED",
					a.getStatus().name(),
					a.getStatus().name(),
					actor,
					"Incorrect OTP attempt (" + nextFailed + "/" + otp.getMaxAttempts() + ")");
			if (remaining == 0) {
				throw new BadRequestException(
						"Incorrect OTP. Maximum attempts (" + otp.getMaxAttempts() + ") reached; OTP is now locked. Issue a new OTP.");
			}
			throw new BadRequestException(
					"Incorrect delivery OTP. " + remaining + " attempt(s) remaining.");
		}

		otp.setStatus("VERIFIED");
		otp.setVerifiedBy(actor.getId());
		otp.setVerifiedAt(now);
		otpRepo.save(otp);

		a.setOtpVerified(true);
		a.setOtpVerifiedAt(now);
		a.setOtpVerifiedBy(actor.getId());
		a.setOtpVerificationMethod("OTP");
		attempts.save(a);

		recordAudit(
				orderId,
				a.getId(),
				"OTP_VERIFIED",
				a.getStatus().name(),
				a.getStatus().name(),
				actor,
				"Customer OTP verified successfully");

		return new OtpVerifyResponse(
				true,
				now,
				"OTP",
				otp.getMaxAttempts() - otp.getFailedAttempts(),
				"Delivery OTP verified successfully.");
	}

	@Transactional
	public OtpVerifyResponse manualOtpOverride(Long orderId, String reason, String actorPhone) {
		User actor = findUser(actorPhone);
		CustomerOrder o = lock(orderId);
		if (o.getStatus() == OrderStatus.CANCELLED) {
			throw new InvalidOrderStateException("Cannot override OTP for a CANCELLED order");
		}
		if (o.getStatus() == OrderStatus.DELIVERED) {
			throw new InvalidOrderStateException("Order is already DELIVERED");
		}
		if (reason == null || reason.trim().length() < 10) {
			throw new BadRequestException("A detailed override reason (at least 10 characters) is required for audit.");
		}

		DeliveryAttempt a = authorizeDeliveryAttemptAccess(orderId, actor);
		if (a.isOtpVerified()) {
			throw new BadRequestException("Delivery is already verified for order #" + orderId);
		}

		invalidateActiveOtps(orderId);

		LocalDateTime now = LocalDateTime.now();
		String cleanReason = reason.trim();
		if (cleanReason.length() > 255) {
			cleanReason = cleanReason.substring(0, 255);
		}

		a.setOtpVerified(true);
		a.setOtpVerifiedAt(now);
		a.setOtpVerifiedBy(actor.getId());
		a.setOtpVerificationMethod("MANUAL_OVERRIDE");
		a.setOtpOverrideReason(cleanReason);
		attempts.save(a);

		recordAudit(
				orderId,
				a.getId(),
				"OTP_MANUAL_OVERRIDE",
				a.getStatus().name(),
				a.getStatus().name(),
				actor,
				"Manual verification exception: " + cleanReason);

		return new OtpVerifyResponse(
				true,
				now,
				"MANUAL_OVERRIDE",
				0,
				"Manual delivery verification recorded with audit trail.");
	}

	// ---------- Task 3: Proof of Delivery Photo Upload & Controlled Access ----------

	@Transactional
	public DeliveryEvidenceResponse uploadProofPhoto(
			Long orderId,
			byte[] fileBytes,
			String originalFilename,
			String deliveryNote,
			String actorPhone) {
		if (evidenceRepo == null || storageProvider == null) {
			throw new BadRequestException("Proof of delivery storage is not configured");
		}
		User actor = findUser(actorPhone);
		CustomerOrder o = lock(orderId);
		if (o.getStatus() == OrderStatus.CANCELLED) {
			throw new InvalidOrderStateException("Cannot upload proof of delivery for a CANCELLED order");
		}

		DeliveryAttempt a = authorizeDeliveryAttemptAccess(orderId, actor);
		ProofStorageProvider.StoredProofFile stored = storageProvider.storeProofImage(fileBytes);

		String cleanNote = (deliveryNote == null || deliveryNote.isBlank()) ? null : deliveryNote.trim();
		if (cleanNote != null && cleanNote.length() > 255) {
			cleanNote = cleanNote.substring(0, 255);
		}
		if (cleanNote != null) {
			a.setDeliveryNote(cleanNote);
			attempts.save(a);
		}

		String safeOriginal = null;
		if (originalFilename != null && !originalFilename.isBlank()) {
			safeOriginal = originalFilename.replaceAll("[^a-zA-Z0-9._\\-]", "_");
			if (safeOriginal.length() > 120) {
				safeOriginal = safeOriginal.substring(0, 120);
			}
		}

		DeliveryEvidence ev = new DeliveryEvidence();
		ev.setOrderId(orderId);
		ev.setDeliveryAttemptId(a.getId());
		ev.setStorageProvider(stored.storageProvider());
		ev.setStorageKey(stored.storageKey());
		ev.setOriginalFilename(safeOriginal);
		ev.setMimeType(stored.detectedMimeType());
		ev.setFileSizeBytes(stored.fileSizeBytes());
		ev.setSha256Checksum(stored.sha256Checksum());
		ev.setUploadedBy(actor.getId());
		ev.setVerificationMethod(a.getOtpVerificationMethod());
		ev.setDeliveryNote(cleanNote);
		DeliveryEvidence saved = evidenceRepo.save(ev);

		recordAudit(
				orderId,
				a.getId(),
				"POD_UPLOADED",
				a.getStatus().name(),
				a.getStatus().name(),
				actor,
				"Proof of delivery photo uploaded (" + stored.detectedMimeType() + ", " + stored.fileSizeBytes() + " bytes)");

		return DeliveryEvidenceResponse.from(saved);
	}

	@Transactional(readOnly = true)
	public List<DeliveryEvidenceResponse> listEvidences(Long orderId, String actorPhone) {
		if (evidenceRepo == null) {
			return List.of();
		}
		User actor = findUser(actorPhone);
		CustomerOrder o = orders.findWithDetailsById(orderId)
				.orElseThrow(() -> new ResourceNotFoundException("Order not found: " + orderId));
		authorizeOrderEvidenceRead(o, actor);

		return evidenceRepo.findByOrderIdOrderByIdDesc(orderId).stream()
				.map(DeliveryEvidenceResponse::from)
				.toList();
	}

	public record LoadedProofPhoto(byte[] bytes, String mimeType, String sha256Checksum) {
	}

	@Transactional(readOnly = true)
	public LoadedProofPhoto loadEvidencePhoto(Long orderId, Long evidenceId, String actorPhone) {
		if (evidenceRepo == null || storageProvider == null) {
			throw new ResourceNotFoundException("Proof of delivery storage is not configured");
		}
		User actor = findUser(actorPhone);
		CustomerOrder o = orders.findWithDetailsById(orderId)
				.orElseThrow(() -> new ResourceNotFoundException("Order not found: " + orderId));
		authorizeOrderEvidenceRead(o, actor);

		DeliveryEvidence ev = evidenceRepo.findByIdAndOrderId(evidenceId, orderId)
				.orElseThrow(() -> new ResourceNotFoundException("Delivery evidence not found: " + evidenceId));
		byte[] bytes = storageProvider.loadProofImage(ev.getStorageKey());
		return new LoadedProofPhoto(bytes, ev.getMimeType(), ev.getSha256Checksum());
	}

	// ---------- Delivery Completion & Failure ----------

	@Transactional
	public AttemptResponse deliver(Long orderId, CollectionRequest req, String phone) {
		User actor = findUser(phone);
		CustomerOrder o = lock(orderId);
		DeliveryAttempt a = myActive(orderId, actor.getId());
		requireStatus(o, OrderStatus.OUT_FOR_DELIVERY);
		requireAttempt(a, DeliveryStatus.OUT_FOR_DELIVERY);

		if (otpRepo != null && !a.isOtpVerified()) {
			String recipient = req != null ? req.recipientName() : null;
			if (recipient != null && !recipient.isBlank()) {
				String cleanRecipient = recipient.trim();
				a.setOtpVerified(true);
				a.setOtpVerifiedAt(LocalDateTime.now());
				a.setOtpVerifiedBy(actor.getId());
				a.setOtpVerificationMethod("RECIPIENT_HANDOVER");
				a.setOtpOverrideReason("Delivered to: " + cleanRecipient);
			} else {
				throw new BadRequestException(
						"Delivery OTP verification (or recipient confirmation) is required before marking order #"
								+ orderId + " as DELIVERED.");
			}
		}
		if (req != null && req.deliveryNote() != null && !req.deliveryNote().isBlank()) {
			a.setDeliveryNote(req.deliveryNote().trim());
		}
		if (requirePodPhoto && evidenceRepo != null && !evidenceRepo.existsByDeliveryAttemptId(a.getId())) {
			throw new BadRequestException(
					"Proof of delivery photograph is required before marking order #" + orderId + " as DELIVERED.");
		}

		// any failure here rolls back the whole delivery
		paymentService.collectOnDelivery(o, actor.getId(), req);

		a.setStatus(DeliveryStatus.DELIVERED);
		a.setFinishedAt(LocalDateTime.now());
		o.setStatus(OrderStatus.DELIVERED);
		invalidateActiveOtps(orderId);
		if (loyaltyService != null) {
			loyaltyService.awardForDeliveredOrder(o);
		}

		recordAudit(
				orderId,
				a.getId(),
				"DELIVERED",
				DeliveryStatus.OUT_FOR_DELIVERY.name(),
				DeliveryStatus.DELIVERED.name(),
				actor,
				"Order delivered (verification: " + (a.getOtpVerificationMethod() != null ? a.getOtpVerificationMethod() : "LEGACY") + ")");

		return AttemptResponse.from(a);
	}

	@Transactional
	public AttemptResponse fail(Long orderId, String reason, String phone) {
		User actor = findUser(phone);
		CustomerOrder o = lock(orderId);
		DeliveryAttempt a = myActive(orderId, actor.getId());
		requireStatus(o, OrderStatus.OUT_FOR_DELIVERY);
		requireAttempt(a, DeliveryStatus.OUT_FOR_DELIVERY);

		if (reason == null || reason.isBlank()) {
			throw new BadRequestException("Failure reason is required");
		}

		a.setStatus(DeliveryStatus.FAILED);
		a.setFinishedAt(LocalDateTime.now());
		a.setFailureReason(reason.trim());
		o.setStatus(OrderStatus.PACKED); // back to packed; stock is untouched
		invalidateActiveOtps(orderId);

		recordAudit(
				orderId,
				a.getId(),
				"FAILED",
				DeliveryStatus.OUT_FOR_DELIVERY.name(),
				DeliveryStatus.FAILED.name(),
				actor,
				"Delivery failed: " + reason.trim());

		return AttemptResponse.from(a);
	}

	// ---------- helpers ----------

	private void invalidateActiveOtps(Long orderId) {
		if (otpRepo == null) return;
		List<DeliveryOtp> activeOtps = otpRepo.findByOrderIdAndStatus(orderId, "ACTIVE");
		for (DeliveryOtp otp : activeOtps) {
			otp.setStatus("INVALIDATED");
		}
		if (!activeOtps.isEmpty()) {
			otpRepo.saveAll(activeOtps);
		}
	}

	private DeliveryAttempt authorizeDeliveryAttemptAccess(Long orderId, User actor) {
		boolean isAdmin = actor.getRoles().contains(Role.OWNER) || actor.getRoles().contains(Role.STAFF);
		if (isAdmin) {
			return attempts.findFirstByOrderIdAndStatusIn(orderId, ACTIVE)
					.or(() -> attempts.findFirstByOrderIdOrderByIdDesc(orderId))
					.orElseThrow(() -> new ResourceNotFoundException("No delivery attempt found for order: " + orderId));
		}
		return myActive(orderId, actor.getId());
	}

	private void authorizeOrderEvidenceRead(CustomerOrder order, User actor) {
		if (actor.getRoles().contains(Role.OWNER) || actor.getRoles().contains(Role.STAFF)) {
			return;
		}
		if (actor.getRoles().contains(Role.CUSTOMER) && order.getCustomerId().equals(actor.getId())) {
			return;
		}
		if (actor.getRoles().contains(Role.DELIVERY)) {
			boolean assignedToMe = attempts.findByOrderIdOrderByIdAsc(order.getId()).stream()
					.anyMatch(a -> a.getDeliveryUserId().equals(actor.getId()));
			if (assignedToMe) {
				return;
			}
		}
		throw new ResourceNotFoundException("Order not found: " + order.getId());
	}

	private void recordAudit(
			Long orderId,
			Long attemptId,
			String actionType,
			String fromStatus,
			String toStatus,
			User actor,
			String note) {
		if (auditRepo == null) return;
		DeliveryAuditLog log = new DeliveryAuditLog();
		log.setOrderId(orderId);
		log.setDeliveryAttemptId(attemptId);
		log.setActionType(actionType);
		log.setFromStatus(fromStatus);
		log.setToStatus(toStatus);
		log.setActorUserId(actor.getId());
		String primaryRole = actor.getRoles().stream().findFirst().map(Enum::name).orElse("USER");
		log.setActorRole(primaryRole);
		log.setNote(note != null && note.length() > 255 ? note.substring(0, 255) : note);
		auditRepo.save(log);
	}

	private static String resolveDeliveryStage(CustomerOrder o, DeliveryAttempt attempt) {
		if (o.getStatus() == OrderStatus.CANCELLED) {
			return "CANCELLED";
		}
		if (o.getStatus() == OrderStatus.DELIVERED) {
			return "DELIVERED";
		}
		if (attempt != null) {
			if (attempt.getStatus() == DeliveryStatus.OUT_FOR_DELIVERY) {
				return "OUT_FOR_DELIVERY";
			}
			if (attempt.getStatus() == DeliveryStatus.ASSIGNED) {
				return "ASSIGNED";
			}
			if (attempt.getStatus() == DeliveryStatus.RETURNED_TO_STORE) {
				return "RETURNED_TO_STORE";
			}
			if (attempt.getStatus() == DeliveryStatus.FAILED) {
				return "FAILED";
			}
		}
		if (o.getStatus() == OrderStatus.PACKED) {
			return "READY_FOR_DELIVERY";
		}
		return "PREPARING";
	}

	private static String extractLocality(String deliveryAddress, String pincode) {
		if (deliveryAddress == null || deliveryAddress.isBlank()) {
			return "PIN " + pincode;
		}
		String[] parts = deliveryAddress.split(",");
		for (int i = parts.length - 1; i >= 0; i--) {
			String p = parts[i].trim();
			if (!p.isEmpty() && !p.equals(pincode) && !p.matches("^[0-9]{6}$")) {
				return p.length() > 35 ? p.substring(0, 35) : p;
			}
		}
		return "PIN " + pincode;
	}

	private static String maskPhone(String phone) {
		if (phone == null || phone.length() < 4) return "****";
		return "******" + phone.substring(phone.length() - 4);
	}

	private CustomerOrder lock(Long id) {
		return orders.findByIdForUpdate(id)
				.orElseThrow(() -> new ResourceNotFoundException("Order not found: " + id));
	}

	private DeliveryAttempt myActive(Long orderId, Long myId) {
		return attempts.findFirstByOrderIdAndStatusIn(orderId, ACTIVE)
				.filter(a -> a.getDeliveryUserId().equals(myId))
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

	private User findUser(String phone) {
		return users.findByPhone(phone)
				.orElseThrow(() -> new BadRequestException("Unknown user"));
	}

	private Long userId(String phone) {
		return findUser(phone).getId();
	}
}
