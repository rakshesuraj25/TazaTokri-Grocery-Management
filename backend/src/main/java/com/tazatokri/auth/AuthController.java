package com.tazatokri.auth;

import java.util.Map;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.tazatokri.user.CustomerSignupRequest;
import com.tazatokri.user.RegisterRequest;
import com.tazatokri.user.UserResponse;
import com.tazatokri.user.UserService;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

	private final UserService userService;
	private final AuthService authService;
	private final AccountSecurityService accountSecurityService;

	public AuthController(UserService userService, AuthService authService) {
		this(userService, authService, null);
	}

	@Autowired
	public AuthController(
			UserService userService,
			AuthService authService,
			AccountSecurityService accountSecurityService) {
		this.userService = userService;
		this.authService = authService;
		this.accountSecurityService = accountSecurityService;
	}

	@PostMapping("/login")
	public LoginResponse login(@Valid @RequestBody LoginRequest request) {
		return authService.login(request);
	}

	@PostMapping("/register")
	@ResponseStatus(HttpStatus.CREATED)
	public UserResponse register(@Valid @RequestBody RegisterRequest request) {
		return userService.register(request);
	}

	@PostMapping("/signup")
	@ResponseStatus(HttpStatus.CREATED)
	public UserResponse signup(@Valid @RequestBody CustomerSignupRequest request) {
		return userService.registerCustomer(request);
	}

	@PostMapping("/change-password")
	public Map<String, String> changePassword(
			@Valid @RequestBody ChangePasswordRequest request,
			Authentication auth) {
		authService.changePassword(auth.getName(), request);
		return Map.of("message", "Password updated successfully");
	}

	@PostMapping("/forgot-password")
	public AccountSecurityService.ForgotPasswordResponse forgotPassword(
			@Valid @RequestBody AccountSecurityService.ForgotPasswordRequest request) {
		return accountSecurityService.forgotPassword(request);
	}

	@PostMapping("/reset-password")
	public Map<String, String> resetPassword(
			@Valid @RequestBody AccountSecurityService.ResetPasswordRequest request) {
		accountSecurityService.resetPassword(request);
		return Map.of("message", "Password has been reset successfully. Please sign in with your new password.");
	}

}