'use client';

import React, { useState, useEffect, useCallback, Suspense } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getSupabaseClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import {
  CalendarClock,
  Clock,
  MapPin,
  IndianRupee,
  CheckCircle2,
  AlertCircle,
  XCircle,
  ArrowRight,
  User,
  Star,
  RefreshCw,
  Sparkles,
  ShieldCheck,
  AlertTriangle,
  Navigation,
  Wrench,
  Zap,
  Paintbrush,
  Hammer,
  Bug,
  Home,
  SlidersHorizontal,
} from 'lucide-react';
import { BookingHistoryItem } from '@/app/api/bookings/route';

type FilterTab = 'all' | 'active' | 'completed' | 'cancelled';

function formatBookingDateTime(isoString: string): { date: string; time: string; full: string } {
  if (!isoString) return { date: '—', time: '—', full: '—' };
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return { date: isoString, time: '', full: isoString };
    const date = d.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
    const time = d.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
    return { date, time, full: `${date} at ${time}` };
  } catch {
    return { date: isoString, time: '', full: isoString };
  }
}

function getCategoryIcon(category: string) {
  const cat = (category || '').toLowerCase();
  if (cat.includes('elect')) return <Zap className="w-4 h-4 text-amber-600" />;
  if (cat.includes('paint')) return <Paintbrush className="w-4 h-4 text-purple-600" />;
  if (cat.includes('carp')) return <Hammer className="w-4 h-4 text-amber-700" />;
  if (cat.includes('clean') || cat.includes('maid')) return <Home className="w-4 h-4 text-teal-600" />;
  if (cat.includes('pest')) return <Bug className="w-4 h-4 text-red-600" />;
  return <Wrench className="w-4 h-4 text-[#217E66]" />;
}

function getStageBadge(stage: string, status: string) {
  if (stage === 'cancelled' || status === 'cancelled') {
    return (
      <Badge variant="red" className="flex items-center gap-1">
        <XCircle className="w-3.5 h-3.5" />
        <span>Cancelled</span>
      </Badge>
    );
  }
  if (stage === 'completed' || status === 'completed') {
    return (
      <Badge variant="green" className="flex items-center gap-1">
        <CheckCircle2 className="w-3.5 h-3.5" />
        <span>Completed</span>
      </Badge>
    );
  }
  if (stage === 'arrived') {
    return (
      <Badge variant="green" className="flex items-center gap-1">
        <MapPin className="w-3.5 h-3.5" />
        <span>Professional Arrived</span>
      </Badge>
    );
  }
  if (stage === 'on_the_way') {
    return (
      <Badge variant="amber" className="flex items-center gap-1">
        <Navigation className="w-3.5 h-3.5 animate-pulse" />
        <span>On The Way</span>
      </Badge>
    );
  }
  if (stage === 'in_progress') {
    return (
      <Badge variant="teal" className="flex items-center gap-1">
        <Clock className="w-3.5 h-3.5 animate-spin" />
        <span>Service In Progress</span>
      </Badge>
    );
  }
  return (
    <Badge variant="teal" className="flex items-center gap-1">
      <CheckCircle2 className="w-3.5 h-3.5" />
      <span>Booking Confirmed</span>
    </Badge>
  );
}

