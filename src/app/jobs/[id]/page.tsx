'use client';

import React, { useState, useEffect, Suspense } from 'react';
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
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';

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
  estimated_min_price_inr?: number | null;
  estimated_max_price_inr?: number | null;
  created_at: string;
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

function JobDiscoveryContent() {
  const params = useParams();
  const router = useRouter();
  const jobId = params?.id as string;

  const [job, setJob] = useState<JobDetails | null>(null);
  const [bidsCount, setBidsCount] = useState<number>(0);
  const [loadingJob, setLoadingJob] = useState(true);
  const [jobError, setJobError] = useState<string | null>(null);

  // Worker Discovery States
  const [workers, setWorkers] = useState<NearbyWorker[]>([]);
  const [loadingWorkers, setLoadingWorkers] = useState(false);
  const [searchRadius, setSearchRadius] = useState<number>(15000); // 15 km default
  const [activeWorkerProfile, setActiveWorkerProfile] = useState<NearbyWorker | null>(null);

  // 1. Fetch Job Details
  useEffect(() => {
    if (!jobId) return;
    let isCancelled = false;

    const loadJob = async () => {
      try {
        const res = await fetch(`/api/jobs/${jobId}`);
        const data = await res.json();
        if (isCancelled) return;

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
      } catch (err) {
        if (!isCancelled) {
          setJobError(err instanceof Error ? err.message : 'Network error loading job.');
        }
      } finally {
        if (!isCancelled) {
          setLoadingJob(false);
        }
      }
    };

    loadJob();

    return () => {
      isCancelled = true;
    };
  }, [jobId, router]);

  // 2. Fetch Nearby Workers once Job is Loaded
  useEffect(() => {
    if (!job) return;
    let isCancelled = false;

    const loadWorkers = async () => {
      await Promise.resolve();
      if (isCancelled) return;
      setLoadingWorkers(true);

      const locField = (job as { service_location?: unknown; location_point?: unknown }).service_location ?? job.location_point;
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
          <Badge variant="green">{job.status}</Badge>
          <span className="text-xs text-[#83928E] font-mono">#{job.id.slice(0, 8)}</span>
        </div>
      </div>

      {/* Broadcast Success & Job Summary Banner */}
      <div className="bg-white rounded-2xl border border-[#BCE5DA] p-6 shadow-sm space-y-5">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200">
                {job.category}
              </span>
              <Badge variant={job.urgency === 'emergency' ? 'amber' : 'neutral'}>
                {job.urgency}
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
                : job.urgency === 'same_day'
                ? '⚡ Same-Day Service Alert Broadcast Active:'
                : '📅 Standard Request Broadcasted:'}
            </span>{' '}
            <span className="text-[#576563]">
              Neighborhood professionals in {job.city} matching {job.category} have been alerted. When workers submit itemized quotes, you will be notified.
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
                No Active {job.category} Workers Found within {(searchRadius / 1000).toFixed(0)} km
              </h3>
              <p className="text-xs text-[#576563] leading-relaxed">
                Your request is broadcasted live on the marketplace. As workers come online or expand their service zone, they will place bids. You can also widen your search radius below.
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

              return (
                <Card
                  key={w.worker_id}
                  className="p-5 space-y-4 flex flex-col justify-between hover:shadow-md transition-shadow"
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

                      <Badge variant="green" className="text-[10px]">
                        Available
                      </Badge>
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

                  {/* Actions & Discovery Disclaimer */}
                  <div className="space-y-2 pt-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      className="w-full gap-1.5 text-xs font-semibold justify-center"
                      onClick={() => setActiveWorkerProfile(w)}
                    >
                      <Eye className="w-3.5 h-3.5 text-[#0D4A52]" />
                      <span>View Professional Profile</span>
                    </Button>

                    <p className="text-[10px] text-[#83928E] text-center leading-tight">
                      Alert sent. Bids submitted by this worker will appear in your Dashboard.
                    </p>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Slide-Over Worker Profile Modal */}
      {activeWorkerProfile && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl border border-[#E5DFD2] max-w-md w-full p-6 shadow-xl space-y-5 animate-in zoom-in-95">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-[#EBF4F3] border border-[#BCE5DA] flex items-center justify-center text-[#0D4A52] font-bold text-base">
                  {activeWorkerProfile.avatar_url ? (
                    <img
                      src={activeWorkerProfile.avatar_url}
                      alt={activeWorkerProfile.full_name}
                      className="w-full h-full rounded-full object-cover"
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

            <Button
              variant="primary"
              className="w-full text-xs"
              onClick={() => setActiveWorkerProfile(null)}
            >
              Close Profile View
            </Button>
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
