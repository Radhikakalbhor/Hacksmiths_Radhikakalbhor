'use client';

import React, { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import {
  Calendar,
  Clock,
  MapPin,
  IndianRupee,
  User,
  Phone,
  AlertCircle,
  CheckCircle2,
  XCircle,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  Briefcase,
  MessageSquare,
} from 'lucide-react';
import Link from 'next/link';

interface WorkerOverviewTabProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  categorizedJobs: {
    upcoming: any[];
    pending: any[];
    accepted: any[];
    rejected: any[];
  };
  loading: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onOpenDetails: (job: any) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onOpenCancel: (job: any) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onAction: (action: 'accept' | 'reject', job: any) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onOpenChat?: (job: any) => void;
  unreadCountsByJob?: Record<string, number>;
}

export function WorkerOverviewTab({
  categorizedJobs,
  loading,
  onOpenDetails,
  onOpenCancel,
  onAction,
  onOpenChat,
  unreadCountsByJob,
}: WorkerOverviewTabProps) {
  const [activeSubTab, setActiveSubTab] = useState<'upcoming' | 'pending' | 'accepted' | 'rejected'>('upcoming');

  const counts = {
    upcoming: categorizedJobs.upcoming.length,
    pending: categorizedJobs.pending.length,
    accepted: categorizedJobs.accepted.length,
    rejected: categorizedJobs.rejected.length,
  };

  const currentJobs = categorizedJobs[activeSubTab];

  return (
    <div className="space-y-6">
      {/* Sub-tabs header cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <button
          onClick={() => setActiveSubTab('upcoming')}
          className={`p-4 rounded-xl border text-left transition ${
            activeSubTab === 'upcoming'
              ? 'bg-teal-700 text-white border-teal-700 shadow-md ring-2 ring-teal-500/20'
              : 'bg-white hover:bg-gray-50 border-gray-200 text-gray-800'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider opacity-90">Upcoming</span>
            <Calendar className="w-4 h-4 opacity-80" />
          </div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-2xl font-black">{counts.upcoming}</span>
            <span className="text-[11px] opacity-75">scheduled</span>
          </div>
        </button>

        <button
          onClick={() => setActiveSubTab('pending')}
          className={`p-4 rounded-xl border text-left transition ${
            activeSubTab === 'pending'
              ? 'bg-amber-600 text-white border-amber-600 shadow-md ring-2 ring-amber-500/20'
              : 'bg-white hover:bg-gray-50 border-gray-200 text-gray-800'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider opacity-90">Pending Offers</span>
            <Clock className="w-4 h-4 opacity-80" />
          </div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-2xl font-black">{counts.pending}</span>
            <span className="text-[11px] opacity-75">awaiting response</span>
          </div>
        </button>

        <button
          onClick={() => setActiveSubTab('accepted')}
          className={`p-4 rounded-xl border text-left transition ${
            activeSubTab === 'accepted'
              ? 'bg-emerald-700 text-white border-emerald-700 shadow-md ring-2 ring-emerald-500/20'
              : 'bg-white hover:bg-gray-50 border-gray-200 text-gray-800'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider opacity-90">Accepted & Active</span>
            <CheckCircle2 className="w-4 h-4 opacity-80" />
          </div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-2xl font-black">{counts.accepted}</span>
            <span className="text-[11px] opacity-75">in progress</span>
          </div>
        </button>

        <button
          onClick={() => setActiveSubTab('rejected')}
          className={`p-4 rounded-xl border text-left transition ${
            activeSubTab === 'rejected'
              ? 'bg-rose-700 text-white border-rose-700 shadow-md ring-2 ring-rose-500/20'
              : 'bg-white hover:bg-gray-50 border-gray-200 text-gray-800'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider opacity-90">Rejected / Cancelled</span>
            <XCircle className="w-4 h-4 opacity-80" />
          </div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-2xl font-black">{counts.rejected}</span>
            <span className="text-[11px] opacity-75">history</span>
          </div>
        </button>
      </div>

      {/* Jobs Listing */}
      {loading ? (
        <div className="text-center py-12 text-sm text-gray-500">Loading your jobs...</div>
      ) : currentJobs.length === 0 ? (
        <Card className="text-center py-12 space-y-3">
          <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto text-gray-400">
            <Briefcase className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-gray-800">
            No {activeSubTab} jobs right now
          </h3>
          <p className="text-xs text-gray-500 max-w-sm mx-auto">
            {activeSubTab === 'upcoming' && 'Jobs you have been selected for will appear here.'}
            {activeSubTab === 'pending' && 'Direct homeowner offers and booking requests awaiting your approval.'}
            {activeSubTab === 'accepted' && 'Jobs currently underway, in transit, or active today.'}
            {activeSubTab === 'rejected' && 'Jobs declined by you or cancelled by homeowners.'}
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          {currentJobs.map((job: any) => {
            const booking = job.booking || null;
            const isEmergency = job.urgency === 'emergency';
            const isSameDay = job.urgency === 'same_day' || job.urgency === 'urgent';

            return (
              <Card key={job.id} className="p-5 flex flex-col justify-between space-y-4 hover:shadow-md transition">
                <div className="space-y-3">
                  {/* Top Bar: Category & Badges */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200">
                        {job.category}
                      </span>
                      <h3 className="text-base font-bold text-[#152220] mt-1 line-clamp-1">{job.title}</h3>
                    </div>
                    <Badge variant={isEmergency ? 'amber' : isSameDay ? 'teal' : 'neutral'}>
                      {isSameDay ? 'Same Day' : isEmergency ? 'Emergency' : 'Standard'}
                    </Badge>
                  </div>

                  {/* Customer & Location */}
                  <div className="p-3 bg-[#FAF8F3] rounded-lg border border-[#E5DFD2] space-y-1 text-xs">
                    <div className="flex items-center justify-between text-[#152220]">
                      <span className="font-bold flex items-center gap-1">
                        <User className="w-3 h-3 text-[#0D4A52]" />
                        <span>{job.customerName || 'Customer'}</span>
                      </span>
                      {job.customerPhone && (
                        <span className="text-teal-700 flex items-center gap-1 font-semibold">
                          <Phone className="w-3 h-3" />
                          <span>{job.customerPhone}</span>
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 text-gray-500">
                      <MapPin className="w-3 h-3 text-teal-700 shrink-0" />
                      <span className="truncate">{job.city} ({job.pincode})</span>
                    </div>
                  </div>

                  {/* Timing & Price Metrics */}
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="p-2 bg-gray-50 rounded border border-gray-100">
                      <span className="text-[10px] text-gray-400 block">Scheduled Time</span>
                      <div className="font-semibold text-gray-800 flex items-center gap-1 mt-0.5">
                        <Calendar className="w-3 h-3 text-teal-600" />
                        <span className="truncate">{job.scheduled_date || 'Flexible'} {job.scheduled_time_slot ? `(${job.scheduled_time_slot})` : ''}</span>
                      </div>
                    </div>

                    <div className="p-2 bg-gray-50 rounded border border-gray-100">
                      <span className="text-[10px] text-gray-400 block">Agreed Price</span>
                      <div className="font-bold text-[#217E66] flex items-center gap-1 mt-0.5">
                        <IndianRupee className="w-3.5 h-3.5" />
                        <span>₹{job.agreedPriceInr || job.accepted_price_inr || job.estimated_budget_inr || 500}</span>
                      </div>
                    </div>
                  </div>

                  {/* Stage or cancellation notice */}
                  {job.cancellation_reason || booking?.cancellationReason ? (
                    <div className="text-[11px] bg-rose-50 text-rose-800 p-2 rounded border border-rose-200">
                      <span className="font-bold">Reason: </span>
                      <span>{job.cancellation_reason || booking?.cancellationReason}</span>
                    </div>
                  ) : null}
                </div>

                {/* Card Actions */}
                <div className="pt-3 border-t border-gray-100 flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <Button size="sm" variant="ghost" onClick={() => onOpenDetails(job)}>
                      Details
                    </Button>
                    {onOpenChat && activeSubTab !== 'rejected' && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => onOpenChat(job)}
                        className="text-xs flex items-center gap-1"
                      >
                        <MessageSquare className="w-3.5 h-3.5 text-[#0D4A52]" />
                        <span>Message Customer</span>
                        {unreadCountsByJob && (unreadCountsByJob[job.id] || 0) > 0 && (
                          <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-amber-500 text-white animate-pulse">
                            {unreadCountsByJob[job.id]}
                          </span>
                        )}
                      </Button>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5">
                    {activeSubTab === 'pending' && (
                      <>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => onAction('reject', job)}
                          className="text-rose-600"
                        >
                          Decline
                        </Button>
                        <Button
                          size="sm"
                          variant="primary"
                          onClick={() => onAction('accept', job)}
                        >
                          Accept Offer
                        </Button>
                      </>
                    )}

                    {activeSubTab === 'upcoming' && (
                      <>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => onOpenCancel(job)}
                          className="text-rose-600 text-xs"
                        >
                          Cancel
                        </Button>
                        <Link href={`/jobs/${job.id}`}>
                          <Button size="sm" variant="secondary">
                            <span>Open Tracker</span>
                            <ExternalLink className="w-3 h-3 ml-1" />
                          </Button>
                        </Link>
                      </>
                    )}

                    {activeSubTab === 'accepted' && (
                      <>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => onOpenCancel(job)}
                          className="text-rose-600 text-xs"
                        >
                          Cancel
                        </Button>
                        <Link href={`/jobs/${job.id}`}>
                          <Button size="sm" variant="primary">
                            <span>Continue Job</span>
                            <ChevronRight className="w-3.5 h-3.5 ml-1" />
                          </Button>
                        </Link>
                      </>
                    )}

                    {activeSubTab === 'rejected' && (
                      <Link href={`/jobs/${job.id}`}>
                        <Button size="sm" variant="ghost">
                          View History
                        </Button>
                      </Link>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

