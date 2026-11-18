package com.tazatokri.catalog;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

@RestController
@RequestMapping("/api/categories")
public class CategoryController {
	private final CategoryService service;

	public CategoryController(CategoryService service) {
		this.service = service;
	}

	public record CategoryRequest(@NotBlank @Size(max = 60) String name) {
	}

	public record CategoryResponse(Long id, String name, boolean active) {
	}

	@PostMapping
	@PreAuthorize("hasRole('OWNER')")
	@ResponseStatus(HttpStatus.CREATED)
	public CategoryResponse create(@Valid @RequestBody CategoryRequest req) {
		Category c = service.create(req.name());
		return new CategoryResponse(c.getId(), c.getName(), c.isActive());
	}

	@GetMapping
	@PreAuthorize("hasAnyRole('OWNER','STAFF')")
	public List<CategoryResponse> list() {
		return service.listAll().stream().map(c -> new CategoryResponse(c.getId(), c.getName(), c.isActive())).toList();
	}
}