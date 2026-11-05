'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  Phone,
  Mail,
  MapPin,
  Calendar,
  ShieldCheck,
  Star,
  ArrowLeft,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/admin/StatusBadge';
import { useToast } from '@/components/admin/ToastContext';

interface UserJobItem {
  id: string;
  title: string;
  category: string;
  status: string;
  created_at: string;
  final_price_inr?: number;
}

interface UserReviewItem {
  id: string;
  rating: number;
  comment?: string;
  created_at: string;
}

interface UserDetailPayload {
  profile: {
    id: string;
    full_name: string;
    role: string;
    phone: string;
    email: string;
    created_at: string;
    primary_city?: string;
    verification_status?: string;
    is_suspended?: boolean;
    suspended_reason?: string;
  };
  workerDetails?: {
    id: string;
    primary_category: string;
    experience_years?: number;
    rating: number;
    reputation_score: number;
    total_completed_jobs: number;
    service_radius_km: number;
    government_id_verified: boolean;
    background_check_verified: boolean;
    verification_status: string;
  };
  jobs: UserJobItem[];
  reviews: UserReviewItem[];
}

export default function UserDetailPage() {
  const params = useParams();
  const id = params?.id as string;
  const { error } = useToast();

  const [data, setData] = useState<UserDetailPayload | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    let isMounted = true;
    async function load() {
      try {
        const res = await fetch(`/api/admin/users/${id}`);
        const json = await res.json();
        if (isMounted) {
          if (json.success && json.data) {
            setData(json.data);
          } else {
            error(json.error?.message || 'User not found');
          }
        }
      } catch {
        if (isMounted) error('Failed to load user profile');
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    load();
    return () => {
      isMounted = false;
    };
  }, [id, error]);

  if (loading) {
    return (
      <div className="py-20 text-center text-[#576563] space-y-3">
        <div className="w-8 h-8 rounded-full border-3 border-[#0D4A52] border-t-transparent animate-spin mx-auto" />
        <p className="text-xs">Loading User Passport & History...</p>
      </div>
    );
  }

  const profile = data?.profile;
  const worker = data?.workerDetails;
  const jobs = data?.jobs || [];
  const reviews = data?.reviews || [];

  if (!profile) {
    return (
      <div className="py-16 text-center space-y-4">
        <p className="text-sm font-semibold text-red-600">User Profile Not Found</p>
        <Link href="/admin/users">
          <Button variant="secondary" size="sm">
            <ArrowLeft className="w-4 h-4 mr-1" /> Back to Directory
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back button */}
      <div>
        <Link
          href="/admin/users"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#576563] hover:text-[#0D4A52] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Users Directory</span>
        </Link>
      </div>

      {/* Main Profile Header Card */}
      <Card className="p-6 rounded-2xl border-[#E5DFD2] shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#0D4A52] to-[#217E66] text-white flex items-center justify-center font-bold text-2xl shadow-sm">
              {profile.full_name?.charAt(0) || 'U'}
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-xl font-bold text-[#152220]">{profile.full_name}</h1>
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full capitalize bg-teal-50 text-teal-800 border border-teal-200">
                  {profile.role}
                </span>
                {profile.is_suspended && (
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                    Suspended
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-4 mt-2 text-xs text-[#576563]">
                <span className="flex items-center gap-1">
                  <Phone className="w-3.5 h-3.5 text-[#0D4A52]" /> {profile.phone}
                </span>
                {profile.email && (
                  <span className="flex items-center gap-1">
                    <Mail className="w-3.5 h-3.5 text-[#0D4A52]" /> {profile.email}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-[#0D4A52]" /> {profile.primary_city}
                </span>
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-[#0D4A52]" /> Member since{' '}
                  {new Date(profile.created_at).toLocaleDateString()}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <StatusBadge status={profile.verification_status || 'unverified'} type="verification" />
          </div>
        </div>
      </Card>

      {/* Worker Reputation Passport (if worker) */}
      {worker && (
        <Card className="p-6 rounded-2xl border-[#E5DFD2] bg-gradient-to-r from-white to-[#FAF9F5] shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#E5DFD2]">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-[#217E66]" />
              <h3 className="text-base font-bold text-[#152220]">
                Worker Reputation Passport & Badges
              </h3>
            </div>
            <span className="text-xs font-semibold px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
              Score: {worker.reputation_score || 4.8} / 5.0
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
            <div className="p-3 bg-white rounded-xl border border-[#E5DFD2]">
              <span className="text-[#576563] block">Trade Category</span>
              <span className="font-bold text-sm text-[#152220] capitalize mt-0.5 block">
                {worker.primary_category}
              </span>
            </div>
            <div className="p-3 bg-white rounded-xl border border-[#E5DFD2]">
              <span className="text-[#576563] block">Completed Jobs</span>
              <span className="font-bold text-sm text-[#152220] mt-0.5 block">
                {worker.total_completed_jobs || 0}
              </span>
            </div>
            <div className="p-3 bg-white rounded-xl border border-[#E5DFD2]">
              <span className="text-[#576563] block">Govt ID Verified</span>
              <span
                className={`font-bold text-xs mt-1 inline-flex items-center gap-1 ${
                  worker.government_id_verified ? 'text-emerald-700' : 'text-amber-700'
                }`}
              >
                {worker.government_id_verified ? 'Verified (Aadhaar)' : 'Pending Verification'}
              </span>
            </div>
            <div className="p-3 bg-white rounded-xl border border-[#E5DFD2]">
              <span className="text-[#576563] block">Service Radius</span>
              <span className="font-bold text-sm text-[#152220] mt-0.5 block">
                {worker.service_radius_km || 10} km
              </span>
            </div>
          </div>
        </Card>
      )}

      {/* Jobs History & Reviews Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Jobs History */}
        <Card className="p-6 rounded-2xl border-[#E5DFD2] shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#E5DFD2]">
            <h3 className="text-sm font-bold text-[#152220]">Associated Job Requests</h3>
            <span className="text-xs text-[#576563]">{jobs.length} records</span>
          </div>

          <div className="divide-y divide-[#E5DFD2]/60 max-h-72 overflow-y-auto text-xs">
            {jobs.length > 0 ? (
              jobs.map((j: UserJobItem) => (
                <div key={j.id} className="py-2.5 flex items-center justify-between gap-3">
                  <div>
                    <Link
                      href={`/admin/jobs/${j.id}`}
                      className="font-bold text-[#152220] hover:text-[#0D4A52] hover:underline"
                    >
                      {j.title}
                    </Link>
                    <p className="text-[#576563] capitalize mt-0.5">
                      {j.category} • {new Date(j.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <StatusBadge status={j.status} type="job" />
                    {j.final_price_inr && (
                      <span className="text-xs font-bold text-[#0D4A52] block mt-1">
                        ₹{j.final_price_inr}
                      </span>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <p className="py-6 text-center text-[#576563]">No job history recorded yet.</p>
            )}
          </div>
        </Card>

        {/* Reviews History */}
        <Card className="p-6 rounded-2xl border-[#E5DFD2] shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#E5DFD2]">
            <h3 className="text-sm font-bold text-[#152220]">Community Ratings & Feedback</h3>
            <span className="text-xs text-[#576563]">{reviews.length} reviews</span>
          </div>

          <div className="divide-y divide-[#E5DFD2]/60 max-h-72 overflow-y-auto text-xs">
            {reviews.length > 0 ? (
              reviews.map((rev: UserReviewItem) => (
                <div key={rev.id} className="py-2.5 space-y-1">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1 font-bold text-amber-500">
                      <Star className="w-3.5 h-3.5 fill-current" />
                      <span>{rev.rating}.0</span>
                    </div>
                    <span className="text-[#576563] text-[10px]">
                      {new Date(rev.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-[#152220] italic">&ldquo;{rev.comment || 'No comment text'}&rdquo;</p>
                </div>
              ))
            ) : (
              <p className="py-6 text-center text-[#576563]">No reviews logged yet.</p>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
