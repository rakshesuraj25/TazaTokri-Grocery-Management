package com.tazatokri.basket;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/my/baskets")
public class BasketController {

    private final BasketService service;

    public BasketController(BasketService service) {
        this.service = service;
    }

    @GetMapping
    public List<BasketService.SavedBasketDto> list(Authentication auth) {
        return service.listForCustomer(auth.getName());
    }

    @GetMapping("/reminders")
    public List<BasketService.SavedBasketDto> reminders(Authentication auth) {
        return service.listReminders(auth.getName());
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public BasketService.SavedBasketDto create(
            @Valid @RequestBody BasketService.BasketUpsertRequest req,
            Authentication auth) {
        return service.create(req, auth.getName());
    }

    @PutMapping("/{id}")
    public BasketService.SavedBasketDto update(
            @PathVariable Long id,
            @Valid @RequestBody BasketService.BasketUpsertRequest req,
            Authentication auth) {
        return service.update(id, req, auth.getName());
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long id, Authentication auth) {
        service.delete(id, auth.getName());
    }

    @PutMapping("/{id}/schedule")
    public BasketService.SavedBasketDto upsertSchedule(
            @PathVariable Long id,
            @Valid @RequestBody BasketService.ScheduleUpsertRequest req,
            Authentication auth) {
        return service.upsertSchedule(id, req, auth.getName());
    }

    @PostMapping("/{id}/schedule/pause")
    public BasketService.SavedBasketDto pauseSchedule(
            @PathVariable Long id,
            Authentication auth) {
        return service.pauseSchedule(id, auth.getName());
    }

    @PostMapping("/{id}/schedule/resume")
    public BasketService.SavedBasketDto resumeSchedule(
            @PathVariable Long id,
            Authentication auth) {
        return service.resumeSchedule(id, auth.getName());
    }

    @DeleteMapping("/{id}/schedule")
    public BasketService.SavedBasketDto cancelSchedule(
            @PathVariable Long id,
            Authentication auth) {
        return service.cancelSchedule(id, auth.getName());
    }
}
