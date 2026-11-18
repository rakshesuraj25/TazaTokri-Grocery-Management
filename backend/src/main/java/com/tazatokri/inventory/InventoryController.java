package com.tazatokri.inventory;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import org.springframework.validation.annotation.Validated;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import com.tazatokri.catalog.UnitType;
import com.tazatokri.catalog.Vegetable;
import com.tazatokri.catalog.VegetableRepository;
import com.tazatokri.common.ResourceNotFoundException;
@RestController
@RequestMapping("/api/inventory")
public class InventoryController {

    private final InventoryService service;
    private final StockMovementRepository movementRepo;
    private final VegetableRepository vegetableRepo;

    public InventoryController(InventoryService service, StockMovementRepository movementRepo,
                               VegetableRepository vegetableRepo) {
        this.service = service;
        this.movementRepo = movementRepo;
        this.vegetableRepo = vegetableRepo;
    }

    public record WastageRequest(
            @NotNull Long vegetableId,
            @NotNull @DecimalMin("0.001") @Digits(integer = 9, fraction = 3) BigDecimal quantity,
            @Size(max = 255) String note) {}

    public record AdjustmentRequest(
            @NotNull Long vegetableId,
            @NotNull @Digits(integer = 9, fraction = 3) BigDecimal quantity,   // signed
            @NotBlank @Size(max = 255) String note) {}

    public record MovementResponse(Long id, MovementType type, BigDecimal quantity,
                                   String referenceType, Long referenceId, String note,
                                   Long createdBy, LocalDateTime createdAt) {
        static MovementResponse from(StockMovement m) {
            return new MovementResponse(m.getId(), m.getType(), m.getQuantity(),
                    m.getReferenceType(), m.getReferenceId(), m.getNote(),
                    m.getCreatedBy(), m.getCreatedAt());
        }
    }

    public record StockResponse(Long vegetableId, String nameEn, UnitType baseUnit,
                                BigDecimal currentStock) {}

    @PostMapping("/wastage")
    @PreAuthorize("hasAnyRole('OWNER','STAFF')")
    @ResponseStatus(HttpStatus.CREATED)
    public MovementResponse wastage(@Valid @RequestBody WastageRequest req, Authentication auth) {
        return MovementResponse.from(service.record(req.vegetableId(), MovementType.WASTAGE,
                req.quantity(), req.note(), null, null, auth.getName()));
    }

    @PostMapping("/adjustments")
    @PreAuthorize("hasRole('OWNER')")
    @ResponseStatus(HttpStatus.CREATED)
    public MovementResponse adjust(@Valid @RequestBody AdjustmentRequest req, Authentication auth) {
        return MovementResponse.from(service.record(req.vegetableId(), MovementType.ADJUSTMENT,
                req.quantity(), req.note(), null, null, auth.getName()));
    }

    @GetMapping("/stock/{vegetableId}")
    @PreAuthorize("hasAnyRole('OWNER','STAFF')")
    public StockResponse stock(@PathVariable Long vegetableId) {
        Vegetable v = vegetableRepo.findById(vegetableId)
                .orElseThrow(() -> new ResourceNotFoundException("Vegetable not found: " + vegetableId));
        return new StockResponse(v.getId(), v.getNameEn(), v.getBaseUnit(),
                service.currentStock(vegetableId));
    }

    @GetMapping("/stock/{vegetableId}/movements")
    @PreAuthorize("hasAnyRole('OWNER','STAFF')")
    public List<MovementResponse> history(@PathVariable Long vegetableId,
                                          @RequestParam(defaultValue = "0") int page) {
        Pageable p = PageRequest.of(page, 20, Sort.by(Sort.Direction.DESC, "createdAt", "id"));
        return movementRepo.findByVegetableId(vegetableId, p).map(MovementResponse::from).getContent();
    }
}