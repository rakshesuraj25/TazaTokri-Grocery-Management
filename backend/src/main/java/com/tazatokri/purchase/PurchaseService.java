package com.tazatokri.purchase;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.tazatokri.catalog.Vegetable;
import com.tazatokri.catalog.VegetableRepository;
import com.tazatokri.common.BadRequestException;
import com.tazatokri.common.ResourceNotFoundException;
import com.tazatokri.inventory.InventoryService;
import com.tazatokri.inventory.MovementType;
import com.tazatokri.user.UserRepository;

@Service
public class PurchaseService {

    private final PurchaseRepository purchases;
    private final SupplierRepository suppliers;
    private final VegetableRepository vegetables;
    private final UserRepository users;
    private final InventoryService inventory;

    public PurchaseService(PurchaseRepository purchases, SupplierRepository suppliers,
                           VegetableRepository vegetables, UserRepository users,
                           InventoryService inventory) {
        this.purchases = purchases;
        this.suppliers = suppliers;
        this.vegetables = vegetables;
        this.users = users;
        this.inventory = inventory;
    }

    @Transactional
    public PurchaseResponse create(PurchaseRequest req, String actorPhone) {
        Supplier supplier = suppliers.findById(req.supplierId())
                .orElseThrow(() -> new BadRequestException("Supplier does not exist"));
        if (!supplier.isActive()) {
            throw new BadRequestException("Supplier is inactive");
        }

        // same vegetable twice in one purchase is rejected
        Set<Long> seen = new HashSet<>();
        for (PurchaseItemRequest r : req.items()) {
            if (!seen.add(r.vegetableId())) {
                throw new BadRequestException("Vegetable repeated in one purchase: " + r.vegetableId());
            }
        }

        // lock vegetables in a fixed order to avoid deadlocks
        List<PurchaseItemRequest> sorted = req.items().stream()
                .sorted(Comparator.comparing(PurchaseItemRequest::vegetableId)).toList();

        Long userId = users.findByPhone(actorPhone)
                .orElseThrow(() -> new BadRequestException("Unknown user")).getId();

        Purchase p = new Purchase();
        p.setSupplier(supplier);
        p.setPurchaseDate(req.purchaseDate());
        p.setTransportCost(req.transportCost());
        p.setNote(req.note() == null || req.note().isBlank() ? null : req.note().trim());
        p.setCreatedBy(userId);

        // 1. price each line
        BigDecimal itemsTotal = BigDecimal.ZERO;
        for (PurchaseItemRequest r : sorted) {
            Vegetable v = vegetables.findById(r.vegetableId())
                    .orElseThrow(() -> new BadRequestException("Vegetable does not exist: " + r.vegetableId()));
            PurchaseItem item = new PurchaseItem();
            item.setPurchase(p);
            item.setVegetable(v);
            item.setQuantity(r.quantity());
            item.setRatePerUnit(r.ratePerUnit());
            item.setLineCost(r.quantity().multiply(r.ratePerUnit()).setScale(2, RoundingMode.HALF_UP));
            p.getItems().add(item);
            itemsTotal = itemsTotal.add(item.getLineCost());
        }

        // 2. split transport by line value; the last line takes the remainder
        BigDecimal allocated = BigDecimal.ZERO;
        for (int i = 0; i < p.getItems().size(); i++) {
            PurchaseItem item = p.getItems().get(i);
            BigDecimal share;
            if (i == p.getItems().size() - 1) {
                share = req.transportCost().subtract(allocated);
            } else {
                share = req.transportCost().multiply(item.getLineCost())
                        .divide(itemsTotal, 2, RoundingMode.HALF_UP);
                allocated = allocated.add(share);
            }
            item.setTransportShare(share);
            item.setLandedCostPerUnit(item.getLineCost().add(share)
                    .divide(item.getQuantity(), 4, RoundingMode.HALF_UP));
        }
        p.setTotalCost(itemsTotal.add(req.transportCost()));

        // 3. save the purchase (IDENTITY gives us the id now)
        Purchase saved = purchases.save(p);

        // 4. one ledger row per line, in the same transaction
        for (PurchaseItem item : saved.getItems()) {
            inventory.record(item.getVegetable().getId(), MovementType.PURCHASE,
                    item.getQuantity(), "Purchase #" + saved.getId(),
                    "PURCHASE", saved.getId(), actorPhone);
        }
        return PurchaseResponse.from(saved, true);
    }

    @Transactional(readOnly = true)
    public PurchaseResponse get(Long id) {
        return PurchaseResponse.from(purchases.findWithDetailsById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Purchase not found: " + id)), true);
    }

    @Transactional(readOnly = true)
    public List<PurchaseResponse> list(int page) {
        return purchases.findAllByOrderByPurchaseDateDescIdDesc(PageRequest.of(page, 20))
                .map(p -> PurchaseResponse.from(p, false)).getContent();
    }
}