package com.tazatokri.purchase;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.tazatokri.catalog.VegetableService;
import com.tazatokri.common.BadRequestException;
import com.tazatokri.common.DuplicateResourceException;
import com.tazatokri.common.ResourceNotFoundException;
import com.tazatokri.user.UserRepository;

@Service
public class SupplierService {

    private final SupplierRepository suppliers;
    private final PurchaseRepository purchases;
    private final SupplierPaymentRepository payments;
    private final UserRepository users;

    public SupplierService(SupplierRepository suppliers,
                           PurchaseRepository purchases,
                           SupplierPaymentRepository payments,
                           UserRepository users) {
        this.suppliers = suppliers;
        this.purchases = purchases;
        this.payments = payments;
        this.users = users;
    }

    public record SupplierSummary(
            Long id,
            String name,
            SupplierType type,
            String phone,
            String address,
            String notes,
            boolean active,
            LocalDateTime createdAt,
            long purchaseCount,
            BigDecimal totalPurchases,
            BigDecimal totalPayments,
            BigDecimal outstandingPayable,
            LocalDate lastPurchaseDate) {}

    public record SupplierDashboardResponse(
            long totalSuppliers,
            long activeSuppliers,
            BigDecimal totalPurchases,
            BigDecimal totalPayments,
            BigDecimal totalOutstandingPayable,
            List<SupplierSummary> suppliers) {}

    public record SupplierPaymentResponse(
            Long id,
            Long supplierId,
            String supplierName,
            Long purchaseId,
            String invoiceNumber,
            BigDecimal amount,
            SupplierPaymentMethod paymentMethod,
            LocalDate paymentDate,
            String referenceNumber,
            String notes,
            Long recordedBy,
            LocalDateTime createdAt) {

        public static SupplierPaymentResponse from(SupplierPayment sp) {
            return new SupplierPaymentResponse(
                    sp.getId(),
                    sp.getSupplier().getId(),
                    sp.getSupplier().getName(),
                    sp.getPurchase() != null ? sp.getPurchase().getId() : null,
                    sp.getPurchase() != null ? sp.getPurchase().getInvoiceNumber() : null,
                    scale(sp.getAmount()),
                    sp.getPaymentMethod(),
                    sp.getPaymentDate(),
                    sp.getReferenceNumber(),
                    sp.getNotes(),
                    sp.getRecordedBy(),
                    sp.getCreatedAt());
        }
    }

    public record SupplierDetailResponse(
            SupplierSummary summary,
            List<PurchaseResponse> purchases,
            List<SupplierPaymentResponse> payments) {}

    public record SupplierCreateUpdateRequest(
            String name,
            SupplierType type,
            String phone,
            String address,
            String notes,
            Boolean active) {}

    public record RecordPaymentRequest(
            Long purchaseId,
            BigDecimal amount,
            SupplierPaymentMethod paymentMethod,
            LocalDate paymentDate,
            String referenceNumber,
            String idempotencyKey,
            String notes) {}

    @Transactional(readOnly = true)
    public List<Supplier> listBasic(boolean activeOnly) {
        return suppliers.findAll().stream()
                .filter(s -> !activeOnly || s.isActive())
                .toList();
    }

    @Transactional(readOnly = true)
    public SupplierDashboardResponse getDashboard(String search, Boolean activeOnly) {
        List<Supplier> allSuppliers = suppliers.findAll();

        Map<Long, PurchaseRepository.SupplierPurchaseProjection> purchaseMap = new HashMap<>();
        for (PurchaseRepository.SupplierPurchaseProjection proj : purchases.summarizeAllSupplierPurchases()) {
            purchaseMap.put(proj.getSupplierId(), proj);
        }

        Map<Long, BigDecimal> paymentMap = new HashMap<>();
        for (SupplierPaymentRepository.SupplierPaidProjection proj : payments.summarizeAllSupplierPayments()) {
            paymentMap.put(proj.getSupplierId(), scale(proj.getTotalPaid()));
        }

        BigDecimal grandPurchases = BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
        BigDecimal grandPayments = BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
        long activeCount = 0;

        String q = trimToNull(search);
        String lowerQ = q != null ? q.toLowerCase(Locale.ROOT) : null;

        List<SupplierSummary> summaries = new java.util.ArrayList<>();
        for (Supplier s : allSuppliers) {
            if (s.isActive()) {
                activeCount++;
            }
            PurchaseRepository.SupplierPurchaseProjection pProj = purchaseMap.get(s.getId());
            long count = pProj != null ? pProj.getPurchaseCount() : 0L;
            BigDecimal totalPurchased = pProj != null ? scale(pProj.getTotalPurchases()) : scale(BigDecimal.ZERO);
            BigDecimal totalPaid = paymentMap.getOrDefault(s.getId(), scale(BigDecimal.ZERO));
            BigDecimal outstanding = totalPurchased.subtract(totalPaid).setScale(2, RoundingMode.HALF_UP);
            LocalDate lastDate = pProj != null ? pProj.getLastPurchaseDate() : null;

            grandPurchases = grandPurchases.add(totalPurchased);
            grandPayments = grandPayments.add(totalPaid);

            if (activeOnly != null && s.isActive() != activeOnly) {
                continue;
            }
            if (lowerQ != null && !matchesSearch(s, lowerQ)) {
                continue;
            }

            summaries.add(new SupplierSummary(
                    s.getId(),
                    s.getName(),
                    s.getType(),
                    s.getPhone(),
                    s.getAddress(),
                    s.getNotes(),
                    s.isActive(),
                    s.getCreatedAt(),
                    count,
                    totalPurchased,
                    totalPaid,
                    outstanding,
                    lastDate));
        }

        BigDecimal grandOutstanding = grandPurchases.subtract(grandPayments).setScale(2, RoundingMode.HALF_UP);
        return new SupplierDashboardResponse(
                allSuppliers.size(),
                activeCount,
                grandPurchases,
                grandPayments,
                grandOutstanding,
                summaries);
    }

