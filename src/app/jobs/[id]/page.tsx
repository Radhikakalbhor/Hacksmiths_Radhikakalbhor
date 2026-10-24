'use client';

import React, { useState, useEffect, Suspense, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  MapPin,
  IndianRupee,
  Clock,
  Sparkles,
  Star,
  ShieldCheck,
  AlertCircle,
  Loader2,
  Briefcase,
  Radio,
  Eye,
  X,
  Compass,
  Phone,
  MessageSquare,
  Send,
  CheckCircle2,
  Navigation,
  KeyRound,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  UserCheck,
  Timer,
  AlertTriangle,
  XCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import {
  BookingStage,
  BookingState,
  ChatMessage,
  calculateEstimatedTravelTimeMinutes,
} from '@/types/booking';

const CANCELLATION_REASONS = [
  'Estimated wait time is too long',
  'I no longer need this service',
  'I found a better price',
  'I am not comfortable with this professional',
  'I changed my mind',
  'Other',
] as const;

interface JobDetails {
  id: string;
  customer_id: string;
  category: string;
  title: string;
  description: string;
  urgency: string;
  status: string;
  address_line: string;
  landmark?: string | null;
  city: string;
  pincode: string;
  location_point?: unknown;
  service_location?: unknown;
  estimated_min_price_inr?: number | null;
  estimated_max_price_inr?: number | null;
  created_at: string;
  ai_details?: {
    booking?: BookingState;
    chat_messages?: ChatMessage[];
    [key: string]: unknown;
  } | null;
}

interface NearbyWorker {
  worker_id: string;
  full_name: string;
  avatar_url: string | null;
  primary_category: string;
  skills: string[];
  bio: string | null;
  years_experience: number;
  hourly_rate_inr: number | null;
  fixed_rate_estimate_inr: number | null;
  reputation_score: number;
  total_completed_jobs: number;
  is_available: boolean;
  distance_meters: number;
}

function parseCoords(locationPoint: unknown, fallbackCity?: string): { lat: number; lng: number } {
  if (typeof locationPoint === 'string') {
    const match = locationPoint.match(/POINT\s*\(\s*([-\d.]+)\s+([-\d.]+)\s*\)/i);
    if (match) {
      return { lng: parseFloat(match[1]), lat: parseFloat(match[2]) };
    }
  } else if (locationPoint && typeof locationPoint === 'object' && 'coordinates' in locationPoint) {
    const coords = (locationPoint as { coordinates: number[] }).coordinates;
    if (Array.isArray(coords) && coords.length >= 2) {
      return { lng: coords[0], lat: coords[1] };
    }
  }
  if (fallbackCity && fallbackCity.toLowerCase().includes('mumbai')) {
    return { lat: 19.076, lng: 72.8777 };
  }
  return { lat: 19.076, lng: 72.8777 };
}

const BOOKING_STEPS: { stage: BookingStage; label: string; description: string }[] = [
  { stage: 'requested', label: 'Requested', description: 'Booking request placed' },
  { stage: 'accepted', label: 'Confirmed', description: 'Professional assigned' },
  { stage: 'on_the_way', label: 'On The Way', description: 'Traveling to location' },
  { stage: 'arrived', label: 'Arrived', description: 'At customer address' },
  { stage: 'in_progress', label: 'In Progress', description: 'Work in progress' },
  { stage: 'completed', label: 'Completed', description: 'Service completed' },
];

function JobDiscoveryContent() {
  const params = useParams();
  const router = useRouter();
  const jobId = params?.id as string;

  // Job & Discovery Data
  const [job, setJob] = useState<JobDetails | null>(null);
  const [bidsCount, setBidsCount] = useState<number>(0);
  const [loadingJob, setLoadingJob] = useState(true);
  const [jobError, setJobError] = useState<string | null>(null);

  // Workers Discovery
  const [workers, setWorkers] = useState<NearbyWorker[]>([]);
  const [loadingWorkers, setLoadingWorkers] = useState(false);
  const [searchRadius, setSearchRadius] = useState<number>(15000);
  const [activeWorkerProfile, setActiveWorkerProfile] = useState<NearbyWorker | null>(null);

  // Active Booking & Uber/Rapido States
  const [booking, setBooking] = useState<BookingState | null>(null);
  const [customerOtp, setCustomerOtp] = useState<string | null>(null);
  const [bookingConfirmWorker, setBookingConfirmWorker] = useState<NearbyWorker | null>(null);
  const [bookingAgreedPrice, setBookingAgreedPrice] = useState<number>(450);
  const [isBookingSubmitting, setIsBookingSubmitting] = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);

  // Modals & Panels
  const [showCallModal, setShowCallModal] = useState(false);
  const [showChatDrawer, setShowChatDrawer] = useState(false);
  const [showWorkerSimulation, setShowWorkerSimulation] = useState(false);

  // Chat States
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Worker Transition & OTP States
  const [workerOtpInput, setWorkerOtpInput] = useState('');
  const [isTransitioningStatus, setIsTransitioningStatus] = useState(false);
  const [transitionError, setTransitionError] = useState<string | null>(null);
  const [transitionSuccess, setTransitionSuccess] = useState<string | null>(null);

  // Cancellation States
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [selectedCancelReason, setSelectedCancelReason] = useState<string>('');
  const [customCancelReason, setCustomCancelReason] = useState<string>('');
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [cancelSuccessMsg, setCancelSuccessMsg] = useState<string | null>(null);

  // Simulated countdown seconds for demo tracking
  const [simulatedCountdown, setSimulatedCountdown] = useState<number>(0);

  // 1. Fetch Job Details
  const loadJob = useCallback(async () => {
    if (!jobId) return;
    try {
      const res = await fetch(`/api/jobs/${jobId}`);
      const data = await res.json();

      if (!res.ok) {
        if (res.status === 401) {
          router.push(`/login?redirect=/jobs/${jobId}`);
          return;
        }
        setJobError(data.error || 'Failed to retrieve job details.');
        setLoadingJob(false);
        return;
      }

      const jobData = data.data?.job as JobDetails;
      setJob(jobData);
      setBidsCount(Array.isArray(data.data?.bids) ? data.data.bids.length : 0);

      // Check for active booking state in ai_details
      if (jobData?.ai_details?.booking) {
        const b = jobData.ai_details.booking;
        setBooking(b);
        if (b.customerOtp) {
          setCustomerOtp(b.customerOtp);
        }
        if (b.isDemoWorker && b.simulatedSecondsRemaining) {
          setSimulatedCountdown(b.simulatedSecondsRemaining);
        } else if (b.estimatedArrivalMinutes) {
          setSimulatedCountdown(b.estimatedArrivalMinutes * 60);
        }
      }
    } catch (err) {
      setJobError(err instanceof Error ? err.message : 'Network error loading job.');
    } finally {
      setLoadingJob(false);
    }
  }, [jobId, router]);

  useEffect(() => {
    loadJob();
  }, [loadJob]);

  // 2. Fetch Nearby Workers once Job is Loaded
  useEffect(() => {
    if (!job) return;
    let isCancelled = false;

    const loadWorkers = async () => {
      setLoadingWorkers(true);
      const locField = job.service_location ?? job.location_point;
      const { lat, lng } = parseCoords(locField, job.city);

      try {
        const queryParams = new URLSearchParams({
          lat: lat.toString(),
          lng: lng.toString(),
          category: job.category,
          radius: searchRadius.toString(),
          limit: '20',
        });

        const res = await fetch(`/api/workers/nearby?${queryParams.toString()}`);
        const data = await res.json();
        if (isCancelled) return;

        if (res.ok && data.data?.workers) {
          setWorkers(data.data.workers);
        } else {
          setWorkers([]);
        }
      } catch (err) {
        console.warn('Nearby workers query notice:', err);
        if (!isCancelled) setWorkers([]);
      } finally {
        if (!isCancelled) setLoadingWorkers(false);
      }
    };

    loadWorkers();

    return () => {
      isCancelled = true;
    };
  }, [job, searchRadius]);

  // 3. Messages Polling
  const fetchMessages = useCallback(async () => {
    if (!jobId || !booking) return;
    try {
      setIsLoadingMessages(true);
      const res = await fetch(`/api/jobs/${jobId}/messages`);
      const data = await res.json();
      if (res.ok && data.data?.messages) {
        setMessages(data.data.messages);
      }
    } catch (err) {
      console.warn('Failed to load messages:', err);
    } finally {
      setIsLoadingMessages(false);
    }
  }, [jobId, booking]);

  useEffect(() => {
    if (booking && showChatDrawer) {
      fetchMessages();
      const interval = setInterval(fetchMessages, 3000);
      return () => clearInterval(interval);
    }
  }, [booking, showChatDrawer, fetchMessages]);

  // Auto-scroll chat to latest message
  useEffect(() => {
    if (showChatDrawer) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, showChatDrawer]);

  // 4. Simulated Arrival Countdown Timer
  useEffect(() => {
    if (
      !booking ||
      booking.stage === 'arrived' ||
      booking.stage === 'in_progress' ||
      booking.stage === 'completed' ||
      booking.stage === 'cancelled'
    ) {
      return;
    }
    if (simulatedCountdown <= 0) return;

    const timer = setInterval(() => {
      setSimulatedCountdown((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => clearInterval(timer);
  }, [booking, simulatedCountdown]);

  // Initiate Booking Modal
  const handleOpenBookingConfirm = (worker: NearbyWorker) => {
    setActiveWorkerProfile(null);
    setBookingConfirmWorker(worker);
    const estimatedAmount =
      worker.fixed_rate_estimate_inr ||
      worker.hourly_rate_inr ||
      job?.estimated_min_price_inr ||
      450;
    setBookingAgreedPrice(estimatedAmount);
    setBookingError(null);
  };

  // Submit Instant Booking
  const handleConfirmBooking = async () => {
    if (!job || !bookingConfirmWorker) return;
    setIsBookingSubmitting(true);
    setBookingError(null);

    try {
      const res = await fetch(`/api/jobs/${job.id}/book-now`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workerId: bookingConfirmWorker.worker_id,
          workerName: bookingConfirmWorker.full_name,
          offeredPriceInr: bookingAgreedPrice,
          distanceMeters: bookingConfirmWorker.distance_meters,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setBookingError(data.error || 'Failed to complete booking. Please try again.');
        setIsBookingSubmitting(false);
        return;
      }

      const confirmedBooking = data.data.booking as BookingState;
      setBooking(confirmedBooking);
      if (data.data.startOtp) {
        setCustomerOtp(data.data.startOtp);
      }
      setBookingConfirmWorker(null);

      // Refresh job state
      await loadJob();
    } catch (err) {
      setBookingError(err instanceof Error ? err.message : 'Network error during booking.');
    } finally {
      setIsBookingSubmitting(false);
    }
  };

  // Update Status Transition (Worker / Simulation)
  const handleTransitionBooking = async (targetStage: BookingStage, otpCode?: string) => {
    if (!job) return;
    setIsTransitioningStatus(true);
    setTransitionError(null);
    setTransitionSuccess(null);

    try {
      const res = await fetch(`/api/jobs/${job.id}/booking-status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetStage,
          otpCode: otpCode?.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setTransitionError(data.error || 'Status update failed.');
        setIsTransitioningStatus(false);
        return;
      }

      setTransitionSuccess(`Booking transitioned to '${targetStage.replace('_', ' ')}' successfully.`);
      if (data.data?.booking) {
        setBooking(data.data.booking);
      }
      setWorkerOtpInput('');
      await loadJob();
    } catch (err) {
      setTransitionError(err instanceof Error ? err.message : 'Network error updating booking status.');
    } finally {
      setIsTransitioningStatus(false);
    }
  };

  // Send In-App Chat Message
  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || chatInput).trim();
    if (!text || !job || isSendingMessage) return;

    setIsSendingMessage(true);
    setChatError(null);
    try {
      const res = await fetch(`/api/jobs/${job.id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });

      const data = await res.json();
      if (res.ok && data.data?.message) {
        setMessages((prev) => {
          const existingIds = new Set(prev.map((m) => m.id));
          const next = [...prev];
          if (!existingIds.has(data.data.message.id)) {
            next.push(data.data.message);
            existingIds.add(data.data.message.id);
          }
          if (data.data.demoReply && !existingIds.has(data.data.demoReply.id)) {
            next.push(data.data.demoReply);
          }
          return next;
        });
        setChatInput('');
        // Trigger server sync
        fetchMessages();
      } else {
        setChatError(data.error || 'Failed to deliver message.');
      }
    } catch (err) {
      console.warn('Error sending message:', err);
      setChatError('Network error while delivering message. Please try again.');
    } finally {
      setIsSendingMessage(false);
    }
  };

  // Customer Booking Cancellation Handler
  const handleConfirmCancellation = async () => {
    if (!job || !booking) return;

    const finalReason = selectedCancelReason === 'Other'
      ? customCancelReason.trim()
      : selectedCancelReason.trim();

    if (!finalReason) {
      setCancelError(selectedCancelReason === 'Other' ? 'Please specify your cancellation reason.' : 'Please select a reason for cancellation.');
      return;
    }

    setIsCancelling(true);
    setCancelError(null);

    try {
      const res = await fetch(`/api/jobs/${job.id}/booking-status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetStage: 'cancelled',
          cancellationReason: finalReason,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setCancelError(data.error || 'Failed to cancel booking. Please try again.');
        setIsCancelling(false);
        return;
      }

      const updatedBooking = data.data.booking as BookingState;
      setBooking(updatedBooking);
      setJob((prev) => (prev ? { ...prev, status: 'cancelled' } : null));
      setSimulatedCountdown(0);
      setShowCancelModal(false);
      setCancelSuccessMsg('Your booking has been cancelled successfully.');
    } catch (err) {
      console.error('Cancellation error:', err);
      setCancelError('Network error while cancelling booking. Please try again.');
    } finally {
      setIsCancelling(false);
    }
  };

  // Click-to-call handler
  const handleCallWorker = () => {
    if (!booking) return;
    // Check if worker is demo or has dummy number
    const isDemo =
      booking.isDemoWorker ||
      !booking.workerPhone ||
      booking.workerPhone.startsWith('+91999900000');

    if (isDemo) {
      setShowCallModal(true);
    } else {
      window.location.href = `tel:${booking.workerPhone}`;
    }
  };

  if (loadingJob) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-3">
        <Loader2 className="w-8 h-8 animate-spin text-[#0D4A52]" />
        <p className="text-sm text-[#576563]">Loading Service Request &amp; Neighborhood Pros...</p>
      </div>
    );
  }

  if (jobError || !job) {
    return (
      <div className="max-w-xl mx-auto my-12 p-6 bg-white rounded-2xl border border-red-200 text-center space-y-4">
        <AlertCircle className="w-10 h-10 text-red-600 mx-auto" />
        <h2 className="text-lg font-bold text-[#152220]">Service Request Not Found</h2>
        <p className="text-xs text-[#576563]">{jobError || 'The requested job ID could not be loaded.'}</p>
        <div className="pt-2 flex justify-center gap-3">
          <Link href="/dashboard">
            <Button variant="primary" size="sm">
              Go to My Jobs Dashboard
            </Button>
          </Link>
          <Link href="/post-job">
            <Button variant="secondary" size="sm">
              Post New Request
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const travelMinutes = booking?.estimatedArrivalMinutes || 18;
  const remainingMinutes = Math.ceil(simulatedCountdown / 60);

  return (
    <div className="max-w-5xl mx-auto py-8 px-4 sm:px-6 lg:px-8 space-y-8">
      {/* Top Navigation */}
      <div className="flex items-center justify-between">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#576563] hover:text-[#0D4A52] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Dashboard</span>
        </Link>
        <div className="flex items-center gap-2">
          <Badge variant={booking ? 'teal' : 'green'}>
            {booking ? `BOOKING: ${booking.stage.toUpperCase()}` : job.status.toUpperCase()}
          </Badge>
          <span className="text-xs text-[#83928E] font-mono">#{job.id.slice(0, 8)}</span>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 🚀 ACTIVE BOOKING & TRACKING EXPERIENCE (Uber/Rapido style) */}
      {/* ========================================================================= */}
      {booking && (
        <div className="bg-white rounded-3xl border-2 border-[#0D4A52] shadow-xl overflow-hidden transition-all">
          {/* Top Status Header */}
          <div className="bg-[#0D4A52] text-white p-5 sm:p-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-white/20 text-white">
                    Direct Booking Confirmed
                  </span>
                  {booking.isDemoWorker && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-400 text-amber-950">
                      [DEMO PROFESSIONAL]
                    </span>
                  )}
                </div>
                <h2 className="text-xl sm:text-2xl font-black tracking-tight">
                  {booking.stage === 'requested' && 'Finding & Assigning Professional...'}
                  {booking.stage === 'accepted' && `${booking.workerName} is Confirmed`}
                  {booking.stage === 'on_the_way' && `${booking.workerName} is On The Way`}
                  {booking.stage === 'arrived' && `${booking.workerName} Has Arrived!`}
                  {booking.stage === 'in_progress' && 'Service Currently In Progress'}
                  {booking.stage === 'completed' && 'Service Successfully Completed'}
                  {booking.stage === 'cancelled' && 'Booking Cancelled'}
                </h2>
                <p className="text-xs text-white/80">
                  {booking.stage === 'arrived'
                    ? 'Please share your 4-digit start OTP with the professional.'
                    : `Estimated arrival travel time: ~${remainingMinutes > 0 ? remainingMinutes : travelMinutes} mins.`}
                </p>
              </div>

              {/* Action Buttons: Call, Chat & Cancel */}
              <div className="flex items-center gap-2 shrink-0 flex-wrap">
                {booking.stage !== 'completed' && booking.stage !== 'cancelled' ? (
                  <>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={handleCallWorker}
                      className="gap-1.5 text-xs font-bold shadow-sm"
                    >
                      <Phone className="w-3.5 h-3.5 text-[#0D4A52]" />
                      <span>Call Worker</span>
                    </Button>

                    <Button
                      variant="accent"
                      size="sm"
                      onClick={() => setShowChatDrawer(true)}
                      className="gap-1.5 text-xs font-bold shadow-sm bg-[#217E66] hover:bg-[#19604e]"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span>Message Worker</span>
                    </Button>

                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        setSelectedCancelReason('');
                        setCustomCancelReason('');
                        setCancelError(null);
                        setShowCancelModal(true);
                      }}
                      className="gap-1.5 text-xs font-bold text-red-600 hover:text-red-700 bg-white hover:bg-red-50 border border-red-200 shadow-sm"
                    >
                      <XCircle className="w-3.5 h-3.5 text-red-600" />
                      <span>Cancel Booking</span>
                    </Button>
                  </>
                ) : (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setShowChatDrawer(true)}
                    className="gap-1.5 text-xs font-bold shadow-sm"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>View Chat</span>
                  </Button>
                )}
              </div>
            </div>

            {/* Uber/Rapido Stage Progress Stepper */}
            <div className="mt-6 pt-5 border-t border-white/15">
              <div className="grid grid-cols-2 sm:grid-cols-6 gap-2">
                {BOOKING_STEPS.map((step, idx) => {
                  const stepIndex = BOOKING_STEPS.findIndex((s) => s.stage === booking.stage);
                  const isCurrent = step.stage === booking.stage;
                  const isCompleted = stepIndex > idx;

                  return (
                    <div
                      key={step.stage}
                      className={`p-2.5 rounded-xl text-center transition-all ${
                        isCurrent
                          ? 'bg-white text-[#0D4A52] font-bold shadow-md scale-105'
                          : isCompleted
                          ? 'bg-white/10 text-white/90 border border-white/20'
                          : 'bg-black/10 text-white/40'
                      }`}
                    >
                      <div className="flex items-center justify-center gap-1 mb-1">
                        {isCompleted ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        ) : isCurrent ? (
                          <div className="w-2 h-2 rounded-full bg-[#217E66] animate-ping" />
                        ) : (
                          <span className="text-[10px] opacity-60 font-mono">{idx + 1}</span>
                        )}
                        <span className="text-xs truncate">{step.label}</span>
                      </div>
                      <p className="text-[10px] truncate opacity-80">{step.description}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Cancellation Alerts & Notifications */}
          {cancelSuccessMsg && (
            <div className="p-4 mx-6 mt-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center justify-between shadow-sm">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className="font-semibold">{cancelSuccessMsg}</span>
              </div>
              <button
                type="button"
                onClick={() => setCancelSuccessMsg(null)}
                className="text-[11px] font-bold text-emerald-700 hover:text-emerald-900"
              >
                Dismiss
              </button>
            </div>
          )}

          {booking.stage === 'cancelled' && (
            <div className="p-5 mx-6 mt-4 rounded-2xl bg-red-50/90 border border-red-200 text-red-900 text-xs flex items-start gap-3 shadow-sm">
              <XCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h4 className="font-bold text-red-950 text-sm">Booking Cancelled</h4>
                <p className="text-[#576563]">
                  <strong>Reason:</strong> {booking.cancellationReason || 'No specific reason provided.'}
                </p>
                <p className="text-[11px] text-red-700 leading-relaxed">
                  Worker assignment and real-time tracking have been terminated. You can post a new request or book another professional from the marketplace at any time.
                </p>
              </div>
            </div>
          )}

          {/* Details Body */}
          <div className="p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Worker Profile Card */}
              <div className="md:col-span-1 p-4 rounded-2xl bg-[#FAF9F5] border border-[#E5DFD2] flex flex-col justify-between space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-14 h-14 rounded-full bg-[#EBF4F3] border-2 border-[#BCE5DA] flex items-center justify-center text-[#0D4A52] font-bold text-lg overflow-hidden shrink-0">
                    {booking.workerAvatarUrl ? (
                      <img
                        src={booking.workerAvatarUrl}
                        alt={booking.workerName}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      booking.workerName
                        .split(' ')
                        .map((n) => n[0])
                        .slice(0, 2)
                        .join('')
                    )}
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-[#152220]">{booking.workerName}</h3>
                    <p className="text-xs text-[#217E66] font-semibold capitalize">
                      {booking.workerCategory} Professional
                    </p>
                    <div className="flex items-center gap-1 text-amber-600 font-bold text-xs mt-1">
                      <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                      <span>{booking.workerRating?.toFixed(1) || '5.0'}</span>
                      <span className="text-[#83928E] font-normal text-[11px]">
                        ({booking.workerExperience} yrs experience)
                      </span>
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-[#E5DFD2] space-y-1 text-xs">
                  <div className="flex justify-between text-[#576563]">
                    <span>Agreed Service Fare:</span>
                    <span className="font-bold text-[#152220] text-sm">₹{booking.agreedPriceInr}</span>
                  </div>
                  <div className="flex justify-between text-[#576563]">
                    <span>Service Destination:</span>
                    <span className="font-semibold text-[#152220] truncate max-w-[160px]">
                      {job.city} ({job.pincode})
                    </span>
                  </div>
                </div>
              </div>

              {/* Arrival Security & OTP Badge */}
              <div className="md:col-span-1 p-4 rounded-2xl bg-gradient-to-br from-[#EBF4F3] to-[#FAF9F5] border border-[#BCE5DA] flex flex-col justify-between space-y-3">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-[#0D4A52]">
                    <KeyRound className="w-4 h-4 text-[#217E66]" />
                    <span>SERVICE START OTP CODE</span>
                  </div>
                  <p className="text-[11px] text-[#576563] leading-relaxed">
                    Share this 4-digit code verbally with the professional <strong>only</strong> when they physically arrive at your location.
                  </p>
                </div>

                {customerOtp ? (
                  <div className="p-3 bg-white rounded-xl border-2 border-dashed border-[#217E66] text-center space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-[#576563] block">
                      Customer Secret OTP
                    </span>
                    <div className="flex justify-center gap-2 py-1 font-mono text-2xl font-black text-[#0D4A52] tracking-widest">
                      {customerOtp.split('').map((digit, i) => (
                        <span
                          key={i}
                          className="w-10 h-10 rounded-lg bg-[#FAF8F3] border border-[#BCE5DA] flex items-center justify-center shadow-inner"
                        >
                          {digit}
                        </span>
                      ))}
                    </div>
                    {booking.otpVerified ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        Verified on arrival
                      </span>
                    ) : (
                      <span className="text-[10px] text-amber-800 bg-amber-50 px-2 py-0.5 rounded font-medium block">
                        Awaiting worker arrival verification
                      </span>
                    )}
                  </div>
                ) : (
                  <div className="p-3 bg-white rounded-xl border border-gray-200 text-center text-xs text-[#576563]">
                    {booking.otpVerified ? (
                      <div className="flex items-center justify-center gap-1.5 text-emerald-700 font-bold">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <span>OTP verified at start</span>
                      </div>
                    ) : (
                      <span>Code issued on booking. Only authorized customer can view code.</span>
                    )}
                  </div>
                )}

                <p className="text-[10px] text-[#83928E] leading-tight">
                  🛡️ Cryptographically validated. Distinguishes demo OTP from SMS; no telecom carrier delay.
                </p>
              </div>

              {/* Travel ETA & Tracking Card */}
              <div className="md:col-span-1 p-4 rounded-2xl bg-[#FAF9F5] border border-[#E5DFD2] flex flex-col justify-between space-y-3">
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#152220] flex items-center gap-1.5">
                      <Navigation className="w-4 h-4 text-[#217E66]" />
                      <span>Estimated Arrival</span>
                    </span>
                    <Badge variant={booking.stage === 'cancelled' ? 'red' : booking.stage === 'arrived' ? 'green' : 'amber'}>
                      {booking.stage === 'cancelled' ? 'CANCELLED' : booking.stage === 'arrived' ? 'ARRIVED' : `${remainingMinutes > 0 ? remainingMinutes : travelMinutes} MINS`}
                    </Badge>
                  </div>
                  <p className="text-[11px] text-[#576563] leading-relaxed">
                    Estimated arrival based on distance and average urban transit. Actual traffic and routes may differ.
                  </p>
                </div>

                <div className="p-3 bg-white rounded-xl border border-[#E5DFD2] space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[#576563] flex items-center gap-1">
                      <Timer className="w-3.5 h-3.5 text-[#217E66]" />
                      <span>Countdown:</span>
                    </span>
                    <span className="font-mono font-bold text-[#0D4A52]">
                      {booking.stage === 'arrived' || booking.stage === 'in_progress' || booking.stage === 'completed' || booking.stage === 'cancelled'
                        ? '00:00'
                        : `${Math.floor(simulatedCountdown / 60)
                            .toString()
                            .padStart(2, '0')}:${(simulatedCountdown % 60).toString().padStart(2, '0')}`}
                    </span>
                  </div>

                  <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-full transition-all duration-1000 ${booking.stage === 'cancelled' ? 'bg-red-400' : 'bg-[#217E66]'}`}
                      style={{
                        width:
                          booking.stage === 'cancelled'
                            ? '0%'
                            : booking.stage === 'arrived' || booking.stage === 'in_progress' || booking.stage === 'completed'
                            ? '100%'
                            : `${Math.min(100, Math.max(10, 100 - (simulatedCountdown / (travelMinutes * 60)) * 100))}%`,
                      }}
                    />
                  </div>
                </div>

                <div className="text-[10px] text-[#83928E] space-y-0.5">
                  {booking.stage === 'cancelled' ? (
                    <span className="text-red-700 font-semibold block">
                      🛑 Tracking simulation ended due to cancellation.
                    </span>
                  ) : booking.isDemoWorker ? (
                    <span className="text-amber-800 font-semibold block">
                      ⚡ Simulated tracking active for demo worker account.
                    </span>
                  ) : (
                    <span>Real-time GPS requires worker explicit permission while in transit.</span>
                  )}
                </div>
              </div>
            </div>

            {/* Worker Experience / Simulation Accordion */}
            <div className="pt-2 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setShowWorkerSimulation(!showWorkerSimulation)}
                className="w-full flex items-center justify-between p-3 rounded-xl bg-gray-50 hover:bg-gray-100 text-xs font-semibold text-[#0D4A52] transition-colors"
              >
                <div className="flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-[#217E66]" />
                  <span>
                    Worker View &amp; Simulation Controls ({booking.isDemoWorker ? 'Demo Worker Actions' : 'Worker Lifecycle'})
                  </span>
                </div>
                {showWorkerSimulation ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>

              {showWorkerSimulation && (
                <div className="mt-3 p-4 bg-white rounded-xl border border-gray-200 space-y-4 animate-in fade-in">
                  <p className="text-xs text-[#576563]">
                    These controls simulate or execute the worker counterpart experience: status progression and OTP arrival verification.
                  </p>

                  {transitionError && (
                    <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{transitionError}</span>
                    </div>
                  )}

                  {transitionSuccess && (
                    <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-700 flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                      <span>{transitionSuccess}</span>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2.5 items-center">
                    {booking.stage === 'accepted' && (
                      <Button
                        variant="primary"
                        size="sm"
                        disabled={isTransitioningStatus}
                        onClick={() => handleTransitionBooking('on_the_way')}
                        className="text-xs gap-1.5"
                      >
                        {isTransitioningStatus && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                        <span>Worker Action: Start Traveling (On The Way)</span>
                      </Button>
                    )}

                    {booking.stage === 'on_the_way' && (
                      <Button
                        variant="primary"
                        size="sm"
                        disabled={isTransitioningStatus}
                        onClick={() => handleTransitionBooking('arrived')}
                        className="text-xs gap-1.5"
                      >
                        {isTransitioningStatus && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                        <span>Worker Action: Mark Arrived at Destination</span>
                      </Button>
                    )}

                    {booking.stage === 'arrived' && (
                      <div className="w-full flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-1">
                        <input
                          type="text"
                          maxLength={4}
                          placeholder="Enter 4-digit OTP"
                          value={workerOtpInput}
                          onChange={(e) => setWorkerOtpInput(e.target.value.replace(/\D/g, ''))}
                          className="px-3 py-1.5 text-xs font-mono tracking-widest border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0D4A52] outline-none"
                        />
                        <Button
                          variant="accent"
                          size="sm"
                          disabled={isTransitioningStatus || workerOtpInput.length !== 4}
                          onClick={() => handleTransitionBooking('in_progress', workerOtpInput)}
                          className="text-xs gap-1.5"
                        >
                          {isTransitioningStatus && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                          <span>Verify Customer OTP &amp; Start Job</span>
                        </Button>

                        {customerOtp && (
                          <button
                            type="button"
                            onClick={() => setWorkerOtpInput(customerOtp)}
                            className="text-xs text-[#217E66] hover:underline"
                          >
                            Autofill OTP ({customerOtp})
                          </button>
                        )}
                      </div>
                    )}

                    {booking.stage === 'in_progress' && (
                      <Button
                        variant="primary"
                        size="sm"
                        disabled={isTransitioningStatus}
                        onClick={() => handleTransitionBooking('completed')}
                        className="text-xs gap-1.5 bg-emerald-700 hover:bg-emerald-800"
                      >
                        {isTransitioningStatus && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                        <span>Worker Action: Mark Service Completed</span>
                      </Button>
                    )}

                    {booking.stage !== 'completed' && booking.stage !== 'cancelled' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={isTransitioningStatus}
                        onClick={() => {
                          const reason = prompt('Please enter cancellation reason:');
                          if (reason) handleTransitionBooking('cancelled', undefined);
                        }}
                        className="text-xs text-red-600 hover:bg-red-50 ml-auto"
                      >
                        Cancel Booking
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Broadcast Success & Job Summary Banner */}
      <div className="bg-white rounded-2xl border border-[#BCE5DA] p-6 shadow-sm space-y-5">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200">
                {job.category}
              </span>
              <Badge variant={job.urgency === 'emergency' ? 'amber' : (job.urgency === 'same_day' || job.urgency === 'urgent') ? 'teal' : 'neutral'}>
                {job.urgency === 'emergency' ? 'Emergency' : (job.urgency === 'same_day' || job.urgency === 'urgent') ? 'Same Day' : 'Standard'}
              </Badge>
              {bidsCount > 0 && (
                <Badge variant="teal">
                  {bidsCount} Bid{bidsCount > 1 ? 's' : ''} Received
                </Badge>
              )}
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-[#152220] tracking-tight">
              {job.title}
            </h1>
          </div>

          <Link href="/dashboard">
            <Button variant="primary" size="sm" className="gap-1.5 shrink-0">
              <Briefcase className="w-3.5 h-3.5" />
              <span>Review Bids in Dashboard</span>
            </Button>
          </Link>
        </div>

        <p className="text-xs sm:text-sm text-[#576563] leading-relaxed">
          {job.description}
        </p>

        {/* Location & Budget Badges */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 pt-3 border-t border-gray-100 text-xs">
          <div className="flex items-center gap-2 text-[#576563]">
            <MapPin className="w-4 h-4 text-[#217E66] shrink-0" />
            <span className="truncate">
              {job.address_line}, {job.city} ({job.pincode})
            </span>
          </div>

          <div className="flex items-center gap-2 text-[#576563]">
            <IndianRupee className="w-4 h-4 text-[#217E66] shrink-0" />
            <span>
              {job.estimated_min_price_inr
                ? `₹${job.estimated_min_price_inr} - ₹${job.estimated_max_price_inr || job.estimated_min_price_inr}`
                : 'Budget Flexible'}
            </span>
          </div>

          <div className="flex items-center gap-2 text-[#576563]">
            <Clock className="w-4 h-4 text-[#217E66] shrink-0" />
            <span>Posted {new Date(job.created_at).toLocaleDateString()}</span>
          </div>
        </div>

        {/* Urgency Dispatch Indicator */}
        <div className="p-3 bg-[#FAF8F3] border border-[#E5DFD2] rounded-xl flex items-start gap-2.5 text-xs text-[#0D4A52]">
          <Radio className="w-4 h-4 text-[#217E66] shrink-0 mt-0.5 animate-pulse" />
          <div>
            <span className="font-bold">
              {job.urgency === 'emergency'
                ? '🚨 Emergency Dispatch Broadcast Active:'
                : (job.urgency === 'same_day' || job.urgency === 'urgent')
                ? '⚡ Same-Day Service Alert Broadcast Active:'
                : '📅 Standard Request Broadcasted:'}
            </span>{' '}
            <span className="text-[#576563]">
              Neighborhood professionals in {job.city} matching {job.category} have been alerted. You can also directly click <strong>&quot;Book Now&quot;</strong> on any verified professional below for instant Uber/Rapido-style dispatch.
            </span>
          </div>
        </div>
      </div>

      {/* Nearby Worker Discovery Section */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-[#152220] flex items-center gap-2">
              <Compass className="w-5 h-5 text-[#0D4A52]" />
              <span>Available Neighborhood {job.category.toUpperCase()} Professionals</span>
            </h2>
            <p className="text-xs text-[#576563]">
              PostGIS distance calculation from your service coordinates within {(searchRadius / 1000).toFixed(0)} km.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-[#576563]">Search Radius:</span>
            <select
              value={searchRadius}
              onChange={(e) => setSearchRadius(parseInt(e.target.value, 10))}
              className="text-xs font-semibold py-1.5 px-2.5 rounded-lg border border-[#E5DFD2] bg-white text-[#0D4A52] focus:ring-1 focus:ring-[#0D4A52] outline-none"
            >
              <option value="5000">5 km</option>
              <option value="15000">15 km (Default)</option>
              <option value="30000">30 km (Wider)</option>
              <option value="50000">50 km (Regional)</option>
            </select>
          </div>
        </div>

        {/* Worker Discovery Results */}
        {loadingWorkers ? (
          <div className="py-12 bg-white rounded-2xl border border-dashed border-[#E5DFD2] text-center space-y-3">
            <Loader2 className="w-6 h-6 animate-spin text-[#0D4A52] mx-auto" />
            <p className="text-xs text-[#576563]">
              Scanning PostGIS spatial radius for verified {job.category} workers...
            </p>
          </div>
        ) : workers.length === 0 ? (
          /* Empty State */
          <div className="p-8 bg-white rounded-2xl border border-[#E5DFD2] text-center space-y-4 shadow-sm">
            <div className="w-12 h-12 rounded-full bg-[#FAF8F3] text-[#0D4A52] flex items-center justify-center mx-auto border border-[#E5DFD2]">
              <Compass className="w-6 h-6 text-[#217E66]" />
            </div>
            <div className="space-y-1 max-w-md mx-auto">
              <h3 className="text-base font-bold text-[#152220]">
                No Active {job.category} Professionals Found within {(searchRadius / 1000).toFixed(0)} km
              </h3>
              <p className="text-xs text-[#576563] leading-relaxed">
                Your request is broadcasted live on the marketplace. As workers come online, they will place quotes. You can also widen your search radius below.
              </p>
            </div>

            <div className="pt-2 flex flex-wrap justify-center gap-2.5">
              {searchRadius < 50000 && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setSearchRadius((prev) => Math.min(50000, prev + 15000))}
                  className="gap-1.5 text-xs"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Expand Search Radius to {((searchRadius + 15000) / 1000).toFixed(0)} km</span>
                </Button>
              )}
              <Link href="/dashboard">
                <Button variant="primary" size="sm" className="text-xs">
                  Go to My Jobs Dashboard
                </Button>
              </Link>
            </div>
          </div>
        ) : (
          /* Worker Grid */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {workers.map((w) => {
              const distanceKm = (w.distance_meters / 1000).toFixed(1);
              const travelCalc = calculateEstimatedTravelTimeMinutes(w.distance_meters);
              const isAssignedToThis = booking?.workerId === w.worker_id;

              return (
                <Card
                  key={w.worker_id}
                  className={`p-5 space-y-4 flex flex-col justify-between hover:shadow-md transition-shadow ${
                    isAssignedToThis ? 'ring-2 ring-[#0D4A52] bg-emerald-50/20' : ''
                  }`}
                >
                  <div className="space-y-3">
                    {/* Worker Header */}
                    <div className="flex items-start gap-3">
                      <div className="w-11 h-11 rounded-full bg-[#EBF4F3] border border-[#BCE5DA] flex items-center justify-center text-[#0D4A52] font-bold text-sm shrink-0">
                        {w.avatar_url ? (
                          <img
                            src={w.avatar_url}
                            alt={w.full_name}
                            className="w-full h-full rounded-full object-cover"
                          />
                        ) : (
                          w.full_name
                            .split(' ')
                            .map((n) => n[0])
                            .slice(0, 2)
                            .join('')
                            .toUpperCase()
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-1">
                          <h4 className="text-sm font-bold text-[#152220] truncate">
                            {w.full_name}
                          </h4>
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 shrink-0">
                            {distanceKm} km
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5 text-[11px] text-[#576563] mt-0.5">
                          <span className="capitalize">{w.primary_category}</span>
                          <span>•</span>
                          <span>{w.years_experience} yrs exp</span>
                        </div>
                      </div>
                    </div>

                    {/* Reputation & Stats */}
                    <div className="flex items-center justify-between py-2 border-y border-gray-100 text-xs">
                      <div className="flex items-center gap-1 text-amber-600 font-bold">
                        <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                        <span>{w.reputation_score?.toFixed(1) || '5.0'}</span>
                        <span className="text-[10px] text-[#83928E] font-normal">
                          ({w.total_completed_jobs} jobs)
                        </span>
                      </div>

                      <div className="flex items-center gap-1 text-[11px] text-[#0D4A52] font-semibold">
                        <Clock className="w-3 h-3 text-[#217E66]" />
                        <span>~{travelCalc.minutes} mins arrival</span>
                      </div>
                    </div>

                    {/* Bio Snippet */}
                    {w.bio && (
                      <p className="text-xs text-[#576563] line-clamp-2 leading-relaxed">
                        {w.bio}
                      </p>
                    )}

                    {/* Skills pills */}
                    {w.skills && w.skills.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {w.skills.slice(0, 3).map((skill, idx) => (
                          <span
                            key={idx}
                            className="text-[10px] px-2 py-0.5 rounded-full bg-[#FAF9F5] text-[#576563] border border-[#E5DFD2]"
                          >
                            {skill}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Actions & Book Now Button */}
                  <div className="space-y-2 pt-2">
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        className="text-xs font-semibold justify-center"
                        onClick={() => setActiveWorkerProfile(w)}
                      >
                        <Eye className="w-3.5 h-3.5 text-[#0D4A52]" />
                        <span>View Profile</span>
                      </Button>

                      <Button
                        variant="primary"
                        size="sm"
                        disabled={booking !== null && booking.stage !== 'completed' && booking.stage !== 'cancelled'}
                        onClick={() => handleOpenBookingConfirm(w)}
                        className="text-xs font-bold justify-center bg-[#0D4A52] hover:bg-[#072F35]"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                        <span>{isAssignedToThis ? 'Booked' : 'Book Now'}</span>
                      </Button>
                    </div>

                    <p className="text-[10px] text-[#83928E] text-center leading-tight">
                      Instant Uber/Rapido-style dispatch with customer arrival OTP.
                    </p>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 📋 STEP 1 CONFIRMATION MODAL: BOOK NOW */}
      {/* ========================================================================= */}
      {bookingConfirmWorker && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl border border-[#E5DFD2] max-w-lg w-full p-6 sm:p-7 shadow-2xl space-y-6 animate-in zoom-in-95">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200">
                  Instant Dispatch
                </span>
                <h3 className="text-xl font-black text-[#152220] mt-1">
                  Confirm Worker Booking
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setBookingConfirmWorker(null)}
                className="p-1 rounded-full text-[#83928E] hover:text-[#152220]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Selected Worker Overview */}
            <div className="p-4 rounded-2xl bg-[#FAF9F5] border border-[#E5DFD2] flex items-center gap-3.5">
              <div className="w-13 h-13 rounded-full bg-[#EBF4F3] border border-[#BCE5DA] flex items-center justify-center text-[#0D4A52] font-bold text-base shrink-0 overflow-hidden">
                {bookingConfirmWorker.avatar_url ? (
                  <img
                    src={bookingConfirmWorker.avatar_url}
                    alt={bookingConfirmWorker.full_name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  bookingConfirmWorker.full_name
                    .split(' ')
                    .map((n) => n[0])
                    .slice(0, 2)
                    .join('')
                )}
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="text-base font-bold text-[#152220] truncate">
                  {bookingConfirmWorker.full_name}
                </h4>
                <div className="flex items-center gap-2 text-xs text-[#576563]">
                  <span className="capitalize">{bookingConfirmWorker.primary_category}</span>
                  <span>•</span>
                  <span>{(bookingConfirmWorker.distance_meters / 1000).toFixed(1)} km away</span>
                </div>
                <div className="flex items-center gap-1 text-amber-600 font-bold text-xs mt-0.5">
                  <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                  <span>{bookingConfirmWorker.reputation_score?.toFixed(1) || '5.0'}</span>
                  <span className="text-[#83928E] font-normal">
                    ({bookingConfirmWorker.total_completed_jobs} completed)
                  </span>
                </div>
              </div>
            </div>

            {/* Service & Fare Summary */}
            <div className="space-y-3 text-xs">
              <div className="flex justify-between items-center py-2 border-b border-gray-100">
                <span className="text-[#576563]">Service Title:</span>
                <span className="font-bold text-[#152220] max-w-[220px] truncate text-right">
                  {job.title}
                </span>
              </div>

              <div className="flex justify-between items-center py-2 border-b border-gray-100">
                <span className="text-[#576563]">Service Address:</span>
                <span className="font-semibold text-[#152220] max-w-[220px] truncate text-right">
                  {job.address_line}, {job.city}
                </span>
              </div>

              <div className="flex justify-between items-center py-2 border-b border-gray-100">
                <span className="text-[#576563]">Estimated Arrival Time:</span>
                <span className="font-bold text-[#217E66]">
                  ~{calculateEstimatedTravelTimeMinutes(bookingConfirmWorker.distance_meters).minutes} mins (Traffic may vary)
                </span>
              </div>

              <div className="flex justify-between items-center py-2.5 bg-emerald-50/60 px-3 rounded-xl border border-emerald-100">
                <span className="font-bold text-[#0D4A52]">Agreed Service Amount:</span>
                <div className="flex items-center gap-1 font-black text-lg text-[#0D4A52]">
                  <span>₹</span>
                  <input
                    type="number"
                    min="100"
                    step="50"
                    value={bookingAgreedPrice}
                    onChange={(e) => setBookingAgreedPrice(Math.max(100, parseInt(e.target.value, 10) || 100))}
                    className="w-24 text-right bg-white px-2 py-1 rounded border border-[#BCE5DA] font-mono text-base outline-none focus:ring-2 focus:ring-[#0D4A52]"
                  />
                </div>
              </div>
            </div>

            {/* Zero-Trust Notice */}
            <div className="p-3 bg-[#FAF8F3] rounded-xl border border-[#E5DFD2] text-[11px] text-[#576563] space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-[#0D4A52]">
                <ShieldCheck className="w-3.5 h-3.5 text-[#217E66]" />
                <span>Zero-Trust Start Protection</span>
              </div>
              <p>
                A secure numeric OTP will be generated. You share this code with the professional <strong>only</strong> when they arrive at your door to authenticate service commencement.
              </p>
            </div>

            {bookingError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{bookingError}</span>
              </div>
            )}

            <div className="flex gap-3">
              <Button
                variant="secondary"
                size="md"
                disabled={isBookingSubmitting}
                className="w-1/3 text-xs"
                onClick={() => setBookingConfirmWorker(null)}
              >
                Cancel
              </Button>

              <Button
                variant="primary"
                size="md"
                disabled={isBookingSubmitting}
                className="w-2/3 text-xs font-bold gap-2 bg-[#0D4A52] hover:bg-[#072F35]"
                onClick={handleConfirmBooking}
              >
                {isBookingSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Confirming Booking...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 text-amber-300" />
                    <span>Confirm &amp; Dispatch Now</span>
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 📞 DEMO CALLING FRIENDLY MODAL */}
      {/* ========================================================================= */}
      {showCallModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl border border-[#E5DFD2] max-w-sm w-full p-6 shadow-2xl space-y-4 text-center">
            <div className="w-12 h-12 rounded-full bg-emerald-50 text-[#0D4A52] flex items-center justify-center mx-auto border border-emerald-200">
              <Phone className="w-6 h-6 text-[#217E66]" />
            </div>
            <h3 className="text-base font-bold text-[#152220]">
              Calling Unavailable for Demo Worker
            </h3>
            <p className="text-xs text-[#576563] leading-relaxed">
              <strong>{booking?.workerName}</strong> is an automated demo professional account without a live cellular subscriber identity.
            </p>
            <div className="p-3 bg-gray-50 rounded-xl border border-gray-200 text-[11px] text-[#576563] text-left">
              🔒 <strong>In Live Production:</strong> When a real worker is booked and mutual acceptance is verified, this button initiates a direct, masked telecom carrier phone call to the verified phone number.
            </div>
            <Button
              variant="primary"
              size="sm"
              className="w-full text-xs"
              onClick={() => setShowCallModal(false)}
            >
              Understood
            </Button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 💬 IN-APP BOOKING CHAT DRAWER */}
      {/* ========================================================================= */}
      {showChatDrawer && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex justify-end animate-in fade-in">
          <div className="bg-white w-full max-w-md h-full shadow-2xl flex flex-col justify-between animate-in slide-in-from-right duration-200">
            {/* Header */}
            <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-[#0D4A52] text-white">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center font-bold text-xs">
                  {booking?.workerName?.[0] || 'P'}
                </div>
                <div>
                  <h3 className="text-sm font-bold">{booking?.workerName || 'Worker'}</h3>
                  <span className="text-[10px] text-white/80 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    Online for Booking
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={fetchMessages}
                  className="p-1.5 text-white/80 hover:text-white rounded-lg hover:bg-white/10"
                  title="Refresh chat"
                >
                  <RefreshCw className={`w-4 h-4 ${isLoadingMessages ? 'animate-spin' : ''}`} />
                </button>
                <button
                  type="button"
                  onClick={() => setShowChatDrawer(false)}
                  className="p-1.5 text-white/80 hover:text-white rounded-lg hover:bg-white/10"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Quick Suggestions Chips */}
            <div className="px-4 py-2.5 bg-[#FAF9F5] border-b border-[#E5DFD2] flex gap-1.5 overflow-x-auto text-[11px] no-scrollbar">
              {[
                'How long until you arrive?',
                'I’m waiting at the entrance',
                'Please let me know when you arrive',
                'Need help finding the gate?',
              ].map((suggestion, idx) => (
                <button
                  key={idx}
                  type="button"
                  disabled={isSendingMessage}
                  onClick={() => handleSendMessage(suggestion)}
                  className="whitespace-nowrap px-2.5 py-1 rounded-full bg-white border border-[#BCE5DA] text-[#0D4A52] hover:bg-[#EBF4F3] transition-colors shrink-0 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {suggestion}
                </button>
              ))}
            </div>

            {/* Chat Error Banner */}
            {chatError && (
              <div className="p-2.5 mx-4 mt-2 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-center justify-between shadow-sm">
                <span>{chatError}</span>
                <button
                  type="button"
                  onClick={() => setChatError(null)}
                  className="text-red-500 hover:text-red-700 font-bold ml-2 text-sm leading-none"
                >
                  &times;
                </button>
              </div>
            )}

            {/* Messages Scroll Area */}
            <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-[#FAF8F3]/50">
              {messages.length === 0 ? (
                <div className="text-center py-12 text-xs text-[#83928E] space-y-1">
                  <MessageSquare className="w-8 h-8 text-[#BCE5DA] mx-auto" />
                  <p className="font-semibold text-[#576563]">No messages yet</p>
                  <p>Send a quick update or message to your professional.</p>
                </div>
              ) : (
                messages.map((m) => {
                  const isMe = m.senderRole === 'customer';
                  const isDemoSimulation = m.text.includes('[Demo Simulation]') || m.senderName.includes('Demo');
                  const displayText = m.text.replace(/\[Demo Simulation\]\s*/g, '');

                  return (
                    <div
                      key={m.id}
                      className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                    >
                      <div className="flex items-center gap-1.5 text-[10px] text-[#83928E] mb-1">
                        <span className="font-semibold text-[#152220]">{m.senderName}</span>
                        {isDemoSimulation && (
                          <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 font-bold text-[9px] border border-amber-200">
                            Demo Simulation
                          </span>
                        )}
                        <span>•</span>
                        <span>{new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      <div
                        className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed ${
                          isMe
                            ? 'bg-[#0D4A52] text-white rounded-tr-none shadow-sm'
                            : isDemoSimulation
                            ? 'bg-amber-50/80 text-[#152220] border border-amber-200 rounded-tl-none shadow-sm'
                            : 'bg-white text-[#152220] border border-[#E5DFD2] rounded-tl-none shadow-sm'
                        }`}
                      >
                        {displayText}
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Bar */}
            <div className="p-3 border-t border-gray-200 bg-white flex items-center gap-2">
              <input
                type="text"
                placeholder="Type a message to your professional..."
                value={chatInput}
                disabled={isSendingMessage}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                className="flex-1 px-3.5 py-2 text-xs border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#0D4A52] outline-none disabled:bg-gray-50"
              />
              <Button
                variant="primary"
                size="sm"
                disabled={isSendingMessage || !chatInput.trim()}
                onClick={() => handleSendMessage()}
                className="px-3"
              >
                {isSendingMessage ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Slide-Over Worker Profile Modal */}
      {activeWorkerProfile && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl border border-[#E5DFD2] max-w-md w-full p-6 shadow-xl space-y-5 animate-in zoom-in-95">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-[#EBF4F3] border border-[#BCE5DA] flex items-center justify-center text-[#0D4A52] font-bold text-base overflow-hidden">
                  {activeWorkerProfile.avatar_url ? (
                    <img
                      src={activeWorkerProfile.avatar_url}
                      alt={activeWorkerProfile.full_name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    activeWorkerProfile.full_name
                      .split(' ')
                      .map((n) => n[0])
                      .slice(0, 2)
                      .join('')
                      .toUpperCase()
                  )}
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#152220]">
                    {activeWorkerProfile.full_name}
                  </h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-[#217E66] font-semibold capitalize">
                      {activeWorkerProfile.primary_category}
                    </span>
                    <Badge variant="teal" className="text-[10px]">
                      Verified ID
                    </Badge>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setActiveWorkerProfile(null)}
                className="p-1 rounded-full text-[#83928E] hover:text-[#152220]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Profile Overview Card */}
            <div className="bg-[#FAF9F5] p-3.5 rounded-xl border border-[#E5DFD2] grid grid-cols-3 gap-2 text-center text-xs">
              <div>
                <span className="text-[10px] text-[#83928E] block">Reputation</span>
                <span className="font-bold text-[#152220] flex items-center justify-center gap-1 mt-0.5">
                  <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                  {activeWorkerProfile.reputation_score?.toFixed(1) || '5.0'}
                </span>
              </div>
              <div className="border-x border-[#E5DFD2]">
                <span className="text-[10px] text-[#83928E] block">Experience</span>
                <span className="font-bold text-[#152220] block mt-0.5">
                  {activeWorkerProfile.years_experience} Yrs
                </span>
              </div>
              <div>
                <span className="text-[10px] text-[#83928E] block">Completed</span>
                <span className="font-bold text-[#152220] block mt-0.5">
                  {activeWorkerProfile.total_completed_jobs} Jobs
                </span>
              </div>
            </div>

            {/* Bio & Skills */}
            <div className="space-y-3 text-xs">
              <div>
                <h4 className="font-bold text-[#152220] mb-1">About Professional</h4>
                <p className="text-[#576563] leading-relaxed">
                  {activeWorkerProfile.bio || 'Verified service professional operating in this locality.'}
                </p>
              </div>

              {activeWorkerProfile.skills && activeWorkerProfile.skills.length > 0 && (
                <div>
                  <h4 className="font-bold text-[#152220] mb-1.5">Trade Skills</h4>
                  <div className="flex flex-wrap gap-1.5">
                    {activeWorkerProfile.skills.map((skill, idx) => (
                      <span
                        key={idx}
                        className="text-[11px] px-2.5 py-0.5 rounded-full bg-[#EBF4F3] text-[#0D4A52] font-medium"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Privacy & Bidding Assurance */}
            <div className="p-3 rounded-xl bg-gray-50 border border-gray-200 text-[11px] text-[#576563] space-y-1">
              <div className="flex items-center gap-1.5 font-semibold text-[#152220]">
                <ShieldCheck className="w-3.5 h-3.5 text-[#217E66]" />
                <span>Zero-Trust Privacy Protection</span>
              </div>
              <p>
                Direct contact details and service addresses are only exchanged upon mutual bid acceptance with OTP verification.
              </p>
            </div>

            <div className="space-y-2 pt-1">
              <Button
                variant="primary"
                className="w-full text-xs font-bold gap-2 bg-[#0D4A52] hover:bg-[#072F35]"
                disabled={booking !== null && booking.stage !== 'completed' && booking.stage !== 'cancelled'}
                onClick={() => handleOpenBookingConfirm(activeWorkerProfile)}
              >
                <Sparkles className="w-4 h-4 text-amber-300" />
                <span>Book This Professional Now</span>
              </Button>

              <Button
                variant="secondary"
                className="w-full text-xs"
                onClick={() => setActiveWorkerProfile(null)}
              >
                Close Profile
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 🛑 CANCELLATION CONFIRMATION MODAL */}
      {/* ========================================================================= */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl border border-[#E5DFD2] max-w-md w-full p-6 shadow-2xl space-y-5 animate-in zoom-in-95">
            {/* Modal Header */}
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center border border-red-200 shrink-0">
                  <XCircle className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#152220]">Cancel Booking</h3>
                  <p className="text-xs text-[#576563]">
                    Please select a reason to cancel service with {booking?.workerName || 'this professional'}.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (!isCancelling) setShowCancelModal(false);
                }}
                className="p-1 rounded-lg text-[#83928E] hover:text-[#152220] hover:bg-gray-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Error Message */}
            {cancelError && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                <span>{cancelError}</span>
              </div>
            )}

            {/* Reasons Radio List */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-[#152220] block">
                Select Reason for Cancellation <span className="text-red-500">*</span>
              </label>
              <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                {CANCELLATION_REASONS.map((reason) => {
                  const isSelected = selectedCancelReason === reason;
                  return (
                    <label
                      key={reason}
                      className={`flex items-center gap-3 p-2.5 rounded-xl border text-xs cursor-pointer transition-all ${
                        isSelected
                          ? 'border-[#0D4A52] bg-[#EBF4F3]/60 font-semibold text-[#0D4A52]'
                          : 'border-[#E5DFD2] bg-white text-[#576563] hover:bg-[#FAF9F5]'
                      }`}
                    >
                      <input
                        type="radio"
                        name="cancellationReason"
                        value={reason}
                        checked={isSelected}
                        onChange={() => {
                          setSelectedCancelReason(reason);
                          setCancelError(null);
                        }}
                        className="w-4 h-4 text-[#0D4A52] focus:ring-[#0D4A52] border-gray-300"
                      />
                      <span>{reason}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Custom Reason Field for "Other" */}
            {selectedCancelReason === 'Other' && (
              <div className="space-y-1.5 animate-in fade-in">
                <label className="text-xs font-bold text-[#152220] flex items-center justify-between">
                  <span>Please specify reason: <span className="text-red-500">*</span></span>
                  <span className="text-[10px] text-[#83928E] font-normal">Required</span>
                </label>
                <textarea
                  rows={2}
                  value={customCancelReason}
                  onChange={(e) => {
                    setCustomCancelReason(e.target.value);
                    if (cancelError) setCancelError(null);
                  }}
                  placeholder="Tell us what went wrong so we can improve..."
                  className="w-full px-3 py-2 text-xs border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#0D4A52] outline-none"
                />
              </div>
            )}

            {/* Warning Note */}
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-900 leading-relaxed">
              ⚠️ Cancelling will immediately stop the professional’s travel dispatch. Your job will be returned to the open marketplace so you can invite or receive new offers.
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 pt-1">
              <Button
                variant="secondary"
                size="sm"
                disabled={isCancelling}
                onClick={() => setShowCancelModal(false)}
                className="text-xs"
              >
                Keep Booking
              </Button>
              <Button
                variant="danger"
                size="sm"
                disabled={isCancelling}
                onClick={handleConfirmCancellation}
                className="text-xs font-bold gap-1.5"
              >
                {isCancelling ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Cancelling...</span>
                  </>
                ) : (
                  <>
                    <XCircle className="w-3.5 h-3.5" />
                    <span>Confirm Cancellation</span>
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function JobDiscoveryPage() {
  return (
    <div className="min-h-[85vh] bg-[#FAF9F5] py-8">
      <Suspense fallback={<div className="text-center text-xs text-[#576563] p-12">Loading Job Details...</div>}>
        <JobDiscoveryContent />
      </Suspense>
    </div>
  );
}
