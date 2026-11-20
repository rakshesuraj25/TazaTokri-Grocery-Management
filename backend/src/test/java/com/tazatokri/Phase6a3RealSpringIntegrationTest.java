package com.tazatokri;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.math.BigDecimal;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.Statement;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.atomic.AtomicInteger;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestMethodOrder;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

import tools.jackson.databind.ObjectMapper;
import com.tazatokri.auth.JwtService;
import com.tazatokri.catalog.Category;
import com.tazatokri.catalog.CategoryRepository;
import com.tazatokri.catalog.UnitType;
import com.tazatokri.catalog.Vegetable;
import com.tazatokri.catalog.VegetableRepository;
import com.tazatokri.catalog.VegetableUnit;
import com.tazatokri.common.InsufficientStockException;
import com.tazatokri.delivery.DeliveryRules;
import com.tazatokri.inventory.InventoryService;
import com.tazatokri.inventory.MovementType;
import com.tazatokri.inventory.StockMovementRepository;
import com.tazatokri.order.CustomerOrderRepository;
import com.tazatokri.order.OrderItemRequest;
import com.tazatokri.order.OrderPaymentMethod;
import com.tazatokri.order.OrderResponse;
import com.tazatokri.order.OrderService;
import com.tazatokri.order.PlaceOrderRequest;
import com.tazatokri.pricing.PriceSource;
import com.tazatokri.pricing.VegetablePrice;
import com.tazatokri.pricing.VegetablePriceRepository;
import com.tazatokri.user.Address;
import com.tazatokri.user.AddressRepository;
import com.tazatokri.user.Role;
import com.tazatokri.user.User;
import com.tazatokri.user.UserRepository;

/**
 * Phase 6A.3: Real Spring Boot Service Concurrency & Real API Integration Test.
 * 
 * Target: Dedicated Isolated Database 'tazatokri_phase6a3_test' on MySQL 8.4 (Port 3307).
 * Safety: Never touches 'tazatokri', 'tazatokri_dev', or 'tazatokri_phase6a2_test'.
 */
@SpringBootTest
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
@TestPropertySource(properties = {
    "spring.datasource.url=jdbc:mysql://localhost:3307/tazatokri_phase6a3_test?createDatabaseIfNotExist=true&useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=Asia/Kolkata",
    "spring.datasource.username=tazatokri_test",
    "spring.datasource.password=tazatokri_test_pass",
    "spring.flyway.enabled=true",
    "spring.flyway.user=tazatokri_test",
    "spring.flyway.password=tazatokri_test_pass",
    "spring.flyway.baseline-on-migrate=false",
    "spring.jpa.hibernate.ddl-auto=none",
    "app.jwt.secret=test-isolated-jwt-secret-for-tests-only-must-be-32bytes-long",
    "app.jwt.expiration-minutes=60",
    "app.bootstrap.owner-password=TestOwner@123"
})
public class Phase6a3RealSpringIntegrationTest {

    private static final String EXPECTED_DB = "tazatokri_phase6a3_test";
    private static final String JDBC_URL = "jdbc:mysql://localhost:3307/" + EXPECTED_DB
            + "?createDatabaseIfNotExist=true&useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=Asia/Kolkata";
    private static final String USER = "tazatokri_test";
    private static final String PASS = "tazatokri_test_pass";

    @Autowired
    private WebApplicationContext webApplicationContext;

    @Autowired
    private InventoryService inventoryService;

    @Autowired
    private OrderService orderService;

    @Autowired
    private DeliveryRules deliveryRules;

    @Autowired
    private VegetableRepository vegetableRepository;

    @Autowired
    private StockMovementRepository stockMovementRepository;

    @Autowired
    private CategoryRepository categoryRepository;

    @Autowired
    private VegetablePriceRepository vegetablePriceRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private AddressRepository addressRepository;

    @Autowired
    private CustomerOrderRepository customerOrderRepository;

    @Autowired
    private JwtService jwtService;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private jakarta.servlet.Filter springSecurityFilterChain;

    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @BeforeEach
    void setupMockMvc() {
        this.mockMvc = MockMvcBuilders.webAppContextSetup(webApplicationContext)
                .addFilters(springSecurityFilterChain)
                .build();
    }

    private static Connection getDirectConnection() throws Exception {
        return DriverManager.getConnection(JDBC_URL, USER, PASS);
    }

