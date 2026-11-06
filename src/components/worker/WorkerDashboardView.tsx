'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { getSupabaseClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import {
  Briefcase,
  MapPin,
  IndianRupee,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  ArrowRight,
  RefreshCw,
  Calendar,
  Wallet,
  SlidersHorizontal,
  Compass,
  ShieldCheck,
  Star,
} from 'lucide-react';
import {
  WorkerWallet,
  WalletTransaction,
  JobEarningsBreakdown,
  WorkerPayoutMethod,
  PlatformSettings,
  WorkerNotification,
  TransactionType,
  TransactionStatus,
} from '@/types/wallet';
import { WorkerOverviewTab } from '@/components/worker/WorkerOverviewTab';
import { WorkerWalletTab } from '@/components/worker/WorkerWalletTab';
import { WorkerNotificationsDrawer } from '@/components/worker/WorkerNotificationsDrawer';
import { WorkerJobDetailsModal } from '@/components/worker/WorkerJobDetailsModal';
import { WorkerCancelModal } from '@/components/worker/WorkerCancelModal';
import { WorkerWithdrawModal } from '@/components/worker/WorkerWithdrawModal';
import { WorkerPayoutMethodsModal } from '@/components/worker/WorkerPayoutMethodsModal';
import { AdminControlPanel } from '@/components/worker/AdminControlPanel';

interface Job {
  id: string;
  customer_id: string;
  selected_worker_id: string | null;
  accepted_bid_id: string | null;
  category: string;
  title: string;
  description: string;
  urgency: 'standard' | 'same_day' | 'urgent' | 'emergency';
  status: string;
  address_line: string;
  city: string;
  pincode: string;
  estimated_min_price_inr: number | null;
  estimated_max_price_inr: number | null;
  accepted_price_inr: number | null;
  scheduled_date?: string | null;
  scheduled_time_slot?: string | null;
  created_at: string;
}

export interface WorkerDashboardViewProps {
  initialTab?: 'overview' | 'wallet' | 'marketplace' | 'reputation' | 'admin';
}

