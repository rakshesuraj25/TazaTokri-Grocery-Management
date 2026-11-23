package com.tazatokri.auth;

import java.util.Map;

import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.tazatokri.user.UserResponse;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/account")
@PreAuthorize("isAuthenticated()")
public class AccountController {

    private final AccountSecurityService accountSecurityService;

    public AccountController(AccountSecurityService accountSecurityService) {
        this.accountSecurityService = accountSecurityService;
    }

    @GetMapping("/profile")
    public UserResponse profile(Authentication auth) {
        return accountSecurityService.getProfile(auth.getName());
    }

    @PostMapping("/phone/request-verification")
    public AccountSecurityService.VerificationChallengeResponse requestPhoneVerification(
            @Valid @RequestBody AccountSecurityService.ChangePhoneRequest request,
            Authentication auth) {
        return accountSecurityService.requestPhoneVerification(auth.getName(), request);
    }

    @PostMapping("/phone/confirm")
    public AccountSecurityService.PhoneUpdateResponse confirmPhoneChange(
            @Valid @RequestBody AccountSecurityService.ConfirmPhoneChangeRequest request,
            Authentication auth) {
        return accountSecurityService.confirmPhoneChange(auth.getName(), request);
    }

    @PostMapping("/email/request-verification")
    public AccountSecurityService.VerificationChallengeResponse requestEmailVerification(
            @Valid @RequestBody AccountSecurityService.ChangeEmailRequest request,
            Authentication auth) {
        return accountSecurityService.requestEmailVerification(auth.getName(), request);
    }

    @PostMapping("/email/confirm")
    public Map<String, Object> confirmEmailChange(
            @Valid @RequestBody AccountSecurityService.ConfirmEmailChangeRequest request,
            Authentication auth) {
        UserResponse updated = accountSecurityService.confirmEmailChange(auth.getName(), request);
        return Map.of("message", "Email updated successfully", "user", updated);
    }

    @PostMapping("/delete")
    public Map<String, String> deleteAccount(
            @Valid @RequestBody AccountSecurityService.DeleteAccountRequest request,
            Authentication auth) {
        accountSecurityService.deleteAccount(auth.getName(), request);
        return Map.of(
                "message",
                "Account deleted successfully. Historical orders, payments, and business records have been preserved.");
    }
}
