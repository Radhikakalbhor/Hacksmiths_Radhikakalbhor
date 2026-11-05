'use client';

import React, { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { AlertTriangle, X, Clock, ShieldAlert } from 'lucide-react';

interface CancelModalProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  job: any | null;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void>;
  loading?: boolean;
}

export function WorkerCancelModal({ job, onClose, onConfirm, loading }: CancelModalProps) {
  const [reason, setReason] = useState('');
  const [selectedPreset, setSelectedPreset] = useState('');

  if (!job) return null;

  const presets = [
    'Schedule conflict / unavoidable emergency',
    'Customer address is too far or unreachable',
    'Vehicle breakdown or transit delay',
    'Required spare parts or specialized equipment unavailable',
    'Safety concerns at service location',
  ];

  const handlePresetClick = (p: string) => {
    setSelectedPreset(p);
    setReason(p);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) return;
    onConfirm(reason.trim());
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200">
      <Card className="max-w-lg w-full p-6 relative space-y-5 shadow-2xl">
        <div className="flex items-start justify-between border-b border-gray-100 pb-3">
          <div className="flex items-center gap-2 text-rose-600">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <h3 className="text-base font-bold text-gray-900">Cancel Accepted Service Booking</h3>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            className="p-1 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 text-xs text-amber-900 space-y-1">
          <div className="flex items-center gap-1.5 font-bold">
            <ShieldAlert className="w-4 h-4 text-amber-700" />
            <span>Sahayak Fair Cancellation Policy</span>
          </div>
          <p>
            Cancellations within 60 minutes of the scheduled time impact your worker reliability score.
            Please only cancel if strictly unavoidable so the customer can be promptly matched with a nearby alternative.
          </p>
        </div>

        <div className="text-xs text-gray-600">
          Job: <span className="font-bold text-gray-800">{job.title}</span> ({job.city})
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-gray-600 block">
              Reason for Cancellation <span className="text-rose-500">*</span>
            </label>

            {/* Quick preset chips */}
            <div className="flex flex-wrap gap-1.5">
              {presets.map((preset) => (
                <button
                  type="button"
                  key={preset}
                  onClick={() => handlePresetClick(preset)}
                  className={`text-[11px] px-2.5 py-1 rounded-full border transition text-left ${
                    selectedPreset === preset
                      ? 'bg-rose-50 border-rose-300 text-rose-800 font-medium'
                      : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  {preset}
                </button>
              ))}
            </div>

            <textarea
              rows={3}
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                setSelectedPreset('');
              }}
              placeholder="Please provide explicit details for the homeowner..."
              className="w-full text-xs p-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-rose-500"
              required
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
            <Button size="sm" variant="ghost" onClick={onClose} disabled={loading}>
              Keep Booking
            </Button>
            <Button
              size="sm"
              variant="primary"
              type="submit"
              disabled={!reason.trim() || loading}
              className="bg-rose-600 hover:bg-rose-700 text-white"
            >
              {loading ? 'Cancelling...' : 'Confirm Cancellation'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

