package com.tazatokri.sales;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.TreeMap;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.tazatokri.catalog.Vegetable;
import com.tazatokri.catalog.VegetableRepository;
import com.tazatokri.common.BadRequestException;
import com.tazatokri.common.ResourceNotFoundException;
import com.tazatokri.inventory.InventoryService;
import com.tazatokri.inventory.MovementType;
import com.tazatokri.pricing.VegetablePrice;
import com.tazatokri.pricing.VegetablePriceRepository;
import com.tazatokri.user.UserRepository;

@Service
public class SaleService {

    private final SaleRepository sales;
    private final VegetableRepository vegetables;
    private final VegetablePriceRepository prices;
    private final UserRepository users;
    private final InventoryService inventory;

    public SaleService(SaleRepository sales, VegetableRepository vegetables,
                       VegetablePriceRepository prices, UserRepository users,
                       InventoryService inventory) {
        this.sales = sales;
        this.vegetables = vegetables;
        this.prices = prices;
        this.users = users;
        this.inventory = inventory;
    }

    @Transactional
    public SaleResponse create(SaleRequest req, String actorPhone) {

        // 1. idempotency: same clientRef again returns the original sale
        Optional<Sale> existing = sales.findWithDetailsByClientRef(req.clientRef());
        if (existing.isPresent()) {
            return SaleResponse.from(existing.get(), true);
        }

        Long userId = users.findByPhone(actorPhone)
                .orElseThrow(() -> new BadRequestException("Unknown user")).getId();

        // 2. merge duplicate vegetables; TreeMap keeps ids sorted (deadlock-safe order)
        TreeMap<Long, BigDecimal> qtyByVegetable = new TreeMap<>();
        for (SaleItemRequest r : req.items()) {
            qtyByVegetable.merge(r.vegetableId(), r.quantity(), BigDecimal::add);
        }

        Sale sale = new Sale();
        sale.setClientRef(req.clientRef());
        sale.setPaymentMethod(req.paymentMethod());
        sale.setCreatedBy(userId);

        // 3. price every line from the server's current price
        BigDecimal total = BigDecimal.ZERO;
        for (Map.Entry<Long, BigDecimal> e : qtyByVegetable.entrySet()) {
            Vegetable v = vegetables.findById(e.getKey())
                    .orElseThrow(() -> new BadRequestException("Vegetable does not exist: " + e.getKey()));
            if (!v.isActive() || !v.isAvailable()) {
                throw new BadRequestException(v.getNameEn() + " is not available today");
            }
            VegetablePrice price = prices.findFirstByVegetableIdOrderByIdDesc(v.getId())
                    .orElseThrow(() -> new BadRequestException("No price set for " + v.getNameEn()));

            SaleItem item = new SaleItem();
            item.setSale(sale);
            item.setVegetable(v);
            item.setQuantity(e.getValue());
            item.setUnitPrice(price.getPricePerUnit());
            item.setLineTotal(e.getValue().multiply(price.getPricePerUnit())
                    .setScale(2, RoundingMode.HALF_UP));
            sale.getItems().add(item);
            total = total.add(item.getLineTotal());
        }
        sale.setTotalAmount(total);

        // 4. save the sale first so we have its id for the ledger reference
        Sale saved = sales.save(sale);

        // 5. one ledger row per line, same transaction (rolls back together)
        for (SaleItem item : saved.getItems()) {
            inventory.record(item.getVegetable().getId(), MovementType.SHOP_SALE,
                    item.getQuantity(), "Sale #" + saved.getId(),
                    "SALE", saved.getId(), actorPhone);
        }
        return SaleResponse.from(saved, true);
    }

    @Transactional(readOnly = true)
    public SaleResponse get(Long id) {
        return SaleResponse.from(sales.findWithDetailsById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Sale not found: " + id)), true);
    }

    @Transactional(readOnly = true)
    public List<SaleResponse> listForDate(LocalDate date) {
        LocalDate d = (date == null) ? LocalDate.now() : date;
        return sales.findByCreatedAtGreaterThanEqualAndCreatedAtLessThanOrderByIdDesc(
                        d.atStartOfDay(), d.plusDays(1).atStartOfDay())
                .stream().map(s -> SaleResponse.from(s, true)).toList();
    }
}