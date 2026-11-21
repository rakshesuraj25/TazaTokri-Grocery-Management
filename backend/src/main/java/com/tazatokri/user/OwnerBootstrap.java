package com.tazatokri.user;

import java.util.Set;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

@Component
@Order(1)
public class OwnerBootstrap implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(OwnerBootstrap.class);

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final String name;
    private final String phone;
    private final String password;

    public OwnerBootstrap(UserRepository userRepository, PasswordEncoder passwordEncoder,
                          @Value("${app.bootstrap.owner-name}") String name,
                          @Value("${app.bootstrap.owner-phone}") String phone,
                          @Value("${app.bootstrap.owner-password}") String password) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.name = name;
        this.phone = phone;
        this.password = password;
    }

    @Override
    public void run(ApplicationArguments args) {
        if (userRepository.existsByRole(Role.OWNER)) {
            return;
        }
        if (phone == null || phone.isBlank() || password == null || password.isBlank()) {
            log.warn("No OWNER exists and bootstrap variables are not set. Nobody can manage the system.");
            return;
        }
        String trimmedPassword = password.trim();
        if (trimmedPassword.startsWith("PLACEHOLDER_") || "Owner@123".equals(trimmedPassword)) {
            log.error("Refusing to create bootstrap OWNER with an insecure or placeholder password.");
            return;
        }
        User owner = new User();
        owner.setFullName(name == null || name.isBlank() ? "Owner" : name.trim());
        owner.setPhone(phone.trim());
        owner.setPasswordHash(passwordEncoder.encode(trimmedPassword));
        owner.setRoles(Set.of(Role.OWNER));
        userRepository.save(owner);
        log.info("Bootstrap OWNER created for phone {}", phone);
    }
}