'use client';

import React, { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { X, Plus, Trash2, Building, Smartphone, Check, AlertCircle } from 'lucide-react';
import { WorkerPayoutMethod, PayoutMethodType } from '@/types/wallet';

interface PayoutMethodsModalProps {
  methods: WorkerPayoutMethod[];
  onClose: () => void;
  onRefresh: () => void;
}

export function WorkerPayoutMethodsModal({ methods, onClose, onRefresh }: PayoutMethodsModalProps) {
  const [showAddForm, setShowAddForm] = useState(methods.length === 0);
  const [methodType, setMethodType] = useState<PayoutMethodType>('UPI');
  const [holderName, setHolderName] = useState('');
  const [upiId, setUpiId] = useState('');
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [ifscCode, setIfscCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!holderName.trim()) {
      setError('Account holder name is required.');
      return;
    }

    if (methodType === 'UPI') {
      if (!upiId.trim() || !upiId.includes('@')) {
        setError('A valid UPI ID is required.');
        return;
      }
    } else {
      if (!accountNumber.trim() || accountNumber.length < 8) {
        setError('A valid bank account number is required.');
        return;
      }
      if (!ifscCode.trim() || ifscCode.length < 4) {
        setError('A valid IFSC code is required.');
        return;
      }
    }

    setLoading(true);
    try {
      const res = await fetch('/api/worker/payout-methods', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          methodType,
          accountHolderName: holderName.trim(),
          upiId: methodType === 'UPI' ? upiId.trim() : undefined,
          bankName: methodType === 'BANK_ACCOUNT' ? bankName.trim() : undefined,
          accountNumber: methodType === 'BANK_ACCOUNT' ? accountNumber.trim() : undefined,
          ifscCode: methodType === 'BANK_ACCOUNT' ? ifscCode.trim().toUpperCase() : undefined,
          isPrimary: true,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json.error || 'Failed to add payout method.');
      } else {
        setShowAddForm(false);
        setUpiId('');
        setAccountNumber('');
        setIfscCode('');
        onRefresh();
      }
    } catch {
      setError('Network error saving payout method.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to remove this payout method?')) return;
    try {
      await fetch(`/api/worker/payout-methods?id=${id}`, { method: 'DELETE' });
      onRefresh();
    } catch {
      // Ignore
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200">
      <Card className="max-w-md w-full p-6 relative space-y-5 shadow-2xl">
        <div className="flex items-start justify-between border-b border-gray-100 pb-3">
          <h3 className="text-base font-bold text-gray-900">Manage Payout Methods</h3>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Existing Methods */}
        <div className="space-y-2">
          {methods.map((m) => (
            <div
              key={m.id}
              className="p-3 rounded-lg border border-gray-200 bg-white flex items-center justify-between text-xs"
            >
              <div className="flex items-center gap-2.5">
                {m.methodType === 'UPI' ? (
                  <Smartphone className="w-4 h-4 text-teal-700 shrink-0" />
                ) : (
                  <Building className="w-4 h-4 text-teal-700 shrink-0" />
                )}
                <div>
                  <div className="font-bold text-gray-800 flex items-center gap-1.5">
                    <span>{m.methodType === 'UPI' ? m.upiId : `${m.bankName || 'Bank'} (${m.accountNumberMasked})`}</span>
                    {m.isPrimary && (
                      <span className="text-[10px] bg-teal-50 text-teal-800 border border-teal-200 px-1.5 py-0.2 rounded font-bold">
                        Primary
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] text-gray-500">{m.accountHolderName}</span>
                </div>
              </div>
              <button
                onClick={() => handleDelete(m.id)}
                className="p-1.5 text-gray-400 hover:text-rose-600 rounded transition"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>

        {/* Add Payout Method Form */}
        {showAddForm ? (
          <form onSubmit={handleSave} className="p-4 rounded-xl border border-teal-100 bg-teal-50/30 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-teal-900">
              Add New Payout Account
            </h4>

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

            <input
              type="text"
              placeholder="Account Holder Name"
              value={holderName}
              onChange={(e) => setHolderName(e.target.value)}
              className="w-full text-xs p-2 rounded border border-gray-300 bg-white focus:ring-1 focus:ring-teal-600"
              required
            />

            {methodType === 'UPI' ? (
              <input
                type="text"
                placeholder="UPI ID (e.g. yourname@oksbi)"
                value={upiId}
                onChange={(e) => setUpiId(e.target.value)}
                className="w-full text-xs p-2 rounded border border-gray-300 bg-white focus:ring-1 focus:ring-teal-600"
                required
              />
            ) : (
              <div className="space-y-2">
                <input
                  type="text"
                  placeholder="Bank Name (e.g. State Bank of India)"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  className="w-full text-xs p-2 rounded border border-gray-300 bg-white focus:ring-1 focus:ring-teal-600"
                />
                <input
                  type="text"
                  placeholder="Account Number"
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                  className="w-full text-xs p-2 rounded border border-gray-300 bg-white focus:ring-1 focus:ring-teal-600"
                  required
                />
                <input
                  type="text"
                  placeholder="IFSC Code (e.g. SBIN0001234)"
                  value={ifscCode}
                  onChange={(e) => setIfscCode(e.target.value)}
                  className="w-full text-xs p-2 rounded border border-gray-300 bg-white focus:ring-1 focus:ring-teal-600"
                  required
                />
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              {methods.length > 0 && (
                <Button size="sm" variant="ghost" onClick={() => setShowAddForm(false)}>
                  Cancel
                </Button>
              )}
              <Button size="sm" variant="primary" type="submit" disabled={loading}>
                {loading ? 'Saving...' : 'Save Method'}
              </Button>
            </div>
          </form>
        ) : (
          <Button
            size="sm"
            variant="secondary"
            className="w-full"
            onClick={() => setShowAddForm(true)}
          >
            <Plus className="w-3.5 h-3.5 mr-1" />
            <span>Add Another Method</span>
          </Button>
        )}

        <div className="pt-2 border-t border-gray-100 flex justify-end">
          <Button size="sm" variant="ghost" onClick={onClose}>
            Done
          </Button>
        </div>
      </Card>
    </div>
  );
}

