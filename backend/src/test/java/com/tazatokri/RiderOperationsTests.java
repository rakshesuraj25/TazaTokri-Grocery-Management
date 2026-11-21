package com.tazatokri;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;

import java.lang.reflect.Field;
import java.lang.reflect.InvocationHandler;
import java.lang.reflect.Proxy;
import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import java.util.Set;

import org.junit.jupiter.api.Test;
import org.springframework.security.access.prepost.PreAuthorize;

import com.tazatokri.delivery.AttemptResponse;
import com.tazatokri.delivery.DeliveryAttempt;
import com.tazatokri.delivery.DeliveryAttemptRepository;
import com.tazatokri.delivery.DeliveryStatus;
import com.tazatokri.delivery.RiderOperationsController;
import com.tazatokri.delivery.RiderOperationsService;
import com.tazatokri.delivery.RiderOperationsService.RiderSummaryDto;
import com.tazatokri.payment.PaymentRepository;
import com.tazatokri.user.Role;
import com.tazatokri.user.User;
import com.tazatokri.user.UserRepository;

class RiderOperationsTests {

    @SuppressWarnings("unchecked")
    private static <T> T proxy(Class<T> iface, InvocationHandler handler) {
        return (T) Proxy.newProxyInstance(iface.getClassLoader(), new Class<?>[] { iface }, handler);
    }

    private static User rider(long id, String name, String phone, boolean active) {
        User u = new User();
        try {
            Field f = User.class.getDeclaredField("id");
            f.setAccessible(true);
            f.set(u, id);
        } catch (ReflectiveOperationException e) {
            throw new RuntimeException(e);
        }
        u.setFullName(name);
        u.setPhone(phone);
        u.setActive(active);
        u.setRoles(Set.of(Role.DELIVERY));
        return u;
    }

    @Test
    void controllerAllowsOwnerAndStaffOnly() {
        PreAuthorize ann = RiderOperationsController.class.getAnnotation(PreAuthorize.class);
        assertNotNull(ann);
        assertEquals("hasAnyRole('OWNER','STAFF')", ann.value());
    }

    @Test
    void summarizesRiderDeliveriesCompletionRateAndCodSettlement() {
        User r1 = rider(10L, "Ramesh Rider", "9000011111", true);

        UserRepository users = proxy(UserRepository.class, (p, m, a) -> switch (m.getName()) {
            case "findByRole" -> List.of(r1);
            case "findById" -> Long.valueOf(10L).equals(a[0]) ? Optional.of(r1) : Optional.empty();
            default -> null;
        });

        DeliveryAttempt a1 = new DeliveryAttempt();
        a1.setOrderId(101L);
        a1.setDeliveryUserId(10L);
        a1.setStatus(DeliveryStatus.DELIVERED);
        a1.setOtpVerified(true);

        DeliveryAttemptRepository attempts = proxy(DeliveryAttemptRepository.class, (p, m, a) -> switch (m.getName()) {
            case "summarizeStatusByRider" -> List.of(
                    proxy(DeliveryAttemptRepository.RiderStatusCount.class, (p2, m2, a2) -> switch (m2.getName()) {
                        case "getDeliveryUserId" -> 10L;
                        case "getStatus" -> DeliveryStatus.ASSIGNED;
                        case "getCnt" -> 2L;
                        default -> null;
                    }),
                    proxy(DeliveryAttemptRepository.RiderStatusCount.class, (p2, m2, a2) -> switch (m2.getName()) {
                        case "getDeliveryUserId" -> 10L;
                        case "getStatus" -> DeliveryStatus.DELIVERED;
                        case "getCnt" -> 8L;
                        default -> null;
                    }),
                    proxy(DeliveryAttemptRepository.RiderStatusCount.class, (p2, m2, a2) -> switch (m2.getName()) {
                        case "getDeliveryUserId" -> 10L;
                        case "getStatus" -> DeliveryStatus.FAILED;
                        case "getCnt" -> 2L;
                        default -> null;
                    }));
            case "findByDeliveryUserIdOrderByIdDesc" -> List.of(a1);
            default -> List.of();
        });

        PaymentRepository payments = proxy(PaymentRepository.class, (p, m, a) -> switch (m.getName()) {
            case "sumCashCollectedByRider" -> List.of(
                    proxy(PaymentRepository.RiderCashSummary.class, (p2, m2, a2) -> switch (m2.getName()) {
                        case "getCollectedBy" -> 10L;
                        case "getTotal" -> new BigDecimal("1500.00");
                        default -> null;
                    }));
            case "sumCashSettledByRider" -> List.of(
                    proxy(PaymentRepository.RiderCashSummary.class, (p2, m2, a2) -> switch (m2.getName()) {
                        case "getCollectedBy" -> 10L;
                        case "getTotal" -> new BigDecimal("1100.00");
                        default -> null;
                    }));
            default -> List.of();
        });

        RiderOperationsService service = new RiderOperationsService(users, attempts, payments);

        List<RiderSummaryDto> list = service.summarizeRiders();
        assertEquals(1, list.size());
        RiderSummaryDto dto = list.get(0);
        assertEquals("Ramesh Rider", dto.fullName());
        assertEquals(2L, dto.assignedCount());
        assertEquals(8L, dto.deliveredCount());
        assertEquals(2L, dto.failedCount());
        assertEquals(new BigDecimal("80.0"), dto.completionRate());
        assertEquals(new BigDecimal("1500.00"), dto.codCollectedTotal());
        assertEquals(new BigDecimal("1100.00"), dto.codSettledTotal());
        assertEquals(new BigDecimal("400.00"), dto.codPendingSettlement());

        List<AttemptResponse> history = service.riderHistory(10L);
        assertEquals(1, history.size());
        assertEquals(101L, history.get(0).orderId());
    }
}
