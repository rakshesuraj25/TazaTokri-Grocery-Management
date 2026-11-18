package com.tazatokri.basket;

import java.time.LocalDate;
import java.time.LocalDateTime;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OneToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;

@Entity
@Table(name = "recurring_basket_schedules")
public class RecurringBasketSchedule {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "basket_id", unique = true)
    private SavedBasket basket;

    @Column(name = "customer_id", nullable = false)
    private Long customerId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private ScheduleFrequency frequency;

    @Column(name = "preferred_day_of_week")
    private Integer preferredDayOfWeek;

    @Column(name = "next_reminder_date", nullable = false)
    private LocalDate nextReminderDate;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 15)
    private ScheduleStatus status = ScheduleStatus.ACTIVE;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist
    void onCreate() {
        LocalDateTime now = LocalDateTime.now();
        createdAt = now;
        updatedAt = now;
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = LocalDateTime.now();
    }

    public Long getId() { return id; }
    public SavedBasket getBasket() { return basket; }
    public void setBasket(SavedBasket basket) { this.basket = basket; }
    public Long getCustomerId() { return customerId; }
    public void setCustomerId(Long customerId) { this.customerId = customerId; }
    public ScheduleFrequency getFrequency() { return frequency; }
    public void setFrequency(ScheduleFrequency frequency) { this.frequency = frequency; }
    public Integer getPreferredDayOfWeek() { return preferredDayOfWeek; }
    public void setPreferredDayOfWeek(Integer preferredDayOfWeek) { this.preferredDayOfWeek = preferredDayOfWeek; }
    public LocalDate getNextReminderDate() { return nextReminderDate; }
    public void setNextReminderDate(LocalDate nextReminderDate) { this.nextReminderDate = nextReminderDate; }
    public ScheduleStatus getStatus() { return status; }
    public void setStatus(ScheduleStatus status) { this.status = status; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
}