export function WorkerDashboardView({ initialTab }: WorkerDashboardViewProps = {}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [sessionUser, setSessionUser] = useState<{ id: string; email?: string } | null>(null);
  const [userRole, setUserRole] = useState<'customer' | 'worker' | 'admin' | null>(null);
  const [loadingSession, setLoadingSession] = useState(true);

  // Worker Navigation Tabs
  const tabFromQuery = searchParams.get('tab');
  const validTab =
    tabFromQuery === 'wallet' ||
    tabFromQuery === 'marketplace' ||
    tabFromQuery === 'reputation' ||
    tabFromQuery === 'admin' ||
    tabFromQuery === 'overview'
      ? tabFromQuery
      : initialTab || 'overview';
  const [workerNavTab, setWorkerNavTab] = useState<'overview' | 'wallet' | 'marketplace' | 'reputation' | 'admin'>(validTab);

  useEffect(() => {
    if (
      tabFromQuery === 'wallet' ||
      tabFromQuery === 'marketplace' ||
      tabFromQuery === 'reputation' ||
      tabFromQuery === 'admin' ||
      tabFromQuery === 'overview'
    ) {
      setWorkerNavTab(tabFromQuery);
    }
  }, [tabFromQuery]);

  // Categorized Jobs State
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [categorizedJobs, setCategorizedJobs] = useState<{ upcoming: any[]; pending: any[]; accepted: any[]; rejected: any[] }>({
    upcoming: [],
    pending: [],
    accepted: [],
    rejected: [],
  });
  const [loadingCategorizedJobs, setLoadingCategorizedJobs] = useState(false);

  // Wallet & Earnings State
  const [wallet, setWallet] = useState<WorkerWallet | null>(null);
  const [settings, setSettings] = useState<PlatformSettings | null>(null);
  const [breakdown, setBreakdown] = useState<JobEarningsBreakdown[]>([]);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [payoutMethods, setPayoutMethods] = useState<WorkerPayoutMethod[]>([]);
  const [loadingWallet, setLoadingWallet] = useState(false);

  // Notifications State
  const [notifications, setNotifications] = useState<WorkerNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  // Modals State
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [selectedJobForModal, setSelectedJobForModal] = useState<any | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [jobToCancel, setJobToCancel] = useState<any | null>(null);
  const [cancellingJob, setCancellingJob] = useState(false);
  const [withdrawModalOpen, setWithdrawModalOpen] = useState(false);
  const [payoutMethodsModalOpen, setPayoutMethodsModalOpen] = useState(false);

  // Open Marketplace State
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

  // Reputation & Reviews State
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [reputationData, setReputationData] = useState<{
    averageRating: number;
    totalReviews: number;
    totalCompletedJobs: number;
    completionRate: number;
    punctualityScore: number;
    qualityScore: number;
    pricingHonestyScore: number;
    badges: string[];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    reviews: any[];
  } | null>(null);
  const [loadingReputation, setLoadingReputation] = useState(false);

  // Status Alerts
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // 1. Authoritative Server-Verified Auth Session & Role Resolution
  useEffect(() => {
    let isCancelled = false;

    const resolveRoleAndSession = async () => {
      try {
        const res = await fetch('/api/auth/me');
        const json = await res.json();

        if (isCancelled) return;

        if (!json.success || !json.data?.authenticated || !json.data?.user) {
          setSessionUser(null);
          setUserRole(null);
          setLoadingSession(false);
          router.replace('/login?role=worker');
          return;
        }

        const authUser = json.data.user;
        const authRole = json.data.role as 'worker' | 'customer' | 'admin';

        setSessionUser({ id: authUser.id, email: authUser.email });
        setUserRole(authRole);
        setLoadingSession(false);

        if (authRole === 'customer') {
          // Customers should not land on worker views; redirect directly to /post-job
          router.replace('/post-job');
          return;
        }
        // Authenticated workers stay directly on the Worker Dashboard!
      } catch (err) {
        if (!isCancelled) {
          console.error('Session resolution error:', err);
          setLoadingSession(false);
        }
      }
    };

    resolveRoleAndSession();

    const supabase = getSupabaseClient();
    if (supabase) {
      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((_event, session) => {
        if (session?.user) {
          resolveRoleAndSession();
        } else {
          setSessionUser(null);
          setUserRole(null);
          router.replace('/login?role=worker');
        }
      });

      return () => {
        isCancelled = true;
        subscription.unsubscribe();
      };
    }

    return () => {
      isCancelled = true;
    };
  }, [router]);

  // 2. Fetch Categorized Jobs for Worker
  const fetchCategorizedJobs = useCallback(async () => {
    setLoadingCategorizedJobs(true);
    try {
      const res = await fetch('/api/worker/jobs');
      const json = await res.json();
      if (json.success && json.data) {
        setCategorizedJobs({
          upcoming: json.data.upcoming || [],
          pending: json.data.pending || [],
          accepted: json.data.accepted || [],
          rejected: json.data.rejected || [],
        });
      }
    } catch {
      // Ignore
    } finally {
      setLoadingCategorizedJobs(false);
    }
  }, []);

  // 3. Fetch Worker Wallet & Breakdown
  const fetchWalletData = useCallback(async () => {
    setLoadingWallet(true);
    try {
      const [walletRes, methodsRes, txRes] = await Promise.all([
        fetch('/api/worker/wallet'),
        fetch('/api/worker/payout-methods'),
        fetch('/api/worker/transactions'),
      ]);

      const [walletJson, methodsJson, txJson] = await Promise.all([
        walletRes.json(),
        methodsRes.json(),
        txRes.json(),
      ]);

      if (walletJson.success && walletJson.data) {
        setWallet(walletJson.data.wallet);
        setSettings(walletJson.data.settings);
        setBreakdown(walletJson.data.breakdown || []);
      }

      if (methodsJson.success && Array.isArray(methodsJson.data)) {
        setPayoutMethods(methodsJson.data);
      }

      if (txJson.success && Array.isArray(txJson.data)) {
        setTransactions(txJson.data);
      }
    } catch {
      // Ignore
    } finally {
      setLoadingWallet(false);
    }
  }, []);

  // 4. Fetch Notifications
  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch('/api/worker/notifications');
      const json = await res.json();
      if (json.success && json.data) {
        setNotifications(json.data.notifications || []);
        setUnreadCount(json.data.unreadCount || 0);
      }
    } catch {
      // Ignore
    }
  }, []);

  // 5. Fetch Open Jobs for Marketplace
  const fetchWorkerOpenJobs = useCallback(async () => {
    setLoadingOpenJobs(true);
    try {
      const res = await fetch('/api/jobs?view=open');
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setOpenJobs(json.data);
      }
    } catch {
      // Ignore
    } finally {
      setLoadingOpenJobs(false);
    }
  }, []);

  // 6. Fetch Reputation & Customer Reviews
  const fetchReputation = useCallback(async () => {
    setLoadingReputation(true);
    try {
      const res = await fetch('/api/worker/reputation');
      const json = await res.json();
      if (json.success && json.data) {
        setReputationData(json.data);
      }
    } catch {
      // Ignore
    } finally {
      setLoadingReputation(false);
    }
  }, []);

  // Trigger initial fetches when authenticated as worker
  useEffect(() => {
    if (sessionUser && (userRole === 'worker' || userRole === 'admin')) {
      fetchCategorizedJobs();
      fetchWalletData();
      fetchNotifications();
      fetchWorkerOpenJobs();
      fetchReputation();

      // Polling notifications every 15 seconds
      const timer = setInterval(() => {
        fetchNotifications();
      }, 15000);
      return () => clearInterval(timer);
    }
  }, [sessionUser, userRole, fetchCategorizedJobs, fetchWalletData, fetchNotifications, fetchWorkerOpenJobs, fetchReputation]);

  // Handle Mark Single Notification Read
  const handleMarkNotificationRead = async (id: string) => {
    try {
      await fetch('/api/worker/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationId: id }),
      });
      fetchNotifications();
    } catch {
      // Ignore
    }
  };

  // Handle Mark All Read
  const handleMarkAllRead = async () => {
    try {
      await fetch('/api/worker/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markAll: true }),
      });
      fetchNotifications();
    } catch {
      // Ignore
    }
  };

  // Handle Worker Job Action (Accept / Reject)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleWorkerJobAction = async (action: 'accept' | 'reject', job: any) => {
    setActionError(null);
    setActionSuccess(null);
    try {
      const res = await fetch(`/api/worker/jobs/${job.id}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const json = await res.json();
      if (json.success) {
        setActionSuccess(`Job offer successfully ${action}ed!`);
        setSelectedJobForModal(null);
        fetchCategorizedJobs();
        fetchNotifications();
      } else {
        setActionError(json.error || `Failed to ${action} job.`);
      }
    } catch {
      setActionError(`Network error while trying to ${action} job.`);
    }
  };

  // Handle Worker Cancel Job Confirmation
  const handleConfirmCancelJob = async (reason: string) => {
    if (!jobToCancel) return;
    setCancellingJob(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      const res = await fetch(`/api/worker/jobs/${jobToCancel.id}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'cancel', reason }),
      });
      const json = await res.json();
      if (json.success) {
        setActionSuccess('Job booking successfully cancelled.');
        setJobToCancel(null);
        setSelectedJobForModal(null);
        fetchCategorizedJobs();
        fetchNotifications();
      } else {
        setActionError(json.error || 'Failed to cancel job booking.');
      }
    } catch {
      setActionError('Network error while cancelling booking.');
    } finally {
      setCancellingJob(false);
    }
  };

  // Filter Transaction History
  const handleTransactionFilterChange = async (filters: { type?: TransactionType; status?: TransactionStatus }) => {
    try {
      const query = new URLSearchParams();
      if (filters.type) query.set('type', filters.type);
      if (filters.status) query.set('status', filters.status);
      const res = await fetch(`/api/worker/transactions?${query.toString()}`);
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setTransactions(json.data);
      }
    } catch {
      // Ignore
    }
  };

  // Worker Submits Open Bid
  const handleSubmitBid = async (jobId: string, minPrice?: number, maxPrice?: number) => {
    const offeredAmount = parseFloat(bidInput.offeredAmountInr);
    const laborCost = parseFloat(bidInput.laborCostInr || '0');
    const materialsEstimate = parseFloat(bidInput.materialsEstimateInr || '0');
    const visitationFee = parseFloat(bidInput.visitationFeeInr || '0');

    if (isNaN(offeredAmount) || offeredAmount <= 0) {
      setActionError('Total offered amount must be greater than 0.');
      return;
    }

    if (minPrice != null && offeredAmount < minPrice) {
      setActionError(`Bid amount ₹${offeredAmount} is below the minimum fair estimate of ₹${minPrice} for this job.`);
      return;
    }

    if (maxPrice != null && offeredAmount > maxPrice) {
      setActionError(`Bid amount ₹${offeredAmount} exceeds the maximum fair ceiling of ₹${maxPrice} for this job.`);
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
        fetchCategorizedJobs();
      } else {
        setActionError(json.error || 'Failed to submit bid.');
      }
    } catch {
      setActionError('Network error while placing bid.');
    } finally {
      setSubmittingBid(false);
    }
  };

  // Loading & Role Guard
  if (loadingSession) {
    return (
      <div className="min-h-screen bg-transparent flex items-center justify-center">
        <div className="flex items-center gap-2 text-xs text-[#576563]">
          <RefreshCw className="w-4 h-4 animate-spin text-[#0D4A52]" />
          <span>Loading Sahayak Worker Portal...</span>
        </div>
      </div>
    );
  }

  if (userRole === 'customer') {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="flex items-center gap-2 text-xs text-[#576563]">
          <RefreshCw className="w-4 h-4 animate-spin text-[#0D4A52]" />
          <span>Redirecting to Service Request...</span>
        </div>
      </div>
    );
  }

  const availableBalance = wallet?.availableBalanceInr || 0;
  const totalActiveJobs = categorizedJobs.upcoming.length + categorizedJobs.pending.length + categorizedJobs.accepted.length;

  return (
    <div className="min-h-screen bg-transparent text-[#152220] pb-20">
      {/* Main Body */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 space-y-6">
        {/* Navigation Tabs - Long Connected Button UI */}
        <div className="flex items-center justify-between border-b border-[#E5DFD2] pb-4 flex-wrap gap-3">
          <div className="inline-flex items-center p-1.5 rounded-full bg-white/90 backdrop-blur-md border border-[#E5DFD2] shadow-xs gap-1 max-w-full overflow-x-auto scrollbar-none">
            <button
              onClick={() => setWorkerNavTab('overview')}
              className={`px-3.5 sm:px-4 py-2 rounded-full text-xs sm:text-sm font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
                workerNavTab === 'overview'
                  ? 'bg-[#0D4A52] text-white shadow-xs'
                  : 'text-[#576563] hover:text-[#0D4A52] hover:bg-black/5'
              }`}
            >
              <Briefcase className="w-4 h-4" />
              <span>Work Overview</span>
              {totalActiveJobs > 0 && (
                <span
                  className={`ml-0.5 px-2 py-0.5 rounded-full text-[10px] font-black ${
                    workerNavTab === 'overview' ? 'bg-teal-400 text-teal-950' : 'bg-gray-100 text-gray-700'
                  }`}
                >
                  {totalActiveJobs}
                </span>
              )}
            </button>

            <button
              onClick={() => setWorkerNavTab('wallet')}
              className={`px-3.5 sm:px-4 py-2 rounded-full text-xs sm:text-sm font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
                workerNavTab === 'wallet'
                  ? 'bg-[#0D4A52] text-white shadow-xs'
                  : 'text-[#576563] hover:text-[#0D4A52] hover:bg-black/5'
              }`}
            >
              <Wallet className="w-4 h-4" />
              <span>Earnings &amp; Wallet</span>
            </button>

            <button
              onClick={() => setWorkerNavTab('marketplace')}
              className={`px-3.5 sm:px-4 py-2 rounded-full text-xs sm:text-sm font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
                workerNavTab === 'marketplace'
                  ? 'bg-[#0D4A52] text-white shadow-xs'
                  : 'text-[#576563] hover:text-[#0D4A52] hover:bg-black/5'
              }`}
            >
              <Compass className="w-4 h-4" />
              <span>Open Marketplace</span>
              {openJobs.length > 0 && (
                <span
                  className={`ml-0.5 px-2 py-0.5 rounded-full text-[10px] font-black ${
                    workerNavTab === 'marketplace' ? 'bg-teal-400 text-teal-950' : 'bg-gray-100 text-gray-700'
                  }`}
                >
                  {openJobs.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setWorkerNavTab('reputation')}
              className={`px-3.5 sm:px-4 py-2 rounded-full text-xs sm:text-sm font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
                workerNavTab === 'reputation'
                  ? 'bg-[#0D4A52] text-white shadow-xs'
                  : 'text-[#576563] hover:text-[#0D4A52] hover:bg-black/5'
              }`}
            >
              <Star className="w-4 h-4 text-amber-500 fill-amber-400" />
              <span>Reputation &amp; Reviews</span>
              {reputationData && (
                <span
                  className={`ml-0.5 px-2 py-0.5 rounded-full text-[10px] font-black ${
                    workerNavTab === 'reputation' ? 'bg-amber-400 text-amber-950' : 'bg-gray-100 text-gray-700'
                  }`}
                >
                  {reputationData.averageRating}
                </span>
              )}
            </button>

            {(userRole === 'admin' || searchParams.get('admin') === 'true') && (
              <button
                onClick={() => setWorkerNavTab('admin')}
                className={`px-3.5 sm:px-4 py-2 rounded-full text-xs sm:text-sm font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
                  workerNavTab === 'admin'
                    ? 'bg-[#0D4A52] text-white shadow-xs'
                    : 'text-[#576563] hover:text-[#0D4A52] hover:bg-black/5'
                }`}
              >
                <SlidersHorizontal className="w-4 h-4" />
                <span>Platform Policy</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {(userRole === 'admin' || searchParams.get('admin') === 'true') && (
              <Link
                href="/admin"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0D4A52] hover:bg-[#072F35] text-white text-xs font-semibold transition shadow-xs whitespace-nowrap"
                title="Open full Admin Operations Console"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span className="hidden sm:inline">Open full Admin Panel</span>
                <span className="sm:hidden">Admin Panel</span>
              </Link>
            )}
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                fetchCategorizedJobs();
                fetchWalletData();
                fetchWorkerOpenJobs();
                fetchReputation();
              }}
              disabled={loadingCategorizedJobs || loadingWallet || loadingOpenJobs || loadingReputation}
            >
              <RefreshCw
                className={`w-3.5 h-3.5 mr-1 ${
                  loadingCategorizedJobs || loadingWallet || loadingOpenJobs || loadingReputation ? 'animate-spin' : ''
                }`}
              />
              <span>Refresh</span>
            </Button>
          </div>
        </div>

        {/* Action Alerts */}
        {actionSuccess && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{actionSuccess}</span>
          </div>
        )}

        {actionError && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 flex items-center gap-2 animate-in fade-in">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{actionError}</span>
          </div>
        )}

        {/* TAB 1: WORK OVERVIEW */}
        {workerNavTab === 'overview' && (
          <WorkerOverviewTab
            categorizedJobs={categorizedJobs}
            loading={loadingCategorizedJobs}
            onOpenDetails={(job) => setSelectedJobForModal(job)}
            onOpenCancel={(job) => setJobToCancel(job)}
            onAction={handleWorkerJobAction}
          />
        )}

        {/* TAB 2: EARNINGS & WALLET */}
        {workerNavTab === 'wallet' && (
          <WorkerWalletTab
            wallet={wallet}
            settings={settings}
            breakdown={breakdown}
            transactions={transactions}
            payoutMethods={payoutMethods}
            loading={loadingWallet}
            onOpenWithdraw={() => setWithdrawModalOpen(true)}
            onOpenPayoutMethods={() => setPayoutMethodsModalOpen(true)}
            onFilterChange={handleTransactionFilterChange}
          />
        )}

        {/* TAB 3: OPEN MARKETPLACE (PRESERVED) */}
        {workerNavTab === 'marketplace' && (
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
                  const jobMinPrice = job.estimated_min_price_inr || 300;
                  const jobMaxPrice = job.estimated_max_price_inr || Math.max(jobMinPrice + 100, Math.round(jobMinPrice * 1.5));
                  const enteredAmount = parseFloat(bidInput.offeredAmountInr);
                  const isAmountEntered = !isNaN(enteredAmount) && bidInput.offeredAmountInr.trim() !== '';
                  const isAmountBelowMin = isAmountEntered && enteredAmount < jobMinPrice;
                  const isAmountAboveMax = isAmountEntered && enteredAmount > jobMaxPrice;
                  const isBidValid = isAmountEntered && !isAmountBelowMin && !isAmountAboveMax;

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
                          {job.scheduled_time_slot && (
                            <div className="flex items-center gap-1.5 col-span-2 text-gray-700">
                              <Calendar className="w-3.5 h-3.5 text-teal-600" />
                              <span>{job.scheduled_date || 'Today'} ({job.scheduled_time_slot})</span>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="pt-3 border-t border-gray-100 flex items-center justify-between">
                        <Link href={`/jobs/${job.id}`} className="text-xs font-semibold text-[#0D4A52] hover:underline flex items-center gap-1">
                          <span>View Details</span>
                          <ArrowRight className="w-3 h-3" />
                        </Link>

                        <Button
                          size="sm"
                          variant={isBiddingOnThis ? 'secondary' : 'primary'}
                          onClick={() => setBidFormOpen(isBiddingOnThis ? null : job.id)}
                        >
                          {isBiddingOnThis ? 'Cancel Bid' : 'Submit Proposal'}
                        </Button>
                      </div>

                      {/* Itemized Bid Submission Form */}
                      {isBiddingOnThis && (
                        <div className="pt-4 border-t border-emerald-100 bg-emerald-50/40 -mx-5 -mb-5 p-5 rounded-b-xl space-y-3">
                          <div className="flex items-center justify-between">
                            <h4 className="text-xs font-bold uppercase tracking-wider text-[#0D4A52]">
                              Submit Your Proposal
                            </h4>
                            <div className="flex items-center gap-1 text-[11px] font-bold text-teal-900 bg-teal-100/80 px-2.5 py-0.5 rounded-full border border-teal-200">
                              <ShieldCheck className="w-3.5 h-3.5 text-teal-700" />
                              <span>Fair Range: ₹{jobMinPrice} – ₹{jobMaxPrice}</span>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                            <div className="space-y-1">
                              <label className="text-gray-600 block font-semibold">Total Price (₹)*</label>
                              <input
                                type="number"
                                placeholder={`₹${jobMinPrice}–₹${jobMaxPrice}`}
                                value={bidInput.offeredAmountInr}
                                onChange={(e) =>
                                  setBidInput((prev) => ({ ...prev, offeredAmountInr: e.target.value }))
                                }
                                className={`w-full p-2 rounded border bg-white ${
                                  isAmountBelowMin || isAmountAboveMax
                                    ? 'border-rose-400 focus:ring-rose-400'
                                    : isBidValid
                                    ? 'border-emerald-400 focus:ring-emerald-400'
                                    : 'border-gray-300'
                                }`}
                                required
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-gray-600 block">Labor (₹)</label>
                              <input
                                type="number"
                                placeholder="Labor"
                                value={bidInput.laborCostInr}
                                onChange={(e) =>
                                  setBidInput((prev) => ({ ...prev, laborCostInr: e.target.value }))
                                }
                                className="w-full p-2 rounded border border-gray-300 bg-white"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-gray-600 block">Materials (₹)</label>
                              <input
                                type="number"
                                placeholder="Parts"
                                value={bidInput.materialsEstimateInr}
                                onChange={(e) =>
                                  setBidInput((prev) => ({ ...prev, materialsEstimateInr: e.target.value }))
                                }
                                className="w-full p-2 rounded border border-gray-300 bg-white"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-gray-600 block">Visit Fee (₹)</label>
                              <input
                                type="number"
                                placeholder="Visit"
                                value={bidInput.visitationFeeInr}
                                onChange={(e) =>
                                  setBidInput((prev) => ({ ...prev, visitationFeeInr: e.target.value }))
                                }
                                className="w-full p-2 rounded border border-gray-300 bg-white"
                              />
                            </div>
                          </div>

                          {/* Dynamic Fair Price Range Feedback */}
                          {isAmountBelowMin && (
                            <div className="p-2 bg-amber-50 border border-amber-200 rounded text-[11px] text-amber-900 flex items-center gap-1.5 animate-in fade-in">
                              <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                              <span>Amount cannot be below the fair minimum of ₹{jobMinPrice} for this request.</span>
                            </div>
                          )}

                          {isAmountAboveMax && (
                            <div className="p-2 bg-rose-50 border border-rose-200 rounded text-[11px] text-rose-900 flex items-center gap-1.5 animate-in fade-in">
                              <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                              <span>Amount exceeds the fair price ceiling of ₹{jobMaxPrice}. Please adjust your bid to comply with Sahayak Fair Pricing.</span>
                            </div>
                          )}

                          {isBidValid && (
                            <div className="p-2 bg-emerald-50 border border-emerald-200 rounded text-[11px] text-emerald-900 flex items-center gap-1.5 animate-in fade-in">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                              <span>Bid of ₹{enteredAmount} complies with the Fair Pricing Policy (₹{jobMinPrice} – ₹{jobMaxPrice}).</span>
                            </div>
                          )}

                          <div className="space-y-1 text-xs">
                            <label className="text-gray-600 block">Note for Homeowner</label>
                            <input
                              type="text"
                              placeholder="e.g. 5 yrs experience with copper piping, carry original parts"
                              value={bidInput.note}
                              onChange={(e) => setBidInput((prev) => ({ ...prev, note: e.target.value }))}
                              className="w-full p-2 rounded border border-gray-300 bg-white"
                            />
                          </div>

                          <div className="flex justify-end gap-2 pt-2">
                            <Button size="sm" variant="ghost" onClick={() => setBidFormOpen(null)}>
                              Cancel
                            </Button>
                            <Button
                              size="sm"
                              variant="primary"
                              disabled={submittingBid || !isBidValid}
                              onClick={() => handleSubmitBid(job.id, jobMinPrice, jobMaxPrice)}
                            >
                              {submittingBid ? 'Submitting...' : 'Send Proposal'}
                            </Button>
                          </div>
                        </div>
                      )}
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 4: REPUTATION & REVIEWS */}
        {workerNavTab === 'reputation' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-[#152220] flex items-center gap-2">
                  <Star className="w-5 h-5 text-amber-500 fill-amber-400" />
                  <span>Worker Reputation & Customer Reviews</span>
                </h2>
                <p className="text-xs text-[#576563]">
                  Ratings, verified feedback, and reliability metrics calculated from completed services.
                </p>
              </div>
              {reputationData && (
                <div className="flex items-center gap-1.5 px-3 py-1 bg-amber-50 border border-amber-200 rounded-full text-xs font-bold text-amber-900">
                  <Star className="w-4 h-4 text-amber-500 fill-amber-400" />
                  <span>{reputationData.averageRating} Rating</span>
                  <span className="text-amber-600 font-normal">({reputationData.totalReviews} reviews)</span>
                </div>
              )}
            </div>

            {loadingReputation ? (
              <div className="p-12 text-center text-xs text-[#576563] flex items-center justify-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin text-[#0D4A52]" />
                <span>Loading reputation and customer reviews...</span>
              </div>
            ) : reputationData ? (
              <div className="space-y-6">
                {/* Metrics Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Card className="p-4 bg-white border border-[#E5DFD2]">
                    <div className="text-xs text-gray-500 font-semibold flex items-center justify-between">
                      <span>Overall Rating</span>
                      <Star className="w-4 h-4 text-amber-500 fill-amber-400" />
                    </div>
                    <div className="mt-2 text-2xl font-black text-[#152220] flex items-baseline gap-1">
                      <span>{reputationData.averageRating}</span>
                      <span className="text-xs text-gray-400 font-normal">/ 5.0</span>
                    </div>
                    <p className="text-[11px] text-gray-500 mt-1">
                      Based on {reputationData.totalReviews} verified ratings
                    </p>
                  </Card>

                  <Card className="p-4 bg-white border border-[#E5DFD2]">
                    <div className="text-xs text-gray-500 font-semibold flex items-center justify-between">
                      <span>Job Completion</span>
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    </div>
                    <div className="mt-2 text-2xl font-black text-[#152220] flex items-baseline gap-1">
                      <span>{reputationData.completionRate}%</span>
                    </div>
                    <p className="text-[11px] text-gray-500 mt-1">
                      {reputationData.totalCompletedJobs} jobs successfully finished
                    </p>
                  </Card>

                  <Card className="p-4 bg-white border border-[#E5DFD2]">
                    <div className="text-xs text-gray-500 font-semibold flex items-center justify-between">
                      <span>Punctuality Score</span>
                      <Sparkles className="w-4 h-4 text-teal-600" />
                    </div>
                    <div className="mt-2 text-2xl font-black text-[#152220] flex items-baseline gap-1">
                      <span>{reputationData.punctualityScore}</span>
                      <span className="text-xs text-gray-400 font-normal">/ 5.0</span>
                    </div>
                    <p className="text-[11px] text-gray-500 mt-1">On-time arrival track record</p>
                  </Card>

                  <Card className="p-4 bg-white border border-[#E5DFD2]">
                    <div className="text-xs text-gray-500 font-semibold flex items-center justify-between">
                      <span>Pricing Honesty</span>
                      <ShieldCheck className="w-4 h-4 text-blue-600" />
                    </div>
                    <div className="mt-2 text-2xl font-black text-[#152220] flex items-baseline gap-1">
                      <span>{reputationData.pricingHonestyScore}</span>
                      <span className="text-xs text-gray-400 font-normal">/ 5.0</span>
                    </div>
                    <p className="text-[11px] text-gray-500 mt-1">Zero hidden costs reported</p>
                  </Card>
                </div>

                {/* Trust Badges */}
                {reputationData.badges && reputationData.badges.length > 0 && (
                  <div className="p-4 bg-teal-50/50 border border-teal-100 rounded-xl space-y-2">
                    <span className="text-xs font-bold text-teal-900 uppercase tracking-wider">
                      Earned Trust & Quality Badges
                    </span>
                    <div className="flex flex-wrap gap-2 pt-1">
                      {reputationData.badges.map((badge: string, idx: number) => (
                        <span
                          key={idx}
                          className="px-3 py-1 bg-white border border-teal-200 text-teal-950 font-bold text-xs rounded-full shadow-xs flex items-center gap-1.5"
                        >
                          <ShieldCheck className="w-3.5 h-3.5 text-teal-600" />
                          <span>{badge}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Customer Reviews List */}
                <div className="space-y-3">
                  <h3 className="text-sm font-bold text-[#152220] flex items-center gap-2">
                    <span>Customer Feedback & Testimonials</span>
                    <span className="text-xs font-normal text-gray-500">
                      ({reputationData.reviews?.length || 0} reviews)
                    </span>
                  </h3>

                  {(!reputationData.reviews || reputationData.reviews.length === 0) ? (
                    <Card className="p-8 text-center text-xs text-gray-500">
                      No customer reviews yet. Reviews will automatically appear once customers complete their bookings.
                    </Card>
                  ) : (
                    <div className="space-y-3">
                      {reputationData.reviews.map((rev: any) => (
                        <Card key={rev.id} className="p-4 bg-white border border-[#E5DFD2] space-y-2.5">
                          <div className="flex items-start justify-between flex-wrap gap-2">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-sm text-[#152220]">{rev.customerName}</span>
                                {rev.verified && (
                                  <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded flex items-center gap-1">
                                    <ShieldCheck className="w-3 h-3 text-emerald-600" />
                                    <span>Verified Customer</span>
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-gray-500 mt-0.5">
                                {rev.jobTitle} • <span className="capitalize font-medium text-gray-700">{rev.category}</span>
                              </p>
                            </div>

                            <div className="flex items-center gap-1">
                              {Array.from({ length: 5 }).map((_, i) => (
                                <Star
                                  key={i}
                                  className={`w-4 h-4 ${
                                    i < Math.floor(rev.rating)
                                      ? 'text-amber-400 fill-amber-400'
                                      : 'text-gray-200'
                                  }`}
                                />
                              ))}
                              <span className="text-xs font-bold text-gray-800 ml-1">
                                {Number(rev.rating).toFixed(1)}
                              </span>
                            </div>
                          </div>

                          <p className="text-xs text-[#2A3B39] leading-relaxed bg-[#FBF9F5] p-3 rounded-lg border border-[#E5DFD2]/60">
                            &ldquo;{rev.comment}&rdquo;
                          </p>

                          <div className="flex items-center justify-between text-[11px] text-gray-400 pt-1">
                            <span>{rev.date}</span>
                            <span className="text-emerald-700 font-semibold flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              <span>Completed Service</span>
                            </span>
                          </div>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        )}

        {/* TAB 5: PLATFORM POLICY (ADMIN CONTROLS) */}
        {workerNavTab === 'admin' && (
          <AdminControlPanel
            initialSettings={settings}
            onRefreshWallet={fetchWalletData}
          />
        )}
      </main>

      {/* MODALS */}

      {/* 1. Job Details Modal */}
      <WorkerJobDetailsModal
        job={selectedJobForModal}
        onClose={() => setSelectedJobForModal(null)}
        onAction={(action, job) => {
          if (action === 'cancel') {
            setJobToCancel(job);
          } else {
            handleWorkerJobAction(action, job);
          }
        }}
      />

      {/* 2. Cancellation Modal */}
      <WorkerCancelModal
        job={jobToCancel}
        onClose={() => setJobToCancel(null)}
        onConfirm={handleConfirmCancelJob}
        loading={cancellingJob}
      />

      {/* 3. Withdraw Funds Modal */}
      {withdrawModalOpen && (
        <WorkerWithdrawModal
          availableBalanceInr={availableBalance}
          payoutMethods={payoutMethods}
          isDemo={wallet?.isDemo}
          onClose={() => setWithdrawModalOpen(false)}
          onSuccess={() => {
            fetchWalletData();
            fetchNotifications();
          }}
        />
      )}

      {/* 4. Payout Methods Modal */}
      {payoutMethodsModalOpen && (
        <WorkerPayoutMethodsModal
          methods={payoutMethods}
          onClose={() => setPayoutMethodsModalOpen(false)}
          onRefresh={() => {
            fetchWalletData();
          }}
        />
      )}

      {/* 5. Real-Time Notifications Drawer */}
      <WorkerNotificationsDrawer
        notifications={notifications}
        unreadCount={unreadCount}
        isOpen={notificationsOpen}
        onClose={() => setNotificationsOpen(false)}
        onMarkRead={handleMarkNotificationRead}
        onMarkAllRead={handleMarkAllRead}
      />
    </div>
  );
}

