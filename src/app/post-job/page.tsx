'use client';

import React, { useState, useEffect, Suspense, useRef } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
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
  User,
  Compass,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import {
  SERVICE_CATEGORIES,
  OTHER_CUSTOM_CATEGORY,
} from '@/lib/config/constants';
import { ServiceCategory, JobUrgency } from '@/types/jobs';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { reverseGeocodeCoordinates } from '@/lib/utils/geocoding';

const DRAFT_STORAGE_KEY = 'sahayak_job_draft_v1';

interface DraftData {
  category: ServiceCategory;
  customCategoryName?: string;
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
  const validCategoryIds = [...SERVICE_CATEGORIES.map((c) => c.id), 'other'];

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

  const [customCategoryName, setCustomCategoryName] = useState(() => initialDraft.customCategoryName || '');

  const [title, setTitle] = useState(() => {
    const draftTitle = initialDraft.title || '';
    const isCategoryMatch =
      SERVICE_CATEGORIES.some((c) => c.name.toLowerCase() === draftTitle.toLowerCase()) ||
      draftTitle.toLowerCase() === 'plumbing';
    return isCategoryMatch ? '' : draftTitle;
  });

  const [description, setDescription] = useState(() => initialDraft.description || '');
  const [urgency, setUrgency] = useState<JobUrgency>(() => (initialDraft.urgency === 'urgent' ? 'same_day' : initialDraft.urgency) || 'standard');
  const [addressLine, setAddressLine] = useState(() => initialDraft.addressLine || '');
  const [landmark, setLandmark] = useState(() => initialDraft.landmark || '');
  const [city, setCity] = useState(() => initialDraft.city || 'Mumbai');
  const [pincode, setPincode] = useState(() => initialDraft.pincode || '400050');
  const [latitude, setLatitude] = useState<number | null>(() => initialDraft.latitude ?? null);
  const [longitude, setLongitude] = useState<number | null>(() => initialDraft.longitude ?? null);
  const [showManualCoords, setShowManualCoords] = useState(false);
  const [locationStatusMsg, setLocationStatusMsg] = useState<string | null>(null);
  const [estimatedBudgetInr, setEstimatedBudgetInr] = useState(() => initialDraft.estimatedBudgetInr || '');

  // Handler for category selection
  const handleCategorySelect = (selectedCatId: ServiceCategory) => {
    setCategory(selectedCatId);
  };

  // Handler for custom category name change
  const handleCustomCategoryNameChange = (val: string) => {
    setCustomCategoryName(val);
  };

  // Local Micro-Market Pricing Benchmark
  const [benchmark, setBenchmark] = useState<{
    min: number;
    median: number;
    max: number;
    area: string;
  } | null>(null);
  const [loadingBenchmark, setLoadingBenchmark] = useState(false);

  // Fetch neighborhood pricing benchmark when category or city changes
  useEffect(() => {
    let isCancelled = false;
    const fetchBenchmark = async () => {
      try {
        setLoadingBenchmark(true);
        const supabase = getSupabaseBrowserClient();
        if (!supabase) return;

        const effectiveCategoryQuery =
          category === 'other'
            ? 'other'
            : category.toLowerCase();

        const cityPrefix = city.split(' ')[0] || city;
        const { data: areaData } = await supabase
          .from('price_benchmarks')
          .select('min_price_inr, median_price_inr, max_price_inr, micro_market_area')
          .eq('category', effectiveCategoryQuery)
          .ilike('city', `%${cityPrefix}%`)
          .order('sample_size', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!isCancelled && areaData) {
          setBenchmark({
            min: Number(areaData.min_price_inr),
            median: Number(areaData.median_price_inr),
            max: Number(areaData.max_price_inr),
            area: areaData.micro_market_area,
          });
          return;
        }

        const { data: genData } = await supabase
          .from('price_benchmarks')
          .select('min_price_inr, median_price_inr, max_price_inr, micro_market_area')
          .eq('category', effectiveCategoryQuery)
          .order('sample_size', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!isCancelled && genData) {
          setBenchmark({
            min: Number(genData.min_price_inr),
            median: Number(genData.median_price_inr),
            max: Number(genData.max_price_inr),
            area: genData.micro_market_area,
          });
        } else if (!isCancelled) {
          setBenchmark(null);
        }
      } catch {
        if (!isCancelled) setBenchmark(null);
      } finally {
        if (!isCancelled) setLoadingBenchmark(false);
      }
    };

    fetchBenchmark();
    return () => {
      isCancelled = true;
    };
  }, [category, city]);