    @Transactional(readOnly = true)
    public SupplierDetailResponse getDetail(Long supplierId) {
        Supplier s = suppliers.findById(supplierId)
                .orElseThrow(() -> new ResourceNotFoundException("Supplier not found: " + supplierId));

        List<Purchase> supplierPurchases = purchases.findBySupplierIdOrderByPurchaseDateDescIdDesc(supplierId);
        List<SupplierPayment> supplierPayments = payments.findBySupplierIdOrderByPaymentDateDescIdDesc(supplierId);

        Map<Long, BigDecimal> paidByPurchase = new HashMap<>();
        BigDecimal totalPaid = BigDecimal.ZERO;
        for (SupplierPayment sp : supplierPayments) {
            BigDecimal amt = scale(sp.getAmount());
            totalPaid = totalPaid.add(amt);
            if (sp.getPurchase() != null) {
                paidByPurchase.merge(sp.getPurchase().getId(), amt, BigDecimal::add);
            }
        }

        long completedCount = 0;
        BigDecimal totalPurchases = BigDecimal.ZERO;
        LocalDate lastDate = null;
        for (Purchase p : supplierPurchases) {
            if (p.getStatus() == PurchaseStatus.COMPLETED) {
                completedCount++;
                totalPurchases = totalPurchases.add(scale(p.getTotalCost()));
                if (lastDate == null || p.getPurchaseDate().isAfter(lastDate)) {
                    lastDate = p.getPurchaseDate();
                }
            }
        }

        totalPurchases = scale(totalPurchases);
        totalPaid = scale(totalPaid);
        BigDecimal outstanding = totalPurchases.subtract(totalPaid).setScale(2, RoundingMode.HALF_UP);

        SupplierSummary summary = new SupplierSummary(
                s.getId(),
                s.getName(),
                s.getType(),
                s.getPhone(),
                s.getAddress(),
                s.getNotes(),
                s.isActive(),
                s.getCreatedAt(),
                completedCount,
                totalPurchases,
                totalPaid,
                outstanding,
                lastDate);

        List<PurchaseResponse> purchaseDtos = supplierPurchases.stream()
                .map(p -> PurchaseResponse.from(p, true, paidByPurchase.getOrDefault(p.getId(), scale(BigDecimal.ZERO))))
                .toList();
        List<SupplierPaymentResponse> paymentDtos = supplierPayments.stream()
                .map(SupplierPaymentResponse::from)
                .toList();

        return new SupplierDetailResponse(summary, purchaseDtos, paymentDtos);
    }

    @Transactional
    public Supplier create(SupplierCreateUpdateRequest req) {
        String name = VegetableService.normalize(req.name());
        if (suppliers.existsByNameIgnoreCase(name)) {
            throw new DuplicateResourceException("Supplier already exists: " + name);
        }
        Supplier s = new Supplier();
        s.setName(name);
        s.setType(req.type());
        s.setPhone(trimToNull(req.phone()));
        s.setAddress(trimToNull(req.address()));
        s.setNotes(trimToNull(req.notes()));
        s.setActive(req.active() == null || req.active());
        return suppliers.save(s);
    }

    @Transactional
    public Supplier update(Long id, SupplierCreateUpdateRequest req) {
        Supplier s = suppliers.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Supplier not found: " + id));
        String name = VegetableService.normalize(req.name());
        if (suppliers.existsByNameIgnoreCaseAndIdNot(name, id)) {
            throw new DuplicateResourceException("Supplier already exists: " + name);
        }
        s.setName(name);
        s.setType(req.type());
        s.setPhone(trimToNull(req.phone()));
        s.setAddress(trimToNull(req.address()));
        s.setNotes(trimToNull(req.notes()));
        if (req.active() != null) {
            s.setActive(req.active());
        }
        return suppliers.save(s);
    }