function BookingHistoryContent() {
  const router = useRouter();
  const [sessionUser, setSessionUser] = useState<{ id: string; email?: string } | null>(null);
  const [loadingSession, setLoadingSession] = useState(true);
  const [bookings, setBookings] = useState<BookingHistoryItem[]>([]);
  const [loadingBookings, setLoadingBookings] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all');

  // Verify authentication
  useEffect(() => {
    const supabase = getSupabaseClient();
    if (!supabase) {
      setLoadingSession(false);
      setLoadingBookings(false);
      return;
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setSessionUser({ id: session.user.id, email: session.user.email });
      } else {
        setSessionUser(null);
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

  // Fetch bookings for authenticated customer
  const fetchBookings = useCallback(async () => {
    const supabase = getSupabaseClient();
    if (!supabase) return;

    setLoadingBookings(true);
    setErrorMessage(null);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        setBookings([]);
        setLoadingBookings(false);
        return;
      }

      const res = await fetch('/api/bookings', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to fetch booking history.');
      }

      setBookings(Array.isArray(json.data) ? json.data : []);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'An error occurred while loading booking history.';
      setErrorMessage(msg);
    } finally {
      setLoadingBookings(false);
    }
  }, []);

  useEffect(() => {
    if (!loadingSession && sessionUser) {
      fetchBookings();
    } else if (!loadingSession && !sessionUser) {
      setLoadingBookings(false);
    }
  }, [loadingSession, sessionUser, fetchBookings]);

  // Status filtering logic
  const isBookingActive = (b: BookingHistoryItem) => {
    return ['requested', 'accepted', 'on_the_way', 'arrived', 'in_progress'].includes(b.stage) && b.status !== 'cancelled' && b.status !== 'completed';
  };

  const isBookingCompleted = (b: BookingHistoryItem) => {
    return b.stage === 'completed' || b.status === 'completed';
  };

  const isBookingCancelled = (b: BookingHistoryItem) => {
    return b.stage === 'cancelled' || b.status === 'cancelled';
  };

  const filteredBookings = bookings.filter((b) => {
    if (activeFilter === 'active') return isBookingActive(b);
    if (activeFilter === 'completed') return isBookingCompleted(b);
    if (activeFilter === 'cancelled') return isBookingCancelled(b);
    return true; // 'all'
  });

  const countActive = bookings.filter(isBookingActive).length;
  const countCompleted = bookings.filter(isBookingCompleted).length;
  const countCancelled = bookings.filter(isBookingCancelled).length;

  // Unauthenticated State
  if (!loadingSession && !sessionUser) {
    return (
      <div className="max-w-2xl mx-auto my-16 px-4">
        <Card className="text-center p-8 sm:p-12 space-y-6">
          <div className="w-16 h-16 rounded-2xl bg-[#EBF4F3] flex items-center justify-center mx-auto text-[#0D4A52]">
            <CalendarClock className="w-8 h-8 text-[#217E66]" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-[#152220]">Sign In to View Booking History</h2>
            <p className="text-sm text-[#576563] max-w-md mx-auto">
              Access your confirmed bookings, assigned professionals, service statuses, cancellation details, and receipts securely.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <Link href="/login?redirect=/bookings">
              <Button variant="primary" className="w-full sm:w-auto">
                Sign In to Sahayak
              </Button>
            </Link>
            <Link href="/dashboard">
              <Button variant="secondary" className="w-full sm:w-auto">
                Browse Marketplace
              </Button>
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto py-8 px-4 sm:px-6 lg:px-8 space-y-6">
      {/* First Card: Booking History Header */}
      <div className="bg-white/95 backdrop-blur-md rounded-2xl border border-[#E5DFD2] p-6 sm:p-8 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-[#152220] tracking-tight">
              Booking History
            </h1>
            <p className="text-sm text-[#576563] mt-1">
              Track and review all your service bookings, assigned professionals, price agreements, and ratings.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="secondary"
              size="sm"
              onClick={fetchBookings}
              disabled={loadingBookings}
              className="flex items-center gap-1.5"
              title="Refresh bookings"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingBookings ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </Button>
            <Link href="/post-job">
              <Button variant="primary" size="sm" className="shadow-sm">
                <span>Book New Service</span>
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Second Card: Filter Tabs Long Card */}
      <div className="bg-white/95 backdrop-blur-md rounded-2xl border border-[#E5DFD2] p-4 sm:p-5 shadow-xl">
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-none">
          <button
            type="button"
            onClick={() => setActiveFilter('all')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
              activeFilter === 'all'
                ? 'bg-[#0D4A52] text-white shadow-sm'
                : 'bg-white text-[#576563] border border-[#E5DFD2] hover:bg-[#F3EFE6] hover:text-[#152220]'
            }`}
          >
            <span>All Bookings</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                activeFilter === 'all' ? 'bg-white/20 text-white' : 'bg-[#EBF4F3] text-[#0D4A52]'
              }`}
            >
              {bookings.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveFilter('active')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
              activeFilter === 'active'
                ? 'bg-[#0D4A52] text-white shadow-sm'
                : 'bg-white text-[#576563] border border-[#E5DFD2] hover:bg-[#F3EFE6] hover:text-[#152220]'
            }`}
          >
            <span>Upcoming & Active</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                activeFilter === 'active' ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-800'
              }`}
            >
              {countActive}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveFilter('completed')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
              activeFilter === 'completed'
                ? 'bg-[#0D4A52] text-white shadow-sm'
                : 'bg-white text-[#576563] border border-[#E5DFD2] hover:bg-[#F3EFE6] hover:text-[#152220]'
            }`}
          >
            <span>Completed</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                activeFilter === 'completed' ? 'bg-white/20 text-white' : 'bg-emerald-100 text-emerald-800'
              }`}
            >
              {countCompleted}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveFilter('cancelled')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
              activeFilter === 'cancelled'
                ? 'bg-[#0D4A52] text-white shadow-sm'
                : 'bg-white text-[#576563] border border-[#E5DFD2] hover:bg-[#F3EFE6] hover:text-[#152220]'
            }`}
          >
            <span>Cancelled</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                activeFilter === 'cancelled' ? 'bg-white/20 text-white' : 'bg-red-100 text-red-800'
              }`}
            >
              {countCancelled}
            </span>
          </button>
        </div>
      </div>

      {/* Error Alert */}
      {errorMessage && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div className="space-y-1 text-xs">
            <p className="font-semibold">Unable to load booking history</p>
            <p>{errorMessage}</p>
          </div>
          <Button variant="secondary" size="sm" onClick={fetchBookings} className="ml-auto text-xs py-1">
            Try Again
          </Button>
        </div>
      )}

      {/* Loading Skeleton */}
      {loadingBookings && (
        <div className="space-y-4">
          {[1, 2, 3].map((idx) => (
            <div
              key={idx}
              className="bg-white/95 backdrop-blur-md rounded-2xl border border-[#E5DFD2] p-6 shadow-xl animate-pulse space-y-4"
            >
              <div className="flex items-center justify-between">
                <div className="h-5 bg-gray-200 rounded w-1/3" />
                <div className="h-6 bg-gray-200 rounded-full w-24" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="h-10 bg-gray-100 rounded" />
                <div className="h-10 bg-gray-100 rounded" />
                <div className="h-10 bg-gray-100 rounded" />
              </div>
              <div className="h-8 bg-gray-100 rounded" />
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!loadingBookings && filteredBookings.length === 0 && (
        <Card className="bg-white/95 backdrop-blur-md rounded-2xl border border-[#E5DFD2] text-center py-12 px-4 space-y-4 shadow-xl">
          <div className="w-14 h-14 rounded-full bg-[#EBF4F3] flex items-center justify-center mx-auto text-[#0D4A52]">
            <CalendarClock className="w-7 h-7 text-[#217E66]" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-[#152220]">
              {activeFilter === 'all'
                ? 'No Bookings Found'
                : `No ${activeFilter.charAt(0).toUpperCase() + activeFilter.slice(1)} Bookings`}
            </h3>
            <p className="text-xs text-[#576563] max-w-md mx-auto">
              {activeFilter === 'all'
                ? 'You have not booked any local service partners yet. Post a service request or browse top-rated local professionals.'
                : `You currently have no bookings in the "${activeFilter}" category.`}
            </p>
          </div>
          <div className="pt-2 flex justify-center gap-3">
            {activeFilter !== 'all' && (
              <Button variant="secondary" size="sm" onClick={() => setActiveFilter('all')}>
                View All Bookings
              </Button>
            )}
            <Link href="/dashboard">
              <Button variant="primary" size="sm">
                Explore Marketplace & Jobs
              </Button>
            </Link>
          </div>
        </Card>
      )}

      {/* Bookings List */}
      {!loadingBookings && filteredBookings.length > 0 && (
        <div className="space-y-4">
          {filteredBookings.map((booking) => {
            const formattedTime = formatBookingDateTime(booking.bookedAt || booking.createdAt);
            const isCancelled = booking.stage === 'cancelled' || booking.status === 'cancelled';
            const formattedCancelledTime = booking.cancelledAt
              ? formatBookingDateTime(booking.cancelledAt)
              : null;

            return (
              <Card
                key={booking.id}
                hoverEffect
                className="bg-white/95 backdrop-blur-md rounded-2xl border border-[#E5DFD2] p-6 sm:p-7 shadow-xl transition-all duration-200 hover:border-[#217E66]/40"
              >
                <div className="space-y-4">
                  {/* Top Bar: Title, Category, Status */}
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 pb-3 border-b border-[#E5DFD2]/60">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="p-1 rounded bg-[#EBF4F3]">
                          {getCategoryIcon(booking.category)}
                        </span>
                        <h2 className="text-base sm:text-lg font-bold text-[#152220]">
                          {booking.title}
                        </h2>
                        <span className="text-[11px] font-medium text-[#576563] bg-[#F3EFE6] px-2 py-0.5 rounded capitalize">
                          {booking.category.replace('_', ' ')}
                        </span>
                      </div>
                      <p className="text-xs text-[#576563] flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-[#217E66]" />
                        <span>Booked on {formattedTime.full}</span>
                      </p>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                      {getStageBadge(booking.stage, booking.status)}
                    </div>
                  </div>

                  {/* Worker & Pricing Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-[#FAF9F5] p-3.5 rounded-xl border border-[#E5DFD2]/60">
                    {/* Worker Info */}
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-[#0D4A52] text-white flex items-center justify-center font-bold text-sm shadow-sm flex-shrink-0">
                        {booking.workerName.charAt(0).toUpperCase()}
                      </div>
                      <div className="space-y-0.5 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className="text-xs font-bold text-[#152220] truncate">
                            {booking.workerName}
                          </p>
                          {booking.isDemoWorker && (
                            <span className="text-[9px] font-semibold bg-amber-100 text-amber-800 px-1 rounded">
                              Demo Simulation
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-[#576563] truncate capitalize">
                          {booking.workerCategory.replace('_', ' ')}
                          {booking.workerExperience ? ` • ${booking.workerExperience} yrs exp` : ''}
                        </p>
                        {booking.workerRating && (
                          <div className="flex items-center gap-1 text-[11px] font-semibold text-amber-700">
                            <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                            <span>{booking.workerRating} / 5.0</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Agreed Price */}
                    <div className="flex flex-col justify-center border-t md:border-t-0 md:border-l border-[#E5DFD2]/60 pt-2 md:pt-0 md:pl-4">
                      <span className="text-[11px] font-medium text-[#576563]">Agreed Price</span>
                      <div className="flex items-center gap-1 text-base font-extrabold text-[#0D4A52]">
                        <IndianRupee className="w-4 h-4 text-[#217E66]" />
                        <span>{booking.agreedPriceInr.toLocaleString('en-IN')}</span>
                      </div>
                      <span className="text-[10px] text-[#576563]">Zero hidden markup • Direct payout</span>
                    </div>

                    {/* Service Location */}
                    <div className="flex flex-col justify-center border-t md:border-t-0 md:border-l border-[#E5DFD2]/60 pt-2 md:pt-0 md:pl-4">
                      <span className="text-[11px] font-medium text-[#576563]">Service Address</span>
                      <div className="flex items-start gap-1 text-xs text-[#152220] font-medium line-clamp-1">
                        <MapPin className="w-3.5 h-3.5 text-[#217E66] flex-shrink-0 mt-0.5" />
                        <span className="truncate">
                          {[booking.addressLine, booking.city, booking.pincode].filter(Boolean).join(', ') || 'Local area'}
                        </span>
                      </div>
                      <span className="text-[10px] text-[#576563]">Safe handoff with arrival OTP</span>
                    </div>
                  </div>

                  {/* Cancellation Reason Box (when applicable) */}
                  {isCancelled && (
                    <div className="p-3.5 rounded-xl bg-red-50/80 border border-red-200 text-xs space-y-1.5">
                      <div className="flex items-center gap-2 text-red-800 font-bold">
                        <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0" />
                        <span>Booking Cancelled</span>
                        {formattedCancelledTime && (
                          <span className="text-[11px] font-normal text-red-600">
                            • on {formattedCancelledTime.full}
                          </span>
                        )}
                      </div>
                      <p className="text-red-900 pl-6">
                        <span className="font-semibold">Reason: </span>
                        {booking.cancellationReason || 'Cancelled by user'}
                      </p>
                    </div>
                  )}

                  {/* Rating / Review Box */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-[#576563]">Customer Rating:</span>
                      {booking.customerReview ? (
                        <div className="flex items-center gap-2">
                          <div className="flex items-center text-amber-500 font-bold">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <Star
                                key={star}
                                className={`w-3.5 h-3.5 ${
                                  star <= booking.customerReview!.rating
                                    ? 'fill-amber-400 text-amber-400'
                                    : 'text-gray-300'
                                }`}
                              />
                            ))}
                            <span className="ml-1 text-[#152220]">
                              {booking.customerReview.rating} / 5
                            </span>
                          </div>
                          {booking.customerReview.reviewText && (
                            <span className="text-[#576563] italic truncate max-w-xs">
                              &ldquo;{booking.customerReview.reviewText}&rdquo;
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] text-[#576563] bg-[#F3EFE6] px-2 py-0.5 rounded font-medium">
                          <Star className="w-3 h-3 text-[#576563]" />
                          <span>Not rated yet</span>
                        </span>
                      )}
                    </div>

                    {/* View Original Job / Tracking Link */}
                    <Link href={`/jobs/${booking.id}`} className="sm:ml-auto">
                      <Button variant="secondary" size="sm" className="w-full sm:w-auto flex items-center justify-center gap-1.5 text-xs py-1.5">
                        <span>View Details & Tracking</span>
                        <ArrowRight className="w-3.5 h-3.5 text-[#217E66]" />
                      </Button>
                    </Link>
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

export default function BookingHistoryPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-5xl mx-auto py-12 px-4 text-center">
          <RefreshCw className="w-6 h-6 animate-spin text-[#0D4A52] mx-auto" />
          <p className="text-xs text-[#576563] mt-2">Loading your booking history...</p>
        </div>
      }
    >
      <BookingHistoryContent />
    </Suspense>
  );
}
