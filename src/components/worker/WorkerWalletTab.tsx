'use client';

import React, { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import {
  Wallet,
  IndianRupee,
  ArrowDownLeft,
  ArrowUpRight,
  ShieldCheck,
  Building,
  Clock,
  Filter,
  CheckCircle2,
  AlertCircle,
  FileText,
  Calendar,
  Sparkles,
} from 'lucide-react';
import {
  WorkerWallet,
  WalletTransaction,
  JobEarningsBreakdown,
  TransactionType,
  TransactionStatus,
  WorkerPayoutMethod,
  PlatformSettings,
} from '@/types/wallet';

interface WorkerWalletTabProps {
  wallet: WorkerWallet | null;
  settings: PlatformSettings | null;
  breakdown: JobEarningsBreakdown[];
  transactions: WalletTransaction[];
  payoutMethods: WorkerPayoutMethod[];
  loading: boolean;
  onOpenWithdraw: () => void;
  onOpenPayoutMethods: () => void;
  onFilterChange: (filters: { type?: TransactionType; status?: TransactionStatus }) => void;
}

export function WorkerWalletTab({
  wallet,
  settings,
  breakdown,
  transactions,
  payoutMethods,
  loading,
  onOpenWithdraw,
  onOpenPayoutMethods,
  onFilterChange,
}: WorkerWalletTabProps) {
  const [selectedType, setSelectedType] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');

  const available = wallet?.availableBalanceInr || 0;
  const pending = wallet?.pendingBalanceInr || 0;
  const totalEarned = wallet?.totalEarnedInr || 0;
  const totalDeductions = wallet?.totalDeductionsInr || 0;
  const commissionRate = settings?.commissionRatePercent ?? 10.0;

  const handleTypeSelect = (type: string) => {
    setSelectedType(type);
    onFilterChange({
      type: type === 'ALL' ? undefined : (type as TransactionType),
      status: selectedStatus === 'ALL' ? undefined : (selectedStatus as TransactionStatus),
    });
  };

  const handleStatusSelect = (status: string) => {
    setSelectedStatus(status);
    onFilterChange({
      type: selectedType === 'ALL' ? undefined : (selectedType as TransactionType),
      status: status === 'ALL' ? undefined : (status as TransactionStatus),
    });
  };

  return (
    <div className="space-y-6">
      {/* Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Available Balance */}
        <Card className="p-5 bg-gradient-to-br from-teal-900 to-[#0D4A52] text-white shadow-lg relative overflow-hidden">
          <div className="flex items-center justify-between opacity-80 text-xs">
            <span>Available Balance</span>
            <Wallet className="w-4 h-4 text-emerald-300" />
          </div>
          <div className="mt-2 text-2xl sm:text-3xl font-black text-white flex items-center">
            <IndianRupee className="w-5 h-5 sm:w-6 sm:h-6 mr-0.5 text-emerald-300" />
            <span>{available.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
          {wallet?.isDemo && (
            <div className="mt-1 flex items-center gap-1 text-[10px] text-amber-300 font-semibold">
              <Sparkles className="w-3 h-3" />
              <span>Sample Demo Balance</span>
            </div>
          )}
          <div className="mt-4 flex items-center gap-2">
            <Button
              size="sm"
              variant="primary"
              onClick={onOpenWithdraw}
              disabled={available <= 0}
              className="bg-emerald-500 hover:bg-emerald-600 text-teal-950 font-bold text-xs shadow-sm py-1 h-auto"
            >
              <ArrowDownLeft className="w-3.5 h-3.5 mr-1" />
              <span>Withdraw</span>
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={onOpenPayoutMethods}
              className="text-white hover:bg-white/10 text-xs py-1 h-auto"
            >
              <span>Bank / UPI</span>
            </Button>
          </div>
        </Card>

        {/* Pending Balance */}
        <Card className="p-5 bg-white border border-gray-200">
          <div className="flex items-center justify-between text-gray-500 text-xs font-semibold">
            <span>Pending Escrow</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-gray-900 flex items-center">
            <IndianRupee className="w-5 h-5 mr-0.5 text-gray-400" />
            <span>{pending.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
          <p className="mt-2 text-[11px] text-gray-400 leading-tight">
            Awaiting customer completion confirmation. Released immediately once verified.
          </p>
        </Card>

        {/* Total Earned */}
        <Card className="p-5 bg-white border border-gray-200">
          <div className="flex items-center justify-between text-gray-500 text-xs font-semibold">
            <span>Total Cleared</span>
            <Sparkles className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-2 text-2xl font-bold text-gray-900 flex items-center">
            <IndianRupee className="w-5 h-5 mr-0.5 text-emerald-600" />
            <span>{totalEarned.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
          <p className="mt-2 text-[11px] text-gray-400 leading-tight">
            Lifetime net wages credited to your Sahayak wallet.
          </p>
        </Card>

        {/* Total Deductions */}
        <Card className="p-5 bg-white border border-gray-200">
          <div className="flex items-center justify-between text-gray-500 text-xs font-semibold">
            <span>Platform Commission</span>
            <span className="text-[10px] font-bold px-1.5 py-0.5 bg-gray-100 rounded text-gray-700">
              {commissionRate}%
            </span>
          </div>
          <div className="mt-2 text-2xl font-bold text-gray-900 flex items-center">
            <IndianRupee className="w-5 h-5 mr-0.5 text-gray-400" />
            <span>{totalDeductions.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
          <p className="mt-2 text-[11px] text-gray-400 leading-tight">
            Zero hidden fees. Flat {commissionRate}% commission on completed services.
          </p>
        </Card>
      </div>

      {/* Per-Job Earnings Breakdown Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
            <FileText className="w-4 h-4 text-teal-700" />
            <span>Per-Job Earnings Breakdown</span>
          </h3>
          <span className="text-xs text-gray-500">
            {breakdown.length} {breakdown.length === 1 ? 'record' : 'records'}
          </span>
        </div>

        {breakdown.length === 0 ? (
          <Card className="p-6 text-center text-xs text-gray-500">
            No completed jobs yet. When you complete customer requests, detailed commission and net payout breakdowns appear here.
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {breakdown.map((item) => (
              <Card key={item.jobId} className="p-4 space-y-3 bg-white border border-gray-200">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h4 className="text-sm font-bold text-gray-900 line-clamp-1">{item.jobTitle}</h4>
                    <span className="text-[11px] text-gray-400">
                      {item.completedAt
                        ? new Date(item.completedAt).toLocaleDateString('en-IN', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })
                        : 'Recent'}
                    </span>
                  </div>
                  <Badge
                    variant={item.paymentStatus === 'RELEASED_TO_WALLET' ? 'green' : 'amber'}
                    className="text-[10px]"
                  >
                    {item.paymentStatus === 'RELEASED_TO_WALLET' ? 'Credited to Wallet' : 'In Escrow'}
                  </Badge>
                </div>

                <div className="p-3 bg-gray-50 rounded-lg text-xs space-y-1.5 border border-gray-100">
                  <div className="flex justify-between text-gray-600">
                    <span>Agreed Gross Price:</span>
                    <span className="font-semibold text-gray-900">₹{item.grossAmountInr}</span>
                  </div>
                  <div className="flex justify-between text-gray-600">
                    <span>Platform Commission ({item.commissionRatePercent}%):</span>
                    <span className="text-rose-600 font-semibold">- ₹{item.commissionAmountInr}</span>
                  </div>
                  {item.approvedDeductionsInr > 0 && (
                    <div className="flex justify-between text-gray-600">
                      <span>Approved Deductions:</span>
                      <span className="text-rose-600 font-semibold">- ₹{item.approvedDeductionsInr}</span>
                    </div>
                  )}
                  <div className="pt-1.5 border-t border-gray-200 flex justify-between font-bold text-[#217E66] text-sm">
                    <span>Your Net Payout:</span>
                    <span>₹{item.workerNetEarningInr}</span>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Transaction History Section */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
            <Filter className="w-4 h-4 text-teal-700" />
            <span>Transaction Ledger</span>
          </h3>

          {/* Type & Status Filters */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1 text-xs">
              <span className="text-gray-400">Type:</span>
              <select
                value={selectedType}
                onChange={(e) => handleTypeSelect(e.target.value)}
                className="text-xs p-1 rounded border border-gray-300 bg-white"
              >
                <option value="ALL">All Types</option>
                <option value="JOB_PAYOUT">Job Payouts</option>
                <option value="WITHDRAWAL">Withdrawals</option>
                <option value="COMMISSION_DEDUCTION">Commissions</option>
                <option value="REFUND">Refunds</option>
              </select>
            </div>

            <div className="flex items-center gap-1 text-xs">
              <span className="text-gray-400">Status:</span>
              <select
                value={selectedStatus}
                onChange={(e) => handleStatusSelect(e.target.value)}
                className="text-xs p-1 rounded border border-gray-300 bg-white"
              >
                <option value="ALL">All Status</option>
                <option value="COMPLETED">Completed</option>
                <option value="PENDING">Pending</option>
                <option value="FAILED">Failed</option>
              </select>
            </div>
          </div>
        </div>

        {transactions.length === 0 ? (
          <Card className="p-8 text-center text-xs text-gray-500">
            No transactions match the selected criteria.
          </Card>
        ) : (
          <Card className="overflow-x-auto border border-gray-200">
            <table className="w-full text-xs text-left">
              <thead className="bg-[#FAF8F3] text-gray-500 uppercase text-[10px] tracking-wider border-b border-gray-200">
                <tr>
                  <th className="p-3">Date & Time</th>
                  <th className="p-3">Description</th>
                  <th className="p-3">Type</th>
                  <th className="p-3 text-right">Amount</th>
                  <th className="p-3 text-right">Balance After</th>
                  <th className="p-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {transactions.map((t) => {
                  const isCredit = t.amountInr > 0;
                  return (
                    <tr key={t.id} className="hover:bg-gray-50/50">
                      <td className="p-3 text-gray-500 whitespace-nowrap">
                        {new Date(t.createdAt).toLocaleDateString('en-IN', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="p-3 font-medium text-gray-800 max-w-xs truncate">
                        {t.description}
                      </td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-gray-100 text-gray-700">
                          {t.transactionType}
                        </span>
                      </td>
                      <td className={`p-3 text-right font-bold whitespace-nowrap ${isCredit ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {isCredit ? `+₹${t.amountInr}` : `-₹${Math.abs(t.amountInr)}`}
                      </td>
                      <td className="p-3 text-right text-gray-700 font-semibold whitespace-nowrap">
                        ₹{t.balanceAfterInr}
                      </td>
                      <td className="p-3 text-center">
                        <Badge
                          variant={
                            t.status === 'COMPLETED'
                              ? 'green'
                              : t.status === 'PENDING'
                              ? 'amber'
                              : 'neutral'
                          }
                          className="text-[10px]"
                        >
                          {t.status}
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
        )}
      </div>
    </div>
  );
}

