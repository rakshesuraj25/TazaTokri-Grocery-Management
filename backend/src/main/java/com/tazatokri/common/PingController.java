package com.tazatokri.common;

import java.util.Map;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
public class PingController {

    @GetMapping("/ping")
    public Map<String, String> ping() {
        return Map.of("app", "TazaTokri", "status", "running");
    }
    
    @GetMapping("/me")
    public Map<String, Object> me(org.springframework.security.core.Authentication auth) {
        return Map.of("phone", auth.getName(), "roles", auth.getAuthorities().toString());
    }
}