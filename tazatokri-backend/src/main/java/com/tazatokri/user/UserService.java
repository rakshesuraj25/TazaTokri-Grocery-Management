package com.tazatokri.user;

import java.util.HashSet;
import java.util.Set;

import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.tazatokri.common.DuplicateResourceException;

@Service
public class UserService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    public UserService(UserRepository userRepository, PasswordEncoder passwordEncoder) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @Transactional
    public UserResponse register(RegisterRequest request) {
        if (userRepository.existsByPhone(request.getPhone())) {
            throw new DuplicateResourceException("Phone already registered");
        }

        User user = new User();
        user.setFullName(request.getFullName().trim());
        user.setPhone(request.getPhone());
        user.setEmail(blankToNull(request.getEmail()));
        user.setPasswordHash(passwordEncoder.encode(request.getPassword()));
        user.setRoles(request.getRoles());

        User saved = userRepository.save(user);

        return new UserResponse(saved.getId(), saved.getFullName(),
                saved.getPhone(), saved.getEmail(), saved.getRoles());
    }

    private String blankToNull(String value) {
        return (value == null || value.isBlank()) ? null : value.trim();
    }
    
    @Transactional
    public UserResponse registerCustomer(CustomerSignupRequest request) {
        if (userRepository.existsByPhone(request.phone())) {
            throw new DuplicateResourceException("Phone already registered");
        }
        User user = new User();
        user.setFullName(request.fullName().trim());
        user.setPhone(request.phone());
        user.setPasswordHash(passwordEncoder.encode(request.password()));
        user.setRoles(new HashSet<>(Set.of(Role.CUSTOMER)));   // fixed, never from the request
        User saved = userRepository.save(user);
        return new UserResponse(saved.getId(), saved.getFullName(),
                saved.getPhone(), saved.getEmail(), saved.getRoles());
    }
}