    @BeforeAll
    static void initializeSchema() throws Exception {
        System.out.println("=================================================================");
        System.out.println("PHASE 6A.3: INITIALIZING DEDICATED DATABASE " + EXPECTED_DB);
        System.out.println("=================================================================");

        // Run Flyway migrations on the dedicated Phase 6A.3 database
        Flyway flyway = Flyway.configure()
                .dataSource(JDBC_URL, USER, PASS)
                .locations("classpath:db/migration")
                .baselineOnMigrate(false)
                .load();

        var res = flyway.migrate();
        System.out.println("Phase 6A.3 Flyway Migrations Executed: " + res.migrationsExecuted);
        var currentInfo = flyway.info().current();
        assertNotNull(currentInfo, "Current Flyway schema info must not be null");
        assertEquals("4", currentInfo.getVersion().getVersion(), "Database must be at schema version 4");

        // Verify safety preconditions
        try (Connection conn = getDirectConnection(); Statement stmt = conn.createStatement()) {
            try (ResultSet rs = stmt.executeQuery("SELECT DATABASE()")) {
                assertTrue(rs.next());
                String db = rs.getString(1);
                System.out.println("Active Database: " + db);
                assertEquals(EXPECTED_DB, db);
                assertNotEquals("tazatokri", db);
                assertNotEquals("tazatokri_dev", db);
                assertNotEquals("tazatokri_phase6a2_test", db);
            }
        }
    }

    @Test
    @Order(1)
    void test01_verifyRealSpringServiceLevelConcurrencyAndPessimisticLocking() throws Exception {
        System.out.println("=================================================================");
        System.out.println("PHASE 6A.3 - TEST 1: REAL SPRING INVENTORY SERVICE CONCURRENCY");
        System.out.println("=================================================================");

        Long vegId = 99993L;
        Long catId = 99931L;
        String staffPhone = "9999999993";

        // Setup test data in real database
        try (Connection conn = getDirectConnection(); Statement stmt = conn.createStatement()) {
            stmt.executeUpdate("DELETE FROM stock_movements WHERE vegetable_id = " + vegId);
            stmt.executeUpdate("DELETE FROM vegetable_units WHERE vegetable_id = " + vegId);
            stmt.executeUpdate("DELETE FROM vegetable_prices WHERE vegetable_id = " + vegId);
            stmt.executeUpdate("DELETE FROM vegetables WHERE id = " + vegId);
            stmt.executeUpdate("DELETE FROM categories WHERE id = " + catId);
            stmt.executeUpdate("DELETE FROM user_roles WHERE user_id IN (SELECT id FROM users WHERE phone = '" + staffPhone + "')");
            stmt.executeUpdate("DELETE FROM users WHERE phone = '" + staffPhone + "'");

            stmt.executeUpdate("INSERT INTO categories (id, name, active) VALUES (" + catId + ", 'Phase6a3 Concurrency Cat', 1)");
            stmt.executeUpdate("INSERT INTO users (id, phone, full_name, password_hash, active, created_at) VALUES (9993, '"
                    + staffPhone + "', 'Phase6a3 Staff User', '$2a$10$xyz', 1, NOW())");
            stmt.executeUpdate("INSERT INTO user_roles (user_id, role) VALUES (9993, 'STAFF')");
            stmt.executeUpdate("INSERT INTO vegetables (id, name_en, name_mr, name_hi, category_id, base_unit, active, available, created_at, updated_at) "
                    + "VALUES (" + vegId + ", 'Phase6a3 Concurrency Tomato', 'टोमॅटो', 'टमाटर', " + catId + ", 'KG', 1, 1, NOW(), NOW())");
        }

        // Inward initial 10.000 KG stock using real Spring InventoryService bean
        inventoryService.record(vegId, MovementType.PURCHASE, new BigDecimal("10.000"),
                "Initial 10kg Inward", "PURCHASE", 1L, staffPhone);

        BigDecimal startStock = inventoryService.currentStock(vegId);
        System.out.println("Initial Stock in Spring Service: " + startStock + " KG");
        assertEquals(new BigDecimal("10.000"), startStock);

        // Concurrency test: 10 threads concurrently invoke inventoryService.record with 2.000 KG deduction each.
        // Total requested: 20.000 KG. Available: 10.000 KG.
        // Expected: Exactly 5 succeed (10.000 KG total), exactly 5 throw InsufficientStockException.
        int totalThreads = 10;
        BigDecimal deductionAmount = new BigDecimal("2.000");
        AtomicInteger successCount = new AtomicInteger(0);
        AtomicInteger failureCount = new AtomicInteger(0);
        CountDownLatch latch = new CountDownLatch(1);
        ExecutorService executor = Executors.newFixedThreadPool(totalThreads);
        List<Future<?>> futures = new ArrayList<>();

        for (int i = 0; i < totalThreads; i++) {
            final int threadId = i;
            futures.add(executor.submit(() -> {
                try {
                    latch.await();
                    // Invoking the real Spring Boot @Transactional InventoryService
                    inventoryService.record(vegId, MovementType.ONLINE_SALE, deductionAmount,
                            "Concurrent deduction #" + threadId, "ORDER", (long) threadId, staffPhone);
                    successCount.incrementAndGet();
                } catch (InsufficientStockException ise) {
                    failureCount.incrementAndGet();
                } catch (Exception ex) {
                    System.err.println("Unexpected exception in thread " + threadId + ": " + ex.getMessage());
                    failureCount.incrementAndGet();
                }
            }));
        }

        latch.countDown(); // Fire all 10 threads concurrently
        for (Future<?> f : futures) {
            f.get();
        }
        executor.shutdown();

        System.out.println("Spring Service Concurrency Results:");
        System.out.println("  Successful Spring Deductions: " + successCount.get());
        System.out.println("  Rejected (Insufficient Stock): " + failureCount.get());

        assertEquals(5, successCount.get(), "Exactly 5 threads should successfully deduct 2.000 KG");
        assertEquals(5, failureCount.get(), "Exactly 5 threads must throw InsufficientStockException");

        // Verify directly from MySQL InnoDB storage
        try (Connection conn = getDirectConnection(); Statement stmt = conn.createStatement()) {
            try (ResultSet rs = stmt.executeQuery(
                    "SELECT COALESCE(SUM(quantity), 0) FROM stock_movements WHERE vegetable_id = " + vegId)) {
                assertTrue(rs.next());
                BigDecimal finalDbStock = rs.getBigDecimal(1);
                System.out.println("Final MySQL Database Stock: " + finalDbStock);
                assertEquals(0, new BigDecimal("0.000").compareTo(finalDbStock), "Stock must be exactly 0.000 kg and never negative");
            }

            // Verify stock movement ledger entries
            try (ResultSet rs = stmt.executeQuery(
                    "SELECT COUNT(*) FROM stock_movements WHERE vegetable_id = " + vegId + " AND type = 'ONLINE_SALE'")) {
                assertTrue(rs.next());
                assertEquals(5, rs.getInt(1), "Exactly 5 deduction records must be present in stock_movements");
            }
        }
    }

