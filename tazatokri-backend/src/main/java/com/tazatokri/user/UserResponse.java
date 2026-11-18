package com.tazatokri.user;

import java.util.Set;

import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public class UserResponse {
	
	private Long id;
	
	private String fullName;
	
	private String phone;
	
	private String email;
	
	private Set<Role> roles;

}
