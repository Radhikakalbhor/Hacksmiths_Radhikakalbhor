'use client';

import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  FileText,
  Check,
  X,
  HelpCircle,
  Eye,
  ExternalLink,
  User,
  Phone,
  MapPin,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/admin/StatusBadge';
import { ConfirmModal } from '@/components/admin/ConfirmModal';
import { useToast } from '@/components/admin/ToastContext';

interface VerificationDocItem {
  id: string;
  workerId: string;
  workerName: string;
  workerPhone: string;
  workerCategory: string;
  docType: string;
  fileUrl: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'NEEDS_INFO';
  notes?: string;
  createdAt: string;
}

export default function WorkerVerificationPage() {
  const { success, error } = useToast();
  const [items, setItems] = useState<VerificationDocItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedDoc, setSelectedDoc] = useState<VerificationDocItem | null>(null);

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [actionDecision, setActionDecision] = useState<'APPROVE' | 'REJECT' | 'NEEDS_INFO'>('APPROVE');
  const [actionTarget, setActionTarget] = useState<VerificationDocItem | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    let isMounted = true;
    async function load() {
      try {
        const res = await fetch('/api/admin/verification?status=PENDING');
        const json = await res.json();
        if (isMounted && json.success && json.data) {
          setItems(json.data);
        }
      } catch {
        if (isMounted) error('Failed to load verification queue');
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    load();
    return () => {
      isMounted = false;
    };
  }, [error]);

  const refreshQueue = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/verification?status=PENDING');
      const json = await res.json();
      if (json.success && json.data) {
        setItems(json.data);
      }
    } catch {
      error('Failed to load verification queue');
    } finally {
      setLoading(false);
    }
  };

  const openActionModal = (item: VerificationDocItem, decision: 'APPROVE' | 'REJECT' | 'NEEDS_INFO') => {
    setActionTarget(item);
    setActionDecision(decision);
    setModalOpen(true);
  };

  const handleConfirmDecision = async (reason: string) => {
    if (!actionTarget) return;

    setActionLoading(true);
    try {
      const res = await fetch('/api/admin/verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workerId: actionTarget.workerId,
          decision: actionDecision,
          reason,
        }),
      });

      const json = await res.json();
      if (json.success) {
        success(
          actionDecision === 'APPROVE'
            ? `Worker ${actionTarget.workerName} has been approved and verified.`
            : `Verification decision [${actionDecision}] recorded.`
        );
        setModalOpen(false);
        setSelectedDoc(null);
        refreshQueue();
      } else {
        error(json.error?.message || 'Verification update failed.');
      }
    } catch {
      error('Network error updating verification status.');
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
            <div className="p-2 rounded-xl bg-indigo-50 text-indigo-700">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h1 className="text-2xl font-bold text-[#152220]">Partner Verification Queue</h1>
          </div>
          <p className="text-xs md:text-sm text-[#576563] mt-1">
            Manual human review of government identity cards (Aadhaar, PAN) and police clearance certificates.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-amber-50 text-amber-800 border border-amber-200">
            {items.length} Pending Review
          </span>
        </div>
      </div>

      {/* Main Content Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Verification Items Table (2 cols) */}
        <Card className="lg:col-span-2 p-0 overflow-hidden rounded-2xl border-[#E5DFD2] shadow-sm">
          <div className="p-4 border-b border-[#E5DFD2] flex items-center justify-between">
            <h3 className="text-sm font-bold text-[#152220]">Submitted Documents</h3>
            <span className="text-xs text-[#576563]">Never auto-verified</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#FAF9F5] text-[#576563] font-semibold border-b border-[#E5DFD2]">
                <tr>
                  <th className="px-4 py-3">Worker Candidate</th>
                  <th className="px-4 py-3">Document Type</th>
                  <th className="px-4 py-3">Submitted</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5DFD2]/60">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-[#576563]">
                      Loading verification queue...
                    </td>
                  </tr>
                ) : items.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-[#576563]">
                      <Check className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                      <p className="font-semibold text-sm text-[#152220]">Verification Queue Clean</p>
                      <p className="text-xs mt-1">No pending worker documents awaiting review.</p>
                    </td>
                  </tr>
                ) : (
                  items.map((doc) => (
                    <tr
                      key={doc.id}
                      className={`hover:bg-[#FAF9F5]/70 transition-colors ${
                        selectedDoc?.id === doc.id ? 'bg-[#EBF4F3]' : ''
                      }`}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full bg-[#0D4A52]/10 text-[#0D4A52] flex items-center justify-center font-bold">
                            {doc.workerName.charAt(0)}
                          </div>
                          <div>
                            <span className="font-bold text-[#152220] block">{doc.workerName}</span>
                            <span className="text-[#576563]">{doc.workerPhone}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-semibold text-[#0D4A52] bg-teal-50 px-2 py-0.5 rounded-md border border-teal-200">
                          {doc.docType.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[#576563]">
                        {new Date(doc.createdAt).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                        })}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={doc.status} type="verification" />
                      </td>
                      <td className="px-4 py-3 text-right space-x-1.5">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => setSelectedDoc(doc)}
                          className="rounded-lg text-xs py-1"
                        >
                          <Eye className="w-3.5 h-3.5 mr-1" />
                          Review
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Detail & Document Preview Drawer (1 col) */}
        <Card className="p-6 rounded-2xl border-[#E5DFD2] shadow-sm flex flex-col justify-between space-y-4">
          {selectedDoc ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-[#E5DFD2]">
                <h3 className="text-sm font-bold text-[#152220]">Document Preview</h3>
                <span className="text-xs font-semibold px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-md">
                  {selectedDoc.docType}
                </span>
              </div>

              {/* Worker Profile Card */}
              <div className="p-3 bg-[#FAF9F5] rounded-xl border border-[#E5DFD2] space-y-2 text-xs">
                <div className="flex items-center gap-2 text-[#152220] font-bold">
                  <User className="w-4 h-4 text-[#0D4A52]" />
                  <span>{selectedDoc.workerName}</span>
                </div>
                <div className="flex items-center gap-2 text-[#576563]">
                  <Phone className="w-4 h-4" />
                  <span>{selectedDoc.workerPhone}</span>
                </div>
                <div className="flex items-center gap-2 text-[#576563]">
                  <MapPin className="w-4 h-4" />
                  <span>Mumbai Micro-market</span>
                </div>
                {selectedDoc.notes && (
                  <p className="pt-1 text-[#576563] italic">&ldquo;{selectedDoc.notes}&rdquo;</p>
                )}
              </div>

              {/* Document Image Viewer */}
              <div className="space-y-2">
                <span className="text-xs font-bold text-[#152220] uppercase tracking-wider block">
                  Document Capture
                </span>
                <div className="relative rounded-xl overflow-hidden border border-[#E5DFD2] aspect-4/3 bg-gray-100 flex items-center justify-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={selectedDoc.fileUrl}
                    alt={selectedDoc.docType}
                    className="w-full h-full object-cover"
                  />
                  <a
                    href={selectedDoc.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="absolute top-2 right-2 p-1.5 bg-black/60 hover:bg-black text-white rounded-lg transition-colors text-xs flex items-center gap-1"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Enlarge</span>
                  </a>
                </div>
              </div>

              {/* Actions Button Group */}
              <div className="space-y-2 pt-2">
                <Button
                  onClick={() => openActionModal(selectedDoc, 'APPROVE')}
                  variant="primary"
                  className="w-full rounded-xl py-2.5 text-xs font-bold bg-[#217E66] hover:bg-[#165646] shadow-sm flex items-center justify-center gap-2"
                >
                  <Check className="w-4 h-4" />
                  <span>Approve & Verify Worker</span>
                </Button>

                <div className="grid grid-cols-2 gap-2">
                  <Button
                    onClick={() => openActionModal(selectedDoc, 'NEEDS_INFO')}
                    variant="secondary"
                    className="rounded-xl py-2 text-xs font-semibold flex items-center justify-center gap-1.5"
                  >
                    <HelpCircle className="w-3.5 h-3.5 text-amber-600" />
                    <span>Request Info</span>
                  </Button>

                  <Button
                    onClick={() => openActionModal(selectedDoc, 'REJECT')}
                    variant="danger"
                    className="rounded-xl py-2 text-xs font-semibold flex items-center justify-center gap-1.5"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>Reject</span>
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="py-20 text-center text-[#576563] space-y-3">
              <FileText className="w-10 h-10 text-[#0D4A52]/30 mx-auto" />
              <p className="text-sm font-semibold text-[#152220]">No Document Selected</p>
              <p className="text-xs max-w-xs mx-auto">
                Select any candidate from the queue to inspect submitted IDs and authorize platform badges.
              </p>
            </div>
          )}
        </Card>
      </div>

      {/* Confirmation Modal */}
      <ConfirmModal
        isOpen={modalOpen}
        title={
          actionDecision === 'APPROVE'
            ? `Approve Partner Verification`
            : actionDecision === 'REJECT'
            ? `Reject Worker Verification`
            : `Request Additional Information`
        }
        description={
          actionDecision === 'APPROVE'
            ? `This will grant ${actionTarget?.workerName} verified status, allowing them to bid openly on customer requests.`
            : `Please provide specific feedback for ${actionTarget?.workerName}.`
        }
        confirmLabel={
          actionDecision === 'APPROVE' ? 'Grant Verified Status' : 'Submit Decision'
        }
        variant={actionDecision === 'REJECT' ? 'danger' : 'primary'}
        requireReason={actionDecision !== 'APPROVE'}
        reasonPlaceholder="Specify reason (e.g. Blurred photocopy, mismatch in applicant name, expired ID)..."
        isLoading={actionLoading}
        onConfirm={handleConfirmDecision}
        onClose={() => setModalOpen(false)}
      />
    </div>
  );
}
