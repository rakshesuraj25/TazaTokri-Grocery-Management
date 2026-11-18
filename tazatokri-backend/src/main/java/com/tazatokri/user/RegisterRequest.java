package com.tazatokri.user;

import java.util.Set;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class RegisterRequest {

	@NotBlank(message = "Full name is required")
	@Size(max = 100)
	private String fullName;

	@NotBlank(message = "Phone is required")
	@Pattern(regexp = "^[6-9][0-9]{9}$", message = "Enter a valid 10-digit Indian mobile number")
	private String phone;

	@Email(message = "Invalid email")
	private String email;

	@NotBlank(message = "Password is required")
	@Size(min = 8, max = 64, message = "Password must be 8 to 64 characters")
	private String password;

	@NotEmpty(message = "At least one role is required")
	private Set<Role> roles;
}