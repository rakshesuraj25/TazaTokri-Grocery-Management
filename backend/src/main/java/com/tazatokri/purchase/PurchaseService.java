package com.tazatokri.purchase;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
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
    private final SupplierPaymentRepository supplierPayments;
    private final VegetableRepository vegetables;
    private final UserRepository users;
    private final InventoryService inventory;

    public PurchaseService(PurchaseRepository purchases,
                           SupplierRepository suppliers,
                           SupplierPaymentRepository supplierPayments,
                           VegetableRepository vegetables,
                           UserRepository users,
                           InventoryService inventory) {
        this.purchases = purchases;
        this.suppliers = suppliers;
        this.supplierPayments = supplierPayments;
        this.vegetables = vegetables;
        this.users = users;
        this.inventory = inventory;
    }

    @Transactional
    public PurchaseResponse create(PurchaseRequest req, String actorPhone) {
        String idempKey = trimToNull(req.idempotencyKey());
        if (idempKey != null) {
            Optional<Purchase> existing = purchases.findByIdempotencyKey(idempKey);
            if (existing.isPresent()) {
                Purchase found = existing.get();
                BigDecimal paid = safeZero(supplierPayments.sumPaidByPurchase(found.getId()));
                return PurchaseResponse.from(found, true, paid);
            }
        }

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
        p.setInvoiceNumber(trimToNull(req.invoiceNumber()));
        p.setIdempotencyKey(idempKey);
        p.setStatus(PurchaseStatus.COMPLETED);
        p.setTransportCost(req.transportCost());
        p.setNote(trimToNull(req.note()));
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
            if (i == p.getItems().size() - 1 || itemsTotal.signum() == 0) {
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
        return PurchaseResponse.from(saved, true, BigDecimal.ZERO);
    }

    @Transactional
    public PurchaseResponse cancel(Long id, String reason, String actorPhone) {
        Purchase p = purchases.findWithDetailsById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Purchase not found: " + id));
        if (p.getStatus() == PurchaseStatus.CANCELLED) {
            throw new BadRequestException("Purchase is already cancelled");
        }

        BigDecimal purchasePaid = safeZero(supplierPayments.sumPaidByPurchase(id));
        if (purchasePaid.signum() > 0) {
            throw new BadRequestException("Cannot cancel purchase with recorded payments");
        }

        Supplier supplier = suppliers.findByIdForUpdate(p.getSupplier().getId())
                .orElseThrow(() -> new ResourceNotFoundException("Supplier not found"));
        BigDecimal supplierTotalPurchases = safeZero(purchases.sumCompletedBySupplier(supplier.getId()));
        BigDecimal supplierTotalPaid = safeZero(supplierPayments.sumPaidBySupplier(supplier.getId()));
        if (supplierTotalPurchases.subtract(p.getTotalCost()).compareTo(supplierTotalPaid) < 0) {
            throw new BadRequestException("Cannot cancel purchase because supplier payments exceed remaining balance");
        }

        Long userId = users.findByPhone(actorPhone)
                .orElseThrow(() -> new BadRequestException("Unknown user")).getId();

        // Reverse stock movements via InventoryService (validates non-negative stock)
        List<PurchaseItem> sortedItems = p.getItems().stream()
                .sorted(Comparator.comparing(i -> i.getVegetable().getId()))
                .toList();
        for (PurchaseItem item : sortedItems) {
            inventory.record(
                    item.getVegetable().getId(),
                    MovementType.ADJUSTMENT,
                    item.getQuantity().negate(),
                    "Cancelled Purchase #" + p.getId(),
                    "PURCHASE_CANCEL",
                    p.getId(),
                    actorPhone);
        }

        p.setStatus(PurchaseStatus.CANCELLED);
        p.setCancelledAt(LocalDateTime.now());
        p.setCancelledBy(userId);
        p.setCancelReason(trimToNull(reason));
        Purchase saved = purchases.save(p);
        return PurchaseResponse.from(saved, true, BigDecimal.ZERO);
    }

    @Transactional(readOnly = true)
    public PurchaseResponse get(Long id) {
        Purchase p = purchases.findWithDetailsById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Purchase not found: " + id));
        BigDecimal paid = safeZero(supplierPayments.sumPaidByPurchase(id));
        return PurchaseResponse.from(p, true, paid);
    }

    @Transactional(readOnly = true)
    public List<PurchaseResponse> list(int page) {
        return list(page, null, null, null, null, null);
    }

    @Transactional(readOnly = true)
    public List<PurchaseResponse> list(int page, Long supplierId, LocalDate from, LocalDate to,
                                       PurchaseStatus status, String q) {
        String query = q == null ? null : q.trim().toLowerCase(Locale.ROOT);
        if (query != null && query.isEmpty()) {
            query = null;
        }
        final String searchTerm = query;
        return purchases.findAllByOrderByPurchaseDateDescIdDesc(PageRequest.of(page, 50)).stream()
                .filter(p -> supplierId == null || (p.getSupplier() != null && supplierId.equals(p.getSupplier().getId())))
                .filter(p -> from == null || !p.getPurchaseDate().isBefore(from))
                .filter(p -> to == null || !p.getPurchaseDate().isAfter(to))
                .filter(p -> status == null || p.getStatus() == status)
                .filter(p -> searchTerm == null
                        || (p.getSupplier() != null && p.getSupplier().getName().toLowerCase(Locale.ROOT).contains(searchTerm))
                        || (p.getInvoiceNumber() != null && p.getInvoiceNumber().toLowerCase(Locale.ROOT).contains(searchTerm))
                        || (p.getNote() != null && p.getNote().toLowerCase(Locale.ROOT).contains(searchTerm))
                        || p.getItems().stream().anyMatch(i -> i.getVegetable().getNameEn().toLowerCase(Locale.ROOT).contains(searchTerm)))
                .map(p -> PurchaseResponse.from(p, true, safeZero(supplierPayments.sumPaidByPurchase(p.getId()))))
                .toList();
    }

    private static BigDecimal safeZero(BigDecimal v) {
        return v == null ? BigDecimal.ZERO : v;
    }

    private static String trimToNull(String s) {
        if (s == null) return null;
        String trimmed = s.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
