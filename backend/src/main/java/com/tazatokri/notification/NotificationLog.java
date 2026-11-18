package com.tazatokri.notification;

import java.time.LocalDateTime;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

@Entity
@Table(name = "notification_logs")
public class NotificationLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "order_id", nullable = false)
    private Long orderId;

    @Column(name = "customer_id", nullable = false)
    private Long customerId;

    @Enumerated(EnumType.STRING)
    @Column(name = "event_type", nullable = false, length = 30)
    private NotificationEventType eventType;

    @Enumerated(EnumType.STRING)
    @Column(name = "channel", nullable = false, length = 30)
    private NotificationChannel channel;

    @Enumerated(EnumType.STRING)
    @Column(name = "language", nullable = false, length = 5)
    private NotificationLanguage language;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 30)
    private NotificationStatus status;

    @Column(name = "provider_message_id", length = 120)
    private String providerMessageId;

    @Column(name = "error_detail", length = 255)
    private String errorDetail;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    void onCreate() {
        if (createdAt == null) {
            createdAt = LocalDateTime.now();
        }
    }

    public Long getId() { return id; }
    public Long getOrderId() { return orderId; }
    public void setOrderId(Long orderId) { this.orderId = orderId; }
    public Long getCustomerId() { return customerId; }
    public void setCustomerId(Long customerId) { this.customerId = customerId; }
    public NotificationEventType getEventType() { return eventType; }
    public void setEventType(NotificationEventType eventType) { this.eventType = eventType; }
    public NotificationChannel getChannel() { return channel; }
    public void setChannel(NotificationChannel channel) { this.channel = channel; }
    public NotificationLanguage getLanguage() { return language; }
    public void setLanguage(NotificationLanguage language) { this.language = language; }
    public NotificationStatus getStatus() { return status; }
    public void setStatus(NotificationStatus status) { this.status = status; }
    public String getProviderMessageId() { return providerMessageId; }
    public void setProviderMessageId(String providerMessageId) { this.providerMessageId = providerMessageId; }
    public String getErrorDetail() { return errorDetail; }
    public void setErrorDetail(String errorDetail) { this.errorDetail = errorDetail; }
    public LocalDateTime getCreatedAt() { return createdAt; }
}
