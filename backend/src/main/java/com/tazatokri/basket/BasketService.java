package com.tazatokri.basket;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.temporal.TemporalAdjusters;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.tazatokri.catalog.UnitType;
import com.tazatokri.catalog.Vegetable;
import com.tazatokri.catalog.VegetableRepository;
import com.tazatokri.catalog.VegetableUnit;
import com.tazatokri.common.BadRequestException;
import com.tazatokri.common.ResourceNotFoundException;
import com.tazatokri.inventory.StockMovementRepository;
import com.tazatokri.pricing.VegetablePrice;
import com.tazatokri.pricing.VegetablePriceRepository;
import com.tazatokri.user.UserRepository;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

@Service
public class BasketService {

    public static final ZoneId IST = ZoneId.of("Asia/Kolkata");

    private final SavedBasketRepository baskets;
    private final RecurringBasketScheduleRepository schedules;
    private final VegetableRepository vegetables;
    private final VegetablePriceRepository prices;
    private final StockMovementRepository movements;
    private final UserRepository users;

    public BasketService(
            SavedBasketRepository baskets,
            RecurringBasketScheduleRepository schedules,
            VegetableRepository vegetables,
            VegetablePriceRepository prices,
            StockMovementRepository movements,
            UserRepository users) {
        this.baskets = baskets;
        this.schedules = schedules;
        this.vegetables = vegetables;
        this.prices = prices;
        this.movements = movements;
        this.users = users;
    }

    public record BasketItemInput(
            @NotNull Long vegetableId,
            @NotNull Long unitId,
            @Min(1) @Max(20) int count) {}

    public record BasketUpsertRequest(
            @NotBlank @Size(max = 100) String name,
            @NotEmpty @Valid List<BasketItemInput> items) {}

    public record ScheduleUpsertRequest(
            @NotNull ScheduleFrequency frequency,
            @Min(1) @Max(7) Integer preferredDayOfWeek) {}

    public record ScheduleDto(
            Long id,
            ScheduleFrequency frequency,
            Integer preferredDayOfWeek,
            LocalDate nextReminderDate,
            ScheduleStatus status,
            boolean reminderDue) {}

    public record BasketItemDto(
            Long vegetableId,
            String nameEn,
            String nameMr,
            String nameHi,
            String imageUrl,
            UnitType baseUnit,
            Long unitId,
            String unitLabel,
            BigDecimal quantityInBaseUnit,
            int count,
            BigDecimal currentUnitPrice,
            BigDecimal estimatedLineTotal,
            BigDecimal availableStock,
            boolean availableToday) {}

    public record SavedBasketDto(
            Long id,
            String name,
            BigDecimal estimatedTotal,
            int totalItemsCount,
            List<String> unavailableItems,
            ScheduleDto schedule,
            LocalDateTime updatedAt,
            List<BasketItemDto> items) {}

    @Transactional(readOnly = true)
    public List<SavedBasketDto> listForCustomer(String customerPhone) {
        Long customerId = resolveCustomerId(customerPhone);
        List<SavedBasket> list = baskets.findByCustomerIdOrderByUpdatedAtDescIdDesc(customerId);
        return enrichBaskets(list, customerId);
    }

    @Transactional(readOnly = true)
    public List<SavedBasketDto> listReminders(String customerPhone) {
        Long customerId = resolveCustomerId(customerPhone);
        List<SavedBasket> list = baskets.findByCustomerIdOrderByUpdatedAtDescIdDesc(customerId);
        return enrichBaskets(list, customerId).stream()
                .filter(b -> b.schedule() != null
                        && b.schedule().status() == ScheduleStatus.ACTIVE
                        && b.schedule().reminderDue())
                .toList();
    }

    @Transactional
    public SavedBasketDto create(BasketUpsertRequest req, String customerPhone) {
        Long customerId = resolveCustomerId(customerPhone);
        SavedBasket b = new SavedBasket();
        b.setCustomerId(customerId);
        applyBasketFields(b, req);
        SavedBasket saved = baskets.save(b);
        return enrichBaskets(List.of(saved), customerId).get(0);
    }

