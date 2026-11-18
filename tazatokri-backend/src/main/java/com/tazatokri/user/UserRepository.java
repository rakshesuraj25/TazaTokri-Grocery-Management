package com.tazatokri.user;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface UserRepository extends JpaRepository<User, Long> {

    Optional<User> findByPhone(String phone);

    boolean existsByPhone(String phone);
    
    @org.springframework.data.jpa.repository.Query(
            "select count(u) > 0 from User u where :role member of u.roles")
        boolean existsByRole(@org.springframework.data.repository.query.Param("role") Role role);
    
    @Query("select u from User u where :role member of u.roles and u.active = true order by u.fullName")
    List<User> findActiveByRole(@Param("role") Role role);
}