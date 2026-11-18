package com.tazatokri.inventory;

import java.math.BigDecimal;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.tazatokri.catalog.Vegetable;
import com.tazatokri.catalog.VegetableRepository;
import com.tazatokri.common.BadRequestException;
import com.tazatokri.common.InsufficientStockException;
import com.tazatokri.common.ResourceNotFoundException;
import com.tazatokri.user.UserRepository;

@Service
public class InventoryService {

    private final StockMovementRepository movements;
    private final VegetableRepository vegetables;
    private final UserRepository users;

    public InventoryService(StockMovementRepository movements,
                            VegetableRepository vegetables, UserRepository users) {
        this.movements = movements;
        this.vegetables = vegetables;
        this.users = users;
    }

    @Transactional
    public StockMovement record(Long vegetableId, MovementType type, BigDecimal quantity,
                                String note, String refType, Long refId, String actorPhone) {

        // 1. Lock the vegetable row FIRST, so concurrent changes queue up
        Vegetable v = vegetables.findByIdForUpdate(vegetableId)
                .orElseThrow(() -> new ResourceNotFoundException("Vegetable not found: " + vegetableId));
        if (!v.isActive()) {
            throw new BadRequestException("Vegetable is inactive");
        }

        // 2. Decide the sign from the type
        BigDecimal delta = signedQuantity(type, quantity, note);

        // 3. Never allow negative stock
        if (delta.signum() < 0) {
            BigDecimal current = movements.currentStock(vegetableId);
            if (current.add(delta).signum() < 0) {
                throw new InsufficientStockException("Only " + current.stripTrailingZeros().toPlainString()
                        + " " + v.getBaseUnit() + " of " + v.getNameEn() + " in stock");
            }
        }

        Long userId = users.findByPhone(actorPhone)
                .orElseThrow(() -> new BadRequestException("Unknown user")).getId();

        // 4. Append the row
        return movements.save(new StockMovement(v, type, delta, refType, refId, note, userId));
    }

    @Transactional(readOnly = true)
    public BigDecimal currentStock(Long vegetableId) {
        return movements.currentStock(vegetableId);
    }

    private BigDecimal signedQuantity(MovementType type, BigDecimal qty, String note) {
        switch (type) {
            case PURCHASE:
            case ONLINE_CANCEL_RETURN:
                requirePositive(qty);
                return qty;
            case SHOP_SALE:
            case ONLINE_SALE:
            case WASTAGE:
                requirePositive(qty);
                return qty.negate();
            case ADJUSTMENT:
                if (qty.signum() == 0) throw new BadRequestException("Adjustment cannot be zero");
                if (note == null || note.isBlank()) throw new BadRequestException("Adjustment needs a reason");
                return qty;
            default:
                throw new BadRequestException("Unsupported movement type");
        }
    }

    private void requirePositive(BigDecimal qty) {
        if (qty == null || qty.signum() <= 0) {
            throw new BadRequestException("Quantity must be greater than 0");
        }
    }
}