'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  User,
  Mail,
  Phone,
  MapPin,
  Wrench,
  Award,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Clock,
  Sparkles,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';

interface ProfileData {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  primaryCity: string;
  role: string;
  workerProfile?: {
    primaryCategory: string;
    skills: string[];
    bio: string;
    yearsExperience: number;
    isAvailable: boolean;
    reputationScore: number;
    totalCompletedJobs: number;
  };
}

export default function WorkerProfilePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [available, setAvailable] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    let isCancelled = false;

    const loadProfile = async () => {
      try {
        const meRes = await fetch('/api/auth/me');
        const meJson = await meRes.json();

        if (isCancelled) return;

        if (!meJson.success || !meJson.data?.authenticated) {
          router.replace('/login?role=worker');
          return;
        }

        if (meJson.data.role !== 'worker' && meJson.data.role !== 'admin') {
          router.replace('/post-job');
          return;
        }

        const profileRes = await fetch('/api/profile');
        if (profileRes.ok) {
          const profJson = await profileRes.json();
          if (profJson.success && profJson.data) {
            setProfile(profJson.data);
          }
        }
      } catch (err) {
        console.error('Failed to load worker profile:', err);
      } finally {
        if (!isCancelled) setLoading(false);
      }
    };

    loadProfile();
    return () => {
      isCancelled = true;
    };
  }, [router]);

  const handleToggleAvailability = () => {
    setAvailable((prev) => !prev);
    setSuccessMsg(
      !available
        ? 'You are now marked Available for immediate nearby job dispatches.'
        : 'You are now marked Away. You will not receive automatic instant dispatches.'
    );
    setTimeout(() => setSuccessMsg(null), 4000);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-transparent flex items-center justify-center">
        <div className="flex items-center gap-2 text-xs text-[#576563]">
          <RefreshCw className="w-4 h-4 animate-spin text-[#0D4A52]" />
          <span>Loading Worker Profile...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-transparent text-[#152220] py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#E5DFD2]">
          <div>
            <h1 className="text-2xl font-black text-[#0D4A52] tracking-tight">
              Partner Profile & Skills
            </h1>
            <p className="text-xs text-[#576563] mt-0.5">
              Manage your verified tradesperson identity, skill badges, and active service status.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleToggleAvailability}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold transition shadow-xs cursor-pointer ${
                available
                  ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${available ? 'bg-white animate-pulse' : 'bg-gray-500'}`} />
              <span>{available ? 'Available for Jobs' : 'Marked Offline'}</span>
            </button>
          </div>
        </div>

        {/* Notifications */}
        {successMsg && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-xs text-emerald-800">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}
        {errorMsg && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-xs text-red-700">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Identity Card */}
          <Card className="p-6 md:col-span-1 bg-white border border-[#E5DFD2] rounded-2xl shadow-xs space-y-4 text-center">
            <div className="w-20 h-20 mx-auto rounded-full bg-[#EBF4F3] border-2 border-[#0D4A52]/20 flex items-center justify-center text-[#0D4A52] font-black text-2xl">
              {profile?.fullName ? profile.fullName[0].toUpperCase() : 'W'}
            </div>
            <div>
              <h2 className="font-bold text-base text-[#152220]">{profile?.fullName || 'Verified Partner'}</h2>
              <p className="text-xs text-[#576563]">{profile?.email || '—'}</p>
              <Badge variant="teal" className="mt-2 text-[10px]">
                Verified Tradesperson
              </Badge>
            </div>
            <div className="pt-4 border-t border-[#E5DFD2] text-left space-y-2 text-xs text-[#576563]">
              <div className="flex items-center gap-2">
                <Phone className="w-3.5 h-3.5 text-[#217E66]" />
                <span>{profile?.phone || 'No phone registered'}</span>
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="w-3.5 h-3.5 text-[#217E66]" />
                <span>{profile?.primaryCity || 'Delhi NCR'}</span>
              </div>
            </div>
          </Card>

          {/* Trade Details, Bio & Badges */}
          <Card className="p-6 md:col-span-2 bg-white border border-[#E5DFD2] rounded-2xl shadow-xs space-y-6">
            <div>
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-[#0D4A52] uppercase tracking-wider flex items-center gap-2">
                  <Wrench className="w-4 h-4 text-[#217E66]" />
                  <span>Primary Trade Specialization</span>
                </h3>
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                  {profile?.workerProfile?.yearsExperience ?? 2}+ Years Experience
                </span>
              </div>
              <p className="text-xs text-[#576563] mt-1">
                Your registered categories for receiving direct customer dispatch requests.
              </p>
            </div>

            {/* Registered Skills & Categories */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
              <div className="p-3 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-950 font-bold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className="capitalize">{profile?.workerProfile?.primaryCategory || 'General Maintenance'}</span>
              </div>
              {(profile?.workerProfile?.skills || []).map((skill, idx) => (
                <div key={idx} className="p-3 rounded-xl border border-gray-200 bg-gray-50 text-[#152220] font-semibold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="capitalize">{skill}</span>
                </div>
              ))}
            </div>

            {/* Worker Bio & Summary */}
            <div className="pt-4 border-t border-[#E5DFD2]">
              <h4 className="text-xs font-bold text-[#0D4A52] uppercase tracking-wider flex items-center gap-2 mb-2">
                <Sparkles className="w-4 h-4 text-[#217E66]" />
                <span>Professional Bio & Summary</span>
              </h4>
              <p className="text-xs text-[#576563] leading-relaxed p-3 rounded-xl bg-[#FAF9F5] border border-[#E5DFD2]">
                {profile?.workerProfile?.bio || 'Verified tradesperson providing trusted household services on the Sahayak platform.'}
              </p>
            </div>

            <div className="pt-4 border-t border-[#E5DFD2]">
              <h4 className="text-xs font-bold text-[#0D4A52] uppercase tracking-wider flex items-center gap-2 mb-2">
                <Award className="w-4 h-4 text-[#217E66]" />
                <span>Trust & Verification Credentials</span>
              </h4>
              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between p-2.5 rounded-lg bg-[#FAF9F5] border border-[#E5DFD2]">
                  <span className="font-medium text-[#152220]">Government ID Verification</span>
                  <Badge variant="teal" className="text-[10px]">Verified</Badge>
                </div>
                <div className="flex items-center justify-between p-2.5 rounded-lg bg-[#FAF9F5] border border-[#E5DFD2]">
                  <span className="font-medium text-[#152220]">Police Verification & Background Check</span>
                  <Badge variant="teal" className="text-[10px]">Clear</Badge>
                </div>
                <div className="flex items-center justify-between p-2.5 rounded-lg bg-[#FAF9F5] border border-[#E5DFD2]">
                  <span className="font-medium text-[#152220]">Sahayak Skill Assessment</span>
                  <Badge variant="teal" className="text-[10px]">Level 2 Certified</Badge>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

