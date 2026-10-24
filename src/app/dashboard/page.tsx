'use client';

import React, { useState, useEffect, useCallback, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { getSupabaseClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import {
  Briefcase,
  User,
  Clock,
  MapPin,
  IndianRupee,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  ArrowRight,
  Send,
  MessageSquare,
  ShieldCheck,
  RefreshCw,
  LogOut,
} from 'lucide-react';

interface Job {
  id: string;
  customer_id: string;
  selected_worker_id: string | null;
  accepted_bid_id: string | null;
  category: string;
  title: string;
  description: string;
  urgency: 'standard' | 'same_day' | 'emergency';
  status: string;
  address_line: string;
  city: string;
  pincode: string;
  estimated_min_price_inr: number | null;
  estimated_max_price_inr: number | null;
  accepted_price_inr: number | null;
  created_at: string;
}

interface Bid {
  id: string;
  job_id: string;
  worker_id: string;
  offered_amount_inr: number;
  labor_cost_inr: number;
  materials_estimate_inr: number;
  visitation_fee_inr: number;
  note: string | null;
  counter_offers: Array<{
    id: string;
    proposedByRole: 'customer' | 'worker';
    proposedAmountInr: number;
    message: string | null;
    createdAt: string;
  }>;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'WITHDRAWN';
  created_at: string;
  worker?: {
    id: string;
    full_name: string;
    avatar_url: string | null;
    primary_city: string;
  };
}

function DashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialRole = searchParams.get('role') === 'worker' ? 'worker' : 'customer';

  const [activeRole, setActiveRole] = useState<'customer' | 'worker'>(initialRole);
  const [sessionUser, setSessionUser] = useState<{ id: string; email?: string } | null>(null);
  const [loadingSession, setLoadingSession] = useState(true);

  // Customer State
  const [myJobs, setMyJobs] = useState<Job[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(false);
  const [selectedJobBids, setSelectedJobBids] = useState<{ [jobId: string]: Bid[] }>({});
  const [loadingBidsForJob, setLoadingBidsForJob] = useState<string | null>(null);
  const [counterInput, setCounterInput] = useState<{ [bidId: string]: { amount: string; message: string } }>({});
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Worker State
  const [openJobs, setOpenJobs] = useState<Job[]>([]);
  const [loadingOpenJobs, setLoadingOpenJobs] = useState(false);
  const [bidFormOpen, setBidFormOpen] = useState<string | null>(null);
  const [bidInput, setBidInput] = useState({
    offeredAmountInr: '',
    laborCostInr: '',
    materialsEstimateInr: '',
    visitationFeeInr: '0',
    note: '',
  });
  const [submittingBid, setSubmittingBid] = useState(false);

  // Check auth session
  useEffect(() => {
    const supabase = getSupabaseClient();
    if (!supabase) {
      Promise.resolve().then(() => setLoadingSession(false));
      return;
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setSessionUser({ id: session.user.id, email: session.user.email });
      }
      setLoadingSession(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setSessionUser({ id: session.user.id, email: session.user.email });
      } else {
        setSessionUser(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Fetch Customer Jobs
  const fetchCustomerJobs = useCallback(async () => {
    setLoadingJobs(true);
    setActionError(null);
    try {
      const res = await fetch('/api/jobs');
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setMyJobs(json.data);
      } else if (json.code === 'UNAUTHENTICATED') {
        setMyJobs([]);
      } else {
        setActionError(json.error || 'Failed to fetch customer jobs.');
      }
    } catch {
      setActionError('Network error while loading jobs.');
    } finally {
      setLoadingJobs(false);
    }
  }, []);

  // Fetch Worker Open Jobs
  const fetchWorkerOpenJobs = useCallback(async () => {
    setLoadingOpenJobs(true);
    setActionError(null);
    try {
      const res = await fetch('/api/jobs?view=open');
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setOpenJobs(json.data);
      } else if (json.code === 'UNAUTHENTICATED') {
        setOpenJobs([]);
      } else {
        setActionError(json.error || 'Failed to fetch open jobs.');
      }
    } catch {
      setActionError('Network error while loading open jobs.');
    } finally {
      setLoadingOpenJobs(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function init() {
      if (activeRole === 'customer') {
        setLoadingJobs(true);
        setActionError(null);
        try {
          const res = await fetch('/api/jobs');
          const json = await res.json();
          if (!cancelled && json.success && Array.isArray(json.data)) {
            setMyJobs(json.data);
          }
        } catch {
          if (!cancelled) setActionError('Network error while loading jobs.');
        } finally {
          if (!cancelled) setLoadingJobs(false);
        }
      } else {
        setLoadingOpenJobs(true);
        setActionError(null);
        try {
          const res = await fetch('/api/jobs?view=open');
          const json = await res.json();
          if (!cancelled && json.success && Array.isArray(json.data)) {
            setOpenJobs(json.data);
          }
        } catch {
          if (!cancelled) setActionError('Network error while loading open jobs.');
        } finally {
          if (!cancelled) setLoadingOpenJobs(false);
        }
      }
    }
    init();
    return () => {
      cancelled = true;
    };
  }, [activeRole]);

  // Load bids for a specific job (Customer view)
  const toggleJobBids = async (jobId: string) => {
    if (selectedJobBids[jobId]) {
      // Toggle collapse
      setSelectedJobBids((prev) => {
        const next = { ...prev };
        delete next[jobId];
        return next;
      });
      return;
    }

    setLoadingBidsForJob(jobId);
    setActionError(null);
    try {
      const res = await fetch(`/api/jobs/${jobId}/bids`);
      const json = await res.json();
      if (json.success && json.data) {
        setSelectedJobBids((prev) => ({
          ...prev,
          [jobId]: json.data.bids ?? [],
        }));
      } else {
        setActionError(json.error || 'Failed to load bids for this job.');
      }
    } catch {
      setActionError('Network error while loading bids.');
    } finally {
      setLoadingBidsForJob(null);
    }
  };

  // Customer accepts a bid
  const handleAcceptBid = async (jobId: string, bidId: string) => {
    setActionError(null);
    setActionSuccess(null);
    try {
      const res = await fetch(`/api/jobs/${jobId}/accept-bid`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bidId }),
      });
      const json = await res.json();
      if (json.success) {
        setActionSuccess('Bid accepted! The worker has been assigned and competing bids rejected.');
        // Refresh jobs and bids
        fetchCustomerJobs();
        toggleJobBids(jobId);
      } else {
        setActionError(json.error || 'Failed to accept bid.');
      }
    } catch {
      setActionError('Network error while accepting bid.');
    }
  };

  // Submit counter-offer (Customer or Worker)
  const handleSendCounter = async (jobId: string, bidId: string) => {
    const input = counterInput[bidId];
    if (!input || !input.amount || parseFloat(input.amount) <= 0) {
      setActionError('Please enter a valid counter-offer amount greater than 0.');
      return;
    }

    setActionError(null);
    setActionSuccess(null);
    try {
      const res = await fetch(`/api/jobs/${jobId}/bids/${bidId}/counter`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          proposedAmountInr: parseFloat(input.amount),
          message: input.message?.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setActionSuccess('Counter-offer submitted to the negotiation thread.');
        setCounterInput((prev) => {
          const next = { ...prev };
          delete next[bidId];
          return next;
        });
        toggleJobBids(jobId);
      } else {
        setActionError(json.error || 'Failed to submit counter-offer.');
      }
    } catch {
      setActionError('Network error while submitting counter-offer.');
    }
  };

  // Worker submits a bid
  const handleSubmitBid = async (jobId: string) => {
    const offeredAmount = parseFloat(bidInput.offeredAmountInr);
    const laborCost = parseFloat(bidInput.laborCostInr || '0');
    const materialsEstimate = parseFloat(bidInput.materialsEstimateInr || '0');
    const visitationFee = parseFloat(bidInput.visitationFeeInr || '0');

    if (isNaN(offeredAmount) || offeredAmount <= 0) {
      setActionError('Total offered amount must be greater than 0.');
      return;
    }

    setSubmittingBid(true);
    setActionError(null);
    setActionSuccess(null);

    try {
      const res = await fetch(`/api/jobs/${jobId}/bids`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          offeredAmountInr: offeredAmount,
          laborCostInr: laborCost,
          materialsEstimateInr: materialsEstimate,
          visitationFeeInr: visitationFee,
          note: bidInput.note.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setActionSuccess('Your bid has been successfully submitted to the customer!');
        setBidFormOpen(null);
        setBidInput({
          offeredAmountInr: '',
          laborCostInr: '',
          materialsEstimateInr: '',
          visitationFeeInr: '0',
          note: '',
        });
        fetchWorkerOpenJobs();
      } else {
        setActionError(json.error || 'Failed to submit bid.');
      }
    } catch {
      setActionError('Network error while placing bid.');
    } finally {
      setSubmittingBid(false);
    }
  };

  const handleSignOut = async () => {
    const supabase = getSupabaseClient();
    if (supabase) {
      await supabase.auth.signOut();
      setSessionUser(null);
      setMyJobs([]);
      setOpenJobs([]);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF9F5] py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Top Header & Role Switcher */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-[#E5DFD2]">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-[#0D4A52] tracking-tight">
                Sahayak Marketplace Dashboard
              </h1>
              <Badge variant="teal">Live Hyperlocal</Badge>
            </div>
            <p className="text-sm text-[#576563] mt-1">
              Real-time job postings, verified bids, counter-offer negotiations, and atomic worker assignment.
            </p>
          </div>

          {/* User Session Status */}
          <div className="flex items-center gap-3">
            {loadingSession ? (
              <span className="text-xs text-[#576563]">Verifying session...</span>
            ) : sessionUser ? (
              <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-[#E5DFD2] shadow-sm">
                <User className="w-4 h-4 text-[#217E66]" />
                <span className="text-xs font-medium text-[#152220] max-w-[150px] truncate">
                  {sessionUser.email}
                </span>
                <button
                  onClick={handleSignOut}
                  title="Sign Out"
                  className="text-xs text-red-600 hover:text-red-700 font-medium ml-1 flex items-center gap-0.5"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Exit</span>
                </button>
              </div>
            ) : (
              <Link href="/login">
                <Button size="sm" variant="secondary">
                  Sign In to Post / Bid
                </Button>
              </Link>
            )}

            {/* Role Toggle */}
            <div className="bg-[#EAE4D6] p-1 rounded-lg flex items-center">
              <button
                type="button"
                onClick={() => {
                  setActiveRole('customer');
                  setActionError(null);
                  setActionSuccess(null);
                }}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                  activeRole === 'customer'
                    ? 'bg-white text-[#0D4A52] shadow-sm'
                    : 'text-[#576563] hover:text-[#152220]'
                }`}
              >
                Customer View
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveRole('worker');
                  setActionError(null);
                  setActionSuccess(null);
                }}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                  activeRole === 'worker'
                    ? 'bg-[#0D4A52] text-white shadow-sm'
                    : 'text-[#576563] hover:text-[#152220]'
                }`}
              >
                Worker Marketplace
              </button>
            </div>
          </div>
        </div>

        {/* Global Feedback Banners */}
        {actionSuccess && (
          <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <div className="text-sm font-medium">{actionSuccess}</div>
          </div>
        )}

        {actionError && (
          <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-sm">{actionError}</div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* CUSTOMER PORTAL */}
        {/* ========================================================================= */}
        {activeRole === 'customer' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-[#152220] flex items-center gap-2">
                  <Briefcase className="w-5 h-5 text-[#0D4A52]" />
                  <span>My Posted Service Requests</span>
                </h2>
                <p className="text-xs text-[#576563]">
                  Review incoming worker offers, negotiate counter-offers, and assign jobs safely.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Button size="sm" variant="ghost" onClick={fetchCustomerJobs} disabled={loadingJobs}>
                  <RefreshCw className={`w-3.5 h-3.5 mr-1 ${loadingJobs ? 'animate-spin' : ''}`} />
                  <span>Refresh</span>
                </Button>
                <Link href="/post-job">
                  <Button size="sm" variant="primary" className="gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-300" />
                    <span>Post New Job</span>
                  </Button>
                </Link>
              </div>
            </div>

            {loadingJobs ? (
              <div className="py-12 text-center text-sm text-[#576563]">Loading your posted jobs...</div>
            ) : myJobs.length === 0 ? (
              <Card className="text-center py-12 space-y-4">
                <div className="w-12 h-12 rounded-full bg-[#EBF4F3] flex items-center justify-center mx-auto text-[#0D4A52]">
                  <Briefcase className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-base font-bold text-[#152220]">No jobs posted yet</h3>
                  <p className="text-xs text-[#576563] max-w-md mx-auto">
                    {sessionUser
                      ? 'You have not submitted any service requests yet. Post a job to receive competitive bids from verified local tradespeople.'
                      : 'Sign in with your customer account to view your active job listings and incoming worker bids.'}
                  </p>
                </div>
                <div>
                  <Link href="/post-job">
                    <Button size="md" variant="primary">
                      Post Your First Job
                    </Button>
                  </Link>
                </div>
              </Card>
            ) : (
              <div className="space-y-4">
                {myJobs.map((job) => {
                  const bids = selectedJobBids[job.id] || [];
                  const isExpanded = Boolean(selectedJobBids[job.id]);

                  return (
                    <Card key={job.id} className="p-5 space-y-4">
                      {/* Job Header */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-base text-[#152220]">{job.title}</span>
                            <Badge variant={job.status === 'ASSIGNED' ? 'green' : 'teal'}>{job.status}</Badge>
                            <span className="text-xs font-semibold uppercase tracking-wider px-2 py-0.5 rounded bg-gray-100 text-gray-700">
                              {job.category}
                            </span>
                          </div>
                          <p className="text-xs text-[#576563] line-clamp-2">{job.description}</p>
                        </div>

                        <div className="flex items-center gap-2 self-start sm:self-auto">
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => toggleJobBids(job.id)}
                            disabled={loadingBidsForJob === job.id}
                          >
                            {loadingBidsForJob === job.id
                              ? 'Loading...'
                              : isExpanded
                              ? 'Hide Bids'
                              : 'Review Bids'}
                          </Button>
                        </div>
                      </div>

                      {/* Meta Info */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-gray-100 text-xs text-[#576563]">
                        <div className="flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-[#217E66]" />
                          <span className="truncate">
                            {job.city} ({job.pincode})
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <IndianRupee className="w-3.5 h-3.5 text-[#217E66]" />
                          <span>
                            {job.accepted_price_inr
                              ? `Assigned: ₹${job.accepted_price_inr}`
                              : job.estimated_min_price_inr
                              ? `Est: ₹${job.estimated_min_price_inr} - ₹${job.estimated_max_price_inr}`
                              : 'Open Bidding'}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-gray-400" />
                          <span>Urgency: {job.urgency}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <ShieldCheck className="w-3.5 h-3.5 text-teal-600" />
                          <span>ID: {job.id.slice(0, 8)}...</span>
                        </div>
                      </div>

                      {/* Expanded Bids Section */}
                      {isExpanded && (
                        <div className="pt-4 border-t border-[#E5DFD2] space-y-3 bg-[#FAF8F3] -mx-5 -mb-5 p-5 rounded-b-xl">
                          <h4 className="text-xs font-bold uppercase tracking-wider text-[#0D4A52] flex items-center justify-between">
                            <span>Worker Proposals ({bids.length})</span>
                            <span className="text-[11px] font-normal text-[#576563]">
                              Atomic acceptance locks job & rejects competitors
                            </span>
                          </h4>

                          {bids.length === 0 ? (
                            <div className="text-center py-6 text-xs text-[#576563]">
                              No bids have been submitted yet for this job. Nearby verified workers are notified.
                            </div>
                          ) : (
                            <div className="space-y-3">
                              {bids.map((bid) => {
                                const isPending = bid.status === 'PENDING';
                                const isAccepted = bid.status === 'ACCEPTED';
                                const counterData = counterInput[bid.id] || { amount: '', message: '' };

                                return (
                                  <div
                                    key={bid.id}
                                    className={`p-4 rounded-lg border bg-white space-y-3 ${
                                      isAccepted
                                        ? 'border-emerald-300 ring-2 ring-emerald-100'
                                        : 'border-gray-200'
                                    }`}
                                  >
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                      <div className="space-y-0.5">
                                        <div className="flex items-center gap-2">
                                          <span className="font-bold text-sm text-[#152220]">
                                            {bid.worker?.full_name || `Worker (${bid.worker_id.slice(0, 8)})`}
                                          </span>
                                          <Badge
                                            variant={
                                              isAccepted
                                                ? 'green'
                                                : bid.status === 'REJECTED'
                                                ? 'neutral'
                                                : 'teal'
                                            }
                                          >
                                            {bid.status}
                                          </Badge>
                                        </div>
                                        <div className="text-xs text-[#576563] flex items-center gap-3">
                                          <span>Labor: ₹{bid.labor_cost_inr}</span>
                                          <span>•</span>
                                          <span>Materials: ₹{bid.materials_estimate_inr}</span>
                                          {bid.visitation_fee_inr > 0 && (
                                            <>
                                              <span>•</span>
                                              <span>Visit Fee: ₹{bid.visitation_fee_inr}</span>
                                            </>
                                          )}
                                        </div>
                                      </div>

                                      <div className="flex items-center gap-3">
                                        <div className="text-right">
                                          <div className="text-xs text-[#576563]">Proposed Total</div>
                                          <div className="font-extrabold text-base text-[#0D4A52]">
                                            ₹{bid.offered_amount_inr}
                                          </div>
                                        </div>

                                        {isPending && (
                                          <Button
                                            size="sm"
                                            variant="primary"
                                            onClick={() => handleAcceptBid(job.id, bid.id)}
                                          >
                                            Accept Bid
                                          </Button>
                                        )}
                                      </div>
                                    </div>

                                    {bid.note && (
                                      <p className="text-xs bg-gray-50 p-2 rounded text-gray-700 italic">
                                        &ldquo;{bid.note}&rdquo;
                                      </p>
                                    )}

                                    {/* Counter-Offer Negotiation History */}
                                    {bid.counter_offers && bid.counter_offers.length > 0 && (
                                      <div className="space-y-1.5 pt-2 border-t border-gray-100">
                                        <div className="text-[11px] font-semibold text-gray-500 flex items-center gap-1">
                                          <MessageSquare className="w-3 h-3" />
                                          <span>Negotiation History ({bid.counter_offers.length} rounds)</span>
                                        </div>
                                        <div className="space-y-1">
                                          {bid.counter_offers.map((c) => (
                                            <div
                                              key={c.id}
                                              className="text-xs p-1.5 rounded bg-gray-50 flex items-center justify-between"
                                            >
                                              <span className="font-medium text-gray-700">
                                                {c.proposedByRole === 'customer' ? 'You' : 'Worker'} proposed: ₹
                                                {c.proposedAmountInr}
                                              </span>
                                              {c.message && (
                                                <span className="text-gray-500 italic max-w-xs truncate">
                                                  &ldquo;{c.message}&rdquo;
                                                </span>
                                              )}
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )}

                                    {/* Inline Counter-Offer Form for Customer */}
                                    {isPending && (
                                      <div className="pt-2 border-t border-gray-100 flex items-center gap-2">
                                        <input
                                          type="number"
                                          placeholder="Counter INR (e.g. 1800)"
                                          value={counterData.amount}
                                          onChange={(e) =>
                                            setCounterInput((prev) => ({
                                              ...prev,
                                              [bid.id]: { ...counterData, amount: e.target.value },
                                            }))
                                          }
                                          className="w-36 text-xs px-2.5 py-1.5 rounded border border-gray-300 focus:outline-none focus:ring-1 focus:ring-[#0D4A52]"
                                        />
                                        <input
                                          type="text"
                                          placeholder="Optional negotiation message"
                                          value={counterData.message}
                                          onChange={(e) =>
                                            setCounterInput((prev) => ({
                                              ...prev,
                                              [bid.id]: { ...counterData, message: e.target.value },
                                            }))
                                          }
                                          className="flex-1 text-xs px-2.5 py-1.5 rounded border border-gray-300 focus:outline-none focus:ring-1 focus:ring-[#0D4A52]"
                                        />
                                        <Button
                                          size="sm"
                                          variant="secondary"
                                          onClick={() => handleSendCounter(job.id, bid.id)}
                                        >
                                          <Send className="w-3 h-3 mr-1" />
                                          <span>Counter</span>
                                        </Button>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* WORKER MARKETPLACE */}
        {/* ========================================================================= */}
        {activeRole === 'worker' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-[#152220] flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-emerald-600" />
                  <span>Available Jobs for Bidding</span>
                </h2>
                <p className="text-xs text-[#576563]">
                  Discover open jobs in your service area, submit fair bids, and earn transparent wages without commission gouging.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Button size="sm" variant="ghost" onClick={fetchWorkerOpenJobs} disabled={loadingOpenJobs}>
                  <RefreshCw className={`w-3.5 h-3.5 mr-1 ${loadingOpenJobs ? 'animate-spin' : ''}`} />
                  <span>Refresh</span>
                </Button>
                {!sessionUser && (
                  <Link href="/login?role=worker">
                    <Button size="sm" variant="primary">
                      Worker Login
                    </Button>
                  </Link>
                )}
              </div>
            </div>

            {loadingOpenJobs ? (
              <div className="py-12 text-center text-sm text-[#576563]">Scanning for open service requests...</div>
            ) : openJobs.length === 0 ? (
              <Card className="text-center py-12 space-y-4">
                <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center mx-auto text-emerald-700">
                  <Briefcase className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-base font-bold text-[#152220]">No open jobs in this radius right now</h3>
                  <p className="text-xs text-[#576563] max-w-md mx-auto">
                    New homeowner requests appear here live as they are posted in Delhi NCR and your trade category.
                  </p>
                </div>
                <div>
                  <Button size="sm" variant="secondary" onClick={fetchWorkerOpenJobs}>
                    Check Again
                  </Button>
                </div>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {openJobs.map((job) => {
                  const isBiddingOnThis = bidFormOpen === job.id;

                  return (
                    <Card key={job.id} className="p-5 space-y-4 flex flex-col justify-between">
                      <div className="space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200">
                              {job.category}
                            </span>
                            <h3 className="text-base font-bold text-[#152220] mt-1.5">{job.title}</h3>
                          </div>
                          <Badge variant={job.urgency === 'emergency' ? 'amber' : 'neutral'}>
                            {job.urgency}
                          </Badge>
                        </div>

                        <p className="text-xs text-[#576563] leading-relaxed line-clamp-3">
                          {job.description}
                        </p>

                        <div className="grid grid-cols-2 gap-2 text-xs text-[#576563] pt-2 border-t border-gray-100">
                          <div className="flex items-center gap-1.5 truncate">
                            <MapPin className="w-3.5 h-3.5 text-[#217E66]" />
                            <span className="truncate">{job.city} ({job.pincode})</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <IndianRupee className="w-3.5 h-3.5 text-[#217E66]" />
                            <span>
                              {job.estimated_min_price_inr
                                ? `₹${job.estimated_min_price_inr} - ₹${job.estimated_max_price_inr}`
                                : 'Budget Flexible'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Bidding CTA & Form */}
                      <div className="pt-3 border-t border-gray-100">
                        {!isBiddingOnThis ? (
                          <Button
                            size="sm"
                            variant="primary"
                            className="w-full gap-1.5"
                            onClick={() => {
                              if (!sessionUser) {
                                router.push('/login?role=worker&redirect=/dashboard?role=worker');
                                return;
                              }
                              setBidFormOpen(job.id);
                            }}
                          >
                            <span>Place a Bid on this Job</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </Button>
                        ) : (
                          <div className="space-y-3 bg-[#FAF8F3] -mx-5 -mb-5 p-4 rounded-b-xl border-t border-[#E5DFD2]">
                            <div className="flex items-center justify-between text-xs font-bold text-[#0D4A52]">
                              <span>Your Itemized Bid</span>
                              <button
                                type="button"
                                onClick={() => setBidFormOpen(null)}
                                className="text-gray-500 hover:text-gray-700"
                              >
                                Cancel
                              </button>
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="text-[11px] font-semibold text-gray-700 block mb-1">
                                  Total Offer (₹) *
                                </label>
                                <input
                                  type="number"
                                  placeholder="e.g. 1500"
                                  value={bidInput.offeredAmountInr}
                                  onChange={(e) =>
                                    setBidInput((prev) => ({ ...prev, offeredAmountInr: e.target.value }))
                                  }
                                  className="w-full text-xs px-2.5 py-1.5 rounded border border-gray-300"
                                />
                              </div>
                              <div>
                                <label className="text-[11px] font-semibold text-gray-700 block mb-1">
                                  Labor Share (₹)
                                </label>
                                <input
                                  type="number"
                                  placeholder="e.g. 1200"
                                  value={bidInput.laborCostInr}
                                  onChange={(e) =>
                                    setBidInput((prev) => ({ ...prev, laborCostInr: e.target.value }))
                                  }
                                  className="w-full text-xs px-2.5 py-1.5 rounded border border-gray-300"
                                />
                              </div>
                            </div>

                            <div>
                              <label className="text-[11px] font-semibold text-gray-700 block mb-1">
                                Note / Arrival Time
                              </label>
                              <input
                                type="text"
                                placeholder="e.g. Can reach in 45 mins with professional tools"
                                value={bidInput.note}
                                onChange={(e) =>
                                  setBidInput((prev) => ({ ...prev, note: e.target.value }))
                                }
                                className="w-full text-xs px-2.5 py-1.5 rounded border border-gray-300"
                              />
                            </div>

                            <Button
                              size="sm"
                              variant="accent"
                              className="w-full"
                              onClick={() => handleSubmitBid(job.id)}
                              disabled={submittingBid}
                            >
                              {submittingBid ? 'Submitting Bid...' : 'Confirm & Submit Bid'}
                            </Button>
                          </div>
                        )}
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<div className="py-20 text-center text-sm text-[#576563]">Loading Dashboard...</div>}>
      <DashboardContent />
    </Suspense>
  );
}
