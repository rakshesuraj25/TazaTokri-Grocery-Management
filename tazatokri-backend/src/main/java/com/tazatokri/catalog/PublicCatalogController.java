package com.tazatokri.catalog;

import java.util.List;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/public/vegetables")
public class PublicCatalogController {

    private final PublicCatalogService service;
    public PublicCatalogController(PublicCatalogService service) { this.service = service; }

    @GetMapping
    public List<PublicVegetableResponse> list() {
        return service.list();
    }
}