    @Transactional
    public SavedBasketDto update(Long id, BasketUpsertRequest req, String customerPhone) {
        Long customerId = resolveCustomerId(customerPhone);
        SavedBasket b = baskets.findWithDetailsByIdAndCustomerId(id, customerId)
                .orElseThrow(() -> new ResourceNotFoundException("Saved basket not found: " + id));
        applyBasketFields(b, req);
        SavedBasket saved = baskets.save(b);
        return enrichBaskets(List.of(saved), customerId).get(0);
    }

    @Transactional
    public void delete(Long id, String customerPhone) {
        Long customerId = resolveCustomerId(customerPhone);
        SavedBasket b = baskets.findWithDetailsByIdAndCustomerId(id, customerId)
                .orElseThrow(() -> new ResourceNotFoundException("Saved basket not found: " + id));
        schedules.findByBasketIdAndCustomerId(b.getId(), customerId)
                .ifPresent(schedules::delete);
        baskets.delete(b);
    }

    @Transactional
    public SavedBasketDto upsertSchedule(
            Long basketId,
            ScheduleUpsertRequest req,
            String customerPhone) {
        Long customerId = resolveCustomerId(customerPhone);
        SavedBasket b = baskets.findWithDetailsByIdAndCustomerId(basketId, customerId)
                .orElseThrow(() -> new ResourceNotFoundException("Saved basket not found: " + basketId));

        if (req.frequency() == ScheduleFrequency.CUSTOM_WEEKDAY && req.preferredDayOfWeek() == null) {
            throw new BadRequestException("Select a preferred weekday (1 = Monday .. 7 = Sunday)");
        }

        LocalDate todayIst = LocalDate.now(IST);
        LocalDate nextDate = computeNextReminderDate(todayIst, req.frequency(), req.preferredDayOfWeek());

        RecurringBasketSchedule s = schedules.findByBasketIdAndCustomerId(basketId, customerId)
                .orElseGet(() -> {
                    RecurringBasketSchedule fresh = new RecurringBasketSchedule();
                    fresh.setBasket(b);
                    fresh.setCustomerId(customerId);
                    return fresh;
                });

        s.setFrequency(req.frequency());
        s.setPreferredDayOfWeek(req.preferredDayOfWeek());
        s.setNextReminderDate(nextDate);
        s.setStatus(ScheduleStatus.ACTIVE);
        schedules.save(s);

        return enrichBaskets(List.of(b), customerId).get(0);
    }

    @Transactional
    public SavedBasketDto pauseSchedule(Long basketId, String customerPhone) {
        Long customerId = resolveCustomerId(customerPhone);
        SavedBasket b = baskets.findWithDetailsByIdAndCustomerId(basketId, customerId)
                .orElseThrow(() -> new ResourceNotFoundException("Saved basket not found: " + basketId));
        RecurringBasketSchedule s = schedules.findByBasketIdAndCustomerId(basketId, customerId)
                .orElseThrow(() -> new ResourceNotFoundException("No schedule found for basket: " + basketId));

        s.setStatus(ScheduleStatus.PAUSED);
        schedules.save(s);
        return enrichBaskets(List.of(b), customerId).get(0);
    }

    @Transactional
    public SavedBasketDto resumeSchedule(Long basketId, String customerPhone) {
        Long customerId = resolveCustomerId(customerPhone);
        SavedBasket b = baskets.findWithDetailsByIdAndCustomerId(basketId, customerId)
                .orElseThrow(() -> new ResourceNotFoundException("Saved basket not found: " + basketId));
        RecurringBasketSchedule s = schedules.findByBasketIdAndCustomerId(basketId, customerId)
                .orElseThrow(() -> new ResourceNotFoundException("No schedule found for basket: " + basketId));

        LocalDate todayIst = LocalDate.now(IST);
        if (s.getNextReminderDate() == null || s.getNextReminderDate().isBefore(todayIst)) {
            s.setNextReminderDate(todayIst);
        }
        s.setStatus(ScheduleStatus.ACTIVE);
        schedules.save(s);
        return enrichBaskets(List.of(b), customerId).get(0);
    }

