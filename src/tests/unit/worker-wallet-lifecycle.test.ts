import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { WalletService } from '@/lib/services/wallet.service';

describe('Worker Wallet & Financial Settlement Engine', () => {
  describe('Commission and Earnings Split Calculation', () => {
    it('calculates standard 10% platform commission correctly', () => {
      const split = WalletService.calculateEarningsSplit(1000, 10.0, 0);
      assert.equal(split.grossAmountInr, 1000);
      assert.equal(split.commissionRatePercent, 10);
      assert.equal(split.commissionAmountInr, 100);
      assert.equal(split.deductionsInr, 0);
      assert.equal(split.workerNetEarningInr, 900);
    });

    it('calculates custom commission rates correctly (e.g. 15%)', () => {
      const split = WalletService.calculateEarningsSplit(2500, 15.0, 50);
      assert.equal(split.grossAmountInr, 2500);
      assert.equal(split.commissionRatePercent, 15);
      assert.equal(split.commissionAmountInr, 375);
      assert.equal(split.deductionsInr, 50);
      assert.equal(split.workerNetEarningInr, 2075);
    });

    it('clamps negative or invalid rates gracefully', () => {
      const split = WalletService.calculateEarningsSplit(-100, -5, 0);
      assert.equal(split.grossAmountInr, 0);
      assert.equal(split.commissionRatePercent, 0);
      assert.equal(split.commissionAmountInr, 0);
      assert.equal(split.workerNetEarningInr, 0);
    });

    it('handles decimal amounts without float precision artifacts', () => {
      const split = WalletService.calculateEarningsSplit(499, 10.0, 0);
      assert.equal(split.commissionAmountInr, 49.9);
      assert.equal(split.workerNetEarningInr, 449.1);
    });
  });

  describe('Withdrawal Validation', () => {
    it('rejects zero or negative withdrawal requests', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mockSupabase: any = {};
      const result = await WalletService.requestWithdrawal(
        mockSupabase,
        'worker-123',
        0,
        'UPI',
        { upiId: 'test@upi' }
      );
      assert.equal(result.success, false);
      assert.ok(result.error?.includes('greater than zero'));
    });

    it('rejects withdrawal if amount is negative', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mockSupabase: any = {};
      const result = await WalletService.requestWithdrawal(
        mockSupabase,
        'worker-123',
        -250,
        'UPI',
        { upiId: 'test@upi' }
      );
      assert.equal(result.success, false);
      assert.ok(result.error?.includes('greater than zero'));
    });
  });

  describe('Payout Method Validation', () => {
    it('validates UPI ID format and holder name', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mockSupabase: any = {};
      const resultNoName = await WalletService.savePayoutMethod(mockSupabase, 'worker-123', {
        methodType: 'UPI',
        accountHolderName: '   ',
        upiId: 'test@upi',
      });
      assert.equal(resultNoName.success, false);
      assert.ok(resultNoName.error?.includes('Account holder name is required'));

      const resultBadUpi = await WalletService.savePayoutMethod(mockSupabase, 'worker-123', {
        methodType: 'UPI',
        accountHolderName: 'Ramesh Kumar',
        upiId: 'invalid-upi-string',
      });
      assert.equal(resultBadUpi.success, false);
      assert.ok(resultBadUpi.error?.includes('valid UPI ID'));
    });

    it('validates Bank Account Number and IFSC Code', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mockSupabase: any = {};
      const resultBadAcc = await WalletService.savePayoutMethod(mockSupabase, 'worker-123', {
        methodType: 'BANK_ACCOUNT',
        accountHolderName: 'Ramesh Kumar',
        bankName: 'SBI',
        accountNumber: '1234',
        ifscCode: 'SBIN0001234',
      });
      assert.equal(resultBadAcc.success, false);
      assert.ok(resultBadAcc.error?.includes('bank account number'));

      const resultBadIfsc = await WalletService.savePayoutMethod(mockSupabase, 'worker-123', {
        methodType: 'BANK_ACCOUNT',
        accountHolderName: 'Ramesh Kumar',
        bankName: 'SBI',
        accountNumber: '123456789012',
        ifscCode: '12',
      });
      assert.equal(resultBadIfsc.success, false);
      assert.ok(resultBadIfsc.error?.includes('IFSC code'));
    });
  });

  describe('Default Platform Settings', () => {
    it('returns sensible defaults when platform_settings table is empty or offline', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mockSupabase: any = {
        from: () => ({
          select: async () => ({ data: [], error: null }),
        }),
      };

      const settings = await WalletService.getPlatformSettings(mockSupabase);
      assert.equal(settings.commissionRatePercent, 10.0);
      assert.equal(settings.cancellationTimeLimitMinutes, 60);
      assert.equal(settings.cancellationPolicy.maxFreeCancellations, 3);
      assert.equal(settings.cancellationPolicy.penaltyInr, 50.0);
    });
  });
});
