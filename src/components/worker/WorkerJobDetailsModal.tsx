'use client';

import React from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import {
  X,
  MapPin,
  Calendar,
  Clock,
  IndianRupee,
  Phone,
  User,
  ShieldCheck,
  AlertTriangle,
  ExternalLink,
} from 'lucide-react';
import Link from 'next/link';

interface JobDetailsModalProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  job: any | null;
  onClose: () => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onAction?: (action: 'accept' | 'reject' | 'cancel', job: any) => void;
}

export function WorkerJobDetailsModal({ job, onClose, onAction }: JobDetailsModalProps) {
  if (!job) return null;

  const booking = job.booking || null;
  const isPending = booking?.stage === 'requested';
  const isAccepted = booking?.stage === 'accepted' || booking?.stage === 'in_progress' || booking?.stage === 'on_the_way';
  const isCancelled = job.status === 'cancelled' || booking?.stage === 'cancelled';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200">
      <Card className="max-w-xl w-full p-6 relative max-h-[90vh] overflow-y-auto space-y-6 shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-gray-100 pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200">
                {job.category}
              </span>
              <Badge
                variant={
                  job.urgency === 'emergency'
                    ? 'amber'
                    : job.urgency === 'same_day' || job.urgency === 'urgent'
                    ? 'teal'
                    : 'neutral'
                }
              >
                {job.urgency === 'urgent' || job.urgency === 'same_day'
                  ? 'Same Day'
                  : job.urgency === 'emergency'
                  ? 'Emergency'
                  : 'Standard'}
              </Badge>
              {isCancelled && <Badge variant="neutral">Cancelled</Badge>}
            </div>
            <h2 className="text-xl font-bold text-[#152220]">{job.title}</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Customer Information */}
        <div className="bg-[#FAF8F3] p-4 rounded-xl border border-[#E5DFD2] space-y-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-[#0D4A52] flex items-center gap-1.5">
            <User className="w-3.5 h-3.5" />
            <span>Customer Details</span>
          </h4>
          <div className="flex items-center justify-between text-sm">
            <div>
              <p className="font-bold text-[#152220]">{job.customerName || 'Customer'}</p>
              {job.customerPhone ? (
                <a
                  href={`tel:${job.customerPhone}`}
                  className="text-xs text-teal-700 hover:underline flex items-center gap-1 mt-0.5"
                >
                  <Phone className="w-3 h-3" />
                  <span>{job.customerPhone}</span>
                </a>
              ) : (
                <span className="text-xs text-gray-500">Phone protected until accepted</span>
              )}
            </div>
            <div className="text-right">
              <span className="text-xs text-gray-500">Service Location</span>
              <p className="font-semibold text-xs text-[#152220]">{job.city} ({job.pincode})</p>
            </div>
          </div>
        </div>

        {/* Problem Description */}
        <div className="space-y-1.5">
          <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500">Problem Description</h4>
          <p className="text-sm text-gray-700 bg-gray-50 p-3.5 rounded-lg border border-gray-100 leading-relaxed">
            {job.description || 'No description provided.'}
          </p>
        </div>

        {/* Key Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div className="p-3 bg-white border border-gray-200 rounded-lg">
            <span className="text-[11px] text-gray-500 block">Agreed / Est Price</span>
            <div className="flex items-center gap-1 text-base font-extrabold text-[#217E66] mt-0.5">
              <IndianRupee className="w-4 h-4" />
              <span>₹{job.agreedPriceInr || job.accepted_price_inr || job.estimated_budget_inr || 500}</span>
            </div>
          </div>

          <div className="p-3 bg-white border border-gray-200 rounded-lg">
            <span className="text-[11px] text-gray-500 block">Scheduled Date</span>
            <div className="flex items-center gap-1 text-xs font-semibold text-gray-800 mt-1">
              <Calendar className="w-3.5 h-3.5 text-teal-600" />
              <span>{job.scheduled_date || 'Flexible'}</span>
            </div>
          </div>

          <div className="p-3 bg-white border border-gray-200 rounded-lg">
            <span className="text-[11px] text-gray-500 block">Time Slot</span>
            <div className="flex items-center gap-1 text-xs font-semibold text-gray-800 mt-1">
              <Clock className="w-3.5 h-3.5 text-teal-600" />
              <span>{job.scheduled_time_slot || 'Anytime'}</span>
            </div>
          </div>
        </div>

        {/* Service Address */}
        <div className="p-3.5 bg-gray-50 rounded-lg border border-gray-200 space-y-1">
          <div className="flex items-center gap-1 text-xs font-bold text-gray-700">
            <MapPin className="w-3.5 h-3.5 text-teal-700" />
            <span>Service Address</span>
          </div>
          <p className="text-xs text-gray-600">
            {job.address_line || 'Full address shared with confirmed worker'}, {job.city} - {job.pincode}
          </p>
        </div>

        {/* Cancellation Notice if Cancelled */}
        {job.cancellation_reason || booking?.cancellationReason ? (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Cancellation Reason: </span>
              <span>{job.cancellation_reason || booking?.cancellationReason}</span>
            </div>
          </div>
        ) : null}

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-4 border-t border-gray-100">
          <Link
            href={`/jobs/${job.id}`}
            className="text-xs text-[#0D4A52] font-semibold hover:underline inline-flex items-center gap-1"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>Live Job & Tracking View</span>
          </Link>

          <div className="flex items-center gap-2">
            {isPending && onAction && (
              <>
                <Button size="sm" variant="ghost" onClick={() => onAction('reject', job)} className="text-rose-600">
                  Decline
                </Button>
                <Button size="sm" variant="primary" onClick={() => onAction('accept', job)}>
                  Accept Offer
                </Button>
              </>
            )}

            {isAccepted && !isCancelled && onAction && (
              <Button size="sm" variant="ghost" onClick={() => onAction('cancel', job)} className="text-rose-600">
                Cancel Booking
              </Button>
            )}

            <Button size="sm" variant="secondary" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

