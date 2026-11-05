/**
 * Sahayak Worker Wallet & Financial Settlement Service
 * Manages atomic wallet credits, immutable transaction logging,
 * withdrawal requests, commission splits, and admin approvals.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { Database } from '@/types/database.types';
import {
  WorkerWallet,
  WalletTransaction,
  WorkerPayoutMethod,
  WithdrawalRequest,
  JobEarningsBreakdown,
  PlatformSettings,
  TransactionType,
  TransactionStatus,
  PayoutMethodType,
} from '@/types/wallet';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';

export class WalletService {
  /**
   * Retrieves or initializes a worker's wallet atomically.
   */
  static async getOrCreateWallet(
    supabase: SupabaseClient<Database>,
    workerId: string
  ): Promise<WorkerWallet> {
    const admin = getSupabaseAdminClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client = (admin || supabase) as any;

    const { data: existing, error: fetchErr } = await client
      .from('worker_wallets')
      .select('*')
      .eq('worker_id', workerId)
      .maybeSingle();

    if (existing && !fetchErr) {
      return {
        id: existing.id,
        workerId: existing.worker_id,
        availableBalanceInr: Number(existing.available_balance_inr || 0),
        pendingBalanceInr: Number(existing.pending_balance_inr || 0),
        totalEarnedInr: Number(existing.total_earned_inr || 0),
        totalWithdrawnInr: Number(existing.total_withdrawn_inr || 0),
        totalDeductionsInr: Number(existing.total_deductions_inr || 0),
        createdAt: existing.created_at,
        updatedAt: existing.updated_at,
      };
    }

    // Attempt RPC or fallback insert
    try {
      const { data: rpcWallet } = await client.rpc('get_or_create_worker_wallet', {
        p_worker_id: workerId,
      });
      if (rpcWallet) {
        return {
          id: rpcWallet.id,
          workerId: rpcWallet.worker_id,
          availableBalanceInr: Number(rpcWallet.available_balance_inr || 0),
          pendingBalanceInr: Number(rpcWallet.pending_balance_inr || 0),
          totalEarnedInr: Number(rpcWallet.total_earned_inr || 0),
          totalWithdrawnInr: Number(rpcWallet.total_withdrawn_inr || 0),
          totalDeductionsInr: Number(rpcWallet.total_deductions_inr || 0),
          createdAt: rpcWallet.created_at,
          updatedAt: rpcWallet.updated_at,
        };
      }
    } catch {
      // Fallback direct insert
    }

    const { data: inserted, error: insertErr } = await client
      .from('worker_wallets')
      .upsert({
        worker_id: workerId,
        available_balance_inr: 0.0,
        pending_balance_inr: 0.0,
        total_earned_inr: 0.0,
        total_withdrawn_inr: 0.0,
        total_deductions_inr: 0.0,
      })
      .select('*')
      .single();

    if (insertErr || !inserted) {
      // Default in-memory placeholder if db offline
      return {
        id: 'placeholder-wallet',
        workerId,
        availableBalanceInr: 0,
        pendingBalanceInr: 0,
        totalEarnedInr: 0,
        totalWithdrawnInr: 0,
        totalDeductionsInr: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    }

    return {
      id: inserted.id,
      workerId: inserted.worker_id,
      availableBalanceInr: Number(inserted.available_balance_inr || 0),
      pendingBalanceInr: Number(inserted.pending_balance_inr || 0),
      totalEarnedInr: Number(inserted.total_earned_inr || 0),
      totalWithdrawnInr: Number(inserted.total_withdrawn_inr || 0),
      totalDeductionsInr: Number(inserted.total_deductions_inr || 0),
      createdAt: inserted.created_at,
      updatedAt: inserted.updated_at,
    };
  }

  /**
   * Retrieves active platform settings for commission & cancellations.
   */
  static async getPlatformSettings(supabase: SupabaseClient<Database>): Promise<PlatformSettings> {
    const defaultSettings: PlatformSettings = {
      commissionRatePercent: 10.0,
      cancellationTimeLimitMinutes: 60,
      cancellationPolicy: {
        maxFreeCancellations: 3,
        penaltyInr: 50.0,
      },
    };

    try {
      const { data } = await supabase.from('platform_settings').select('*');
      if (!data || data.length === 0) return defaultSettings;

      const settingsMap = new Map<string, unknown>();
      data.forEach((row) => {
        settingsMap.set(row.key, row.value);
      });

      const commVal = settingsMap.get('commission_rate_percent') as { value?: number } | undefined;
      const cancelVal = settingsMap.get('cancellation_time_limit_minutes') as { value?: number } | undefined;
      const policyVal = settingsMap.get('cancellation_policy') as { max_free_cancellations?: number; penalty_inr?: number } | undefined;

      return {
        commissionRatePercent: typeof commVal?.value === 'number' ? commVal.value : 10.0,
        cancellationTimeLimitMinutes: typeof cancelVal?.value === 'number' ? cancelVal.value : 60,
        cancellationPolicy: {
          maxFreeCancellations: typeof policyVal?.max_free_cancellations === 'number' ? policyVal.max_free_cancellations : 3,
          penaltyInr: typeof policyVal?.penalty_inr === 'number' ? policyVal.penalty_inr : 50.0,
        },
      };
    } catch {
      return defaultSettings;
    }
  }

  /**
   * Updates platform settings (Admin only).
   */
  static async updatePlatformSettings(
    supabase: SupabaseClient<Database>,
    key: 'commission_rate_percent' | 'cancellation_time_limit_minutes' | 'cancellation_policy',
    value: Record<string, unknown>
  ): Promise<boolean> {
    const { error } = await supabase
      .from('platform_settings')
      .upsert({
        key,
        value: value as unknown as Database['public']['Tables']['platform_settings']['Insert']['value'],
        updated_at: new Date().toISOString(),
      });
    return !error;
  }

  /**
   * Retrieves immutable transaction history with optional filters.
   */
  static async getTransactions(
    supabase: SupabaseClient<Database>,
    workerId: string,
    options?: {
      page?: number;
      limit?: number;
      type?: TransactionType;
      status?: TransactionStatus;
      fromDate?: string;
      toDate?: string;
    }
  ): Promise<{ transactions: WalletTransaction[]; total: number }> {
    const page = Math.max(1, options?.page ?? 1);
    const limit = Math.min(100, Math.max(1, options?.limit ?? 20));
    const offset = (page - 1) * limit;

    let query = supabase
      .from('wallet_transactions')
      .select('*', { count: 'exact' })
      .eq('worker_id', workerId);

    if (options?.type) {
      query = query.eq('transaction_type', options.type);
    }
    if (options?.status) {
      query = query.eq('status', options.status);
    }
    if (options?.fromDate) {
      query = query.gte('created_at', options.fromDate);
    }
    if (options?.toDate) {
      query = query.lte('created_at', options.toDate);
    }

    const { data, count, error } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error || !data) {
      return { transactions: [], total: 0 };
    }

    const transactions: WalletTransaction[] = data.map((t) => ({
      id: t.id,
      walletId: t.wallet_id,
      workerId: t.worker_id,
      jobId: t.job_id,
      transactionType: t.transaction_type as TransactionType,
      amountInr: Number(t.amount_inr),
      balanceAfterInr: Number(t.balance_after_inr),
      status: t.status as TransactionStatus,
      description: t.description,
      referenceId: t.reference_id,
      createdAt: t.created_at,
    }));

    return { transactions, total: count ?? 0 };
  }

  /**
   * Retrieves worker payout methods (Bank Accounts / UPI).
   */
  static async getPayoutMethods(
    supabase: SupabaseClient<Database>,
    workerId: string
  ): Promise<WorkerPayoutMethod[]> {
    const { data, error } = await supabase
      .from('worker_payout_methods')
      .select('*')
      .eq('worker_id', workerId)
      .order('is_primary', { ascending: false })
      .order('created_at', { ascending: false });

    if (error || !data) return [];

    return data.map((m) => ({
      id: m.id,
      workerId: m.worker_id,
      methodType: m.method_type as PayoutMethodType,
      accountHolderName: m.account_holder_name,
      upiId: m.upi_id,
      bankName: m.bank_name,
      accountNumberMasked: m.account_number_masked,
      ifscCode: m.ifsc_code,
      isPrimary: m.is_primary,
      createdAt: m.created_at,
      updatedAt: m.updated_at,
    }));
  }

  /**
   * Saves or updates a worker payout method (UPI or Bank).
   */
  static async savePayoutMethod(
    supabase: SupabaseClient<Database>,
    workerId: string,
    payload: {
      methodType: PayoutMethodType;
      accountHolderName: string;
      upiId?: string;
      bankName?: string;
      accountNumber?: string;
      ifscCode?: string;
      isPrimary?: boolean;
    }
  ): Promise<{ success: boolean; data?: WorkerPayoutMethod; error?: string }> {
    if (!payload.accountHolderName.trim()) {
      return { success: false, error: 'Account holder name is required.' };
    }

    let accountNumberMasked: string | null = null;
    if (payload.methodType === 'BANK_ACCOUNT') {
      if (!payload.accountNumber || payload.accountNumber.length < 8) {
        return { success: false, error: 'A valid bank account number is required.' };
      }
      if (!payload.ifscCode || payload.ifscCode.length < 4) {
        return { success: false, error: 'A valid IFSC code is required.' };
      }
      const rawNum = payload.accountNumber.trim();
      accountNumberMasked = 'XXXX-XXXX-' + rawNum.slice(-4);
    } else if (payload.methodType === 'UPI') {
      if (!payload.upiId || !payload.upiId.includes('@')) {
        return { success: false, error: 'A valid UPI ID (e.g. name@upi) is required.' };
      }
    }

    // If marked primary, unset any existing primary methods
    if (payload.isPrimary) {
      await supabase
        .from('worker_payout_methods')
        .update({ is_primary: false })
        .eq('worker_id', workerId);
    }

    const { data, error } = await supabase
      .from('worker_payout_methods')
      .insert({
        worker_id: workerId,
        method_type: payload.methodType,
        account_holder_name: payload.accountHolderName.trim(),
        upi_id: payload.methodType === 'UPI' ? payload.upiId?.trim() : null,
        bank_name: payload.methodType === 'BANK_ACCOUNT' ? payload.bankName?.trim() : null,
        account_number_masked: accountNumberMasked,
        ifsc_code: payload.methodType === 'BANK_ACCOUNT' ? payload.ifscCode?.trim().toUpperCase() : null,
        is_primary: payload.isPrimary ?? true,
      })
      .select('*')
      .single();

    if (error || !data) {
      return { success: false, error: error?.message || 'Failed to save payout method.' };
    }

    return {
      success: true,
      data: {
        id: data.id,
        workerId: data.worker_id,
        methodType: data.method_type as PayoutMethodType,
        accountHolderName: data.account_holder_name,
        upiId: data.upi_id,
        bankName: data.bank_name,
        accountNumberMasked: data.account_number_masked,
        ifscCode: data.ifsc_code,
        isPrimary: data.is_primary,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      },
    };
  }

  /**
   * Deletes a worker payout method.
   */
  static async deletePayoutMethod(
    supabase: SupabaseClient<Database>,
    workerId: string,
    methodId: string
  ): Promise<boolean> {
    const { error } = await supabase
      .from('worker_payout_methods')
      .delete()
      .eq('id', methodId)
      .eq('worker_id', workerId);
    return !error;
  }

  /**
   * Worker submits a withdrawal request against their available balance.
   */
  static async requestWithdrawal(
    supabase: SupabaseClient<Database>,
    workerId: string,
    amountInr: number,
    payoutMethodType: PayoutMethodType,
    payoutDetails: Record<string, unknown>
  ): Promise<{ success: boolean; error?: string; requestId?: string; availableBalanceAfterInr?: number }> {
    if (amountInr <= 0) {
      return { success: false, error: 'Withdrawal amount must be greater than zero.' };
    }

    const admin = getSupabaseAdminClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client = (admin || supabase) as any;

    // Call atomic stored procedure
    try {
      const { data, error } = await client.rpc('request_wallet_withdrawal', {
        p_worker_id: workerId,
        p_amount: amountInr,
        p_method_type: payoutMethodType,
        p_details: payoutDetails,
      });

      if (error) {
        return { success: false, error: error.message };
      }

      if (data && typeof data === 'object' && !(data as { success: boolean }).success) {
        return { success: false, error: (data as { error?: string }).error || 'Withdrawal failed.' };
      }

      const res = data as { requestId: string; availableBalanceAfterInr: number };
      return {
        success: true,
        requestId: res.requestId,
        availableBalanceAfterInr: res.availableBalanceAfterInr,
      };
    } catch (err: unknown) {
      return { success: false, error: (err as Error).message || 'Withdrawal processing error.' };
    }
  }

  /**
   * Admin approves or rejects a withdrawal request.
   */
  static async processWithdrawalDecision(
    supabase: SupabaseClient<Database>,
    requestId: string,
    action: 'APPROVE' | 'REJECT',
    adminNotes?: string,
    payoutRef?: string
  ): Promise<{ success: boolean; error?: string }> {
    const admin = getSupabaseAdminClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client = (admin || supabase) as any;

    try {
      const { data, error } = await client.rpc('process_withdrawal_decision', {
        p_request_id: requestId,
        p_action: action,
        p_admin_notes: adminNotes || null,
        p_payout_ref: payoutRef || null,
      });

      if (error) {
        return { success: false, error: error.message };
      }

      if (data && typeof data === 'object' && !(data as { success: boolean }).success) {
        return { success: false, error: (data as { error?: string }).error || 'Processing failed.' };
      }

      return { success: true };
    } catch (err: unknown) {
      return { success: false, error: (err as Error).message || 'Failed to process withdrawal decision.' };
    }
  }

  /**
   * Retrieves withdrawal requests (Worker or Admin).
   */
  static async getWithdrawalRequests(
    supabase: SupabaseClient<Database>,
    workerId?: string,
    status?: string
  ): Promise<WithdrawalRequest[]> {
    let query = supabase.from('withdrawal_requests').select('*');

    if (workerId) {
      query = query.eq('worker_id', workerId);
    }
    if (status) {
      query = query.eq('status', status as Database['public']['Tables']['withdrawal_requests']['Row']['status']);
    }

    const { data, error } = await query.order('created_at', { ascending: false });
    if (error || !data) return [];

    return data.map((d) => ({
      id: d.id,
      workerId: d.worker_id,
      walletId: d.wallet_id,
      amountInr: Number(d.amount_inr),
      payoutMethodType: d.payout_method_type as PayoutMethodType,
      payoutDetails: (d.payout_details && typeof d.payout_details === 'object' ? d.payout_details : {}) as Record<string, unknown>,
      status: d.status as WithdrawalRequest['status'],
      adminNotes: d.admin_notes,
      payoutReference: d.payout_reference,
      processedAt: d.processed_at,
      createdAt: d.created_at,
      updatedAt: d.updated_at,
    }));
  }

  /**
   * Atomically credits job earnings to the worker's wallet upon completion confirmation.
   * Ensures payment is released only once, deducts configurable commission, and updates wallet & audit trails.
   */
  static async creditJobEarningsToWallet(
    supabase: SupabaseClient<Database>,
    jobId: string,
    commissionPercentOverride?: number
  ): Promise<{
    success: boolean;
    error?: string;
    grossAmountInr?: number;
    commissionAmountInr?: number;
    netEarningInr?: number;
    newAvailableBalanceInr?: number;
  }> {
    const admin = getSupabaseAdminClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client = (admin || supabase) as any;

    try {
      const { data, error } = await client.rpc('credit_job_earnings_to_wallet', {
        p_job_id: jobId,
        p_commission_percent: commissionPercentOverride ?? null,
      });

      if (error) {
        return { success: false, error: error.message };
      }

      if (data && typeof data === 'object' && !(data as { success: boolean }).success) {
        return { success: false, error: (data as { error?: string }).error || 'Release failed.' };
      }

      const res = data as {
        grossAmountInr: number;
        commissionAmountInr: number;
        commissionRatePercent: number;
        netEarningInr: number;
        newAvailableBalanceInr: number;
      };

      return {
        success: true,
        grossAmountInr: res.grossAmountInr,
        commissionAmountInr: res.commissionAmountInr,
        netEarningInr: res.netEarningInr,
        newAvailableBalanceInr: res.newAvailableBalanceInr,
      };
    } catch (err: unknown) {
      return { success: false, error: (err as Error).message || 'Failed to credit job earnings.' };
    }
  }

  /**
   * Computes per-job earnings breakdown for a worker.
   */
  static async getJobEarningsBreakdown(
    supabase: SupabaseClient<Database>,
    workerId: string
  ): Promise<JobEarningsBreakdown[]> {
    // 1. Fetch job payments
    const { data: payments } = await supabase
      .from('job_payments')
      .select('*, jobs!job_payments_job_id_fkey(title, completed_at, customer_id)')
      .eq('worker_id', workerId)
      .order('created_at', { ascending: false });

    if (payments && payments.length > 0) {
      return payments.map((p) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const job = (p as any).jobs;
        return {
          jobId: p.job_id,
          jobTitle: job?.title || 'Home Service',
          customerName: 'Customer',
          completedAt: job?.completed_at || p.released_at || p.created_at,
          grossAmountInr: Number(p.gross_amount_inr),
          commissionRatePercent: Number(p.commission_rate_percent),
          commissionAmountInr: Number(p.commission_amount_inr),
          approvedDeductionsInr: 0,
          workerNetEarningInr: Number(p.worker_net_earning_inr),
          paymentStatus: p.payment_status as JobEarningsBreakdown['paymentStatus'],
          releasedAt: p.released_at,
        };
      });
    }

    // Fallback to legacy worker_earnings table if job_payments has no entries yet
    const { data: legacyEarnings } = await supabase
      .from('worker_earnings')
      .select('*, jobs!worker_earnings_job_id_fkey(title, completed_at)')
      .eq('worker_id', workerId)
      .order('created_at', { ascending: false });

    if (!legacyEarnings) return [];

    return legacyEarnings.map((e) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const job = (e as any).jobs;
      const gross = Number(e.gross_amount_inr || 0);
      const fee = Number(e.platform_fee_inr || 0);
      const net = Number(e.net_payout_inr || 0);
      const commRate = gross > 0 ? Math.round((fee / gross) * 100) : 10;
      return {
        jobId: e.job_id,
        jobTitle: job?.title || 'Service Job',
        customerName: 'Customer',
        completedAt: job?.completed_at || e.paid_at || e.created_at,
        grossAmountInr: gross,
        commissionRatePercent: commRate,
        commissionAmountInr: fee,
        approvedDeductionsInr: 0,
        workerNetEarningInr: net,
        paymentStatus: e.status === 'PROCESSED' ? 'RELEASED_TO_WALLET' : 'PENDING_RELEASE',
        releasedAt: e.paid_at,
      };
    });
  }

  /**
   * Helper to compute fair commission and net earning client/server-side.
   */
  static calculateEarningsSplit(
    grossAmountInr: number,
    commissionRatePercent = 10.0,
    deductionsInr = 0
  ): {
    grossAmountInr: number;
    commissionRatePercent: number;
    commissionAmountInr: number;
    deductionsInr: number;
    workerNetEarningInr: number;
  } {
    const gross = Math.max(0, grossAmountInr);
    const commRate = Math.min(100, Math.max(0, commissionRatePercent));
    const commissionAmount = Math.round((gross * (commRate / 100)) * 100) / 100;
    const deductions = Math.max(0, deductionsInr);
    const net = Math.max(0, Math.round((gross - commissionAmount - deductions) * 100) / 100);

    return {
      grossAmountInr: gross,
      commissionRatePercent: commRate,
      commissionAmountInr: commissionAmount,
      deductionsInr: deductions,
      workerNetEarningInr: net,
    };
  }
}

