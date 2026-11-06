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
  CheckCircle2,
  XCircle,
  ExternalLink,
  ChevronRight,
  ChevronDown,
  Briefcase,
  FileText,
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
  const [expandedJobIds, setExpandedJobIds] = useState<Set<string>>(new Set());

  const toggleExpand = (jobId: string) => {
    setExpandedJobIds((prev) => {
      const next = new Set(prev);
      if (next.has(jobId)) {
        next.delete(jobId);
      } else {
        next.add(jobId);
      }
      return next;
    });
  };

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
        <div className="flex flex-col gap-3">
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          {currentJobs.map((job: any) => {
            const booking = job.booking || null;
            const isEmergency = job.urgency === 'emergency';
            const isSameDay = job.urgency === 'same_day' || job.urgency === 'urgent';
            const isExpanded = expandedJobIds.has(job.id);
            const agreedPrice = job.agreedPriceInr || job.accepted_price_inr || job.estimated_budget_inr || 500;

            return (
              <Card
                key={job.id}
                className="overflow-hidden border border-gray-200 transition-all hover:border-gray-300 hover:shadow-sm"
              >
                {/* Horizontal Long Card Header (Always Visible & Clickable) */}
                <div
                  onClick={() => toggleExpand(job.id)}
                  className="p-4 sm:px-5 flex flex-col md:flex-row md:items-center justify-between gap-3 cursor-pointer select-none bg-white hover:bg-gray-50/80 transition"
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      toggleExpand(job.id);
                    }
                  }}
                  aria-expanded={isExpanded}
                >
                  {/* Left: Category Badge & Title */}
                  <div className="flex items-center gap-3 min-w-0 md:w-1/3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200">
                          {job.category}
                        </span>
                        <Badge variant={isEmergency ? 'amber' : isSameDay ? 'teal' : 'neutral'}>
                          {isSameDay ? 'Same Day' : isEmergency ? 'Emergency' : 'Standard'}
                        </Badge>
                      </div>
                      <h3 className="text-base font-bold text-[#152220] mt-1 truncate">
                        {job.title}
                      </h3>
                    </div>
                  </div>

                  {/* Center: Customer, Location, and Schedule */}
                  <div className="flex items-center gap-4 text-xs text-gray-600 flex-wrap md:flex-nowrap md:w-5/12">
                    <div className="flex items-center gap-1.5 min-w-0 truncate">
                      <User className="w-3.5 h-3.5 text-[#0D4A52] shrink-0" />
                      <span className="font-semibold text-gray-800 truncate">
                        {job.customerName || 'Customer'}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 min-w-0 truncate text-gray-500">
                      <MapPin className="w-3.5 h-3.5 text-teal-700 shrink-0" />
                      <span className="truncate">{job.city} ({job.pincode})</span>
                    </div>

                    <div className="flex items-center gap-1.5 min-w-0 truncate text-gray-500 hidden sm:flex">
                      <Calendar className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                      <span className="truncate">
                        {job.scheduled_date || 'Flexible'} {job.scheduled_time_slot ? `(${job.scheduled_time_slot})` : ''}
                      </span>
                    </div>
                  </div>

                  {/* Right: Price & Expand Indicator */}
                  <div className="flex items-center justify-between md:justify-end gap-4 md:w-1/4 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-gray-100">
                    <div className="flex items-center gap-1 text-base font-extrabold text-[#217E66]">
                      <IndianRupee className="w-4 h-4" />
                      <span>{agreedPrice}</span>
                    </div>

                    <div className="flex items-center gap-1.5 text-xs text-gray-500 font-medium">
                      <span>{isExpanded ? 'Less' : 'Details'}</span>
                      <ChevronDown
                        className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${
                          isExpanded ? 'rotate-180 text-teal-700' : ''
                        }`}
                      />
                    </div>
                  </div>
                </div>

                {/* Expanded Details Body */}
                {isExpanded && (
                  <div className="border-t border-gray-100 bg-[#FAF8F3]/50 p-4 sm:p-5 space-y-4 animate-in fade-in duration-150">
                    {/* Customer & Location Details Box */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div className="p-3 bg-white rounded-lg border border-[#E5DFD2] space-y-1 text-xs">
                        <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Customer Contact</span>
                        <div className="flex items-center justify-between text-[#152220] pt-1">
                          <span className="font-bold flex items-center gap-1">
                            <User className="w-3.5 h-3.5 text-[#0D4A52]" />
                            <span>{job.customerName || 'Customer'}</span>
                          </span>
                          {job.customerPhone && (
                            <a
                              href={`tel:${job.customerPhone}`}
                              className="text-teal-700 hover:underline flex items-center gap-1 font-semibold"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Phone className="w-3 h-3" />
                              <span>{job.customerPhone}</span>
                            </a>
                          )}
                        </div>
                      </div>

                      <div className="p-3 bg-white rounded-lg border border-[#E5DFD2] space-y-1 text-xs">
                        <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Service Location</span>
                        <div className="flex items-center gap-1.5 text-gray-700 pt-1">
                          <MapPin className="w-3.5 h-3.5 text-teal-700 shrink-0" />
                          <span className="truncate">{job.address || `${job.city} (${job.pincode})`}</span>
                        </div>
                        <div className="text-[11px] text-gray-400">Pincode: {job.pincode}</div>
                      </div>

                      <div className="p-3 bg-white rounded-lg border border-[#E5DFD2] space-y-1 text-xs">
                        <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Schedule & Budget</span>
                        <div className="flex items-center gap-1.5 text-gray-800 pt-1 font-semibold">
                          <Calendar className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                          <span>{job.scheduled_date || 'Flexible'} {job.scheduled_time_slot ? `(${job.scheduled_time_slot})` : ''}</span>
                        </div>
                        <div className="text-[11px] text-emerald-700 font-bold flex items-center gap-0.5">
                          <IndianRupee className="w-3 h-3" />
                          <span>Agreed: ₹{agreedPrice}</span>
                        </div>
                      </div>
                    </div>

                    {/* Job Description / Notes if available */}
                    {job.description && (
                      <div className="p-3 bg-white rounded-lg border border-[#E5DFD2] text-xs text-gray-700 space-y-1">
                        <div className="flex items-center gap-1 font-bold text-[#152220]">
                          <FileText className="w-3.5 h-3.5 text-teal-700" />
                          <span>Job Description & Scope</span>
                        </div>
                        <p className="text-gray-600 leading-relaxed">{job.description}</p>
                      </div>
                    )}

                    {/* Cancellation Notice if available */}
                    {(job.cancellation_reason || booking?.cancellationReason) && (
                      <div className="text-xs bg-rose-50 text-rose-800 p-3 rounded-lg border border-rose-200">
                        <span className="font-bold">Cancellation Reason: </span>
                        <span>{job.cancellation_reason || booking?.cancellationReason}</span>
                      </div>
                    )}

                    {/* Expanded Action Buttons Footer */}
                    <div className="pt-3 border-t border-[#E5DFD2] flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenDetails(job);
                          }}
                        >
                          View Full Modal Details
                        </Button>

                        {onOpenChat && activeSubTab !== 'rejected' && (
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={(e) => {
                              e.stopPropagation();
                              onOpenChat(job);
                            }}
                            className="text-xs flex items-center gap-1.5"
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

                      <div className="flex items-center gap-2">
                        {activeSubTab === 'pending' && (
                          <>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={(e) => {
                                e.stopPropagation();
                                onAction('reject', job);
                              }}
                              className="text-rose-600 hover:bg-rose-50"
                            >
                              Decline Offer
                            </Button>
                            <Button
                              size="sm"
                              variant="primary"
                              onClick={(e) => {
                                e.stopPropagation();
                                onAction('accept', job);
                              }}
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
                              onClick={(e) => {
                                e.stopPropagation();
                                onOpenCancel(job);
                              }}
                              className="text-rose-600 hover:bg-rose-50 text-xs"
                            >
                              Cancel Booking
                            </Button>
                            <Link href={`/jobs/${job.id}`} onClick={(e) => e.stopPropagation()}>
                              <Button size="sm" variant="secondary">
                                <span>Open Live Tracker</span>
                                <ExternalLink className="w-3.5 h-3.5 ml-1" />
                              </Button>
                            </Link>
                          </>
                        )}

                        {activeSubTab === 'accepted' && (
                          <>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={(e) => {
                                e.stopPropagation();
                                onOpenCancel(job);
                              }}
                              className="text-rose-600 hover:bg-rose-50 text-xs"
                            >
                              Cancel Booking
                            </Button>
                            <Link href={`/jobs/${job.id}`} onClick={(e) => e.stopPropagation()}>
                              <Button size="sm" variant="primary">
                                <span>Continue Job</span>
                                <ChevronRight className="w-3.5 h-3.5 ml-1" />
                              </Button>
                            </Link>
                          </>
                        )}

                        {activeSubTab === 'rejected' && (
                          <Link href={`/jobs/${job.id}`} onClick={(e) => e.stopPropagation()}>
                            <Button size="sm" variant="ghost">
                              View History
                            </Button>
                          </Link>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
