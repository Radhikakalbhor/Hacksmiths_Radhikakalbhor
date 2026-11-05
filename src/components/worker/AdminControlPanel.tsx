'use client';

import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import {
  ShieldAlert,
  Percent,
  Clock,
  CheckCircle2,
  XCircle,
  IndianRupee,
  Building,
  Smartphone,
  Save,
  RefreshCw,
} from 'lucide-react';
import { PlatformSettings, WithdrawalRequest } from '@/types/wallet';

interface AdminControlPanelProps {
  initialSettings: PlatformSettings | null;
  onRefreshWallet: () => void;
}

export function AdminControlPanel({ initialSettings, onRefreshWallet }: AdminControlPanelProps) {
  const [commissionRate, setCommissionRate] = useState<number>(initialSettings?.commissionRatePercent ?? 10);
  const [cancellationBuffer, setCancellationBuffer] = useState<number>(initialSettings?.cancellationTimeLimitMinutes ?? 60);
  const [savingConfig, setSavingConfig] = useState(false);
  const [configSuccess, setConfigSuccess] = useState<string | null>(null);

  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [loadingWithdrawals, setLoadingWithdrawals] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const fetchWithdrawals = async () => {
    setLoadingWithdrawals(true);
    try {
      const res = await fetch('/api/admin/payouts');
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setWithdrawals(json.data);
      }
    } catch {
      // Ignore
    } finally {
      setLoadingWithdrawals(false);
    }
  };

  useEffect(() => {
    fetchWithdrawals();
  }, []);

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingConfig(true);
    setConfigSuccess(null);
    try {
      const res = await fetch('/api/admin/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          commissionRatePercent: Number(commissionRate),
          cancellationTimeLimitMinutes: Number(cancellationBuffer),
        }),
      });
      const json = await res.json();
      if (json.success) {
        setConfigSuccess('Platform settings updated successfully.');
        onRefreshWallet();
      }
    } catch {
      // Ignore
    } finally {
      setSavingConfig(false);
    }
  };

  const handleDecision = async (requestId: string, action: 'APPROVE' | 'REJECT') => {
    setActionError(null);
    setActionSuccess(null);
    const reason = action === 'REJECT' ? prompt('Enter rejection reason:') : null;
    if (action === 'REJECT' && !reason) return;

    try {
      const res = await fetch('/api/admin/payouts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestId,
          action,
          adminNotes: reason || (action === 'APPROVE' ? 'Approved by admin' : undefined),
        }),
      });

      const json = await res.json();
      if (json.success) {
        setActionSuccess(`Request ${action.toLowerCase()}d successfully.`);
        fetchWithdrawals();
        onRefreshWallet();
      } else {
        setActionError(json.error || 'Failed to process decision.');
      }
    } catch {
      setActionError('Network error processing decision.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="p-4 bg-teal-50 border border-teal-200 rounded-xl flex items-center justify-between">
        <div className="flex items-center gap-2 text-teal-900">
          <ShieldAlert className="w-5 h-5 text-teal-700" />
          <div>
            <h3 className="font-bold text-sm">Platform Admin & Policy Controls</h3>
            <p className="text-xs text-teal-700">
              Manage platform commission rates, worker cancellation policies, and review pending withdrawals.
            </p>
          </div>
        </div>
        <Button size="sm" variant="secondary" onClick={fetchWithdrawals} disabled={loadingWithdrawals}>
          <RefreshCw className={`w-3.5 h-3.5 mr-1 ${loadingWithdrawals ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </Button>
      </div>

      {/* Global Config Form */}
      <Card className="p-5 space-y-4">
        <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500">
          Platform Commission & Cancellation Buffer
        </h4>

        {configSuccess && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800">
            {configSuccess}
          </div>
        )}

        <form onSubmit={handleSaveConfig} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-gray-700 flex items-center gap-1">
              <Percent className="w-3.5 h-3.5 text-teal-700" />
              <span>Platform Commission Rate (%)</span>
            </label>
            <input
              type="number"
              step="0.5"
              min="0"
              max="50"
              value={commissionRate}
              onChange={(e) => setCommissionRate(parseFloat(e.target.value) || 0)}
              className="w-full text-xs p-2 rounded border border-gray-300 focus:ring-1 focus:ring-teal-600"
            />
            <span className="text-[11px] text-gray-400">Default: 10%. Deducted upon job completion.</span>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-gray-700 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-teal-700" />
              <span>Cancellation Time Buffer (Minutes)</span>
            </label>
            <input
              type="number"
              min="15"
              max="1440"
              value={cancellationBuffer}
              onChange={(e) => setCancellationBuffer(parseInt(e.target.value, 10) || 60)}
              className="w-full text-xs p-2 rounded border border-gray-300 focus:ring-1 focus:ring-teal-600"
            />
            <span className="text-[11px] text-gray-400">Default: 60 minutes before scheduled start time.</span>
          </div>

          <div className="sm:col-span-2 flex justify-end">
            <Button size="sm" variant="primary" type="submit" disabled={savingConfig}>
              <Save className="w-3.5 h-3.5 mr-1" />
              <span>{savingConfig ? 'Saving...' : 'Save Policy Changes'}</span>
            </Button>
          </div>
        </form>
      </Card>

      {/* Review Withdrawal Requests */}
      <div className="space-y-3">
        <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500">
          Worker Withdrawal Requests ({withdrawals.length})
        </h4>

        {actionSuccess && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800">
            {actionSuccess}
          </div>
        )}

        {actionError && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800">
            {actionError}
          </div>
        )}

        {withdrawals.length === 0 ? (
          <Card className="p-6 text-center text-xs text-gray-500">
            No withdrawal requests recorded yet.
          </Card>
        ) : (
          <div className="space-y-2">
            {withdrawals.map((req) => {
              const isPending = req.status === 'PENDING' || req.status === 'PROCESSING';
              return (
                <Card key={req.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-base font-extrabold text-[#217E66] flex items-center">
                        <IndianRupee className="w-4 h-4 mr-0.5" />
                        <span>₹{req.amountInr}</span>
                      </span>
                      <Badge variant={req.status === 'COMPLETED' ? 'green' : req.status === 'PENDING' ? 'amber' : 'neutral'}>
                        {req.status}
                      </Badge>
                      <span className="text-xs text-gray-500">via {req.payoutMethodType}</span>
                    </div>

                    <div className="text-xs text-gray-600 flex items-center gap-2">
                      {req.payoutMethodType === 'UPI' ? (
                        <span className="flex items-center gap-1">
                          <Smartphone className="w-3 h-3 text-teal-700" />
                          <span>{(req.payoutDetails?.upiId as string) || 'UPI'}</span>
                        </span>
                      ) : (
                        <span className="flex items-center gap-1">
                          <Building className="w-3 h-3 text-teal-700" />
                          <span>{(req.payoutDetails?.bankName as string) || 'Bank'} ({(req.payoutDetails?.accountNumberMasked as string) || 'XXXX'})</span>
                        </span>
                      )}
                      <span>•</span>
                      <span className="text-gray-400">
                        {new Date(req.createdAt).toLocaleDateString('en-IN', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                  </div>

                  {isPending && (
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDecision(req.id, 'REJECT')}
                        className="text-rose-600"
                      >
                        <XCircle className="w-3.5 h-3.5 mr-1" />
                        <span>Reject</span>
                      </Button>
                      <Button
                        size="sm"
                        variant="primary"
                        onClick={() => handleDecision(req.id, 'APPROVE')}
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                        <span>Approve Payout</span>
                      </Button>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