    @Test
    @Order(2)
    void test02_verifyRealApiOrderEndpointsAndBusinessRules() throws Exception {
        System.out.println("=================================================================");
        System.out.println("PHASE 6A.3 - TEST 2: REAL API TESTING WITH SPRING MOCKMVC");
        System.out.println("=================================================================");

        Long vegId = 99994L;
        Long unitId = 99941L;
        String custPhone = "8888888884";
        Long custUserId = 9994L;
        Long validAddrId = 99941L;
        Long unserviceableAddrId = 99942L;

        // Clean & Seed test catalog, pricing, user, addresses, and stock
        try (Connection conn = getDirectConnection(); Statement stmt = conn.createStatement()) {
            stmt.executeUpdate("DELETE FROM order_items WHERE order_id IN (SELECT id FROM orders WHERE customer_id = " + custUserId + ")");
            stmt.executeUpdate("DELETE FROM orders WHERE customer_id = " + custUserId);
            stmt.executeUpdate("DELETE FROM stock_movements WHERE vegetable_id = " + vegId);
            stmt.executeUpdate("DELETE FROM vegetable_units WHERE vegetable_id = " + vegId);
            stmt.executeUpdate("DELETE FROM vegetable_prices WHERE vegetable_id = " + vegId);
            stmt.executeUpdate("DELETE FROM vegetables WHERE id = " + vegId);
            stmt.executeUpdate("DELETE FROM addresses WHERE user_id = " + custUserId);
            stmt.executeUpdate("DELETE FROM user_roles WHERE user_id = " + custUserId);
            stmt.executeUpdate("DELETE FROM users WHERE id = " + custUserId);

            // User & Roles
            stmt.executeUpdate("INSERT INTO users (id, phone, full_name, password_hash, active, created_at) VALUES ("
                    + custUserId + ", '" + custPhone + "', 'Phase6a3 Customer', '$2a$10$xyz', 1, NOW())");
            stmt.executeUpdate("INSERT INTO user_roles (user_id, role) VALUES (" + custUserId + ", 'CUSTOMER')");

            // Serviceable address (411026) and unserviceable address (411001)
            stmt.executeUpdate("INSERT INTO addresses (id, user_id, label, line1, line2, landmark, pincode, default_address, active, created_at) "
                    + "VALUES (" + validAddrId + ", " + custUserId + ", 'Home', 'Flat 101, Test Appt', 'Street 2', 'Near Garden', '411026', 1, 1, NOW())");
            stmt.executeUpdate("INSERT INTO addresses (id, user_id, label, line1, line2, landmark, pincode, default_address, active, created_at) "
                    + "VALUES (" + unserviceableAddrId + ", " + custUserId + ", 'Office', 'Camp Area', 'MG Road', 'Near Station', '411001', 0, 1, NOW())");

            // Ensure Category 9993 exists for API test vegetable
            stmt.executeUpdate("INSERT INTO categories (id, name, active) VALUES (9993, 'Phase6a3 Test Cat', 1) ON DUPLICATE KEY UPDATE active = 1");

            // Vegetable (₹40.00 per KG, unit: 1 KG)
            stmt.executeUpdate("INSERT INTO vegetables (id, name_en, name_mr, name_hi, category_id, base_unit, active, available, created_at, updated_at) "
                    + "VALUES (" + vegId + ", 'Phase6a3 API Tomato', 'टोमॅटो', 'टमाटर', 9993, 'KG', 1, 1, NOW(), NOW())");
            stmt.executeUpdate("INSERT INTO vegetable_units (id, vegetable_id, label, quantity_in_base_unit, default_option, active) "
                    + "VALUES (" + unitId + ", " + vegId + ", '1 KG', 1.000, 1, 1)");
            stmt.executeUpdate("INSERT INTO vegetable_prices (vegetable_id, price_per_unit, source, note, created_by, created_at) "
                    + "VALUES (" + vegId + ", 40.00, 'MANUAL', 'API Test Price', " + custUserId + ", NOW())");

            // Initial Inward Stock: 50.000 KG
            stmt.executeUpdate("INSERT INTO stock_movements (vegetable_id, type, quantity, reference_type, note, created_by, created_at) "
                    + "VALUES (" + vegId + ", 'PURCHASE', 50.000, 'PURCHASE', 'Inward 50kg for API Tests', " + custUserId + ", NOW())");
        }

        // Generate Real JWT Token for the customer
        User customer = userRepository.findById(custUserId).orElseThrow();
        String customerJwt = "Bearer " + jwtService.generateToken(customer);

        // 1. Minimum Order Boundary: ₹149.99 rejected (3 units * ₹40 = ₹120 < ₹150)
        PlaceOrderRequest reqBelowMin = new PlaceOrderRequest(
                "REF-MIN-FAIL-01",
                validAddrId,
                OrderPaymentMethod.COD,
                List.of(new OrderItemRequest(vegId, unitId, 3))
        );

        mockMvc.perform(post("/api/customer/orders")
                .header("Authorization", customerJwt)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(reqBelowMin)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Minimum order is Rs 150"));

        // 2. Minimum Order Accepted: 4 units * ₹40 = ₹160 (>= ₹150)
        // Subtotal ₹160 (< ₹300) must incur ₹30 delivery fee -> total = ₹190
        PlaceOrderRequest reqAboveMin = new PlaceOrderRequest(
                "REF-MIN-PASS-01",
                validAddrId,
                OrderPaymentMethod.COD,
                List.of(new OrderItemRequest(vegId, unitId, 4))
        );

        String firstOrderJson = mockMvc.perform(post("/api/customer/orders")
                .header("Authorization", customerJwt)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(reqAboveMin)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").isNumber())
                .andExpect(jsonPath("$.subtotal").value(160.00))
                .andExpect(jsonPath("$.deliveryFee").value(30.00))
                .andExpect(jsonPath("$.estimatedTotal").value(190.00))
                .andReturn()
                .getResponse()
                .getContentAsString();
        long firstOrderId = objectMapper.readTree(firstOrderJson).get("id").asLong();

        // 3. Free Delivery Threshold: 8 units * ₹40 = ₹320 (>= ₹300) -> deliveryFee = ₹0.00
        PlaceOrderRequest reqFreeDelivery = new PlaceOrderRequest(
                "REF-FREE-DEL-01",
                validAddrId,
                OrderPaymentMethod.COD,
                List.of(new OrderItemRequest(vegId, unitId, 8))
        );

        mockMvc.perform(post("/api/customer/orders")
                .header("Authorization", customerJwt)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(reqFreeDelivery)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.subtotal").value(320.00))
                .andExpect(jsonPath("$.deliveryFee").value(0.00))
                .andExpect(jsonPath("$.estimatedTotal").value(320.00));

        // 4. PIN Code Serviceability: Address with PIN 411001 rejected
        PlaceOrderRequest reqUnserviceablePin = new PlaceOrderRequest(
                "REF-UNSERV-PIN-01",
                unserviceableAddrId,
                OrderPaymentMethod.COD,
                List.of(new OrderItemRequest(vegId, unitId, 4))
        );

        mockMvc.perform(post("/api/customer/orders")
                .header("Authorization", customerJwt)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(reqUnserviceablePin)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("We do not deliver to pincode 411001 yet"));

        // 5. Invalid Quantity Validation: count <= 0 rejected with 400 Bad Request
        String invalidCountPayload = """
                {
                    "clientRef": "REF-INV-COUNT",
                    "addressId": %d,
                    "paymentMethod": "COD",
                    "items": [{"vegetableId": %d, "unitId": %d, "count": 0}]
                }
                """.formatted(validAddrId, vegId, unitId);

        mockMvc.perform(post("/api/customer/orders")
                .header("Authorization", customerJwt)
                .contentType(MediaType.APPLICATION_JSON)
                .content(invalidCountPayload))
                .andExpect(status().isBadRequest());

        // 6. Invalid Payload: Blank clientRef rejected with 400 Bad Request
        String blankClientRefPayload = """
                {
                    "clientRef": "",
                    "addressId": %d,
                    "paymentMethod": "COD",
                    "items": [{"vegetableId": %d, "unitId": %d, "count": 4}]
                }
                """.formatted(validAddrId, vegId, unitId);

        mockMvc.perform(post("/api/customer/orders")
                .header("Authorization", customerJwt)
                .contentType(MediaType.APPLICATION_JSON)
                .content(blankClientRefPayload))
                .andExpect(status().isBadRequest());

        // 7. Authentication Required: Calling without JWT token rejected with 401 Unauthorized
        mockMvc.perform(post("/api/customer/orders")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(reqAboveMin)))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.message").value("Authentication required"));

        // 8. Idempotency: Resubmitting identical clientRef returns existing order with same ID
        mockMvc.perform(post("/api/customer/orders")
                .header("Authorization", customerJwt)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(reqAboveMin)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value(firstOrderId))
                .andExpect(jsonPath("$.subtotal").value(160.00))
                .andExpect(jsonPath("$.deliveryFee").value(30.00))
                .andExpect(jsonPath("$.estimatedTotal").value(190.00));

        // Verify in MySQL that only 1 order row exists for REF-MIN-PASS-01
        try (Connection conn = getDirectConnection(); Statement stmt = conn.createStatement();
             ResultSet rs = stmt.executeQuery("SELECT COUNT(*) FROM orders WHERE client_ref = 'REF-MIN-PASS-01'")) {
            assertTrue(rs.next());
            assertEquals(1, rs.getInt(1), "Idempotent resubmission must not create a duplicate order row");
        }

        System.out.println("Real API Testing passed all validations.");
    }

    @Test
    @Order(3)
    void test03_verifyCutoffTimingAndDeliveryDateCalculation() {
        System.out.println("=================================================================");
        System.out.println("PHASE 6A.3 - TEST 3: CUTOFF TIMING & DATE CALCULATION");
        System.out.println("=================================================================");

        LocalDate today = LocalDate.now();
        LocalDate tomorrow = today.plusDays(1);

        LocalDateTime t17_59 = LocalDateTime.of(today, LocalTime.of(17, 59, 59));
        LocalDateTime t18_00 = LocalDateTime.of(today, LocalTime.of(18, 0, 0));
        LocalDateTime t18_01 = LocalDateTime.of(today, LocalTime.of(18, 1, 0));

        assertEquals(today, deliveryRules.deliveryDateFor(t17_59), "Order before 18:00 cutoff must be scheduled for TODAY");
        assertEquals(tomorrow, deliveryRules.deliveryDateFor(t18_00), "Order at 18:00 cutoff must be scheduled for TOMORROW");
        assertEquals(tomorrow, deliveryRules.deliveryDateFor(t18_01), "Order after 18:00 cutoff must be scheduled for TOMORROW");
    }
}
