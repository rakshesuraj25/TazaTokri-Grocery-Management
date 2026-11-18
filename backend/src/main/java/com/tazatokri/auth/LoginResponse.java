package com.tazatokri.auth;

import java.util.Set;

import com.tazatokri.user.Role;

import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public class LoginResponse {

	private String token;
    private String tokenType;
    private long expiresInMinutes;
    private Long userId;
    private String fullName;
    private Set<Role> roles;
}
