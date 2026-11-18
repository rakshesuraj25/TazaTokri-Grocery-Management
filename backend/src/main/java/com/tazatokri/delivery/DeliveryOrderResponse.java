package com.tazatokri.delivery;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import com.tazatokri.order.CustomerOrder;
import com.tazatokri.order.OrderPaymentMethod;
import com.tazatokri.user.User;

public record DeliveryOrderResponse(
		Long orderId,
		DeliveryStatus deliveryStatus,
		LocalDate deliveryDate,
		String address,
		String pincode,
		String deliveryInstructions,
		String customerName,
		String customerPhone,
		OrderPaymentMethod paymentMethod,
		BigDecimal amountToCollect,
		boolean otpVerified,
		String otpVerificationMethod,
		boolean hasProofPhoto,
		Long latestProofEvidenceId,
		List<Line> items) {

	public DeliveryOrderResponse(
			Long orderId,
			DeliveryStatus deliveryStatus,
			LocalDate deliveryDate,
			String address,
			String pincode,
			String customerName,
			String customerPhone,
			OrderPaymentMethod paymentMethod,
			BigDecimal amountToCollect,
			List<Line> items) {
		this(orderId, deliveryStatus, deliveryDate, address, pincode, null,
				customerName, customerPhone, paymentMethod, amountToCollect,
				false, null, false, null, items);
	}

	public record Line(
			String vegetable,
			BigDecimal packedQuantity,
			String unit) {
	}

	public static DeliveryOrderResponse from(
			CustomerOrder o,
			DeliveryAttempt a,
			User customer,
			BigDecimal amountToCollect) {
		return from(o, a, customer, amountToCollect, false, null);
	}

	public static DeliveryOrderResponse from(
			CustomerOrder o,
			DeliveryAttempt a,
			User customer,
			BigDecimal amountToCollect,
			boolean hasProofPhoto,
			Long latestProofEvidenceId) {

		List<Line> lines = o.getItems().stream()
				.map(i -> new Line(
						i.getVegetable().getNameEn(),
						i.getActualQuantity() != null ? i.getActualQuantity() : i.getQuantity(),
						i.getVegetable().getBaseUnit().name()))
				.toList();

		return new DeliveryOrderResponse(
				o.getId(),
				a.getStatus(),
				o.getDeliveryDate(),
				o.getDeliveryAddress(),
				o.getDeliveryPincode(),
				o.getDeliveryInstructions(),
				customer != null ? customer.getFullName() : "Customer",
				customer != null ? customer.getPhone() : "",
				o.getPaymentMethod(),
				amountToCollect,
				a.isOtpVerified(),
				a.getOtpVerificationMethod(),
				hasProofPhoto,
				latestProofEvidenceId,
				lines);
	}
}
