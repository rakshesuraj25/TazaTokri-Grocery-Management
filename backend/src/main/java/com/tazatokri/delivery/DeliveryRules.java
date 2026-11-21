package com.tazatokri.delivery;

import java.io.IOException;
import java.math.BigDecimal;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Properties;
import java.util.Set;
import java.util.concurrent.atomic.AtomicReference;
import java.util.regex.Pattern;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import com.tazatokri.common.BadRequestException;

@Component
public class DeliveryRules {

    private static final Logger log = LoggerFactory.getLogger(DeliveryRules.class);
    public static final ZoneId IST = ZoneId.of("Asia/Kolkata");
    private static final Pattern INDIAN_PIN_PATTERN = Pattern.compile("^[1-9][0-9]{5}$");
    private static final DateTimeFormatter TIME_FMT = DateTimeFormatter.ofPattern("HH:mm");

    public record Snapshot(
            List<String> pincodes,
            BigDecimal minOrder,
            BigDecimal fee,
            BigDecimal freeAbove,
            LocalTime cutoff,
            boolean storeOpen) {}

    private final AtomicReference<Snapshot> current;
    private final Path settingsPath;
    private final Clock clock;

    public DeliveryRules(
            List<String> pincodes,
            BigDecimal minOrder,
            BigDecimal fee,
            BigDecimal freeAbove,
            String cutoff) {
        this(pincodes, minOrder, fee, freeAbove, cutoff, null, Clock.system(IST));
    }

    public DeliveryRules(
            List<String> pincodes,
            BigDecimal minOrder,
            BigDecimal fee,
            BigDecimal freeAbove,
            String cutoff,
            String settingsFile) {
        this(pincodes, minOrder, fee, freeAbove, cutoff, settingsFile, Clock.system(IST));
    }

    @Autowired
    public DeliveryRules(
            @Value("${app.delivery.pincodes}") List<String> pincodes,
            @Value("${app.delivery.min-order}") BigDecimal minOrder,
            @Value("${app.delivery.fee}") BigDecimal fee,
            @Value("${app.delivery.free-above}") BigDecimal freeAbove,
            @Value("${app.delivery.cutoff-time}") String cutoff,
            @Value("${app.settings.file:}") String settingsFile,
            Clock clock) {
        this.settingsPath = (settingsFile != null && !settingsFile.isBlank())
                ? Paths.get(settingsFile).toAbsolutePath().normalize()
                : null;
        this.clock = clock != null ? clock : Clock.system(IST);

        Snapshot initial = buildValidatedSnapshot(
                pincodes, minOrder, fee, freeAbove, cutoff, true);

        Snapshot loaded = tryLoadPersisted(initial);
        this.current = new AtomicReference<>(loaded != null ? loaded : initial);
    }

    public boolean isServiceable(String pincode) {
        if (pincode == null) return false;
        return current.get().pincodes().contains(pincode.trim());
    }

    public BigDecimal minOrder() {
        return current.get().minOrder();
    }

    public BigDecimal feeFor(BigDecimal subtotal) {
        Snapshot s = current.get();
        return subtotal.compareTo(s.freeAbove()) >= 0 ? BigDecimal.ZERO : s.fee();
    }

    public LocalDate deliveryDateFor() {
        return deliveryDateFor(LocalDateTime.now(clock.withZone(IST)));
    }

    public LocalDate deliveryDateFor(LocalDateTime orderedAt) {
        LocalTime cutoff = current.get().cutoff();
        return orderedAt.toLocalTime().isBefore(cutoff)
                ? orderedAt.toLocalDate()
                : orderedAt.toLocalDate().plusDays(1);
    }

    public boolean isStoreOpen() {
        return current.get().storeOpen();
    }

    public Snapshot getSnapshot() {
        return current.get();
    }

    public synchronized Snapshot updateSettings(
            List<String> pincodes,
            BigDecimal minOrder,
            BigDecimal fee,
            BigDecimal freeAbove,
            String cutoffTime,
            boolean storeOpen) {
        Snapshot updated = buildValidatedSnapshot(pincodes, minOrder, fee, freeAbove, cutoffTime, storeOpen);
        persistSnapshot(updated);
        current.set(updated);
        return updated;
    }