  // Photo Attachment
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoFileName, setPhotoFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const router = useRouter();

  // Status & Auth
  const [authState, setAuthState] = useState<'loading' | 'signed_out' | 'customer' | 'worker'>('loading');
  const [customerName, setCustomerName] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [locating, setLocating] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successJobId, setSuccessJobId] = useState<string | null>(null);
  const [createdJobData, setCreatedJobData] = useState<{
    id: string;
    title: string;
    status: string;
  } | null>(null);

  // 1. Verify user authentication & profile role
  useEffect(() => {
    let isCancelled = false;
    const supabase = getSupabaseBrowserClient();

    if (!supabase) {
      const timer = setTimeout(() => {
        if (!isCancelled) setAuthState('signed_out');
      }, 0);
      return () => {
        isCancelled = true;
        clearTimeout(timer);
      };
    }

    const checkAuth = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          if (!isCancelled) setAuthState('signed_out');
          return;
        }

        const { data: profile } = await supabase
          .from('profiles')
          .select('id, role, full_name')
          .eq('id', user.id)
          .maybeSingle();

        if (isCancelled) return;

        if (profile) {
          if (profile.role === 'worker') {
            setAuthState('worker');
          } else {
            setAuthState('customer');
            setCustomerName(profile.full_name || 'Customer');
          }
        } else {
          // If profile is not yet in public.profiles, check user metadata role
          const metadataRole = user.user_metadata?.role;
          if (metadataRole === 'worker') {
            setAuthState('worker');
          } else {
            setAuthState('customer');
            const name =
              user.user_metadata?.full_name ||
              user.user_metadata?.name ||
              user.email?.split('@')[0] ||
              'Customer';
            setCustomerName(name);

            // Client-side auto-provisioning attempt
            supabase
              .from('profiles')
              .upsert(
                {
                  id: user.id,
                  email: user.email || null,
                  phone: user.phone || `user_${user.id.replace(/-/g, '').slice(0, 10)}`,
                  full_name: name,
                  role: 'customer',
                  verification_status: 'unverified',
                  primary_city: 'Delhi NCR',
                },
                { onConflict: 'id', ignoreDuplicates: true }
              )
              .then(() => {}, () => {});
          }
        }
      } catch (err) {
        console.warn('Auth check notice:', err);
        if (!isCancelled) setAuthState('signed_out');
      }
    };

    checkAuth();

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session?.user) {
        setAuthState('signed_out');
        setCustomerName(null);
      } else {
        checkAuth();
      }
    });

    return () => {
      isCancelled = true;
      authListener.subscription.unsubscribe();
    };
  }, []);

  // 3. Save draft to localStorage on change
  useEffect(() => {
    try {
      const draft: DraftData = {
        category,
        customCategoryName,
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
    customCategoryName,
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
  const currentCategoryMeta =
    category === 'other'
      ? OTHER_CUSTOM_CATEGORY
      : SERVICE_CATEGORIES.find((c) => c.id === category);

  // GPS Location Request with human-readable address reverse geocoding
  const handleGetLocation = () => {
    if (!navigator.geolocation) {
      setErrorMsg('Geolocation is not supported by your browser. Please enter your address manually.');
      return;
    }

    setLocating(true);
    setErrorMsg(null);
    setLocationStatusMsg(null);

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setLatitude(lat);
        setLongitude(lng);

        // Perform reverse geocoding to human-readable address
        try {
          const geocoded = await reverseGeocodeCoordinates(lat, lng);
          if (geocoded) {
            if (geocoded.addressLine) setAddressLine(geocoded.addressLine);
            if (geocoded.landmark) setLandmark(geocoded.landmark);
            if (geocoded.city) setCity(geocoded.city);
            if (geocoded.pincode) setPincode(geocoded.pincode);
            setLocationStatusMsg('Address found from GPS');
          } else {
            setLocationStatusMsg('Location detected');
          }
        } catch {
          setLocationStatusMsg('Location detected');
        } finally {
          setLocating(false);
        }
      },
      (err) => {
        setLocating(false);
        setShowManualCoords(true);
        setErrorMsg(`Unable to retrieve GPS location (${err.message}). You can enter your address and coordinates manually below.`);
      },
      { timeout: 12000, enableHighAccuracy: true }
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

    // If user is guest/signed-out, redirect to login with preserved draft
    if (authState === 'signed_out') {
      try {
        const draft: DraftData = {
          category,
          customCategoryName,
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
        // Ignore localStorage error
      }
      router.push('/login?role=customer&redirect=/post-job');
      return;
    }

    // If user is logged in as a worker, block customer job creation
    if (authState === 'worker') {
      setErrorMsg(
        'Service requests can only be posted from Customer accounts. You are currently signed in as a Worker / Partner. Please switch accounts or sign out.'
      );
      return;
    }

    // Custom Category Validation
    if (category === 'other' && (!customCategoryName.trim() || customCategoryName.trim().length < 2)) {
      setErrorMsg('Please specify the custom service name (e.g. AC Repair, Pet Bathing).');
      return;
    }

    // Strict Input Validation
    if (!title.trim() || title.trim().length < 3) {
      setErrorMsg('Please provide a specific job title (at least 3 characters).');
      return;
    }

    // Description is now OPTIONAL. Only validate if user typed something but it's only whitespace
    if (description.length > 0 && description.trim().length === 0) {
      setErrorMsg('Problem description cannot be only whitespace.');
      return;
    }

    if (!addressLine.trim() || addressLine.trim().length < 3) {
      setErrorMsg('Please enter your complete street address (at least 3 characters).');
      return;
    }

    if (!city.trim()) {
      setErrorMsg('Please specify the service city.');
      return;
    }

    if (!/^\d{6}$/.test(pincode.trim())) {
      setErrorMsg('Please enter a valid 6-digit Indian postal pincode.');
      return;
    }

    // Strict validation: Do not invent coordinates or silently use fake location
    if (latitude === null || longitude === null || typeof latitude !== 'number' || typeof longitude !== 'number') {
      setShowManualCoords(true);
      setErrorMsg('Please click "Use Current GPS Location" or enter your service coordinates before submitting.');
      return;
    }

    if (latitude < 6 || latitude > 38 || longitude < 68 || longitude > 98) {
      setErrorMsg('Service location coordinates must be within valid geographic bounds for India (Lat 6-38, Lng 68-98).');
      return;
    }

    setSubmitting(true);

    try {
      const payload = {
        category,
        customCategoryName: category === 'other' ? customCategoryName.trim() : undefined,
        title: title.trim(),
        description: description.trim() || undefined,
        urgency,
        latitude,
        longitude,
        addressLine: addressLine.trim(),
        landmark: landmark.trim() || undefined,
        city: city.trim(),
        pincode: pincode.trim(),
        estimatedBudgetInr: estimatedBudgetInr ? parseFloat(estimatedBudgetInr) : undefined,
      };

      const supabaseClient = getSupabaseBrowserClient();
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (supabaseClient) {
        try {
          const { data: { session } } = await supabaseClient.auth.getSession();
          if (session?.access_token) {
            headers['Authorization'] = `Bearer ${session.access_token}`;
          }
        } catch {
          // Ignore session retrieval error and rely on cookies
        }
      }

      const res = await fetch('/api/jobs', {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 401) {
          setErrorMsg(
            'Authentication required: Please sign in as a customer to post jobs. Your draft has been safely saved.'
          );
        } else if (res.status === 403) {
          setErrorMsg(
            data.error || 'Access denied: Worker accounts cannot post customer jobs. Please switch to a customer account.'
          );
        } else {
          const detailStr =
            typeof data.details === 'string'
              ? data.details
              : data.details && typeof data.details === 'object' && 'message' in data.details
              ? (data.details as { message: string }).message
              : null;

          const baseMsg = data.error || data.message || 'Failed to create job posting. Please check your inputs.';
          const combinedMsg = detailStr && !baseMsg.includes(detailStr)
            ? `${baseMsg} (${detailStr})`
            : baseMsg;

          setErrorMsg(combinedMsg);
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

      // Direct navigation to nearby worker discovery page
      if (created?.id) {
        router.push(`/jobs/${created.id}`);
        return;
      }
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
            Verified local tradesmen in your area are being notified. Discover nearby pros or review bids in your dashboard.
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
          <Link href={`/jobs/${createdJobData.id}`} className="w-full">
            <Button variant="primary" className="w-full gap-1.5">
              <Compass className="w-4 h-4" />
              <span>Explore Matching Workers &amp; Dispatch</span>
            </Button>
          </Link>
          <Link href="/dashboard" className="w-full">
            <Button variant="secondary" className="w-full gap-1.5">
              <Briefcase className="w-4 h-4" />
              <span>Track in My Jobs Dashboard</span>
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto bg-white/95 backdrop-blur-md rounded-2xl border border-[#E5DFD2] p-6 sm:p-10 shadow-xl space-y-8">
      {/* Header */}
      <div className="space-y-4 border-b border-[#E5DFD2] pb-6">
        <div className="flex items-center justify-between gap-4">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#576563] hover:text-[#0D4A52] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back</span>
          </Link>

          {authState === 'customer' && customerName && (
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#EDF7F4] border border-[#BCE5DA] text-xs font-semibold text-[#0D4A52] shadow-2xs">
              <User className="w-3.5 h-3.5 text-[#217E66]" />
              <span>{customerName}</span>
            </div>
          )}
        </div>

        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#152220] tracking-tight">
            Create a Service Request
          </h1>
        </div>

        {/* Role & Auth Status Banners */}
        {authState === 'loading' && (
          <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl flex items-center gap-2.5 text-xs text-[#576563]">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-[#0D4A52]" />
            <span>Verifying customer account session...</span>
          </div>
        )}

        {authState === 'signed_out' && (
          <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl flex items-start justify-between gap-3 text-xs">
            <div className="flex items-start gap-2 text-amber-800">
              <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <span>
                You are currently in guest mode. You can fill out this request now—your draft will be preserved when you sign in.
              </span>
            </div>
            <Link
              href="/login?role=customer&redirect=/post-job"
              className="font-bold text-[#0D4A52] underline whitespace-nowrap hover:text-[#072F35]"
            >
              Log In as Customer
            </Link>
          </div>
        )}

        {authState === 'worker' && (
          <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl flex items-start justify-between gap-3 text-xs">
            <div className="flex items-start gap-2 text-red-800">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <span>
                <strong>Worker Account Detected:</strong> Job posting is reserved for household customers. Workers browse and bid via the Partner Marketplace.
              </span>
            </div>
            <Link
              href="/dashboard?role=worker"
              className="font-bold text-red-700 underline whitespace-nowrap hover:text-red-900"
            >
              Go to Marketplace
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
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 gap-2.5">
            {SERVICE_CATEGORIES.map((cat) => {
              const isSelected = category === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => handleCategorySelect(cat.id)}
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

            {/* Other / Custom Service Button */}
            <button
              type="button"
              onClick={() => handleCategorySelect('other')}
              className={`p-3 rounded-xl border text-left transition-all ${
                category === 'other'
                  ? 'bg-[#EBF4F3] border-[#0D4A52] ring-1 ring-[#0D4A52]'
                  : 'bg-[#FAF9F5] border-[#E5DFD2] hover:bg-white'
              }`}
            >
              <span className="text-xs font-bold block text-[#152220]">{OTHER_CUSTOM_CATEGORY.name}</span>
              <span className="text-[10px] text-[#217E66] font-medium block truncate">
                {OTHER_CUSTOM_CATEGORY.hindiName}
              </span>
            </button>
          </div>

          {/* Custom Service Input Field when 'other' is selected */}
          {category === 'other' && (
            <div className="p-3.5 bg-[#FAF9F5] border border-[#BCE5DA] rounded-xl space-y-2 animate-in fade-in">
              <label className="block text-xs font-semibold text-[#152220]">
                Specify Unlisted / Custom Service <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={customCategoryName}
                onChange={(e) => handleCustomCategoryNameChange(e.target.value)}
                placeholder="e.g. AC Installation, Pet Bathing, Pest Control, Curtain Fitting"
                className="w-full p-2.5 rounded-lg border border-[#E5DFD2] text-xs text-[#152220] focus:ring-2 focus:ring-[#0D4A52] outline-none bg-white"
              />
              <p className="text-[11px] text-[#576563]">
                Your custom service title will be shown to nearby skilled professionals who offer general or specialized assistance.
              </p>
            </div>
          )}

        </div>

        {/* 2. Job Title & Fault Photo Side-by-Side */}
        <div className="space-y-4">
          <label className="block text-xs font-bold uppercase tracking-wider text-[#152220]">
            2. Describe the Task <span className="text-red-500">*</span>
          </label>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
            {/* Left side: Job Title / Brief Summary */}
            <div>
              <label className="block text-xs font-semibold text-[#152220] mb-1">
                Job Title / Brief Summary <span className="text-red-500">*</span>
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

            {/* Right side: Photo of Fault (Optional) */}
            <div>
              <label className="block text-xs font-semibold text-[#152220] mb-1">
                Photo of Fault <span className="text-[#83928E] font-normal">(Optional)</span>
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
                  className="w-full h-[42px] px-3 rounded-xl border border-dashed border-[#E5DFD2] hover:border-[#0D4A52] bg-[#FAF9F5] text-xs text-[#576563] flex items-center justify-center gap-2 cursor-pointer transition-colors"
                >
                  <Camera className="w-4 h-4 text-[#0D4A52]" />
                  <span>Upload Fault Picture</span>
                </label>
              ) : (
                <div className="relative flex items-center gap-2.5 h-[42px] px-2.5 bg-[#FAF9F5] border border-[#E5DFD2] rounded-xl">
                  <img
                    src={photoPreview}
                    alt="Fault preview"
                    className="w-7 h-7 object-cover rounded-lg shrink-0"
                  />
                  <span className="text-[11px] text-[#152220] truncate flex-1">
                    {photoFileName}
                  </span>
                  <button
                    type="button"
                    onClick={handleRemovePhoto}
                    className="p-1 rounded-full text-[#83928E] hover:text-red-600 transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#152220] mb-1">
              Detailed Problem Description <span className="text-[#83928E] font-normal">(Optional)</span>
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional: Provide extra context, brand/model, specific requirements, or preferred timing..."
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
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#EBF4F3] border border-[#BCE5DA] text-xs text-[#0D4A52] font-semibold hover:bg-[#D8ECE8] transition-colors"
            >
              {locating ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-[#0D4A52]" />
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
        </div>

        {/* 5. Optional Budget */}
        <div className="pt-2 border-t border-[#E5DFD2]">
          <div className="max-w-md">
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
            {benchmark && (
              <div className="mt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setEstimatedBudgetInr(benchmark.median.toString())}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#EDF7F4] border border-[#BCE5DA] text-xs font-semibold text-[#0D4A52] hover:bg-[#D8ECE8] transition-colors"
                >
                  <Sparkles className="w-3.5 h-3.5 text-[#217E66]" />
                  <span>Fair Price: ₹{benchmark.median}</span>
                  {!estimatedBudgetInr && (
                    <span className="text-[11px] text-[#217E66] font-normal underline ml-1">
                      (Use ₹{benchmark.median})
                    </span>
                  )}
                </button>
              </div>
            )}
            {loadingBenchmark && (
              <p className="text-[10px] text-[#83928E] mt-1 flex items-center gap-1">
                <Loader2 className="w-3 h-3 animate-spin" />
                <span>Checking local price benchmarks...</span>
              </p>
            )}
          </div>
        </div>

        {/* Submit Button & Inline Feedback */}
        <div className="pt-4 border-t border-[#E5DFD2] space-y-3">
          {/* Dual error display right above submit button so users never miss validation feedback */}
          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2 text-xs text-red-700 animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <span className="leading-relaxed">{errorMsg}</span>
            </div>
          )}

          {authState === 'signed_out' ? (
            <Button
              type="button"
              variant="primary"
              size="lg"
              className="w-full justify-center gap-2"
              onClick={() => {
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
                  // Ignore localStorage error
                }
                router.push('/login?role=customer&redirect=/post-job');
              }}
            >
              <User className="w-4 h-4" />
              <span>Sign In as Customer to Post Job</span>
            </Button>
          ) : authState === 'worker' ? (
            <div className="space-y-2">
              <Button
                type="button"
                variant="secondary"
                size="lg"
                disabled
                className="w-full justify-center gap-2 opacity-60 cursor-not-allowed"
              >
                <span>Job Posting Disabled for Worker Accounts</span>
              </Button>
              <p className="text-[11px] text-center text-red-700">
                You are signed in with a Worker account. Service requests must be created from a Customer account.
              </p>
            </div>
          ) : (
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
                  <span>Broadcasting Job Request &amp; Finding Pros...</span>
                </>
              ) : (
                <>
                  <span>Post Job &amp; Receive Worker Bids</span>
                </>
              )}
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}

export default function PostJobPage() {
  return (
    <div className="min-h-[85vh] py-12 px-4 sm:px-6 lg:px-8 bg-transparent">
      <Suspense fallback={<div className="text-center text-xs text-[#576563]">Loading Job Creator...</div>}>
        <PostJobForm />
      </Suspense>
    </div>
  );
}
