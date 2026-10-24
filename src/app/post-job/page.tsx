'use client';

import React, { useState, useEffect, Suspense, useRef } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  ArrowLeft,
  Sparkles,
  IndianRupee,
  Camera,
  X,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Navigation,
  Info,
  Briefcase,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { SERVICE_CATEGORIES } from '@/lib/config/constants';
import { ServiceCategory, JobUrgency } from '@/types/jobs';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

const DRAFT_STORAGE_KEY = 'sahayak_job_draft_v1';

interface DraftData {
  category: ServiceCategory;
  title: string;
  description: string;
  urgency: JobUrgency;
  addressLine: string;
  landmark: string;
  city: string;
  pincode: string;
  latitude: number | null;
  longitude: number | null;
  estimatedBudgetInr: string;
}

function PostJobForm() {
  const searchParams = useSearchParams();
  const urlCategory = searchParams.get('category') as ServiceCategory | null;

  // Verify valid category fallback
  const validCategoryIds = SERVICE_CATEGORIES.map((c) => c.id);

  // Lazy draft loader helper
  const getInitialDraft = (): Partial<DraftData> => {
    if (typeof window === 'undefined') return {};
    try {
      const saved = localStorage.getItem(DRAFT_STORAGE_KEY);
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  };

  const initialDraft = getInitialDraft();

  // Form State
  const [category, setCategory] = useState<ServiceCategory>(() => {
    if (urlCategory && validCategoryIds.includes(urlCategory)) return urlCategory;
    if (initialDraft.category && validCategoryIds.includes(initialDraft.category)) {
      return initialDraft.category;
    }
    return 'plumbing';
  });

  const [title, setTitle] = useState(() => initialDraft.title || '');
  const [description, setDescription] = useState(() => initialDraft.description || '');
  const [urgency, setUrgency] = useState<JobUrgency>(() => initialDraft.urgency || 'standard');
  const [addressLine, setAddressLine] = useState(() => initialDraft.addressLine || '');
  const [landmark, setLandmark] = useState(() => initialDraft.landmark || '');
  const [city, setCity] = useState(() => initialDraft.city || 'Delhi NCR');
  const [pincode, setPincode] = useState(() => initialDraft.pincode || '110001');
  const [latitude, setLatitude] = useState<number | null>(() => initialDraft.latitude ?? null);
  const [longitude, setLongitude] = useState<number | null>(() => initialDraft.longitude ?? null);
  const [estimatedBudgetInr, setEstimatedBudgetInr] = useState(() => initialDraft.estimatedBudgetInr || '');

  // Photo Attachment
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoFileName, setPhotoFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Status & Auth
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [locating, setLocating] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successJobId, setSuccessJobId] = useState<string | null>(null);
  const [createdJobData, setCreatedJobData] = useState<{
    id: string;
    title: string;
    status: string;
  } | null>(null);

  // 1. Check user authentication asynchronously
  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      const timer = setTimeout(() => setIsAuthenticated(false), 0);
      return () => clearTimeout(timer);
    }

    supabase.auth.getUser().then(({ data: { user } }) => {
      setIsAuthenticated(!!user);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAuthenticated(!!session?.user);
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  // 3. Save draft to localStorage on change
  useEffect(() => {
    try {
      const draft: DraftData = {
        category,
        title,
        description,
        urgency,
        addressLine,
        landmark,
        city,
        pincode,
        latitude,
        longitude,
        estimatedBudgetInr,
      };
      localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
    } catch {
      // Ignore localStorage write errors
    }
  }, [
    category,
    title,
    description,
    urgency,
    addressLine,
    landmark,
    city,
    pincode,
    latitude,
    longitude,
    estimatedBudgetInr,
  ]);

  // Selected category benchmark lookup
  const currentCategoryMeta = SERVICE_CATEGORIES.find((c) => c.id === category);

  // GPS Location Request
  const handleGetLocation = () => {
    if (!navigator.geolocation) {
      setErrorMsg('Geolocation is not supported by your browser. Please enter your address manually.');
      return;
    }

    setLocating(true);
    setErrorMsg(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLatitude(pos.coords.latitude);
        setLongitude(pos.coords.longitude);
        setLocating(false);
      },
      (err) => {
        setLocating(false);
        setErrorMsg(`Unable to retrieve GPS location (${err.message}). You can fill in the address manually.`);
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  // Photo selection handler
  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMsg(null);
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setErrorMsg('Please select a valid image file (JPEG, PNG, WebP).');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setErrorMsg('Image size must be smaller than 5 MB.');
      return;
    }

    setPhotoFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      setPhotoPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleRemovePhoto = () => {
    setPhotoPreview(null);
    setPhotoFileName(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Form Submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    // Validation
    if (!title.trim() || title.trim().length < 5) {
      setErrorMsg('Please provide a specific job title (at least 5 characters).');
      return;
    }

    if (!description.trim() || description.trim().length < 10) {
      setErrorMsg('Please describe the problem in detail (at least 10 characters).');
      return;
    }

    if (!addressLine.trim() || addressLine.trim().length < 5) {
      setErrorMsg('Please enter your complete street address.');
      return;
    }

    if (!/^\d{6}$/.test(pincode.trim())) {
      setErrorMsg('Please enter a valid 6-digit Indian postal pincode.');
      return;
    }

    // Default geographic fallback for Delhi NCR center if coordinates are omitted
    const effectiveLat = latitude ?? 28.6139;
    const effectiveLng = longitude ?? 77.209;

    setSubmitting(true);

    try {
      const payload = {
        category,
        title: title.trim(),
        description: description.trim(),
        urgency,
        latitude: effectiveLat,
        longitude: effectiveLng,
        addressLine: addressLine.trim(),
        landmark: landmark.trim() || undefined,
        city: city.trim(),
        pincode: pincode.trim(),
        estimatedBudgetInr: estimatedBudgetInr ? parseFloat(estimatedBudgetInr) : undefined,
      };

      const res = await fetch('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          setErrorMsg(
            'Authentication required: Please sign in as a customer to post jobs. Your draft has been safely saved.'
          );
        } else {
          setErrorMsg(data.error || 'Failed to create job posting. Please check your inputs.');
        }
        setSubmitting(false);
        return;
      }

      // Success! Clear draft
      try {
        localStorage.removeItem(DRAFT_STORAGE_KEY);
      } catch {
        // Ignore storage cleanup
      }

      const created = data.data?.job;
      setSuccessJobId(created?.id || 'created');
      setCreatedJobData(created);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Network error while creating job.');
    } finally {
      setSubmitting(false);
    }
  };

  // If successfully created, display confirmation screen
  if (successJobId && createdJobData) {
    return (
      <div className="max-w-xl mx-auto bg-white rounded-2xl border border-[#BCE5DA] p-8 shadow-sm text-center space-y-6">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-[#EBF4F3] flex items-center justify-center text-[#217E66]">
          <CheckCircle2 className="w-10 h-10" />
        </div>

        <div className="space-y-2">
          <Badge variant="teal">Job Posted Live</Badge>
          <h1 className="text-2xl font-extrabold text-[#152220] tracking-tight">
            Job Request Broadcasted Successfully!
          </h1>
          <p className="text-sm text-[#576563]">
            Verified local tradesmen in your area are being notified. You will receive competitive bids shortly.
          </p>
        </div>

        <div className="bg-[#FAF9F5] border border-[#E5DFD2] rounded-xl p-4 text-left text-xs space-y-2">
          <div className="flex items-center justify-between border-b border-[#E5DFD2] pb-2">
            <span className="text-[#576563]">Job ID:</span>
            <span className="font-mono font-bold text-[#152220]">{createdJobData.id}</span>
          </div>
          <div className="flex items-center justify-between border-b border-[#E5DFD2] pb-2">
            <span className="text-[#576563]">Title:</span>
            <span className="font-semibold text-[#152220]">{createdJobData.title}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[#576563]">Status:</span>
            <Badge variant="green">{createdJobData.status}</Badge>
          </div>
        </div>

        <div className="pt-2 flex flex-col sm:flex-row gap-3">
          <Link href="/dashboard" className="w-full">
            <Button variant="primary" className="w-full gap-1.5">
              <Briefcase className="w-4 h-4" />
              <span>Track in My Jobs Dashboard</span>
            </Button>
          </Link>
          <Link href="/" className="w-full">
            <Button variant="secondary" className="w-full">
              Back to Home
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto bg-white rounded-2xl border border-[#E5DFD2] p-6 sm:p-10 shadow-sm space-y-8">
      {/* Header */}
      <div className="space-y-3 border-b border-[#E5DFD2] pb-6">
        <div className="flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#576563] hover:text-[#0D4A52] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back</span>
          </Link>
          <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-[#EDF7F4] text-[#217E66] border border-[#BCE5DA]">
            Zero Middleman Markup
          </span>
        </div>

        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#152220] tracking-tight">
            Create a Service Request
          </h1>
          <p className="text-xs sm:text-sm text-[#576563] mt-1">
            Specify your home repair or maintenance task to receive direct bids from vetted neighborhood workers.
          </p>
        </div>

        {/* Authentication Notice Banner */}
        {isAuthenticated === false && (
          <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl flex items-start justify-between gap-3 text-xs">
            <div className="flex items-start gap-2 text-amber-800">
              <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <span>
                You are currently in guest mode. You can fill out this form now—your draft will be preserved if you navigate to log in.
              </span>
            </div>
            <Link
              href="/login?redirect=/post-job"
              className="font-bold text-[#0D4A52] underline whitespace-nowrap hover:text-[#072F35]"
            >
              Log In
            </Link>
          </div>
        )}
      </div>

      {errorMsg && (
        <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2.5 text-xs text-red-700">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
          <span className="leading-relaxed">{errorMsg}</span>
        </div>
      )}

      {/* Main Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* 1. Category Selection */}
        <div className="space-y-2">
          <label className="block text-xs font-bold uppercase tracking-wider text-[#152220]">
            1. Select Service Category <span className="text-red-500">*</span>
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {SERVICE_CATEGORIES.map((cat) => {
              const isSelected = category === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setCategory(cat.id)}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    isSelected
                      ? 'bg-[#EBF4F3] border-[#0D4A52] ring-1 ring-[#0D4A52]'
                      : 'bg-[#FAF9F5] border-[#E5DFD2] hover:bg-white'
                  }`}
                >
                  <span className="text-xs font-bold block text-[#152220]">{cat.name}</span>
                  <span className="text-[10px] text-[#217E66] font-medium block truncate">
                    {cat.hindiName}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Benchmark Guidance Pill */}
          {currentCategoryMeta && (
            <div className="mt-2 p-2.5 rounded-lg bg-[#FAF9F5] border border-[#E5DFD2] flex items-center justify-between text-[11px] text-[#576563]">
              <span>Indicative Local Benchmark Rate:</span>
              <span className="font-bold text-[#0D4A52]">
                ₹{currentCategoryMeta.typicalBenchmarkRangeInr[0]} – ₹
                {currentCategoryMeta.typicalBenchmarkRangeInr[1]}
              </span>
            </div>
          )}
        </div>

        {/* 2. Job Title & Problem Description */}
        <div className="space-y-4">
          <label className="block text-xs font-bold uppercase tracking-wider text-[#152220]">
            2. Describe the Task <span className="text-red-500">*</span>
          </label>

          <div>
            <label className="block text-xs font-semibold text-[#152220] mb-1">
              Job Title / Brief Summary
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Bathroom tap continuous leakage and spindle repair"
              className="w-full p-3 rounded-xl border border-[#E5DFD2] text-xs text-[#152220] focus:ring-2 focus:ring-[#0D4A52] outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#152220] mb-1">
              Detailed Problem Description
            </label>
            <textarea
              required
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Please describe the issue, equipment brand/model, whether spare parts are required, and when you need it serviced..."
              className="w-full p-3 rounded-xl border border-[#E5DFD2] text-xs text-[#152220] focus:ring-2 focus:ring-[#0D4A52] outline-none resize-none"
            />
          </div>
        </div>

        {/* 3. Urgency Selection */}
        <div className="space-y-2">
          <label className="block text-xs font-bold uppercase tracking-wider text-[#152220]">
            3. Urgency Level <span className="text-red-500">*</span>
          </label>
          <div className="grid grid-cols-3 gap-3">
            {[
              { id: 'standard', label: 'Standard', sub: 'Flexible within 2-3 days' },
              { id: 'same_day', label: 'Same Day', sub: 'Required today' },
              { id: 'emergency', label: 'Emergency', sub: 'Within 1-2 hours' },
            ].map((u) => {
              const isSelected = urgency === u.id;
              return (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => setUrgency(u.id as JobUrgency)}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    isSelected
                      ? 'bg-[#EBF4F3] border-[#0D4A52] ring-1 ring-[#0D4A52]'
                      : 'bg-[#FAF9F5] border-[#E5DFD2] hover:bg-white'
                  }`}
                >
                  <span className="text-xs font-bold block text-[#152220]">{u.label}</span>
                  <span className="text-[10px] text-[#576563] block">{u.sub}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 4. Service Location */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="block text-xs font-bold uppercase tracking-wider text-[#152220]">
              4. Service Address <span className="text-red-500">*</span>
            </label>
            <button
              type="button"
              onClick={handleGetLocation}
              disabled={locating}
              className="inline-flex items-center gap-1.5 text-xs text-[#0D4A52] font-semibold hover:underline"
            >
              {locating ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Locating...</span>
                </>
              ) : (
                <>
                  <Navigation className="w-3.5 h-3.5 text-[#217E66]" />
                  <span>Use Current GPS Location</span>
                </>
              )}
            </button>
          </div>

          <div>
            <input
              type="text"
              required
              value={addressLine}
              onChange={(e) => setAddressLine(e.target.value)}
              placeholder="Flat/House No., Building Name, Street Address"
              className="w-full p-3 rounded-xl border border-[#E5DFD2] text-xs text-[#152220] focus:ring-2 focus:ring-[#0D4A52] outline-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <input
                type="text"
                value={landmark}
                onChange={(e) => setLandmark(e.target.value)}
                placeholder="Landmark (Optional)"
                className="w-full p-2.5 rounded-xl border border-[#E5DFD2] text-xs text-[#152220] focus:ring-2 focus:ring-[#0D4A52] outline-none"
              />
            </div>
            <div>
              <input
                type="text"
                required
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="City (e.g. Delhi NCR)"
                className="w-full p-2.5 rounded-xl border border-[#E5DFD2] text-xs text-[#152220] focus:ring-2 focus:ring-[#0D4A52] outline-none"
              />
            </div>
            <div>
              <input
                type="text"
                required
                maxLength={6}
                value={pincode}
                onChange={(e) => setPincode(e.target.value)}
                placeholder="6-Digit Pincode"
                className="w-full p-2.5 rounded-xl border border-[#E5DFD2] text-xs text-[#152220] focus:ring-2 focus:ring-[#0D4A52] outline-none font-medium"
              />
            </div>
          </div>

          {latitude && longitude && (
            <p className="text-[11px] text-[#217E66] flex items-center gap-1 font-medium">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>
                Coordinates locked ({latitude.toFixed(4)}, {longitude.toFixed(4)}) for PostGIS nearby worker dispatch.
              </span>
            </p>
          )}
        </div>

        {/* 5. Optional Budget & Photo Attachment */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-[#E5DFD2]">
          <div>
            <label className="block text-xs font-semibold text-[#152220] mb-1">
              Estimated Budget (₹ INR, Optional)
            </label>
            <div className="relative">
              <IndianRupee className="w-4 h-4 text-[#83928E] absolute left-3 top-3" />
              <input
                type="number"
                min={0}
                value={estimatedBudgetInr}
                onChange={(e) => setEstimatedBudgetInr(e.target.value)}
                placeholder="e.g. 500"
                className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-[#E5DFD2] text-xs text-[#152220] focus:ring-2 focus:ring-[#0D4A52] outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#152220] mb-1">
              Photo of Fault (Optional)
            </label>
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              onChange={handlePhotoSelect}
              className="hidden"
              id="job-photo-upload"
            />
            {!photoPreview ? (
              <label
                htmlFor="job-photo-upload"
                className="w-full py-2.5 px-3 rounded-xl border border-dashed border-[#E5DFD2] hover:border-[#0D4A52] bg-[#FAF9F5] text-xs text-[#576563] flex items-center justify-center gap-2 cursor-pointer transition-colors"
              >
                <Camera className="w-4 h-4 text-[#0D4A52]" />
                <span>Upload Fault Picture</span>
              </label>
            ) : (
              <div className="relative flex items-center gap-3 p-2 bg-[#FAF9F5] border border-[#E5DFD2] rounded-xl">
                <img
                  src={photoPreview}
                  alt="Fault preview"
                  className="w-10 h-10 object-cover rounded-lg"
                />
                <span className="text-[11px] text-[#152220] truncate max-w-[120px]">
                  {photoFileName}
                </span>
                <button
                  type="button"
                  onClick={handleRemovePhoto}
                  className="ml-auto p-1 rounded-full text-[#83928E] hover:text-red-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Submit Button */}
        <div className="pt-4 border-t border-[#E5DFD2]">
          <Button
            type="submit"
            variant="primary"
            size="lg"
            className="w-full justify-center gap-2"
            disabled={submitting}
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Broadcasting Job Request...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 text-emerald-300" />
                <span>Post Job &amp; Receive Worker Bids</span>
              </>
            )}
          </Button>

          <p className="text-[11px] text-center text-[#576563] mt-3">
            Protected by Sahayak Two-Stage OTP Handshake. No upfront payment required.
          </p>
        </div>
      </form>
    </div>
  );
}

export default function PostJobPage() {
  return (
    <div className="min-h-[85vh] py-12 px-4 sm:px-6 lg:px-8 bg-[#FAF9F5]">
      <Suspense fallback={<div className="text-center text-xs text-[#576563]">Loading Job Creator...</div>}>
        <PostJobForm />
      </Suspense>
    </div>
  );
}
