package com.tazatokri;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.lang.reflect.InvocationHandler;
import java.lang.reflect.Proxy;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Date;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

import com.tazatokri.auth.AuthService;
import com.tazatokri.auth.JwtAuthFilter;
import com.tazatokri.auth.JwtService;
import com.tazatokri.auth.LoginRequest;
import com.tazatokri.auth.LoginResponse;
import com.tazatokri.common.DuplicateResourceException;
import com.tazatokri.common.GlobalExceptionHandler;
import com.tazatokri.common.InvalidCredentialsException;
import com.tazatokri.common.ResourceNotFoundException;
import com.tazatokri.delivery.DeliveryRules;
import com.tazatokri.order.CustomerOrder;
import com.tazatokri.order.CustomerOrderRepository;
import com.tazatokri.order.OrderService;
import com.tazatokri.user.Address;
import com.tazatokri.user.AddressRepository;
import com.tazatokri.user.AddressRequest;
import com.tazatokri.user.AddressService;
import com.tazatokri.user.CustomerSignupRequest;
import com.tazatokri.user.Role;
import com.tazatokri.user.User;
import com.tazatokri.user.UserRepository;
import com.tazatokri.user.UserResponse;
import com.tazatokri.user.UserService;

import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;

class AccountSecurityQaStage5Tests {

    private static final String TEST_SECRET = "stage5-qa-test-secret-key-at-least-32-bytes-long";

    @AfterEach
    void clearSecurityContext() {
        SecurityContextHolder.clearContext();
    }

    @SuppressWarnings("unchecked")
    private static <T> T proxy(Class<T> iface, InvocationHandler handler) {
        return (T) Proxy.newProxyInstance(iface.getClassLoader(), new Class<?>[] { iface }, handler);
    }

    @Test
    void loginAndRegistrationEnforceCredentialsAndDuplicateProtection() {
        Map<Long, User> userStore = new ConcurrentHashMap<>();
        AtomicLong seq = new AtomicLong(1);
        BCryptPasswordEncoder encoder = new BCryptPasswordEncoder();

        UserRepository userRepo = proxy(UserRepository.class, (p, m, a) -> switch (m.getName()) {
            case "existsByPhone" -> userStore.values().stream().anyMatch(u -> u.getPhone().equals(a[0]));
            case "findByPhone" -> userStore.values().stream()
                    .filter(u -> u.getPhone().equals(a[0]))
                    .findFirst();
            case "save" -> {
                User u = (User) a[0];
                if (u.getId() == null) u.setId(seq.getAndIncrement());
                userStore.put(u.getId(), u);
                yield u;
            }
            default -> throw new UnsupportedOperationException("UserRepository." + m.getName());
        });

        UserService userService = new UserService(userRepo, encoder);
        JwtService jwtService = new JwtService(TEST_SECRET, 60);
        AuthService authService = new AuthService(userRepo, encoder, jwtService);

        // Valid customer signup
        UserResponse created = userService.registerCustomer(
                new CustomerSignupRequest("  Asha Patil  ", "9876543210", "SecurePass123"));
        assertEquals("Asha Patil", created.getFullName());
        assertEquals(Set.of(Role.CUSTOMER), created.getRoles());
        User stored = userStore.get(created.getId());
        assertNotEquals("SecurePass123", stored.getPasswordHash());
        assertTrue(encoder.matches("SecurePass123", stored.getPasswordHash()));

        // Duplicate phone rejected
        assertThrows(DuplicateResourceException.class, () -> userService.registerCustomer(
                new CustomerSignupRequest("Another", "9876543210", "SecurePass123")));

        // Valid login
        LoginRequest okReq = new LoginRequest();
        okReq.setPhone("9876543210");
        okReq.setPassword("SecurePass123");
        LoginResponse login = authService.login(okReq);
        assertNotNull(login.getToken());
        assertEquals("Bearer", login.getTokenType());
        assertEquals("Asha Patil", login.getFullName());

        // Wrong password and unknown phone return identical generic InvalidCredentialsException
        LoginRequest badPass = new LoginRequest();
        badPass.setPhone("9876543210");
        badPass.setPassword("WrongPass999");
        InvalidCredentialsException ex1 = assertThrows(InvalidCredentialsException.class,
                () -> authService.login(badPass));

        LoginRequest unknownPhone = new LoginRequest();
        unknownPhone.setPhone("9000000000");
        unknownPhone.setPassword("SecurePass123");
        InvalidCredentialsException ex2 = assertThrows(InvalidCredentialsException.class,
                () -> authService.login(unknownPhone));
        assertEquals(ex1.getMessage(), ex2.getMessage());

        // Inactive/deleted user cannot log in
        stored.setActive(false);
        assertThrows(InvalidCredentialsException.class, () -> authService.login(okReq));
    }

