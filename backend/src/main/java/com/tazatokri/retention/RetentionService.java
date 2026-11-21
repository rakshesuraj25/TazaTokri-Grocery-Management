package com.tazatokri.retention;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.tazatokri.common.BadRequestException;
import com.tazatokri.loyalty.LoyaltyTransactionRepository;
import com.tazatokri.order.CustomerOrderRepository;
import com.tazatokri.user.Role;
import com.tazatokri.user.User;
import com.tazatokri.user.UserRepository;

@Service
public class RetentionService {

    public static final ZoneId IST = ZoneId.of("Asia/Kolkata");
    private static final BigDecimal HUNDRED = new BigDecimal("100");

    public record CustomerInsightDto(
            Long customerId,
            String fullName,
            String phone,
            long totalOrders,
            BigDecimal totalSpend,
            BigDecimal averageOrderValue,
            LocalDate lastOrderDate,
            Long daysSinceLastOrder,
            long loyaltyBalance,
            CustomerSegment segment) {}

    public record RetentionDashboardDto(
            LocalDate from,
            LocalDate to,
            int inactiveDaysThreshold,
            BigDecimal highValueThreshold,
            long totalCustomers,
            long newCustomersInPeriod,
            long repeatCustomers,
            BigDecimal repeatPurchaseRate,
            long inactiveCustomers,
            long highValueCustomers,
            BigDecimal averageOrderFrequency,
            BigDecimal averageLifetimeSpend,
            long totalMatchingCustomers,
            int page,
            int size,
            List<CustomerInsightDto> customers) {}

    private final UserRepository users;
    private final CustomerOrderRepository orders;
    private final LoyaltyTransactionRepository loyaltyTx;
    private final Clock clock;

    public RetentionService(
            UserRepository users,
            CustomerOrderRepository orders,
            LoyaltyTransactionRepository loyaltyTx) {
        this(users, orders, loyaltyTx, Clock.system(IST));
    }

    @Autowired
    public RetentionService(
            UserRepository users,
            CustomerOrderRepository orders,
            LoyaltyTransactionRepository loyaltyTx,
            Clock clock) {
        this.users = users;
        this.orders = orders;
        this.loyaltyTx = loyaltyTx;
        this.clock = clock != null ? clock : Clock.system(IST);
    }

    @Transactional(readOnly = true)
    public RetentionDashboardDto getInsights(
            LocalDate from,
            LocalDate to,
            Integer inactiveDaysParam,
            BigDecimal highValueParam,
            CustomerSegment segmentFilter,
            String search,
            String sortBy,
            int page,
            int size) {

        LocalDate todayIst = LocalDate.now(clock.withZone(IST));
        LocalDate resolvedTo = to != null ? to : todayIst;
        LocalDate resolvedFrom = from != null ? from : resolvedTo.minusDays(29);
        if (resolvedFrom.isAfter(resolvedTo)) {
            throw new BadRequestException("Start date cannot be after end date");
        }

        int inactiveDays = inactiveDaysParam != null ? inactiveDaysParam : 30;
        if (inactiveDays < 1) {
            throw new BadRequestException("Inactive days threshold must be at least 1");
        }
        BigDecimal highValueThreshold = highValueParam != null ? highValueParam : new BigDecimal("2000.00");
        if (highValueThreshold.signum() <= 0) {
            throw new BadRequestException("High-value threshold must be greater than 0");
        }

        LocalDateTime nowIst = LocalDateTime.now(clock.withZone(IST));

        List<User> customerUsers = users.findByRole(Role.CUSTOMER);
        Map<Long, CustomerOrderRepository.CustomerOrderMetrics> metricsByCustomer = new HashMap<>();
        for (CustomerOrderRepository.CustomerOrderMetrics m : orders.summarizeCustomerOrderMetrics()) {
            metricsByCustomer.put(m.getCustomerId(), m);
        }

        Map<Long, Long> loyaltyByCustomer = new HashMap<>();
        if (loyaltyTx != null) {
            for (LoyaltyTransactionRepository.CustomerPointsBalance b : loyaltyTx.sumActivePointsByCustomer(nowIst)) {
                loyaltyByCustomer.put(b.getCustomerId(), Math.max(0L, b.getBalance() != null ? b.getBalance() : 0L));
            }
        }

        long newInPeriod = 0;
        long repeatCount = 0;
        long inactiveCount = 0;
        long highValueCount = 0;
        long sumOrders = 0;
        BigDecimal sumSpend = BigDecimal.ZERO;

        List<CustomerInsightDto> allInsights = new ArrayList<>();
        for (User u : customerUsers) {
            CustomerOrderRepository.CustomerOrderMetrics m = metricsByCustomer.get(u.getId());
            long totalOrd = m != null && m.getTotalOrders() != null ? m.getTotalOrders() : 0L;
            BigDecimal totalSpend = m != null && m.getTotalSpend() != null
                    ? m.getTotalSpend().setScale(2, RoundingMode.HALF_UP)
                    : BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
            BigDecimal aov = totalOrd == 0
                    ? BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP)
                    : totalSpend.divide(BigDecimal.valueOf(totalOrd), 2, RoundingMode.HALF_UP);
            LocalDate lastOrderDate = m != null && m.getLastOrderAt() != null
                    ? m.getLastOrderAt().toLocalDate()
                    : null;
            Long daysSince = lastOrderDate != null
                    ? Math.max(0L, ChronoUnit.DAYS.between(lastOrderDate, todayIst))
                    : null;
            LocalDate firstOrderDate = m != null && m.getFirstOrderAt() != null
                    ? m.getFirstOrderAt().toLocalDate()
                    : null;

            if (totalOrd == 1 && firstOrderDate != null
                    && !firstOrderDate.isBefore(resolvedFrom) && !firstOrderDate.isAfter(resolvedTo)) {
                newInPeriod++;
            }
            if (totalOrd >= 2) {
                repeatCount++;
            }
            if (totalSpend.compareTo(highValueThreshold) >= 0) {
                highValueCount++;
            }
            boolean isInactive = daysSince == null || daysSince >= inactiveDays;
            if (isInactive) {
                inactiveCount++;
            }

            sumOrders += totalOrd;
            sumSpend = sumSpend.add(totalSpend);

            CustomerSegment seg = classifySegment(totalOrd, totalSpend, daysSince, inactiveDays, highValueThreshold);
            long pts = loyaltyByCustomer.getOrDefault(u.getId(), 0L);

            allInsights.add(new CustomerInsightDto(
                    u.getId(),
                    u.getFullName(),
                    u.getPhone(),
                    totalOrd,
                    totalSpend,
                    aov,
                    lastOrderDate,
                    daysSince,
                    pts,
                    seg));
        }

