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
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;

@Entity
@Table(name = "notification_preferences")
public class NotificationPreference {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false, unique = true)
    private Long userId;

    @Column(name = "whatsapp_opt_in", nullable = false)
    private boolean whatsappOptIn = false;

    @Column(name = "consent_timestamp")
    private LocalDateTime consentTimestamp;

    @Enumerated(EnumType.STRING)
    @Column(name = "preferred_language", nullable = false, length = 5)
    private NotificationLanguage preferredLanguage = NotificationLanguage.EN;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist
    @PreUpdate
    void touch() {
        updatedAt = LocalDateTime.now();
    }

    public Long getId() { return id; }
    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }
    public boolean isWhatsappOptIn() { return whatsappOptIn; }
    public void setWhatsappOptIn(boolean whatsappOptIn) { this.whatsappOptIn = whatsappOptIn; }
    public LocalDateTime getConsentTimestamp() { return consentTimestamp; }
    public void setConsentTimestamp(LocalDateTime consentTimestamp) { this.consentTimestamp = consentTimestamp; }
    public NotificationLanguage getPreferredLanguage() { return preferredLanguage; }
    public void setPreferredLanguage(NotificationLanguage preferredLanguage) { this.preferredLanguage = preferredLanguage; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
}