    @Test
    void jwtFilterValidatesSignatureExpiryPurposeAndActiveUser() throws Exception {
        User activeUser = new User();
        activeUser.setId(42L);
        activeUser.setPhone("9876543210");
        activeUser.setFullName("Asha");
        activeUser.setRoles(Set.of(Role.CUSTOMER));
        activeUser.setActive(true);

        UserRepository userRepo = proxy(UserRepository.class, (p, m, a) -> switch (m.getName()) {
            case "findById" -> activeUser.getId().equals(a[0]) ? Optional.of(activeUser) : Optional.empty();
            case "findByPhone" -> activeUser.getPhone().equals(a[0]) ? Optional.of(activeUser) : Optional.empty();
            default -> throw new UnsupportedOperationException("UserRepository." + m.getName());
        });

        JwtService jwtService = new JwtService(TEST_SECRET, 60);
        JwtAuthFilter filter = new JwtAuthFilter(jwtService, userRepo);

        // 1. Valid JWT authenticates user
        String validToken = jwtService.generateToken(activeUser);
        MockHttpServletRequest req1 = new MockHttpServletRequest();
        req1.addHeader("Authorization", "Bearer " + validToken);
        filter.doFilter(req1, new MockHttpServletResponse(), new MockFilterChain());
        assertNotNull(SecurityContextHolder.getContext().getAuthentication());
        assertEquals("9876543210", SecurityContextHolder.getContext().getAuthentication().getName());
        SecurityContextHolder.clearContext();

        // 2. Malformed token rejected
        MockHttpServletRequest req2 = new MockHttpServletRequest();
        req2.addHeader("Authorization", "Bearer not.a.valid.jwt");
        filter.doFilter(req2, new MockHttpServletResponse(), new MockFilterChain());
        assertNull(SecurityContextHolder.getContext().getAuthentication());

        // 3. Expired token rejected
        String expiredToken = Jwts.builder()
                .subject("9876543210")
                .claim("userId", 42L)
                .claim("roles", List.of("CUSTOMER"))
                .issuedAt(Date.from(Instant.now().minus(2, ChronoUnit.HOURS)))
                .expiration(Date.from(Instant.now().minus(1, ChronoUnit.HOURS)))
                .signWith(Keys.hmacShaKeyFor(TEST_SECRET.getBytes(StandardCharsets.UTF_8)))
                .compact();
        MockHttpServletRequest req3 = new MockHttpServletRequest();
        req3.addHeader("Authorization", "Bearer " + expiredToken);
        filter.doFilter(req3, new MockHttpServletResponse(), new MockFilterChain());
        assertNull(SecurityContextHolder.getContext().getAuthentication());

        // 4. Purpose-scoped token (e.g. password reset) cannot be used as Bearer auth
        String purposeToken = jwtService.generatePurposeToken(
                "9876543210", "password-reset", Map.of("userId", 42L), 10);
        MockHttpServletRequest req4 = new MockHttpServletRequest();
        req4.addHeader("Authorization", "Bearer " + purposeToken);
        filter.doFilter(req4, new MockHttpServletResponse(), new MockFilterChain());
        assertNull(SecurityContextHolder.getContext().getAuthentication());

        // 5. Deactivated user's otherwise valid JWT is rejected
        activeUser.setActive(false);
        MockHttpServletRequest req5 = new MockHttpServletRequest();
        req5.addHeader("Authorization", "Bearer " + validToken);
        filter.doFilter(req5, new MockHttpServletResponse(), new MockFilterChain());
        assertNull(SecurityContextHolder.getContext().getAuthentication());
    }

