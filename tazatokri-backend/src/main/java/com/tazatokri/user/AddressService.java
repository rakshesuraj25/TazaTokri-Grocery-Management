package com.tazatokri.user;

import java.util.List;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.tazatokri.common.BadRequestException;
import com.tazatokri.delivery.DeliveryRules;

@Service
public class AddressService {

    private final AddressRepository addresses;
    private final UserRepository users;
    private final DeliveryRules rules;

    public AddressService(AddressRepository addresses, UserRepository users, DeliveryRules rules) {
        this.addresses = addresses;
        this.users = users;
        this.rules = rules;
    }

    @Transactional
    public AddressResponse create(String phone, AddressRequest req) {
        Long userId = userId(phone);
        if (!rules.isServiceable(req.pincode())) {
            throw new BadRequestException("We do not deliver to pincode " + req.pincode() + " yet");
        }
        Address a = new Address();
        a.setUserId(userId);
        a.setLabel(req.label().trim());
        a.setLine1(req.line1().trim());
        a.setLine2(blankToNull(req.line2()));
        a.setLandmark(blankToNull(req.landmark()));
        a.setPincode(req.pincode());
        a.setDefaultAddress(!addresses.existsByUserIdAndActiveTrue(userId));  // first one is default
        return AddressResponse.from(addresses.save(a));
    }

    @Transactional(readOnly = true)
    public List<AddressResponse> list(String phone) {
        return addresses.findByUserIdAndActiveTrueOrderByIdDesc(userId(phone))
                .stream().map(AddressResponse::from).toList();
    }

    private Long userId(String phone) {
        return users.findByPhone(phone)
                .orElseThrow(() -> new BadRequestException("Unknown user")).getId();
    }

    private String blankToNull(String s) {
        return (s == null || s.isBlank()) ? null : s.trim();
    }
}