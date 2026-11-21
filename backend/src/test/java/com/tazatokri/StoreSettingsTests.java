package com.tazatokri;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.math.BigDecimal;
import java.nio.file.Path;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.security.access.prepost.PreAuthorize;

import com.tazatokri.common.BadRequestException;
import com.tazatokri.delivery.DeliveryRules;
import com.tazatokri.delivery.StoreSettingsController;

class StoreSettingsTests {

    @TempDir
    Path tempDir;

    @Test
    void ownerEndpointsEnforceOwnerRoleAnnotation() throws Exception {
        var getMethod = StoreSettingsController.class.getMethod("getOwnerSettings");
        var putMethod = StoreSettingsController.class.getMethod(
                "updateOwnerSettings", StoreSettingsController.UpdateStoreSettingsRequest.class);

        PreAuthorize getAuth = getMethod.getAnnotation(PreAuthorize.class);
        PreAuthorize putAuth = putMethod.getAnnotation(PreAuthorize.class);
        assertNotNull(getAuth);
        assertNotNull(putAuth);
        assertEquals("hasRole('OWNER')", getAuth.value());
        assertEquals("hasRole('OWNER')", putAuth.value());
    }

    @Test
    void validatesPincodesDuplicatesAmountsAndCutoffTime() {
        DeliveryRules rules = new DeliveryRules(
                List.of("411026", "411039"),
                new BigDecimal("150"),
                new BigDecimal("30"),
                new BigDecimal("300"),
                "18:00");

        // Invalid PIN formats
        assertThrows(BadRequestException.class, () ->
                rules.updateSettings(List.of("41102"), new BigDecimal("150"), new BigDecimal("30"), new BigDecimal("300"), "18:00", true));
        assertThrows(BadRequestException.class, () ->
                rules.updateSettings(List.of("011026"), new BigDecimal("150"), new BigDecimal("30"), new BigDecimal("300"), "18:00", true));

        // Duplicate PIN
        assertThrows(BadRequestException.class, () ->
                rules.updateSettings(List.of("411026", "411026"), new BigDecimal("150"), new BigDecimal("30"), new BigDecimal("300"), "18:00", true));

        // Empty PIN list
        assertThrows(BadRequestException.class, () ->
                rules.updateSettings(List.of(), new BigDecimal("150"), new BigDecimal("30"), new BigDecimal("300"), "18:00", true));

        // Negative amounts
        assertThrows(BadRequestException.class, () ->
                rules.updateSettings(List.of("411026"), new BigDecimal("-1"), new BigDecimal("30"), new BigDecimal("300"), "18:00", true));
        assertThrows(BadRequestException.class, () ->
                rules.updateSettings(List.of("411026"), new BigDecimal("150"), new BigDecimal("-5"), new BigDecimal("300"), "18:00", true));
        assertThrows(BadRequestException.class, () ->
                rules.updateSettings(List.of("411026"), new BigDecimal("150"), new BigDecimal("30"), new BigDecimal("-10"), "18:00", true));

        // Invalid cutoff time
        assertThrows(BadRequestException.class, () ->
                rules.updateSettings(List.of("411026"), new BigDecimal("150"), new BigDecimal("30"), new BigDecimal("300"), "25:99", true));
    }

    @Test
    void updatesAndPersistsSettingsAcrossReload() {
        Path file = tempDir.resolve("store-settings.properties");
        DeliveryRules rules = new DeliveryRules(
                List.of("411026", "411039"),
                new BigDecimal("150"),
                new BigDecimal("30"),
                new BigDecimal("300"),
                "18:00",
                file.toString());

        StoreSettingsController controller = new StoreSettingsController(rules);
        var updated = controller.updateOwnerSettings(new StoreSettingsController.UpdateStoreSettingsRequest(
                List.of("411026", "411057"),
                new BigDecimal("200"),
                new BigDecimal("25"),
                new BigDecimal("400"),
                "19:30",
                false));

        assertEquals(List.of("411026", "411057"), updated.pincodes());
        assertEquals(new BigDecimal("200"), updated.minOrder());
        assertEquals(new BigDecimal("25"), updated.deliveryFee());
        assertEquals(new BigDecimal("400"), updated.freeDeliveryAbove());
        assertEquals("19:30", updated.cutoffTime());
        assertFalse(updated.storeOpen());

        // Reload from persisted file
        DeliveryRules reloaded = new DeliveryRules(
                List.of("411026", "411039"),
                new BigDecimal("150"),
                new BigDecimal("30"),
                new BigDecimal("300"),
                "18:00",
                file.toString());

        assertTrue(reloaded.isServiceable("411057"));
        assertFalse(reloaded.isServiceable("411039"));
        assertEquals(new BigDecimal("200"), reloaded.minOrder());
        assertEquals(new BigDecimal("25"), reloaded.feeFor(new BigDecimal("250")));
        assertEquals(BigDecimal.ZERO, reloaded.feeFor(new BigDecimal("400")));
        assertEquals(LocalDate.of(2026, 11, 21),
                reloaded.deliveryDateFor(LocalDateTime.of(2026, 11, 21, 19, 0)));
        assertFalse(reloaded.isStoreOpen());
    }
}
