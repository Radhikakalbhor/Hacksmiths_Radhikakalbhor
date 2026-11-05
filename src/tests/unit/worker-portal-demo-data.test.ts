import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { WorkerDemoProvisioningService } from '@/lib/services/worker-demo-provisioning.service';
import { WorkerWallet } from '@/types/wallet';

describe('Worker Portal Complete Demo Data & Financial Safety Invariants', () => {
  const worker1 = '99999999-0000-0000-0000-000000000001';
  const worker2 = '99999999-0000-0000-0000-000000000002';

  describe('1. Work Overview Jobs Generation & Idempotency', () => {
    it('generates all 4 job categories: upcoming, pending, accepted, rejected', () => {
      const categorized = WorkerDemoProvisioningService.getDemoJobs(worker1, 'Plumbing');
      assert.ok(Array.isArray(categorized.upcoming), 'upcoming must be an array');
      assert.ok(Array.isArray(categorized.pending), 'pending must be an array');
      assert.ok(Array.isArray(categorized.accepted), 'accepted must be an array');
      assert.ok(Array.isArray(categorized.rejected), 'rejected must be an array');

      assert.ok(categorized.upcoming.length > 0, 'upcoming jobs must not be empty');
      assert.ok(categorized.pending.length > 0, 'pending offers must not be empty');
      assert.ok(categorized.accepted.length > 0, 'accepted jobs must not be empty');
      assert.ok(categorized.rejected.length > 0, 'rejected/history jobs must not be empty');
    });

    it('populates realistic Indian customer names, Delhi NCR locations, and valid price quotes', () => {
      const categorized = WorkerDemoProvisioningService.getDemoJobs(worker1, 'Electrician');
      const allJobs = [
        ...categorized.upcoming,
        ...categorized.pending,
        ...categorized.accepted,
        ...categorized.rejected,
      ];

      const indianNamesRegex = /(Sharma|Verma|Patil|Mehta|Joshi|Gupta|Singh|Kulkarni|Deshmukh|Yadav|Malhotra|Agarwal|Iyer|Kapoor)/i;
      const ncrLocationsRegex = /(Delhi|Noida|Gurgaon|Ghaziabad|Faridabad|Indirapuram|Dwarka|Saket|Connaught|Lajpat|Vasant|Rohini)/i;

      for (const job of allJobs) {
        assert.ok(job.id, 'Job must have a unique ID');
        assert.ok(job.title, 'Job must have a descriptive title');
        const name = job.customer_name || job.customerName;
        assert.ok(indianNamesRegex.test(name), `Customer name "${name}" must be an authentic Indian name`);
        const loc = job.location || `${job.address_line}, ${job.city}`;
        assert.ok(ncrLocationsRegex.test(loc), `Location "${loc}" must be in Delhi NCR region`);
        const price = job.quoted_price || job.agreedPriceInr;
        assert.ok(price > 0, 'Job price must be positive');
        const phone = job.customer_phone || job.customerPhone;
        assert.ok(phone.startsWith('+91 '), 'Phone number must have +91 Indian dialing prefix');
      }
    });

    it('is strictly idempotent: repeated calls for the same worker ID yield identical data', () => {
      const firstCall = WorkerDemoProvisioningService.getDemoJobs(worker1, 'Plumbing');
      const secondCall = WorkerDemoProvisioningService.getDemoJobs(worker1, 'Plumbing');

      assert.deepEqual(
        firstCall.upcoming.map((j) => j.id),
        secondCall.upcoming.map((j) => j.id),
        'Job IDs must be identical across calls'
      );
      assert.deepEqual(
        firstCall.upcoming.map((j) => j.agreedPriceInr),
        secondCall.upcoming.map((j) => j.agreedPriceInr),
        'Prices must remain identical across calls'
      );
    });

    it('is strictly account-isolated: distinct worker IDs receive distinct jobs and deterministic assignments', () => {
      const jobsWorker1 = WorkerDemoProvisioningService.getDemoJobs(worker1, 'Plumbing');
      const jobsWorker2 = WorkerDemoProvisioningService.getDemoJobs(worker2, 'Plumbing');

      const ids1 = new Set(jobsWorker1.upcoming.map((j) => j.id));
      const ids2 = new Set(jobsWorker2.upcoming.map((j) => j.id));

      for (const id of ids1) {
        assert.ok(!ids2.has(id), `Worker 1 job ID ${id} must not leak to Worker 2`);
      }
    });
  });

  describe('2. Earnings & Wallet Demo Metrics', () => {
    it('provides populated balance, earnings, and pending escrow figures', () => {
      const wallet = WorkerDemoProvisioningService.getDemoWallet(worker1);

      assert.equal(wallet.workerId, worker1);
      assert.equal(wallet.availableBalanceInr, 2850);
      assert.equal(wallet.pendingBalanceInr, 600);
      assert.equal(wallet.totalEarnedInr, 4200);
      assert.equal(wallet.totalDeductionsInr, 350);
    });

    it('marks demo wallet explicitly as non-withdrawable', () => {
      const wallet = WorkerDemoProvisioningService.getDemoWallet(worker1);
      assert.equal(wallet.isDemo, true, 'Wallet must be flagged as demo');
      assert.equal(wallet.isWithdrawable, false, 'Wallet must not be marked withdrawable');
    });
  });

  describe('3. Strict Financial Safety Invariant: Demo Funds Cannot Be Withdrawn', () => {
    it('blocks withdrawal requests on demo wallet with the exact mandated error message', () => {
      const demoWallet = WorkerDemoProvisioningService.getDemoWallet(worker1);
      const validation = WorkerDemoProvisioningService.validateWithdrawal(demoWallet, 1000);

      assert.equal(validation.valid, false);
      assert.equal(validation.allowed, false);
      assert.equal(
        validation.error,
        'Demo wallet funds cannot be withdrawn as real money. Complete real customer service jobs to earn withdrawable balance.'
      );
    });

    it('blocks withdrawal requests even when amount is equal to or less than demo balance', () => {
      const demoWallet = WorkerDemoProvisioningService.getDemoWallet(worker1);
      const validation1 = WorkerDemoProvisioningService.validateWithdrawal(demoWallet, 100);
      const validation2 = WorkerDemoProvisioningService.validateWithdrawal(demoWallet, demoWallet.availableBalanceInr);

      assert.equal(validation1.valid, false);
      assert.equal(validation2.valid, false);
    });

    it('rejects invalid or non-positive withdrawal amounts', () => {
      const demoWallet = WorkerDemoProvisioningService.getDemoWallet(worker1);
      const validationZero = WorkerDemoProvisioningService.validateWithdrawal(demoWallet, 0);
      const validationNegative = WorkerDemoProvisioningService.validateWithdrawal(demoWallet, -500);

      assert.equal(validationZero.valid, false);
      assert.equal(validationNegative.valid, false);
      assert.match(validationZero.error || '', /greater than zero/i);
    });

    it('allows valid withdrawal requests on real, non-demo wallets', () => {
      const realWallet: WorkerWallet = {
        id: 'wallet-real-123',
        workerId: worker1,
        availableBalanceInr: 3000,
        pendingBalanceInr: 0,
        totalEarnedInr: 5000,
        totalWithdrawnInr: 1000,
        totalDeductionsInr: 500,
        isDemo: false,
        isWithdrawable: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const validWithdrawal = WorkerDemoProvisioningService.validateWithdrawal(realWallet, 1500);
      assert.equal(validWithdrawal.valid, true);
      assert.equal(validWithdrawal.allowed, true);
      assert.equal(validWithdrawal.error, undefined);

      const excessiveWithdrawal = WorkerDemoProvisioningService.validateWithdrawal(realWallet, 3500);
      assert.equal(excessiveWithdrawal.valid, false);
      assert.match(excessiveWithdrawal.error || '', /exceed your available balance/i);
    });
  });

  describe('4. Per-Job Earnings Breakdown & Ledger Transactions', () => {
    it('calculates 10% platform commission and 90% net earnings consistently across job settlements', () => {
      const breakdowns = WorkerDemoProvisioningService.getDemoJobEarningsBreakdown(worker1);
      assert.equal(breakdowns.length, 4, 'Should provide 4 historical job settlement records');

      for (const item of breakdowns) {
        assert.ok(item.jobId, 'Settlement must reference a job ID');
        assert.ok(item.grossAmountInr > 0, 'Gross amount must be positive');
        assert.equal(item.commissionRatePercent, 10.0, 'Platform commission rate must be 10%');

        const expectedCommission = Math.round(item.grossAmountInr * 0.1 * 100) / 100;
        const expectedNet = Math.round(item.grossAmountInr * 0.9 * 100) / 100;

        assert.equal(item.commissionAmountInr, expectedCommission, 'Commission must equal exactly 10%');
        assert.equal(item.workerNetEarningInr, expectedNet, 'Worker net must equal 90%');
      }
    });

    it('provides immutable transaction ledger with credits and debits', () => {
      const { transactions, total } = WorkerDemoProvisioningService.getDemoTransactions(worker1);
      assert.ok(transactions.length >= 8, 'Must return at least 8 ledger transactions');
      assert.equal(total, transactions.length);

      const earningsTxs = transactions.filter((t) => t.transactionType === 'JOB_PAYOUT');
      const commissionTxs = transactions.filter((t) => t.transactionType === 'COMMISSION_DEDUCTION');

      assert.ok(earningsTxs.length > 0, 'Must include JOB_PAYOUT entries');
      assert.ok(commissionTxs.length > 0, 'Must include COMMISSION_DEDUCTION entries');

      for (const t of transactions) {
        assert.equal(t.workerId, worker1);
        assert.equal(t.isDemo, true);
        assert.ok(t.amountInr > 0, 'Transaction amount must be positive');
        assert.ok(t.description, 'Transaction must have description');
      }
    });

    it('supports transaction status and type filtering correctly', () => {
      const { transactions: allTxs } = WorkerDemoProvisioningService.getDemoTransactions(worker1);
      const { transactions: payoutOnly } = WorkerDemoProvisioningService.getDemoTransactions(worker1, {
        type: 'JOB_PAYOUT',
      });
      const { transactions: pendingOnly } = WorkerDemoProvisioningService.getDemoTransactions(worker1, {
        status: 'PENDING',
      });

      assert.ok(payoutOnly.every((t) => t.transactionType === 'JOB_PAYOUT'));
      assert.ok(pendingOnly.every((t) => t.status === 'PENDING'));
      assert.ok(payoutOnly.length < allTxs.length);
    });
  });

  describe('5. Open Marketplace Job Coverage Across All Major Service Categories', () => {
    it('covers all major service categories with realistic Delhi NCR locations and fair budgets', () => {
      const marketplaceJobs = WorkerDemoProvisioningService.getDemoMarketplaceJobs();
      assert.ok(marketplaceJobs.length >= 8, 'Marketplace must have at least 8 available jobs');

      const coveredCategories = new Set(marketplaceJobs.map((j) => j.category.toLowerCase()));
      const expectedCategories = [
        'plumbing',
        'electrical',
        'cleaning',
        'painting',
        'carpentry',
        'appliance_repair',
        'cooking',
        'other_services',
      ];

      for (const cat of expectedCategories) {
        assert.ok(coveredCategories.has(cat), `Category "${cat}" must be represented in open marketplace jobs`);
      }

      for (const job of marketplaceJobs) {
        assert.ok(job.status === 'open' || job.status === 'POSTED', 'Marketplace job must be open or posted');
        const minPrice = job.min_price || job.estimated_min_price_inr;
        const maxPrice = job.max_price || job.estimated_max_price_inr;
        assert.ok(minPrice && maxPrice, 'Must have fair price range');
        assert.ok(minPrice < maxPrice, 'Min price must be less than max price');
        assert.ok(job.location || job.address_line, 'Location must be provided');
        assert.ok(job.customer_name || job.customerName, 'Customer name must be provided');
      }
    });
  });

  describe('6. Worker Reputation, Reliability Scores & Verified Reviews', () => {
    it('provides authentic Indian customer reviews, rating ~4.88, and trust badges', () => {
      const rep = WorkerDemoProvisioningService.getDemoReputation(worker1);

      assert.ok(rep.averageRating >= 4.7 && rep.averageRating <= 5.0, 'Average rating must be high (~4.88)');
      assert.ok(rep.totalReviews >= 15, 'Total reviews must be populated');
      assert.ok(rep.totalCompletedJobs >= 20, 'Completed jobs count must be populated');
      assert.ok(rep.punctualityScore >= 4.8, 'Punctuality score must be tracked');
      assert.ok(rep.pricingHonestyScore >= 4.8, 'Pricing honesty score must be tracked');
      assert.ok(rep.badges.length >= 3, 'Must have at least 3 trust badges');

      assert.ok(rep.reviews.length >= 4, 'Must provide at least 4 detailed customer reviews');
      for (const rev of rep.reviews) {
        assert.ok(rev.customerName, 'Review must have customer name');
        assert.ok(rev.rating >= 4.0, 'Rating must be realistic');
        assert.ok(rev.comment && rev.comment.length > 20, 'Comment must be substantive');
        assert.equal(rev.verified, true, 'Review must be marked verified');
      }
    });
  });

  describe('7. Worker Notifications Feed', () => {
    it('provides populated notifications with unread counts and actionable links', () => {
      const notifs = WorkerDemoProvisioningService.getDemoNotifications(worker1);
      assert.ok(notifs.length >= 4, 'Must provide at least 4 notifications');

      const unreadCount = notifs.filter((n) => !n.isRead).length;
      assert.ok(unreadCount > 0, 'Must have unread notifications for a fresh worker');

      for (const n of notifs) {
        assert.equal(n.workerId, worker1);
        assert.ok(n.title, 'Notification must have a title');
        assert.ok(n.message, 'Notification must have a message');
        assert.ok(n.createdAt, 'Notification must have a timestamp');
      }
    });
  });
});
