package com.tazatokri.catalog;

import java.util.HashSet;
import java.util.List;
import java.util.Set;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.tazatokri.common.BadRequestException;
import com.tazatokri.common.DuplicateResourceException;
import com.tazatokri.common.ResourceNotFoundException;

@Service
public class VegetableService {

    private final VegetableRepository vegetableRepository;
    private final CategoryRepository categoryRepository;

    public VegetableService(VegetableRepository vegetableRepository,
                            CategoryRepository categoryRepository) {
        this.vegetableRepository = vegetableRepository;
        this.categoryRepository = categoryRepository;
    }

    @Transactional
    public VegetableResponse create(VegetableRequest req) {
        String name = normalize(req.nameEn());
        if (vegetableRepository.existsByNameEnIgnoreCase(name)) {
            throw new DuplicateResourceException("Vegetable already exists: " + name);
        }
        Category category = findActiveCategory(req.categoryId());
        validateUnits(req.units());

        Vegetable v = new Vegetable();
        v.setNameEn(name);
        v.setNameMr(optional(req.nameMr()));
        v.setNameHi(optional(req.nameHi()));
        v.setImageUrl(optional(req.imageUrl()));
        v.setCategory(category);
        v.setBaseUnit(req.baseUnit());

        for (UnitRequest u : req.units()) {
            VegetableUnit unit = new VegetableUnit();
            unit.setVegetable(v);
            unit.setLabel(normalize(u.label()));
            unit.setQuantityInBaseUnit(u.quantityInBaseUnit());
            unit.setDefaultOption(u.defaultOption());
            v.getUnits().add(unit);
        }
        return VegetableResponse.from(vegetableRepository.save(v));
    }

    @Transactional
    public VegetableResponse update(Long id, VegetableUpdateRequest req) {
        Vegetable v = load(id);
        String name = normalize(req.nameEn());
        if (vegetableRepository.existsByNameEnIgnoreCaseAndIdNot(name, id)) {
            throw new DuplicateResourceException("Vegetable already exists: " + name);
        }
        v.setNameEn(name);
        v.setNameMr(optional(req.nameMr()));
        v.setNameHi(optional(req.nameHi()));
        v.setImageUrl(optional(req.imageUrl()));
        v.setCategory(findActiveCategory(req.categoryId()));
        return VegetableResponse.from(v);
    }

    @Transactional
    public VegetableResponse setAvailable(Long id, boolean available) {
        Vegetable v = load(id);
        v.setAvailable(available);
        return VegetableResponse.from(v);
    }

    @Transactional
    public VegetableResponse setActive(Long id, boolean active) {
        Vegetable v = load(id);
        // TODO: when active == false, reject if stock > 0 or open orders exist.
        v.setActive(active);
        if (!active) {
            v.setAvailable(false);
        }
        return VegetableResponse.from(v);
    }

    @Transactional(readOnly = true)
    public List<VegetableResponse> listActive() {
        return vegetableRepository.findByActiveTrueOrderByNameEnAsc().stream()
                .map(VegetableResponse::from).toList();
    }

    @Transactional(readOnly = true)
    public VegetableResponse get(Long id) {
        return VegetableResponse.from(load(id));
    }

    // ---------- helpers ----------

    private Vegetable load(Long id) {
        return vegetableRepository.findWithDetailsById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Vegetable not found: " + id));
    }

    private Category findActiveCategory(Long id) {
        Category c = categoryRepository.findById(id)
                .orElseThrow(() -> new BadRequestException("Category does not exist"));
        if (!c.isActive()) {
            throw new BadRequestException("Category is inactive");
        }
        return c;
    }

    private void validateUnits(List<UnitRequest> units) {
        long defaults = units.stream().filter(UnitRequest::defaultOption).count();
        if (defaults != 1) {
            throw new BadRequestException("Exactly one selling option must be the default");
        }
        Set<String> labels = new HashSet<>();
        for (UnitRequest u : units) {
            if (!labels.add(normalize(u.label()).toLowerCase())) {
                throw new BadRequestException("Duplicate selling option: " + u.label());
            }
        }
    }

    public static String normalize(String value) {
        return value.trim().replaceAll("\\s+", " ");
    }

    private String optional(String value) {
        return (value == null || value.isBlank()) ? null : normalize(value);
    }
}