    private Snapshot buildValidatedSnapshot(
            List<String> rawPincodes,
            BigDecimal minOrder,
            BigDecimal fee,
            BigDecimal freeAbove,
            String cutoffTime,
            boolean storeOpen) {
        if (rawPincodes == null || rawPincodes.isEmpty()) {
            throw new BadRequestException("At least one serviceable PIN code is required");
        }
        Set<String> seen = new LinkedHashSet<>();
        for (String raw : rawPincodes) {
            String pin = raw == null ? "" : raw.trim();
            if (!INDIAN_PIN_PATTERN.matcher(pin).matches()) {
                throw new BadRequestException("Invalid 6-digit Indian PIN code: " + pin);
            }
            if (!seen.add(pin)) {
                throw new BadRequestException("Duplicate PIN code is not allowed: " + pin);
            }
        }
        if (minOrder == null || minOrder.compareTo(BigDecimal.ZERO) < 0) {
            throw new BadRequestException("Minimum order amount cannot be negative");
        }
        if (fee == null || fee.compareTo(BigDecimal.ZERO) < 0) {
            throw new BadRequestException("Delivery fee cannot be negative");
        }
        if (freeAbove == null || freeAbove.compareTo(BigDecimal.ZERO) < 0) {
            throw new BadRequestException("Free-delivery threshold cannot be negative");
        }
        LocalTime parsedCutoff;
        try {
            parsedCutoff = LocalTime.parse(cutoffTime == null ? "" : cutoffTime.trim());
        } catch (DateTimeParseException ex) {
            throw new BadRequestException("Cutoff time must be a valid 24-hour time (HH:mm)");
        }
        return new Snapshot(
                List.copyOf(new ArrayList<>(seen)),
                minOrder,
                fee,
                freeAbove,
                parsedCutoff,
                storeOpen);
    }

    private Snapshot tryLoadPersisted(Snapshot fallback) {
        if (settingsPath == null || !Files.exists(settingsPath) || !Files.isRegularFile(settingsPath)) {
            return null;
        }
        try (var in = Files.newInputStream(settingsPath)) {
            Properties props = new Properties();
            props.load(in);
            String pinsRaw = props.getProperty("pincodes", "");
            List<String> pins = Arrays.stream(pinsRaw.split(","))
                    .map(String::trim)
                    .filter(s -> !s.isEmpty())
                    .toList();
            BigDecimal minOrd = new BigDecimal(props.getProperty("minOrder"));
            BigDecimal delFee = new BigDecimal(props.getProperty("fee"));
            BigDecimal freeAbv = new BigDecimal(props.getProperty("freeAbove"));
            String cut = props.getProperty("cutoffTime");
            boolean open = Boolean.parseBoolean(props.getProperty("storeOpen", "true"));
            return buildValidatedSnapshot(pins, minOrd, delFee, freeAbv, cut, open);
        } catch (Exception ex) {
            log.warn("Could not load persisted store settings from {}; using configured defaults.", settingsPath);
            return fallback;
        }
    }

    private void persistSnapshot(Snapshot s) {
        if (settingsPath == null) {
            return;
        }
        try {
            Path parent = settingsPath.getParent();
            if (parent != null) {
                Files.createDirectories(parent);
            }
            Path tmp = settingsPath.resolveSibling(settingsPath.getFileName().toString() + ".tmp");
            Properties props = new Properties();
            props.setProperty("pincodes", String.join(",", s.pincodes()));
            props.setProperty("minOrder", s.minOrder().toPlainString());
            props.setProperty("fee", s.fee().toPlainString());
            props.setProperty("freeAbove", s.freeAbove().toPlainString());
            props.setProperty("cutoffTime", s.cutoff().format(TIME_FMT));
            props.setProperty("storeOpen", String.valueOf(s.storeOpen()));
            try (var out = Files.newOutputStream(tmp)) {
                props.store(out, "TazaTokri Store Settings");
            }
            Files.move(tmp, settingsPath, StandardCopyOption.REPLACE_EXISTING);
        } catch (IOException ex) {
            log.warn("Could not persist store settings to {} ({}); keeping updated in-memory settings.",
                    settingsPath, ex.getMessage());
        }
    }
}