    @Transactional
    public SavedBasketDto cancelSchedule(Long basketId, String customerPhone) {
        Long customerId = resolveCustomerId(customerPhone);
        SavedBasket b = baskets.findWithDetailsByIdAndCustomerId(basketId, customerId)
                .orElseThrow(() -> new ResourceNotFoundException("Saved basket not found: " + basketId));
        schedules.findByBasketIdAndCustomerId(basketId, customerId).ifPresent(s -> {
            s.setStatus(ScheduleStatus.CANCELLED);
            schedules.save(s);
        });
        return enrichBaskets(List.of(b), customerId).get(0);
    }

    public static LocalDate computeNextReminderDate(
            LocalDate fromIst,
            ScheduleFrequency frequency,
            Integer preferredDayOfWeek) {
        return switch (frequency) {
            case DAILY -> fromIst;
            case WEEKLY -> fromIst;
            case BIWEEKLY -> fromIst;
            case CUSTOM_WEEKDAY -> {
                int dow = (preferredDayOfWeek != null && preferredDayOfWeek >= 1 && preferredDayOfWeek <= 7)
                        ? preferredDayOfWeek
                        : fromIst.getDayOfWeek().getValue();
                yield fromIst.with(TemporalAdjusters.nextOrSame(DayOfWeek.of(dow)));
            }
        };
    }

    private void applyBasketFields(SavedBasket b, BasketUpsertRequest req) {
        if (req.items() == null || req.items().isEmpty()) {
            throw new BadRequestException("Saved basket must contain at least one item");
        }
        String cleanName = req.name().trim();
        if (cleanName.isEmpty()) {
            throw new BadRequestException("Basket name is required");
        }

        Set<String> seenPairs = new HashSet<>();
        List<SavedBasketItem> nextItems = new ArrayList<>();

        for (BasketItemInput input : req.items()) {
            if (input.count() < 1 || input.count() > 20) {
                throw new BadRequestException("Item count must be between 1 and 20");
            }
            String pairKey = input.vegetableId() + ":" + input.unitId();
            if (!seenPairs.add(pairKey)) {
                throw new BadRequestException("Duplicate vegetable and unit in basket");
            }

            Vegetable v = vegetables.findWithDetailsById(input.vegetableId())
                    .orElseThrow(() -> new BadRequestException("Vegetable not found: " + input.vegetableId()));
            boolean unitExists = v.getUnits().stream()
                    .anyMatch(u -> u.getId().equals(input.unitId()));
            if (!unitExists) {
                throw new BadRequestException("Invalid selling option for " + v.getNameEn());
            }

            SavedBasketItem item = new SavedBasketItem();
            item.setBasket(b);
            item.setVegetable(v);
            item.setUnitId(input.unitId());
            item.setCount(input.count());
            nextItems.add(item);
        }

        b.setName(cleanName);
        b.getItems().clear();
        b.getItems().addAll(nextItems);
    }

