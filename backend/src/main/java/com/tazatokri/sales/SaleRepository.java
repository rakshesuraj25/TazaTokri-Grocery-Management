package com.tazatokri.sales;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface SaleRepository extends JpaRepository<Sale, Long> {

	@EntityGraph(attributePaths = { "items", "items.vegetable" })
	Optional<Sale> findWithDetailsById(Long id);

	@EntityGraph(attributePaths = { "items", "items.vegetable" })
	Optional<Sale> findWithDetailsByClientRef(String clientRef);

	@EntityGraph(attributePaths = { "items", "items.vegetable" })
	List<Sale> findByCreatedAtGreaterThanEqualAndCreatedAtLessThanOrderByIdDesc(LocalDateTime from, LocalDateTime to);
	
    interface PaymentSummary {
        SalePaymentMethod getMethod();
        Long getBills();
        BigDecimal getTotal();
    }

    @Query("""
           select s.paymentMethod as method, count(s) as bills, sum(s.totalAmount) as total
           from Sale s
           where s.createdAt >= :from and s.createdAt < :to
           group by s.paymentMethod
           """)
    List<PaymentSummary> summarizeByPayment(@Param("from") LocalDateTime from,
                                            @Param("to") LocalDateTime to);
}