        long totalCustomers = customerUsers.size();
        BigDecimal repeatRate = totalCustomers == 0
                ? BigDecimal.ZERO.setScale(1, RoundingMode.HALF_UP)
                : BigDecimal.valueOf(repeatCount)
                        .multiply(HUNDRED)
                        .divide(BigDecimal.valueOf(totalCustomers), 1, RoundingMode.HALF_UP);
        BigDecimal avgFreq = totalCustomers == 0
                ? BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP)
                : BigDecimal.valueOf(sumOrders)
                        .divide(BigDecimal.valueOf(totalCustomers), 2, RoundingMode.HALF_UP);
        BigDecimal avgLifetimeSpend = totalCustomers == 0
                ? BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP)
                : sumSpend.divide(BigDecimal.valueOf(totalCustomers), 2, RoundingMode.HALF_UP);

        String q = search == null ? "" : search.trim().toLowerCase();
        List<CustomerInsightDto> filtered = allInsights.stream()
                .filter(c -> segmentFilter == null || c.segment() == segmentFilter)
                .filter(c -> q.isEmpty()
                        || c.fullName().toLowerCase().contains(q)
                        || c.phone().toLowerCase().contains(q))
                .sorted(comparatorFor(sortBy))
                .toList();

        int safePage = Math.max(0, page);
        int safeSize = Math.min(100, Math.max(1, size));
        int fromIdx = Math.min(safePage * safeSize, filtered.size());
        int toIdx = Math.min(fromIdx + safeSize, filtered.size());

        return new RetentionDashboardDto(
                resolvedFrom,
                resolvedTo,
                inactiveDays,
                highValueThreshold,
                totalCustomers,
                newInPeriod,
                repeatCount,
                repeatRate,
                inactiveCount,
                highValueCount,
                avgFreq,
                avgLifetimeSpend,
                filtered.size(),
                safePage,
                safeSize,
                filtered.subList(fromIdx, toIdx));
    }

    public static CustomerSegment classifySegment(
            long totalOrders,
            BigDecimal totalSpend,
            Long daysSinceLastOrder,
            int inactiveDays,
            BigDecimal highValueThreshold) {
        if (daysSinceLastOrder == null || daysSinceLastOrder >= inactiveDays) {
            return CustomerSegment.INACTIVE;
        }
        if (totalSpend.compareTo(highValueThreshold) >= 0) {
            return CustomerSegment.HIGH_VALUE;
        }
        if (totalOrders == 1) {
            return CustomerSegment.NEW;
        }
        if (totalOrders >= 2) {
            return CustomerSegment.REPEAT;
        }
        return CustomerSegment.ACTIVE;
    }

    private static Comparator<CustomerInsightDto> comparatorFor(String sortBy) {
        if ("orders".equalsIgnoreCase(sortBy)) {
            return Comparator.comparingLong(CustomerInsightDto::totalOrders).reversed();
        }
        if ("recent".equalsIgnoreCase(sortBy)) {
            return Comparator.comparing(
                    CustomerInsightDto::lastOrderDate,
                    Comparator.nullsLast(Comparator.reverseOrder()));
        }
        return Comparator.comparing(CustomerInsightDto::totalSpend).reversed();
    }
}