    private List<SavedBasketDto> enrichBaskets(List<SavedBasket> list, Long customerId) {
        if (list.isEmpty()) return List.of();

        Map<Long, BigDecimal> priceByVegId = new HashMap<>();
        for (VegetablePrice p : prices.findAllCurrent()) {
            priceByVegId.put(p.getVegetable().getId(), p.getPricePerUnit());
        }

        Set<Long> allVegIds = new HashSet<>();
        for (SavedBasket b : list) {
            for (SavedBasketItem item : b.getItems()) {
                allVegIds.add(item.getVegetable().getId());
            }
        }

        Map<Long, BigDecimal> stockByVegId = new HashMap<>();
        if (!allVegIds.isEmpty()) {
            movements.stockForVegetables(allVegIds)
                    .forEach(s -> stockByVegId.put(s.getVegetableId(), s.getQty()));
        }

        Map<Long, RecurringBasketSchedule> scheduleByBasketId = new HashMap<>();
        for (RecurringBasketSchedule s : schedules.findByCustomerId(customerId)) {
            scheduleByBasketId.put(s.getBasket().getId(), s);
        }

        LocalDate todayIst = LocalDate.now(IST);

        return list.stream().map(b -> {
            BigDecimal estTotal = BigDecimal.ZERO;
            int totalCount = 0;
            List<String> unavailable = new ArrayList<>();
            List<BasketItemDto> itemDtos = new ArrayList<>();

            for (SavedBasketItem item : b.getItems()) {
                Vegetable v = item.getVegetable();
                VegetableUnit u = v.getUnits().stream()
                        .filter(opt -> opt.getId().equals(item.getUnitId()))
                        .findFirst()
                        .orElse(null);

                String unitLabel = u != null ? u.getLabel() : v.getBaseUnit().name();
                BigDecimal qtyInBase = u != null ? u.getQuantityInBaseUnit() : BigDecimal.ONE;
                BigDecimal reqBaseQty = qtyInBase.multiply(BigDecimal.valueOf(item.getCount()));

                BigDecimal basePrice = priceByVegId.get(v.getId());
                BigDecimal stock = stockByVegId.getOrDefault(v.getId(), BigDecimal.ZERO);

                boolean unitActive = u != null && u.isActive();
                boolean availableToday = v.isActive()
                        && v.isAvailable()
                        && unitActive
                        && basePrice != null
                        && stock.compareTo(reqBaseQty) >= 0;

                BigDecimal currentUnitPrice = (basePrice != null)
                        ? basePrice.multiply(qtyInBase).setScale(2, RoundingMode.HALF_UP)
                        : null;
                BigDecimal estLineTotal = (currentUnitPrice != null)
                        ? currentUnitPrice.multiply(BigDecimal.valueOf(item.getCount())).setScale(2, RoundingMode.HALF_UP)
                        : null;

                if (availableToday && estLineTotal != null) {
                    estTotal = estTotal.add(estLineTotal);
                } else {
                    unavailable.add(v.getNameEn());
                }

                totalCount += item.getCount();
                itemDtos.add(new BasketItemDto(
                        v.getId(),
                        v.getNameEn(),
                        v.getNameMr(),
                        v.getNameHi(),
                        v.getImageUrl(),
                        v.getBaseUnit(),
                        item.getUnitId(),
                        unitLabel,
                        qtyInBase,
                        item.getCount(),
                        currentUnitPrice,
                        estLineTotal,
                        v.isAvailable() && stock.signum() > 0 ? stock : BigDecimal.ZERO,
                        availableToday));
            }

            RecurringBasketSchedule sched = scheduleByBasketId.get(b.getId());
            ScheduleDto schedDto = null;
            if (sched != null && sched.getStatus() != ScheduleStatus.CANCELLED) {
                boolean due = sched.getStatus() == ScheduleStatus.ACTIVE
                        && sched.getNextReminderDate() != null
                        && !sched.getNextReminderDate().isAfter(todayIst);
                schedDto = new ScheduleDto(
                        sched.getId(),
                        sched.getFrequency(),
                        sched.getPreferredDayOfWeek(),
                        sched.getNextReminderDate(),
                        sched.getStatus(),
                        due);
            }

            return new SavedBasketDto(
                    b.getId(),
                    b.getName(),
                    estTotal.setScale(2, RoundingMode.HALF_UP),
                    totalCount,
                    unavailable,
                    schedDto,
                    b.getUpdatedAt(),
                    itemDtos);
        }).toList();
    }

    private Long resolveCustomerId(String customerPhone) {
        return users.findByPhone(customerPhone)
                .orElseThrow(() -> new BadRequestException("Unknown user"))
                .getId();
    }
}
