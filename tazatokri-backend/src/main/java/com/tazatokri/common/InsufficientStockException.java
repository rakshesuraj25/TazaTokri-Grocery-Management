package com.tazatokri.common;

public class InsufficientStockException extends RuntimeException {
    public InsufficientStockException(String message) { super(message); }
}