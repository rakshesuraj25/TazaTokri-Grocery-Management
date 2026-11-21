package com.tazatokri.common;

import java.time.Clock;
import java.util.Iterator;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

/**
 * Lightweight, thread-safe fixed-window in-memory rate limiter for single-node
 * Spring Boot deployment. Evicts expired entries when map capacity grows.
 */
@Service
public class RateLimitService {

    public record Decision(boolean allowed, int limit, int remaining, long retryAfterSeconds) {}

    private static final int MAX_BUCKETS = 10_000;

    private static final class WindowCounter {
        long windowStartMillis;
        int count;

        WindowCounter(long windowStartMillis) {
            this.windowStartMillis = windowStartMillis;
            this.count = 0;
        }
    }

    private final Clock clock;
    private final ConcurrentHashMap<String, WindowCounter> buckets = new ConcurrentHashMap<>();

    @Autowired
    public RateLimitService() {
        this(Clock.systemUTC());
    }

    public RateLimitService(Clock clock) {
        this.clock = clock;
    }

    public Decision tryConsume(String key, int maxRequests, long windowSeconds) {
        long now = clock.millis();
        long windowMillis = Math.max(1L, windowSeconds) * 1000L;

        if (buckets.size() > MAX_BUCKETS) {
            evictExpired(now, windowMillis);
        }

        WindowCounter counter = buckets.computeIfAbsent(key, k -> new WindowCounter(now));
        synchronized (counter) {
            if (now - counter.windowStartMillis >= windowMillis) {
                counter.windowStartMillis = now;
                counter.count = 0;
            }
            if (counter.count >= maxRequests) {
                long remainingMillis = Math.max(1000L, windowMillis - (now - counter.windowStartMillis));
                long retryAfter = (remainingMillis + 999L) / 1000L;
                return new Decision(false, maxRequests, 0, retryAfter);
            }
            counter.count++;
            int remaining = Math.max(0, maxRequests - counter.count);
            return new Decision(true, maxRequests, remaining, 0L);
        }
    }

    private void evictExpired(long now, long windowMillis) {
        Iterator<Map.Entry<String, WindowCounter>> it = buckets.entrySet().iterator();
        while (it.hasNext()) {
            Map.Entry<String, WindowCounter> entry = it.next();
            WindowCounter c = entry.getValue();
            synchronized (c) {
                if (now - c.windowStartMillis >= windowMillis) {
                    it.remove();
                }
            }
        }
    }
}
