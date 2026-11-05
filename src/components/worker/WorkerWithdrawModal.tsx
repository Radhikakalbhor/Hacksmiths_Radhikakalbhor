'use client';

import React, { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { X, IndianRupee, ArrowDownLeft, ShieldCheck, AlertCircle, Building, Smartphone } from 'lucide-react';
import { WorkerPayoutMethod, PayoutMethodType } from '@/types/wallet';

interface WithdrawModalProps {
  availableBalanceInr: number;
  payoutMethods: WorkerPayoutMethod[];
  isDemo?: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function WorkerWithdrawModal({
  availableBalanceInr,
  payoutMethods,
  isDemo,
  onClose,
  onSuccess,
}: WithdrawModalProps) {
  const [amount, setAmount] = useState('');
  const [selectedMethodId, setSelectedMethodId] = useState<string>(
    payoutMethods.find((m) => m.isPrimary)?.id || payoutMethods[0]?.id || ''
  );
  const [methodType, setMethodType] = useState<PayoutMethodType>('UPI');
  const [upiId, setUpiId] = useState('');
  const [accountHolderName, setAccountHolderName] = useState('');
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [ifscCode, setIfscCode] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const numAmount = parseFloat(amount) || 0;
  const isOverBalance = numAmount > availableBalanceInr;
  const isInvalidAmount = numAmount <= 0;

  const handleQuickAmount = (val: number) => {
    setAmount(Math.min(val, availableBalanceInr).toString());
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (isInvalidAmount) {
      setError('Please enter a valid withdrawal amount.');
      return;
    }

    if (isOverBalance) {
      setError(`Withdrawal amount cannot exceed your available balance of ₹${availableBalanceInr}.`);
      return;
    }

    let finalMethodType = methodType;
    let payoutDetails: Record<string, unknown> = {};

    const existingMethod = payoutMethods.find((m) => m.id === selectedMethodId);
    if (selectedMethodId && existingMethod) {
      finalMethodType = existingMethod.methodType;
      payoutDetails = {
        methodId: existingMethod.id,
        accountHolderName: existingMethod.accountHolderName,
        upiId: existingMethod.upiId,
        bankName: existingMethod.bankName,
        accountNumberMasked: existingMethod.accountNumberMasked,
        ifscCode: existingMethod.ifscCode,
      };
    } else {
      if (methodType === 'UPI') {
        if (!upiId.trim() || !upiId.includes('@')) {
          setError('A valid UPI ID (e.g. name@okaxis) is required.');
          return;
        }
        payoutDetails = {
          upiId: upiId.trim(),
          accountHolderName: accountHolderName.trim() || 'Worker',
        };
      } else {
        if (!accountNumber.trim() || accountNumber.length < 8) {
          setError('A valid bank account number is required.');
          return;
        }
        if (!ifscCode.trim() || ifscCode.length < 4) {
          setError('A valid IFSC code is required.');
          return;
        }
        payoutDetails = {
          bankName: bankName.trim() || 'Bank Account',
          accountNumber: accountNumber.trim(),
          ifscCode: ifscCode.trim().toUpperCase(),
          accountHolderName: accountHolderName.trim() || 'Worker',
        };
      }
    }

    setLoading(true);
    try {
      const res = await fetch('/api/worker/wallet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amountInr: numAmount,
          payoutMethodType: finalMethodType,
          payoutDetails,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json.error || 'Failed to submit withdrawal request.');
      } else {
        setSuccessMsg(
          `Withdrawal request for ₹${numAmount} submitted successfully! In our simulated test environment, this payout will be approved immediately.`
        );
        setTimeout(() => {
          onSuccess();
          onClose();
        }, 1500);
      }
    } catch {
      setError('Network error submitting withdrawal request.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200">
      <Card className="max-w-md w-full p-6 relative space-y-5 shadow-2xl">
        <div className="flex items-start justify-between border-b border-gray-100 pb-3">
          <div className="flex items-center gap-2 text-teal-700">
            <ArrowDownLeft className="w-5 h-5 shrink-0" />
            <h3 className="text-base font-bold text-gray-900">Withdraw Wallet Earnings</h3>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            className="p-1 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Balance pill */}
        <div className="bg-emerald-50 border border-emerald-200 p-3.5 rounded-xl flex items-center justify-between">
          <span className="text-xs text-emerald-800 font-medium">Available for Withdrawal</span>
          <span className="text-lg font-extrabold text-emerald-900 flex items-center">
            <IndianRupee className="w-4 h-4 mr-0.5" />
            <span>₹{availableBalanceInr.toLocaleString('en-IN')}</span>
          </span>
        </div>

        {isDemo && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Demo Wallet Balance Notice</p>
              <p className="text-[11px] text-amber-800 mt-0.5">
                This account is currently populated with sample demo funds. Real money withdrawals cannot be processed for demo balances. Complete verified customer jobs to accumulate withdrawable balance.
              </p>
            </div>
          </div>
        )}

        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-600" />
            <span>{successMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Amount Input */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-gray-600 block">
              Withdrawal Amount (₹)
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-gray-400 font-bold">₹</span>
              <input
                type="number"
                min="1"
                max={availableBalanceInr}
                value={amount}
                onChange={(e) => {
                  setAmount(e.target.value);
                  setError(null);
                }}
                placeholder="Enter amount (e.g. 1500)"
                className={`w-full text-sm pl-8 pr-3 py-2 rounded-lg border focus:outline-none focus:ring-2 ${
                  isOverBalance
                    ? 'border-rose-400 focus:ring-rose-400'
                    : 'border-gray-300 focus:ring-teal-600'
                }`}
                required
              />
            </div>

            {/* Quick chips */}
            {availableBalanceInr > 0 && (
              <div className="flex gap-2 pt-1">
                {[500, 1000, 2000].filter((v) => v <= availableBalanceInr).map((v) => (
                  <button
                    type="button"
                    key={v}
                    onClick={() => handleQuickAmount(v)}
                    className="text-[11px] px-2 py-0.5 rounded bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium"
                  >
                    ₹{v}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => handleQuickAmount(availableBalanceInr)}
                  className="text-[11px] px-2 py-0.5 rounded bg-teal-50 hover:bg-teal-100 text-teal-800 font-bold"
                >
                  All (₹{availableBalanceInr})
                </button>
              </div>
            )}
          </div>

          {/* Payout Method selection */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-gray-600 block">
              Destination Payout Account
            </label>

            {payoutMethods.length > 0 ? (
              <div className="space-y-2">
                {payoutMethods.map((m) => (
                  <label
                    key={m.id}
                    className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer text-xs transition ${
                      selectedMethodId === m.id
                        ? 'border-teal-600 bg-teal-50/50 ring-1 ring-teal-500'
                        : 'border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <input
                        type="radio"
                        name="payoutMethod"
                        checked={selectedMethodId === m.id}
                        onChange={() => setSelectedMethodId(m.id)}
                        className="text-teal-600 focus:ring-teal-500"
                      />
                      <div>
                        <div className="flex items-center gap-1.5 font-bold text-gray-800">
                          {m.methodType === 'UPI' ? (
                            <Smartphone className="w-3.5 h-3.5 text-teal-700" />
                          ) : (
                            <Building className="w-3.5 h-3.5 text-teal-700" />
                          )}
                          <span>{m.methodType === 'UPI' ? m.upiId : `${m.bankName || 'Bank'} (${m.accountNumberMasked})`}</span>
                        </div>
                        <span className="text-[11px] text-gray-500">{m.accountHolderName}</span>
                      </div>
                    </div>
                    {m.isPrimary && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-gray-200 text-gray-700">
                        Primary
                      </span>
                    )}
                  </label>
                ))}
              </div>
            ) : (
              <div className="p-3 bg-gray-50 rounded-lg border border-gray-200 space-y-3">
                <div className="flex gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => setMethodType('UPI')}
                    className={`flex-1 py-1.5 rounded font-semibold border ${
                      methodType === 'UPI'
                        ? 'bg-teal-700 text-white border-teal-700'
                        : 'bg-white text-gray-700 border-gray-300'
                    }`}
                  >
                    UPI ID
                  </button>
                  <button
                    type="button"
                    onClick={() => setMethodType('BANK_ACCOUNT')}
                    className={`flex-1 py-1.5 rounded font-semibold border ${
                      methodType === 'BANK_ACCOUNT'
                        ? 'bg-teal-700 text-white border-teal-700'
                        : 'bg-white text-gray-700 border-gray-300'
                    }`}
                  >
                    Bank Transfer
                  </button>
                </div>

                {methodType === 'UPI' ? (
                  <div className="space-y-2">
                    <input
                      type="text"
                      placeholder="UPI ID (e.g. mobile@upi)"
                      value={upiId}
                      onChange={(e) => setUpiId(e.target.value)}
                      className="w-full text-xs p-2 rounded border border-gray-300 focus:ring-1 focus:ring-teal-600"
                      required
                    />
                    <input
                      type="text"
                      placeholder="Account Holder Name"
                      value={accountHolderName}
                      onChange={(e) => setAccountHolderName(e.target.value)}
                      className="w-full text-xs p-2 rounded border border-gray-300 focus:ring-1 focus:ring-teal-600"
                      required
                    />
                  </div>
                ) : (
                  <div className="space-y-2">
                    <input
                      type="text"
                      placeholder="Account Holder Name"
                      value={accountHolderName}
                      onChange={(e) => setAccountHolderName(e.target.value)}
                      className="w-full text-xs p-2 rounded border border-gray-300 focus:ring-1 focus:ring-teal-600"
                      required
                    />
                    <input
                      type="text"
                      placeholder="Bank Name (e.g. SBI, HDFC)"
                      value={bankName}
                      onChange={(e) => setBankName(e.target.value)}
                      className="w-full text-xs p-2 rounded border border-gray-300 focus:ring-1 focus:ring-teal-600"
                    />
                    <input
                      type="text"
                      placeholder="Account Number"
                      value={accountNumber}
                      onChange={(e) => setAccountNumber(e.target.value)}
                      className="w-full text-xs p-2 rounded border border-gray-300 focus:ring-1 focus:ring-teal-600"
                      required
                    />
                    <input
                      type="text"
                      placeholder="IFSC Code"
                      value={ifscCode}
                      onChange={(e) => setIfscCode(e.target.value)}
                      className="w-full text-xs p-2 rounded border border-gray-300 focus:ring-1 focus:ring-teal-600"
                      required
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
            <Button size="sm" variant="ghost" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button
              size="sm"
              variant="primary"
              type="submit"
              disabled={isInvalidAmount || isOverBalance || loading}
            >
              {loading ? 'Processing...' : `Withdraw ₹${numAmount || 0}`}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

