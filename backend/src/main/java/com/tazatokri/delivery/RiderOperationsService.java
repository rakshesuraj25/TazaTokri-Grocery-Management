package com.tazatokri.delivery;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.EnumMap;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.tazatokri.common.ResourceNotFoundException;
import com.tazatokri.payment.PaymentRepository;
import com.tazatokri.user.Role;
import com.tazatokri.user.User;
import com.tazatokri.user.UserRepository;

@Service
public class RiderOperationsService {

    public record RiderSummaryDto(
            Long userId,
            String fullName,
            String phone,
            boolean active,
            long assignedCount,
            long outForDeliveryCount,
            long deliveredCount,
            long failedCount,
            BigDecimal completionRate,
            BigDecimal codCollectedTotal,
            BigDecimal codSettledTotal,
            BigDecimal codPendingSettlement) {}

    private final UserRepository users;
    private final DeliveryAttemptRepository attempts;
    private final PaymentRepository payments;

    public RiderOperationsService(
            UserRepository users,
            DeliveryAttemptRepository attempts,
            PaymentRepository payments) {
        this.users = users;
        this.attempts = attempts;
        this.payments = payments;
    }

    @Transactional(readOnly = true)
    public List<RiderSummaryDto> summarizeRiders() {
        List<User> riders = users.findByRole(Role.DELIVERY);

        Map<Long, Map<DeliveryStatus, Long>> countsByRider = new HashMap<>();
        for (DeliveryAttemptRepository.RiderStatusCount row : attempts.summarizeStatusByRider()) {
            countsByRider
                    .computeIfAbsent(row.getDeliveryUserId(), id -> new EnumMap<>(DeliveryStatus.class))
                    .put(row.getStatus(), row.getCnt() != null ? row.getCnt() : 0L);
        }

        Map<Long, BigDecimal> collectedByRider = new HashMap<>();
        for (PaymentRepository.RiderCashSummary row : payments.sumCashCollectedByRider()) {
            collectedByRider.put(row.getCollectedBy(), scale(row.getTotal()));
        }

        Map<Long, BigDecimal> settledByRider = new HashMap<>();
        for (PaymentRepository.RiderCashSummary row : payments.sumCashSettledByRider()) {
            settledByRider.put(row.getCollectedBy(), scale(row.getTotal()));
        }

        return riders.stream().map(u -> {
            Map<DeliveryStatus, Long> st = countsByRider.getOrDefault(u.getId(), Map.of());
            long assigned = st.getOrDefault(DeliveryStatus.ASSIGNED, 0L);
            long out = st.getOrDefault(DeliveryStatus.OUT_FOR_DELIVERY, 0L);
            long delivered = st.getOrDefault(DeliveryStatus.DELIVERED, 0L);
            long failed = st.getOrDefault(DeliveryStatus.FAILED, 0L);
            long finished = delivered + failed;
            BigDecimal rate = finished == 0
                    ? BigDecimal.ZERO.setScale(1, RoundingMode.HALF_UP)
                    : BigDecimal.valueOf(delivered * 100.0 / finished).setScale(1, RoundingMode.HALF_UP);

            BigDecimal collected = collectedByRider.getOrDefault(u.getId(), zero());
            BigDecimal settled = settledByRider.getOrDefault(u.getId(), zero());
            BigDecimal pending = collected.subtract(settled).max(zero()).setScale(2, RoundingMode.HALF_UP);

            return new RiderSummaryDto(
                    u.getId(),
                    u.getFullName(),
                    u.getPhone(),
                    u.isActive(),
                    assigned,
                    out,
                    delivered,
                    failed,
                    rate,
                    collected,
                    settled,
                    pending);
        }).toList();
    }

    @Transactional(readOnly = true)
    public List<AttemptResponse> riderHistory(Long riderUserId) {
        User rider = users.findById(riderUserId)
                .filter(u -> u.getRoles().contains(Role.DELIVERY))
                .orElseThrow(() -> new ResourceNotFoundException("Delivery rider not found: " + riderUserId));

        return attempts.findByDeliveryUserIdOrderByIdDesc(rider.getId(), PageRequest.of(0, 30))
                .stream()
                .map(AttemptResponse::from)
                .toList();
    }

    private static BigDecimal zero() {
        return BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
    }

    private static BigDecimal scale(BigDecimal v) {
        return v == null ? zero() : v.setScale(2, RoundingMode.HALF_UP);
    }
}
