package com.tazatokri.catalog;

import java.util.List;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.tazatokri.common.DuplicateResourceException;

@Service
public class CategoryService {
    private final CategoryRepository repo;
    public CategoryService(CategoryRepository repo) { this.repo = repo; }

    @Transactional
    public Category create(String rawName) {
        String name = VegetableService.normalize(rawName);
        if (repo.existsByNameIgnoreCase(name)) {
            throw new DuplicateResourceException("Category already exists: " + name);
        }
        Category c = new Category();
        c.setName(name);
        return repo.save(c);
    }

    @Transactional(readOnly = true)
    public List<Category> listAll() { return repo.findAll(); }
}