package com.tazatokri.common;

import java.util.UUID;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import com.tazatokri.order.OrderExpiryService;
import com.tazatokri.payment.RazorpayGateway;
import com.tazatokri.payment.RefundService;

@Component
@ConditionalOnProperty(name = "app.jobs.enabled", havingValue = "true", matchIfMissing = true)
public class ScheduledJobs {

	private static final Logger log = LoggerFactory.getLogger(ScheduledJobs.class);

	private final OrderExpiryService expiry;
	private final RefundService refunds;
	private final RazorpayGateway gateway;

	public ScheduledJobs(OrderExpiryService expiry, RefundService refunds, RazorpayGateway gateway) {
		this.expiry = expiry;
		this.refunds = refunds;
		this.gateway = gateway;
	}

	@Scheduled(initialDelay = 30_000, fixedDelay = 60_000)
	public void expireUnpaidOrders() {
		String jobCorrId = "job-expiry-" + UUID.randomUUID().toString().substring(0, 8);
		MDC.put(CorrelationIdFilter.MDC_CORRELATION_ID, jobCorrId);
		try {
			int n = expiry.expireUnpaid();
			if (n > 0) {
				log.info("Expired {} unpaid order(s)", n);
			}
		} catch (Exception e) {
			log.error("Expiry job failed", e);
		} finally {
			MDC.remove(CorrelationIdFilter.MDC_CORRELATION_ID);
		}
	}

	@Scheduled(initialDelay = 60_000, fixedDelay = 300_000)
	public void processRefunds() {
		if (!gateway.isConfigured()) {
			return;
		}
		String jobCorrId = "job-refund-" + UUID.randomUUID().toString().substring(0, 8);
		MDC.put(CorrelationIdFilter.MDC_CORRELATION_ID, jobCorrId);
		try {
			int n = refunds.processPending();
			if (n > 0) {
				log.info("Processed {} refund(s)", n);
			}
		} catch (Exception e) {
			log.error("Refund job failed", e);
		} finally {
			MDC.remove(CorrelationIdFilter.MDC_CORRELATION_ID);
		}
	}
}