package com.tazatokri.notification;

import java.math.BigDecimal;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;

public final class OrderMessageTemplates {

    private OrderMessageTemplates() {}

    public static String formatOrderMessage(
            NotificationEventType event,
            NotificationLanguage language,
            Long orderId,
            String customerName,
            BigDecimal billAmount) {

        NotificationLanguage lang = language == null ? NotificationLanguage.EN : language;
        String cleanName = (customerName == null || customerName.isBlank()) ? "" : customerName.trim();
        String billSuffixEn = billAmount != null ? " (Rs " + billAmount.stripTrailingZeros().toPlainString() + ")" : "";
        String billSuffixDeva = billAmount != null ? " (₹" + billAmount.stripTrailingZeros().toPlainString() + ")" : "";

        return switch (lang) {
            case MR -> formatMarathi(event, orderId, cleanName, billSuffixDeva);
            case HI -> formatHindi(event, orderId, cleanName, billSuffixDeva);
            case EN -> formatEnglish(event, orderId, cleanName, billSuffixEn);
        };
    }

    private static String formatEnglish(
            NotificationEventType event,
            Long orderId,
            String name,
            String billSuffix) {

        String greeting = name.isEmpty() ? "Hello!" : "Hello " + name + "!";
        return switch (event) {
            case ORDER_PLACED ->
                greeting + " Your TazaTokri order #" + orderId + billSuffix
                        + " has been received. We will update you when it is confirmed.";
            case ORDER_CONFIRMED ->
                (name.isEmpty() ? "" : "Hi " + name + ", ")
                        + "Your TazaTokri order #" + orderId
                        + " is confirmed. We are preparing your vegetables.";
            case ORDER_PACKED ->
                (name.isEmpty() ? "" : "Hi " + name + ", ")
                        + "Your TazaTokri order #" + orderId + billSuffix
                        + " is packed and ready for delivery.";
            case OUT_FOR_DELIVERY ->
                (name.isEmpty() ? "" : "Hi " + name + ", ")
                        + "Your TazaTokri order #" + orderId + billSuffix
                        + " is out for delivery. Thank you for shopping with TazaTokri!";
            case DELIVERED ->
                (name.isEmpty() ? "" : "Hi " + name + ", ")
                        + "Your TazaTokri order #" + orderId + billSuffix
                        + " has been delivered. Thank you for choosing TazaTokri!";
            case CANCELLED ->
                (name.isEmpty() ? "" : "Hi " + name + ", ")
                        + "Your TazaTokri order #" + orderId
                        + " has been cancelled. Please contact us if you need assistance.";
        };
    }

    private static String formatMarathi(
            NotificationEventType event,
            Long orderId,
            String name,
            String billSuffix) {

        String prefix = name.isEmpty() ? "नमस्कार!" : "नमस्कार " + name + "!";
        return switch (event) {
            case ORDER_PLACED ->
                prefix + " तुमची ताजा टोकरी ऑर्डर #" + orderId + billSuffix
                        + " मिळाली आहे. ऑर्डर कन्फर्म झाल्यावर आम्ही तुम्हाला कळवू.";
            case ORDER_CONFIRMED ->
                prefix + " तुमची ताजा टोकरी ऑर्डर #" + orderId
                        + " कन्फर्म झाली आहे. आम्ही तुमच्या ताज्या भाज्या तयार करत आहोत.";
            case ORDER_PACKED ->
                prefix + " तुमची ताजा टोकरी ऑर्डर #" + orderId + billSuffix
                        + " पॅक झाली असून डिलिव्हरीसाठी तयार आहे.";
            case OUT_FOR_DELIVERY ->
                prefix + " तुमची ताजा टोकरी ऑर्डर #" + orderId + billSuffix
                        + " डिलिव्हरीसाठी निघाली आहे. ताजा टोकरी निवडल्याबद्दल धन्यवाद!";
            case DELIVERED ->
                prefix + " तुमची ताजा टोकरी ऑर्डर #" + orderId + billSuffix
                        + " पोहोचवण्यात आली आहे. ताजा टोकरी निवडल्याबद्दल धन्यवाद!";
            case CANCELLED ->
                prefix + " तुमची ताजा टोकरी ऑर्डर #" + orderId
                        + " रद्द करण्यात आली आहे. मदतीसाठी कृपया आमच्याशी संपर्क साधा.";
        };
    }

    private static String formatHindi(
            NotificationEventType event,
            Long orderId,
            String name,
            String billSuffix) {

        String prefix = name.isEmpty() ? "नमस्ते!" : "नमस्ते " + name + "!";
        return switch (event) {
            case ORDER_PLACED ->
                prefix + " आपका ताज़ा टोकरी ऑर्डर #" + orderId + billSuffix
                        + " प्राप्त हो गया है। ऑर्डर कन्फर्म होने पर हम आपको सूचित करेंगे।";
            case ORDER_CONFIRMED ->
                prefix + " आपका ताज़ा टोकरी ऑर्डर #" + orderId
                        + " कन्फर्म हो गया है। हम आपकी ताज़ी सब्ज़ियाँ तैयार कर रहे हैं।";
            case ORDER_PACKED ->
                prefix + " आपका ताज़ा टोकरी ऑर्डर #" + orderId + billSuffix
                        + " पैक हो चुका है और डिलीवरी के लिए तैयार है।";
            case OUT_FOR_DELIVERY ->
                prefix + " आपका ताज़ा टोकरी ऑर्डर #" + orderId + billSuffix
                        + " डिलीवरी के लिए निकल चुका है। ताज़ा टोकरी से खरीदारी के लिए धन्यवाद!";
            case DELIVERED ->
                prefix + " आपका ताज़ा टोकरी ऑर्डर #" + orderId + billSuffix
                        + " डिलीवर हो गया है। ताज़ा टोकरी चुनने के लिए धन्यवाद!";
            case CANCELLED ->
                prefix + " आपका ताज़ा टोकरी ऑर्डर #" + orderId
                        + " रद्द कर दिया गया है। किसी भी सहायता के लिए कृपया हमसे संपर्क करें।";
        };
    }

    public static String normalizeIndianPhone(String rawPhone) {
        if (rawPhone == null) return "";
        String digits = rawPhone.replaceAll("\\D", "");
        if (digits.length() == 10) {
            return "91" + digits;
        }
        if (digits.length() == 12 && digits.startsWith("91")) {
            return digits;
        }
        return digits;
    }

    public static String buildWaMeUrl(String rawPhone, String message) {
        String phone = normalizeIndianPhone(rawPhone);
        String encoded = URLEncoder.encode(message == null ? "" : message, StandardCharsets.UTF_8);
        if (phone.isEmpty()) {
            return "https://wa.me/?text=" + encoded;
        }
        return "https://wa.me/" + phone + "?text=" + encoded;
    }
}