    @Transactional
    public Supplier updateStatus(Long id, boolean active) {
        Supplier s = suppliers.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Supplier not found: " + id));
        s.setActive(active);
        return suppliers.save(s);
    }

    @Transactional
    public SupplierPaymentResponse recordPayment(Long supplierId, RecordPaymentRequest req, String actorPhone) {
        if (req.amount() == null || req.amount().signum() <= 0) {
            throw new BadRequestException("Payment amount must be greater than zero");
        }
        BigDecimal amount = scale(req.amount());

        String idempKey = trimToNull(req.idempotencyKey());
        if (idempKey != null) {
            Optional<SupplierPayment> existing = payments.findByIdempotencyKey(idempKey);
            if (existing.isPresent()) {
                SupplierPayment found = existing.get();
                if (!found.getSupplier().getId().equals(supplierId)
                        || scale(found.getAmount()).compareTo(amount) != 0) {
                    throw new DuplicateResourceException("Duplicate payment idempotency key");
                }
                return SupplierPaymentResponse.from(found);
            }
        }

        // Concurrency protection: lock supplier row so concurrent payments serialize
        Supplier supplier = suppliers.findByIdForUpdate(supplierId)
                .orElseThrow(() -> new ResourceNotFoundException("Supplier not found: " + supplierId));

        BigDecimal totalPurchases = scale(purchases.sumCompletedBySupplier(supplierId));
        BigDecimal totalPaid = scale(payments.sumPaidBySupplier(supplierId));
        BigDecimal supplierOutstanding = totalPurchases.subtract(totalPaid).setScale(2, RoundingMode.HALF_UP);

        if (amount.compareTo(supplierOutstanding) > 0) {
            throw new BadRequestException("Payment exceeds supplier outstanding payable (₹"
                    + supplierOutstanding.toPlainString() + ")");
        }

        Purchase linkedPurchase = null;
        if (req.purchaseId() != null) {
            linkedPurchase = purchases.findWithDetailsById(req.purchaseId())
                    .orElseThrow(() -> new ResourceNotFoundException("Purchase not found: " + req.purchaseId()));
            if (!linkedPurchase.getSupplier().getId().equals(supplierId)) {
                throw new BadRequestException("Purchase does not belong to this supplier");
            }
            if (linkedPurchase.getStatus() == PurchaseStatus.CANCELLED) {
                throw new BadRequestException("Cannot record payment against a cancelled purchase");
            }
            BigDecimal purchasePaid = scale(payments.sumPaidByPurchase(linkedPurchase.getId()));
            BigDecimal purchaseOutstanding = scale(linkedPurchase.getTotalCost()).subtract(purchasePaid)
                    .setScale(2, RoundingMode.HALF_UP);
            if (amount.compareTo(purchaseOutstanding) > 0) {
                throw new BadRequestException("Payment exceeds purchase outstanding balance (₹"
                        + purchaseOutstanding.toPlainString() + ")");
            }
        }

        Long userId = users.findByPhone(actorPhone)
                .orElseThrow(() -> new BadRequestException("Unknown user")).getId();

        SupplierPayment sp = new SupplierPayment();
        sp.setSupplier(supplier);
        sp.setPurchase(linkedPurchase);
        sp.setAmount(amount);
        sp.setPaymentMethod(req.paymentMethod());
        sp.setPaymentDate(req.paymentDate() != null ? req.paymentDate() : LocalDate.now());
        sp.setReferenceNumber(trimToNull(req.referenceNumber()));
        sp.setIdempotencyKey(idempKey);
        sp.setNotes(trimToNull(req.notes()));
        sp.setRecordedBy(userId);

        SupplierPayment saved = payments.save(sp);
        return SupplierPaymentResponse.from(saved);
    }

    @Transactional(readOnly = true)
    public List<SupplierPaymentResponse> listPayments(Long supplierId) {
        if (!suppliers.existsById(supplierId)) {
            throw new ResourceNotFoundException("Supplier not found: " + supplierId);
        }
        return payments.findBySupplierIdOrderByPaymentDateDescIdDesc(supplierId).stream()
                .map(SupplierPaymentResponse::from)
                .toList();
    }

    private static boolean matchesSearch(Supplier s, String lowerQ) {
        return (s.getName() != null && s.getName().toLowerCase(Locale.ROOT).contains(lowerQ))
                || (s.getPhone() != null && s.getPhone().toLowerCase(Locale.ROOT).contains(lowerQ))
                || (s.getAddress() != null && s.getAddress().toLowerCase(Locale.ROOT).contains(lowerQ));
    }

    private static BigDecimal scale(BigDecimal v) {
        return (v == null ? BigDecimal.ZERO : v).setScale(2, RoundingMode.HALF_UP);
    }

    private static String trimToNull(String s) {
        if (s == null) return null;
        String trimmed = s.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