    @Test
    void addressAndOrderOwnershipIsolateCustomersAgainstIdor() {
        User customerA = new User();
        customerA.setId(10L);
        customerA.setPhone("9876543210");
        customerA.setRoles(Set.of(Role.CUSTOMER));

        User customerB = new User();
        customerB.setId(20L);
        customerB.setPhone("9123456789");
        customerB.setRoles(Set.of(Role.CUSTOMER));

        Address addrA = new Address();
        addrA.setId(100L);
        addrA.setUserId(10L);
        addrA.setLabel("Home");
        addrA.setLine1("101 MG Road");
        addrA.setPincode("411001");
        addrA.setActive(true);

        UserRepository userRepo = proxy(UserRepository.class, (p, m, a) -> switch (m.getName()) {
            case "findByPhone" -> {
                String phone = (String) a[0];
                if (customerA.getPhone().equals(phone)) yield Optional.of(customerA);
                if (customerB.getPhone().equals(phone)) yield Optional.of(customerB);
                yield Optional.empty();
            }
            default -> throw new UnsupportedOperationException("UserRepository." + m.getName());
        });

        AddressRepository addrRepo = proxy(AddressRepository.class, (p, m, a) -> switch (m.getName()) {
            case "findByIdAndUserId" -> {
                Long id = (Long) a[0];
                Long uid = (Long) a[1];
                yield (addrA.getId().equals(id) && addrA.getUserId().equals(uid))
                        ? Optional.of(addrA)
                        : Optional.empty();
            }
            case "findByUserIdAndActiveTrueOrderByIdDesc" ->
                    addrA.getUserId().equals(a[0]) ? List.of(addrA) : List.of();
            case "save" -> a[0];
            default -> throw new UnsupportedOperationException("AddressRepository." + m.getName());
        });

        DeliveryRules rules = new DeliveryRules(
                List.of("411001"), BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO, "18:00") {
            @Override
            public boolean isServiceable(String pincode) {
                return "411001".equals(pincode);
            }
        };

        AddressService addressService = new AddressService(addrRepo, userRepo, rules);

        // Customer A sees own address
        assertEquals(1, addressService.list(customerA.getPhone()).size());
        // Customer B sees 0 addresses
        assertEquals(0, addressService.list(customerB.getPhone()).size());

        // Customer B cannot update Customer A's address by ID
        AddressRequest updateReq = new AddressRequest(
                "Hacked", "999 Evil St", null, null, "411001", null, null, null);
        assertThrows(ResourceNotFoundException.class,
                () -> addressService.update(customerB.getPhone(), 100L, updateReq));
        assertEquals("Home", addrA.getLabel());
        assertEquals("101 MG Road", addrA.getLine1());

        // Order ownership isolation
        CustomerOrder orderA = new CustomerOrder();
        orderA.setId(500L);
        orderA.setCustomerId(10L);

        CustomerOrderRepository orderRepo = proxy(CustomerOrderRepository.class, (p, m, a) -> switch (m.getName()) {
            case "findWithDetailsByIdAndCustomerId" -> {
                Long oid = (Long) a[0];
                Long cid = (Long) a[1];
                yield (orderA.getId().equals(oid) && orderA.getCustomerId().equals(cid))
                        ? Optional.of(orderA)
                        : Optional.empty();
            }
            default -> throw new UnsupportedOperationException("CustomerOrderRepository." + m.getName());
        });

        OrderService orderService = new OrderService(orderRepo, userRepo, addrRepo, null, null, null, rules);
        assertThrows(ResourceNotFoundException.class,
                () -> orderService.get(500L, customerB.getPhone()));
    }

    @Test
    void globalExceptionHandlerHidesInternalDetailsAndStackTraces() {
        GlobalExceptionHandler handler = new GlobalExceptionHandler();
        var response = handler.handleGenericException(
                new RuntimeException("SELECT * FROM users WHERE password_hash = 'secret'"),
                null);
        assertEquals(HttpStatus.INTERNAL_SERVER_ERROR, response.getStatusCode());
        String message = String.valueOf(response.getBody().get("message"));
        assertFalse(message.contains("SELECT"));
        assertFalse(message.contains("password_hash"));
        assertEquals("An unexpected server error occurred. Please try again later.", message);
    }
}
