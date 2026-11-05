'use client';

import React, { useState, useEffect } from 'react';
import {
  Star,
  EyeOff,
  Trash2,
  Sparkles,
  CheckCircle2,
  Loader2,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ConfirmModal } from '@/components/admin/ConfirmModal';
import { useToast } from '@/components/admin/ToastContext';

interface ReviewFlagItem {
  id: string;
  reviewId: string;
  workerId: string;
  workerName: string;
  customerId: string;
  customerName: string;
  rating: number;
  reviewComment: string;
  reason: string;
  status: 'PENDING' | 'REVIEWED' | 'DISMISSED';
  createdAt: string;
}

export default function ReviewModerationPage() {
  const { success, error } = useToast();
  const [flags, setFlags] = useState<ReviewFlagItem[]>([]);
  const [loading, setLoading] = useState(true);

  // AI Scan State
  const [scanning, setScanning] = useState(false);

  // Moderation Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [targetFlag, setTargetFlag] = useState<ReviewFlagItem | null>(null);
  const [actionType, setActionType] = useState<'HIDE' | 'RESTORE' | 'REMOVE'>('HIDE');
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    let isMounted = true;
    async function load() {
      try {
        const res = await fetch('/api/admin/reviews');
        const json = await res.json();
        if (isMounted && json.success && json.data) {
          setFlags(json.data);
        }
      } catch {
        if (isMounted) error('Failed to load flagged reviews');
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    load();
    return () => {
      isMounted = false;
    };
  }, [error]);

  const refreshReviewFlags = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/reviews');
      const json = await res.json();
      if (json.success && json.data) {
        setFlags(json.data);
      }
    } catch {
      error('Failed to load flagged reviews');
    } finally {
      setLoading(false);
    }
  };

  const handleScanToxicity = async () => {
    setScanning(true);
    try {
      const res = await fetch('/api/admin/ai/scan-reviews', {
        method: 'POST',
      });
      const json = await res.json();
      if (json.success) {
        success(
          `AI Toxicity Scan complete. Scanned: ${json.data.scannedCount}, Flagged: ${json.data.flaggedCount}`
        );
        refreshReviewFlags();
      } else {
        error(json.error?.message || 'Toxicity scan failed');
      }
    } catch {
      error('Error executing review scan');
    } finally {
      setScanning(false);
    }
  };

  const openActionModal = (flag: ReviewFlagItem, action: 'HIDE' | 'RESTORE' | 'REMOVE') => {
    setTargetFlag(flag);
    setActionType(action);
    setModalOpen(true);
  };

  const handleConfirmAction = async (reason: string) => {
    if (!targetFlag) return;

    setActionLoading(true);
    try {
      const res = await fetch('/api/admin/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reviewId: targetFlag.reviewId,
          action: actionType,
          reason,
        }),
      });

      const json = await res.json();
      if (json.success) {
        success(`Review moderation completed: ${actionType}.`);
        setModalOpen(false);
        refreshReviewFlags();
      } else {
        error(json.error?.message || 'Action failed.');
      }
    } catch {
      error('Network error executing review moderation.');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-50 text-amber-700">
              <Star className="w-5 h-5" />
            </div>
            <h1 className="text-2xl font-bold text-[#152220]">Review Moderation & Trust</h1>
          </div>
          <p className="text-xs md:text-sm text-[#576563] mt-1">
            Detect vulgar, abusive, or retaliatory ratings and recalculate partner reputation.
          </p>
        </div>

        <Button
          onClick={handleScanToxicity}
          disabled={scanning}
          variant="primary"
          className="rounded-xl px-4 py-2 text-xs font-semibold flex items-center gap-2 bg-[#0D4A52] hover:bg-[#072F35] shadow-xs self-start"
        >
          {scanning ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Scanning Reviews with Gemini...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4 text-emerald-400" />
              <span>Scan for Toxicity with AI</span>
            </>
          )}
        </Button>
      </div>

      {/* Flagged Reviews Queue */}
      <Card className="p-0 overflow-hidden rounded-2xl border-[#E5DFD2] shadow-sm">
        <div className="p-4 border-b border-[#E5DFD2] flex items-center justify-between">
          <h3 className="text-sm font-bold text-[#152220]">Flagged Feedback Queue</h3>
          <span className="text-xs text-[#576563]">{flags.length} Flagged</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#FAF9F5] text-[#576563] font-semibold border-b border-[#E5DFD2]">
              <tr>
                <th className="px-4 py-3">Partner Reviewed</th>
                <th className="px-4 py-3">Rating</th>
                <th className="px-4 py-3">Comment Text</th>
                <th className="px-4 py-3">Flag Reason</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Moderation Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5DFD2]/60">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-[#576563]">
                    Loading review flags...
                  </td>
                </tr>
              ) : flags.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-[#576563]">
                    <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                    <p className="font-semibold text-sm text-[#152220]">Feedback Stream Healthy</p>
                    <p className="text-xs mt-1">No reviews currently flagged for abusive content.</p>
                  </td>
                </tr>
              ) : (
                flags.map((flag) => (
                  <tr key={flag.id} className="hover:bg-[#FAF9F5]/70 transition-colors">
                    <td className="px-4 py-3">
                      <span className="font-bold text-[#152220] block">{flag.workerName}</span>
                      <span className="text-[10px] text-[#576563]">By: {flag.customerName}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 font-bold text-amber-500">
                        <Star className="w-3.5 h-3.5 fill-current" />
                        <span>{flag.rating}.0</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 max-w-sm">
                      <p className="italic text-[#152220] line-clamp-2">
                        &ldquo;{flag.reviewComment}&rdquo;
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-rose-700 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200 block truncate max-w-xs">
                        {flag.reason}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                          flag.status === 'PENDING'
                            ? 'bg-amber-100 text-amber-900'
                            : 'bg-emerald-100 text-emerald-900'
                        }`}
                      >
                        {flag.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right space-x-1.5 whitespace-nowrap">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => openActionModal(flag, 'HIDE')}
                        className="rounded-lg text-xs py-1"
                      >
                        <EyeOff className="w-3.5 h-3.5 mr-1" />
                        Hide
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={() => openActionModal(flag, 'REMOVE')}
                        className="rounded-lg text-xs py-1"
                      >
                        <Trash2 className="w-3.5 h-3.5 mr-1" />
                        Remove
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Confirmation Modal */}
      <ConfirmModal
        isOpen={modalOpen}
        title={`Moderate Review: ${actionType}`}
        description={`This action will affect the reviewer's score and recalculate partner reputation metrics.`}
        confirmLabel={`Confirm ${actionType}`}
        variant={actionType === 'REMOVE' ? 'danger' : 'primary'}
        requireReason={true}
        reasonPlaceholder="Specify reason for moderation (e.g. Abusive profanity, retaliatory score)..."
        isLoading={actionLoading}
        onConfirm={handleConfirmAction}
        onClose={() => setModalOpen(false)}
      />
    </div>
  );
}
