'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Scale,
  Sparkles,
  CheckCircle2,
  Bot,
  Loader2,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/admin/StatusBadge';
import { ConfirmModal } from '@/components/admin/ConfirmModal';
import { useToast } from '@/components/admin/ToastContext';

interface DisputeItem {
  id: string;
  jobId: string;
  jobTitle: string;
  raisedBy: string;
  raisedByName: string;
  raisedByRole: 'customer' | 'worker';
  againstUser: string;
  againstUserName: string;
  reason: string;
  evidence: Record<string, unknown>;
  status: 'OPEN' | 'UNDER_REVIEW' | 'RESOLVED' | 'REJECTED';
  resolution?: string;
  createdAt: string;
}

export default function DisputesManagerPage() {
  const { success, error } = useToast();
  const [disputes, setDisputes] = useState<DisputeItem[]>([]);
  const [selectedDispute, setSelectedDispute] = useState<DisputeItem | null>(null);
  const [loading, setLoading] = useState(true);

  // AI Summary State
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  // Resolution Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [resolutionType, setResolutionType] = useState<'REFUND' | 'WARN' | 'SUSPEND' | 'DISMISS'>('REFUND');
  const [actionLoading, setActionLoading] = useState(false);

  const loadDisputes = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/disputes');
      const json = await res.json();
      if (json.success && json.data) {
        setDisputes(json.data);
        if (json.data.length > 0) {
          setSelectedDispute((prev) => prev ?? json.data[0]);
        }
      }
    } catch {
      error('Failed to load disputes');
    } finally {
      setLoading(false);
    }
  }, [error]);

  useEffect(() => {
    let cancelled = false;
    async function init() {
      try {
        const res = await fetch('/api/admin/disputes');
        const json = await res.json();
        if (!cancelled && json.success && json.data) {
          setDisputes(json.data);
          if (json.data.length > 0) {
            setSelectedDispute((prev) => prev ?? json.data[0]);
          }
        }
      } catch {
        if (!cancelled) error('Failed to load disputes');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    init();
    return () => {
      cancelled = true;
    };
  }, [error]);

  const handleAiSummarize = async () => {
    if (!selectedDispute) return;
    setAiLoading(true);
    setAiSummary(null);

    try {
      const res = await fetch('/api/admin/ai/summarize-dispute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          disputeReason: selectedDispute.reason,
          customerNotes: selectedDispute.evidence?.customerNotes,
          workerNotes: selectedDispute.evidence?.workerNotes,
          jobTitle: selectedDispute.jobTitle,
          amount: selectedDispute.evidence?.claimedAmount || 500,
        }),
      });

      const json = await res.json();
      if (json.success && json.data?.summary) {
        setAiSummary(json.data.summary);
      } else {
        error('AI summarization failed');
      }
    } catch {
      error('Error reaching AI summarizer');
    } finally {
      setAiLoading(false);
    }
  };

  const openResolutionModal = (type: 'REFUND' | 'WARN' | 'SUSPEND' | 'DISMISS') => {
    setResolutionType(type);
    setModalOpen(true);
  };

  const handleConfirmResolution = async (notes: string) => {
    if (!selectedDispute) return;

    setActionLoading(true);
    try {
      const res = await fetch('/api/admin/disputes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          disputeId: selectedDispute.id,
          resolutionType,
          resolutionNotes: notes,
        }),
      });

      const json = await res.json();
      if (json.success) {
        success(`Dispute resolved with action: ${resolutionType}.`);
        setModalOpen(false);
        loadDisputes();
      } else {
        error(json.error?.message || 'Resolution failed.');
      }
    } catch {
      error('Network error resolving dispute.');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-purple-50 text-purple-700">
              <Scale className="w-5 h-5" />
            </div>
            <h1 className="text-2xl font-bold text-[#152220]">Disputes & Mediation Console</h1>
          </div>
          <p className="text-xs md:text-sm text-[#576563] mt-1">
            Review service claims, inspect evidence timeline, and obtain AI advisory summaries.
          </p>
        </div>

        <span className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-purple-50 text-purple-900 border border-purple-200 self-start">
          {disputes.filter((d) => d.status === 'OPEN' || d.status === 'UNDER_REVIEW').length} Open Claims
        </span>
      </div>

      {/* Main Layout Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Disputes List (1 col) */}
        <Card className="p-0 overflow-hidden rounded-2xl border-[#E5DFD2] shadow-sm flex flex-col h-[640px]">
          <div className="p-4 bg-white border-b border-[#E5DFD2] flex items-center justify-between">
            <h3 className="text-sm font-bold text-[#152220]">Dispute Claims</h3>
            <span className="text-xs text-[#576563]">{disputes.length} Total</span>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-[#E5DFD2]/60">
            {loading ? (
              <div className="py-20 text-center text-xs text-[#576563]">Loading claims...</div>
            ) : disputes.length === 0 ? (
              <div className="py-20 text-center text-[#576563] space-y-2">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
                <p className="text-sm font-bold text-[#152220]">All Clear</p>
                <p className="text-xs">No active claims in queue.</p>
              </div>
            ) : (
              disputes.map((d) => (
                <div
                  key={d.id}
                  onClick={() => {
                    setSelectedDispute(d);
                    setAiSummary(null);
                  }}
                  className={`p-4 cursor-pointer transition-colors space-y-2 ${
                    selectedDispute?.id === d.id
                      ? 'bg-purple-50/70 border-l-4 border-l-purple-600'
                      : 'hover:bg-[#FAF9F5]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-[#152220]">{d.jobTitle}</span>
                    <StatusBadge status={d.status} type="dispute" />
                  </div>
                  <p className="text-xs text-[#576563] line-clamp-2">&ldquo;{d.reason}&rdquo;</p>
                  <div className="flex items-center justify-between text-[11px] text-[#576563]">
                    <span>Raised by: {d.raisedByName} ({d.raisedByRole})</span>
                    <span>{new Date(d.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>

        {/* Selected Dispute Detail & Evidence (2 cols) */}
        {selectedDispute ? (
          <div className="lg:col-span-2 space-y-6">
            {/* Header / Summary Card */}
            <Card className="p-6 rounded-2xl border-[#E5DFD2] shadow-sm space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-xs font-bold text-purple-700 uppercase tracking-wider block">
                    Dispute Assessment
                  </span>
                  <h2 className="text-lg font-bold text-[#152220] mt-0.5">
                    {selectedDispute.jobTitle}
                  </h2>
                </div>
                <StatusBadge status={selectedDispute.status} type="dispute" />
              </div>

              {/* Conflict Statement */}
              <div className="p-4 bg-[#FAF9F5] rounded-xl border border-[#E5DFD2] space-y-2 text-xs">
                <span className="font-bold text-[#152220] block">Reason for Escalation:</span>
                <p className="text-[#152220] leading-relaxed italic">&ldquo;{selectedDispute.reason}&rdquo;</p>
              </div>

              {/* Both Parties Overview */}
              <div className="grid grid-cols-2 gap-4 text-xs pt-1">
                <div className="p-3 rounded-xl border border-[#E5DFD2] bg-white">
                  <span className="text-[#576563] block">Claimant ({selectedDispute.raisedByRole})</span>
                  <span className="font-bold text-[#152220] text-sm mt-0.5 block">
                    {selectedDispute.raisedByName}
                  </span>
                </div>
                <div className="p-3 rounded-xl border border-[#E5DFD2] bg-white">
                  <span className="text-[#576563] block">Respondent</span>
                  <span className="font-bold text-[#152220] text-sm mt-0.5 block">
                    {selectedDispute.againstUserName}
                  </span>
                </div>
              </div>

              {/* Resolution if present */}
              {selectedDispute.resolution && (
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900">
                  <span className="font-bold block">Recorded Resolution:</span>
                  <p className="mt-0.5">{selectedDispute.resolution}</p>
                </div>
              )}
            </Card>

            {/* AI Dispute Summarizer (Gemini Integration) */}
            <Card className="p-6 rounded-2xl border-[#E5DFD2] bg-gradient-to-br from-white to-[#FAF9F5] shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-teal-50 text-[#0D4A52]">
                    <Bot className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-[#152220]">
                      Gemini Impartial Case Summarizer
                    </h3>
                    <p className="text-[11px] text-[#576563]">
                      Generates objective conflict synthesis & non-binding advisory resolution.
                    </p>
                  </div>
                </div>

                <Button
                  onClick={handleAiSummarize}
                  disabled={aiLoading}
                  variant="secondary"
                  size="sm"
                  className="rounded-xl px-3 py-1.5 text-xs font-semibold flex items-center gap-1.5 border-[#0D4A52]/20 text-[#0D4A52]"
                >
                  {aiLoading ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Synthesizing...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5 text-[#217E66]" />
                      <span>Summarize with AI</span>
                    </>
                  )}
                </Button>
              </div>

              {aiSummary && (
                <div className="p-4 bg-white rounded-xl border border-[#E5DFD2] text-xs leading-relaxed space-y-2 animate-in fade-in duration-150">
                  <div className="prose prose-xs max-w-none text-[#152220] whitespace-pre-wrap">
                    {aiSummary}
                  </div>
                </div>
              )}
            </Card>

            {/* Dispute Resolution Actions */}
            {selectedDispute.status !== 'RESOLVED' && selectedDispute.status !== 'REJECTED' && (
              <Card className="p-5 rounded-2xl border-[#E5DFD2] shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#152220]">
                    Take Mediation Action
                  </span>
                  <span className="text-xs text-[#576563]">Requires written explanation</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                  <Button
                    onClick={() => openResolutionModal('REFUND')}
                    variant="primary"
                    size="sm"
                    className="rounded-xl text-xs py-2 bg-emerald-700 hover:bg-emerald-800"
                  >
                    Authorize Refund
                  </Button>
                  <Button
                    onClick={() => openResolutionModal('WARN')}
                    variant="secondary"
                    size="sm"
                    className="rounded-xl text-xs py-2 text-amber-700 hover:text-amber-800"
                  >
                    Issue Warning
                  </Button>
                  <Button
                    onClick={() => openResolutionModal('SUSPEND')}
                    variant="danger"
                    size="sm"
                    className="rounded-xl text-xs py-2"
                  >
                    Suspend Party
                  </Button>
                  <Button
                    onClick={() => openResolutionModal('DISMISS')}
                    variant="ghost"
                    size="sm"
                    className="rounded-xl text-xs py-2"
                  >
                    Dismiss Claim
                  </Button>
                </div>
              </Card>
            )}
          </div>
        ) : (
          <div className="lg:col-span-2 flex items-center justify-center p-12 bg-white rounded-2xl border border-[#E5DFD2]">
            <p className="text-xs text-[#576563]">Select a dispute to view evidence and mediation options.</p>
          </div>
        )}
      </div>

      {/* Confirmation Modal */}
      <ConfirmModal
        isOpen={modalOpen}
        title={`Resolve Dispute: ${resolutionType}`}
        description={`This binding action will update the job and both parties' platform standings.`}
        confirmLabel={`Submit Resolution (${resolutionType})`}
        variant={resolutionType === 'SUSPEND' ? 'danger' : 'primary'}
        requireReason={true}
        reasonPlaceholder="Provide comprehensive resolution reasoning (minimum 10 characters)..."
        isLoading={actionLoading}
        onConfirm={handleConfirmResolution}
        onClose={() => setModalOpen(false)}
      />
    </div>
  );
}
