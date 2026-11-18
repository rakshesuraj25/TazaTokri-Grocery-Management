package com.tazatokri.common;

public class InvalidCredentialsException extends RuntimeException {
 
    public  InvalidCredentialsException() {
    	super("Invalid Phone or password");
    }
}
