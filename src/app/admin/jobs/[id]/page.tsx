'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  ArrowLeft,
  MapPin,
  Clock,
  KeyRound,
  CheckCircle2,
  XCircle,
  Phone,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/admin/StatusBadge';
import { ConfirmModal } from '@/components/admin/ConfirmModal';
import { useToast } from '@/components/admin/ToastContext';
import dynamic from 'next/dynamic';
import 'leaflet/dist/leaflet.css';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';

// Mini Leaflet Map Component
function MiniJobMap({ lat, lng }: { lat: number; lng: number }) {
  const customIcon = L.divIcon({
    className: 'custom-job-pin',
    html: `<div style="background-color: #0D4A52; color: white; width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: bold; border: 2px solid white; box-shadow: 0 2px 5px rgba(0,0,0,0.3);">📍</div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });

  return (
    <MapContainer
      center={[lat, lng]}
      zoom={14}
      scrollWheelZoom={false}
      style={{ height: '100%', width: '100%', borderRadius: '16px' }}
    >
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <Marker position={[lat, lng]} icon={customIcon}>
        <Popup>Job Location</Popup>
      </Marker>
    </MapContainer>
  );
}

const DynamicMiniMap = dynamic(() => Promise.resolve(MiniJobMap), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-[#FAF9F5] flex items-center justify-center text-xs text-[#576563]">
      Loading Mini-Map...
    </div>
  ),
});

interface UserContactSummary {
  id?: string;
  full_name?: string;
  phone?: string;
  email?: string;
}

interface WorkerSummary {
  id: string;
  full_name?: string;
  phone?: string;
  rating?: number;
}

interface BidRecord {
  id: string;
  amount?: number;
  offered_amount_inr?: number;
  status: string;
  created_at: string;
  proposed_eta_minutes?: number;
  worker?: WorkerSummary | WorkerSummary[];
}

interface JobDetailItem {
  id: string;
  title: string;
  category: string;
  status: string;
  urgency: string;
  description?: string;
  address_line?: string;
  city?: string;
  pincode?: string;
  created_at: string;
  final_price_inr?: number;
  accepted_price_inr?: number;
  customer?: UserContactSummary;
  assigned_worker?: UserContactSummary;
}

interface JobDetailPayload {
  job: JobDetailItem;
  bids: BidRecord[];
  otpState?: {
    startOtpVerified?: boolean;
    arrivalOtpVerified?: boolean;
    completionOtpVerified?: boolean;
  };
  coordinates?: { lat: number; lng: number };
}

export default function JobDetailPage() {
  const params = useParams();
  const id = params?.id as string;
  const { success, error } = useToast();

  const [data, setData] = useState<JobDetailPayload | null>(null);
  const [loading, setLoading] = useState(true);

  // Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [modalAction, setModalAction] = useState<'FORCE_CANCEL' | 'FLAG'>('FORCE_CANCEL');
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (!id) return;
    let isMounted = true;
    async function load() {
      try {
        const res = await fetch(`/api/admin/jobs/${id}`);
        const json = await res.json();
        if (isMounted) {
          if (json.success && json.data) {
            setData(json.data);
          } else {
            error(json.error?.message || 'Job not found');
          }
        }
      } catch {
        if (isMounted) error('Failed to load job details');
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    load();
    return () => {
      isMounted = false;
    };
  }, [id, error]);

  const refreshJob = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/jobs/${id}`);
      const json = await res.json();
      if (json.success && json.data) {
        setData(json.data);
      }
    } catch {
      error('Failed to reload job details');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmAction = async (reason: string) => {
    setActionLoading(true);
    try {
      const res = await fetch('/api/admin/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobId: id,
          action: modalAction,
          reason,
        }),
      });

      const json = await res.json();
      if (json.success) {
        success(`Job request ${modalAction === 'FORCE_CANCEL' ? 'cancelled' : 'flagged'}.`);
        setModalOpen(false);
        refreshJob();
      } else {
        error(json.error?.message || 'Action failed.');
      }
    } catch {
      error('Network error executing action.');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="py-20 text-center text-[#576563] space-y-3">
        <div className="w-8 h-8 rounded-full border-3 border-[#0D4A52] border-t-transparent animate-spin mx-auto" />
        <p className="text-xs">Loading Job Details & Milestone State...</p>
      </div>
    );
  }

  const job = data?.job;
  const bids = data?.bids || [];
  const otpState = data?.otpState;
  const coordinates = data?.coordinates || { lat: 19.0760, lng: 72.8777 };

  if (!job) {
    return (
      <div className="py-16 text-center space-y-4">
        <p className="text-sm font-semibold text-red-600">Job Not Found</p>
        <Link href="/admin/jobs">
          <Button variant="secondary" size="sm">
            <ArrowLeft className="w-4 h-4 mr-1" /> Back to Jobs
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header & Return */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <Link
            href="/admin/jobs"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#576563] hover:text-[#0D4A52] transition-colors mb-2"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Jobs Manager</span>
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-xl md:text-2xl font-bold text-[#152220]">{job.title}</h1>
            <StatusBadge status={job.status} type="job" />
          </div>
          <p className="text-xs text-[#576563] mt-1">
            Job ID: <code className="bg-white px-2 py-0.5 rounded border border-[#E5DFD2]">{job.id}</code>
          </p>
        </div>

        {/* Action Buttons */}
        {job.status !== 'CANCELLED' && job.status !== 'COMPLETED' && (
          <div className="flex items-center gap-2">
            <Button
              onClick={() => {
                setModalAction('FORCE_CANCEL');
                setModalOpen(true);
              }}
              variant="danger"
              size="sm"
              className="rounded-xl px-4 py-2 text-xs font-semibold"
            >
              <XCircle className="w-4 h-4 mr-1.5" />
              Force Cancel
            </Button>
          </div>
        )}
      </div>

      {/* Primary Details Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Job Info & Bids (2 cols) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Summary Card */}
          <Card className="p-6 rounded-2xl border-[#E5DFD2] shadow-sm space-y-4">
            <h3 className="text-base font-bold text-[#152220]">Service Request Specifications</h3>
            <p className="text-xs text-[#576563] leading-relaxed">
              {job.description || 'No detailed problem description provided by customer.'}
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-3 border-t border-[#E5DFD2]/60 text-xs">
              <div>
                <span className="text-[#576563] block">Trade Category</span>
                <span className="font-bold text-[#152220] capitalize mt-0.5 block">
                  {job.category}
                </span>
              </div>
              <div>
                <span className="text-[#576563] block">Urgency</span>
                <span className="font-bold text-[#152220] capitalize mt-0.5 block">
                  {job.urgency}
                </span>
              </div>
              <div>
                <span className="text-[#576563] block">Accepted Final Price</span>
                <span className="font-bold text-[#0D4A52] text-sm mt-0.5 block">
                  {job.final_price_inr ? `₹${job.final_price_inr}` : 'Pending Bid'}
                </span>
              </div>
              <div>
                <span className="text-[#576563] block">Created Date</span>
                <span className="font-bold text-[#152220] mt-0.5 block">
                  {new Date(job.created_at).toLocaleDateString()}
                </span>
              </div>
            </div>
          </Card>

          {/* OTP Milestone Security Verification (Zero-Trust Privacy) */}
          <Card className="p-6 rounded-2xl border-[#E5DFD2] bg-gradient-to-br from-white to-[#FAF9F5] shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#E5DFD2]">
              <div className="flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-[#0D4A52]" />
                <h3 className="text-base font-bold text-[#152220]">
                  Cryptographic OTP Milestone Verification
                </h3>
              </div>
              <span className="text-[11px] font-semibold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                Privacy Guard Active
              </span>
            </div>

            <p className="text-xs text-[#576563]">
              To protect user safety and prevent unauthorized access, plain-text OTP values are never stored or exposed to anyone. Only cryptographic SHA-256 status is tracked.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs pt-1">
              {/* Start Milestone */}
              <div className="p-4 rounded-xl border border-[#E5DFD2] bg-white space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[#152220]">Start Milestone OTP</span>
                  {otpState?.startOtpVerified ? (
                    <span className="inline-flex items-center gap-1 text-emerald-600 font-bold">
                      <CheckCircle2 className="w-4 h-4" /> Verified
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-amber-600 font-bold">
                      <Clock className="w-4 h-4" /> Pending
                    </span>
                  )}
                </div>
                <p className="text-[#576563] text-[11px]">
                  Worker must enter customer&apos;s arrival OTP to start the job clock.
                </p>
              </div>

              {/* Completion Milestone */}
              <div className="p-4 rounded-xl border border-[#E5DFD2] bg-white space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[#152220]">Completion Milestone OTP</span>
                  {otpState?.completionOtpVerified ? (
                    <span className="inline-flex items-center gap-1 text-emerald-600 font-bold">
                      <CheckCircle2 className="w-4 h-4" /> Verified
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-gray-500 font-medium">
                      <Clock className="w-4 h-4" /> Incomplete
                    </span>
                  )}
                </div>
                <p className="text-[#576563] text-[11px]">
                  Customer enters completion OTP once service satisfies quality standards.
                </p>
              </div>
            </div>
          </Card>

          {/* Bids List */}
          <Card className="p-6 rounded-2xl border-[#E5DFD2] shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#E5DFD2]">
              <h3 className="text-base font-bold text-[#152220]">Marketplace Bids</h3>
              <span className="text-xs text-[#576563]">{bids.length} submitted bids</span>
            </div>

            <div className="divide-y divide-[#E5DFD2]/60 text-xs">
              {bids.length > 0 ? (
                bids.map((bid: BidRecord) => {
                  const workerProfile = Array.isArray(bid.worker) ? bid.worker[0] : bid.worker;
                  return (
                    <div key={bid.id} className="py-3 flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-teal-50 text-[#0D4A52] flex items-center justify-center font-bold">
                          {workerProfile?.full_name?.charAt(0) || 'W'}
                        </div>
                        <div>
                          <span className="font-bold text-[#152220] block">
                            {workerProfile?.full_name || 'Worker'}
                          </span>
                          <span className="text-[#576563]">ETA: {bid.proposed_eta_minutes || 25} mins</span>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="font-bold text-sm text-[#0D4A52] block">
                          ₹{bid.offered_amount_inr}
                        </span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            bid.status === 'ACCEPTED'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {bid.status}
                        </span>
                      </div>
                    </div>
                  );
                })
              ) : (
                <p className="py-8 text-center text-[#576563]">No bids received for this job yet.</p>
              )}
            </div>
          </Card>
        </div>

        {/* Right Column: Location Mini-Map & Customer Info (1 col) */}
        <div className="space-y-6">
          {/* Mini-Map */}
          <Card className="p-0 rounded-2xl border-[#E5DFD2] overflow-hidden shadow-sm flex flex-col h-72">
            <div className="p-3 bg-white border-b border-[#E5DFD2] flex items-center justify-between text-xs font-bold text-[#152220]">
              <span className="flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-[#0D4A52]" /> Service Location
              </span>
              <span className="text-[#576563] text-[11px]">PIN: {job.pincode}</span>
            </div>
            <div className="flex-1 w-full relative">
              <DynamicMiniMap lat={coordinates.lat} lng={coordinates.lng} />
            </div>
            <div className="p-3 bg-white border-t border-[#E5DFD2] text-xs text-[#576563]">
              {job.address_line}, {job.city}
            </div>
          </Card>

          {/* Customer & Assigned Worker Contacts */}
          <Card className="p-6 rounded-2xl border-[#E5DFD2] shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-[#152220]">Parties Contact Information</h3>

            {/* Customer */}
            <div className="p-3 rounded-xl bg-[#FAF9F5] border border-[#E5DFD2] space-y-1 text-xs">
              <span className="text-[10px] font-bold text-[#576563] uppercase tracking-wider block">
                Customer Requester
              </span>
              <p className="font-bold text-[#152220]">
                {job.customer?.full_name || 'Customer Name'}
              </p>
              <p className="text-[#576563] flex items-center gap-1">
                <Phone className="w-3 h-3 text-[#0D4A52]" />
                {job.customer?.phone || 'Phone not available'}
              </p>
            </div>

            {/* Assigned Partner */}
            {job.assigned_worker && (
              <div className="p-3 rounded-xl bg-[#FAF9F5] border border-[#E5DFD2] space-y-1 text-xs">
                <span className="text-[10px] font-bold text-[#576563] uppercase tracking-wider block">
                  Assigned Partner
                </span>
                <p className="font-bold text-[#152220]">
                  {job.assigned_worker?.full_name || 'Worker Partner'}
                </p>
                <p className="text-[#576563] flex items-center gap-1">
                  <Phone className="w-3 h-3 text-[#0D4A52]" />
                  {job.assigned_worker?.phone || 'Phone not available'}
                </p>
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* Confirmation Modal */}
      <ConfirmModal
        isOpen={modalOpen}
        title="Force Cancel Service Request"
        description="This will terminate this booking immediately and alert both customer and partner."
        confirmLabel="Confirm Cancellation"
        variant="danger"
        requireReason={true}
        reasonPlaceholder="Specify reason for administrative cancellation..."
        isLoading={actionLoading}
        onConfirm={handleConfirmAction}
        onClose={() => setModalOpen(false)}
      />
    </div>
  );
}
