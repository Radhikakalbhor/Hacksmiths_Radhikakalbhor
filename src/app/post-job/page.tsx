'use client';

import React, { useState, useEffect, Suspense, useRef } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  ArrowRight,
  Sparkles,
  IndianRupee,
  Camera,
  X,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Navigation,
  Info,
  User,
  Calendar,
  Clock,
  Zap,
  ChevronDown,
  ChevronUp,
  ShieldAlert,
  Calculator,
  Check,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import {
  SERVICE_CATEGORIES,
  OTHER_CUSTOM_CATEGORY,
} from '@/lib/config/constants';
import { ServiceCategory, JobUrgency } from '@/types/jobs';
import { PricingService, FairPricingEngineResult } from '@/lib/services/pricing.service';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { reverseGeocodeCoordinates } from '@/lib/utils/geocoding';
import { CustomerProfileModal } from '@/components/profile/CustomerProfileModal';
import {
  getKolkataNow,
  formatScheduledDisplay,
  getStandardDateOptions,
  getStandardTimeOptions,
  getSameDayTimeOptions,
  getEmergencyTimeOptions,
  getEmergencyArrivalWindow,
  TimeOption,
} from '@/lib/utils/scheduling';

const DRAFT_STORAGE_KEY = 'sahayak_job_draft_v1';

interface DraftData {
  category: ServiceCategory;
  customCategoryName?: string;
  title: string;
  description: string;
  urgency: JobUrgency;
  scheduledDate?: string;
  scheduledTimeSlot?: string;
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
    if (draftTitle) return draftTitle;
    if (urlCategory) {
      const match = SERVICE_CATEGORIES.find((c) => c.id === urlCategory);
      if (match) return match.name;
    }
    return '';
  });

  const [description, setDescription] = useState(() => initialDraft.description || '');
  const [urgency, setUrgency] = useState<JobUrgency>(() => (initialDraft.urgency === 'urgent' ? 'same_day' : initialDraft.urgency) || 'standard');

  const emergencyWindow = React.useMemo(() => getEmergencyArrivalWindow(), []);

  // Date and Time selection state
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    if (initialDraft.scheduledDate) return initialDraft.scheduledDate;
    const now = getKolkataNow();
    const effectiveUrgency = (initialDraft.urgency === 'urgent' ? 'same_day' : initialDraft.urgency) || 'standard';
    if (effectiveUrgency === 'same_day' || effectiveUrgency === 'emergency') {
      return now.dateStr;
    }
    const standardDates = getStandardDateOptions(3);
    return standardDates[0]?.dateStr || now.dateStr;
  });

  const [selectedTime, setSelectedTime] = useState<string>(() => {
    if (initialDraft.scheduledTimeSlot) return initialDraft.scheduledTimeSlot;
    const effectiveUrgency = (initialDraft.urgency === 'urgent' ? 'same_day' : initialDraft.urgency) || 'standard';
    if (effectiveUrgency === 'emergency') {
      const emergencyWin = getEmergencyArrivalWindow();
      return emergencyWin.slotValue;
    }
    if (effectiveUrgency === 'same_day') {
      const sameDayOpts = getSameDayTimeOptions();
      return sameDayOpts[0]?.value || '';
    }
    return '10:00 AM';
  });

  // Urgency change handler that dynamically configures date and time
  const handleUrgencyChange = (newUrgency: JobUrgency) => {
    setUrgency(newUrgency);
    const now = getKolkataNow();

    if (newUrgency === 'same_day') {
      setSelectedDate(now.dateStr);
      const sameDayOpts = getSameDayTimeOptions();
      const stillValid = sameDayOpts.some((opt) => opt.value === selectedTime);
      if (!stillValid) {
        setSelectedTime(sameDayOpts[0]?.value || '');
      }
    } else if (newUrgency === 'emergency') {
      setSelectedDate(now.dateStr);
      const emergencyWin = getEmergencyArrivalWindow();
      setSelectedTime(emergencyWin.slotValue);
      setIsTimeModalOpen(false);
    } else {
      const standardDates = getStandardDateOptions(3);
      const isDateValidStandard = standardDates.some((d) => d.dateStr === selectedDate);
      if (!isDateValidStandard) {
        setSelectedDate(standardDates[0]?.dateStr || now.dateStr);
      }
      const standardTimes = getStandardTimeOptions();
      const isTimeValid = standardTimes.some((t) => t.value === selectedTime);
      if (!isTimeValid) {
        setSelectedTime(standardTimes[1]?.value || standardTimes[0]?.value || '10:00 AM');
      }
    }
  };

  const standardDateOptions = React.useMemo(() => getStandardDateOptions(3), []);

  const availableTimeOptions: TimeOption[] = React.useMemo(() => {
    if (urgency === 'emergency') {
      return getEmergencyTimeOptions();
    }
    if (urgency === 'same_day') {
      return getSameDayTimeOptions();
    }
    return getStandardTimeOptions();
  }, [urgency, selectedDate]);

  const [addressLine, setAddressLine] = useState(() => initialDraft.addressLine || '');
  const [landmark, setLandmark] = useState(() => initialDraft.landmark || '');
  const [city, setCity] = useState(() => initialDraft.city || 'Mumbai');
  const [pincode, setPincode] = useState(() => initialDraft.pincode || '400050');
  const [latitude, setLatitude] = useState<number | null>(() => initialDraft.latitude ?? null);
  const [longitude, setLongitude] = useState<number | null>(() => initialDraft.longitude ?? null);
  const [showManualCoords, setShowManualCoords] = useState(false);
  const [locationStatusMsg, setLocationStatusMsg] = useState<string | null>(null);
  const [estimatedBudgetInr, setEstimatedBudgetInr] = useState(() => initialDraft.estimatedBudgetInr || '');

  // Handler for category selection - automatically syncs with job title
  const handleCategorySelect = (selectedCatId: ServiceCategory) => {
    setCategory(selectedCatId);
    if (selectedCatId === 'other') {
      setTitle(customCategoryName.trim());
    } else {
      const selectedCat = SERVICE_CATEGORIES.find((c) => c.id === selectedCatId);
      if (selectedCat) {
        setTitle(selectedCat.name);
      }
    }
  };

  // Handler for custom category name change
  const handleCustomCategoryNameChange = (val: string) => {
    setCustomCategoryName(val);
    if (category === 'other') {
      setTitle(val);
    }
  };

  // Centralized Fair Pricing Engine State
  const [pricingEstimate, setPricingEstimate] = useState<FairPricingEngineResult>(() => {
    return PricingService.calculateFairPriceRange({
      category,
      title: initialDraft.title || '',
      description: initialDraft.description || '',
      urgency,
      userBudget: initialDraft.estimatedBudgetInr ? parseFloat(initialDraft.estimatedBudgetInr) : null,
      city,
    });
  });
  const [loadingEstimate, setLoadingEstimate] = useState(false);
  const [showPricingBreakdown, setShowPricingBreakdown] = useState(false);

  // Instant local rule-based price calculation + debounced server-side AI enrichment
  useEffect(() => {
    const userBudgetNum = estimatedBudgetInr ? parseFloat(estimatedBudgetInr) : null;

    // 1. Instant 0ms local calculation: Rule-based engine calculates transparent price immediately
    const instantResult = PricingService.calculateFairPriceRange({
      category,
      title,
      description,
      urgency,
      userBudget: userBudgetNum,
      city,
    });
    setPricingEstimate(instantResult);

    // 2. Debounced server-side call for optional AI understanding & complexity assessment
    if (!title.trim() && !description.trim()) return;

    let isCancelled = false;
    const timer = setTimeout(async () => {
      try {
        setLoadingEstimate(true);
        const res = await fetch('/api/pricing/estimate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            category,
            title,
            description,
            urgency,
            userBudget: userBudgetNum,
            city,
          }),
        });

        if (!res.ok) return;
        const data = await res.json();
        if (!isCancelled && data.success && data.data) {
          setPricingEstimate(data.data);
        }
      } catch {
        // Fallback remains completely seamless via local calculation
      } finally {
        if (!isCancelled) setLoadingEstimate(false);
      }
    }, 600);

    return () => {
      isCancelled = true;
      clearTimeout(timer);
    };
  }, [category, title, description, urgency, estimatedBudgetInr, city]);

  // Photo Attachment
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoFileName, setPhotoFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const router = useRouter();

  // Status & Auth
  const [authState, setAuthState] = useState<'loading' | 'signed_out' | 'customer' | 'worker'>('loading');
  const [customerName, setCustomerName] = useState<string | null>(null);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [locating, setLocating] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

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
        const res = await fetch('/api/auth/me');
        const json = await res.json();
        if (isCancelled) return;

        if (!json.success || !json.data?.authenticated || !json.data?.user) {
          setAuthState('signed_out');
          return;
        }

        const role = json.data.role;
        if (role === 'worker' || role === 'admin') {
          // Workers and admins must NEVER access customer job posting
          setAuthState('worker');
          router.replace('/worker/dashboard');
          return;
        }

        setAuthState('customer');
        setCustomerName(json.data.user.fullName || 'Customer');
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
        scheduledDate: selectedDate,
        scheduledTimeSlot: selectedTime,
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
    selectedDate,
    selectedTime,
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

  // Multi-step 4-Card Wizard State & Navigation
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [direction, setDirection] = useState<number>(1);
  const [isTimeModalOpen, setIsTimeModalOpen] = useState<boolean>(false);
  const [isDateModalOpen, setIsDateModalOpen] = useState<boolean>(false);
  const [mounted, setMounted] = useState<boolean>(false);
  const cardTopRef = useRef<HTMLDivElement>(null);
  const progressPercent = currentStep === 1 ? 25 : currentStep === 2 ? 50 : currentStep === 3 ? 75 : 100;

  useEffect(() => {
    setMounted(true);
  }, []);

  // Prevent background body scroll when modal is open and mark modal active
  useEffect(() => {
    if (isTimeModalOpen || isDateModalOpen) {
      document.body.style.overflow = 'hidden';
      document.body.classList.add('modal-open');
    } else {
      document.body.style.overflow = '';
      document.body.classList.remove('modal-open');
    }
    return () => {
      document.body.style.overflow = '';
      document.body.classList.remove('modal-open');
    };
  }, [isTimeModalOpen, isDateModalOpen]);

  // Escape key closes modals
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isTimeModalOpen) setIsTimeModalOpen(false);
        if (isDateModalOpen) setIsDateModalOpen(false);
      }
    };
    if (isTimeModalOpen || isDateModalOpen) {
      window.addEventListener('keydown', handleKey);
    }
    return () => window.removeEventListener('keydown', handleKey);
  }, [isTimeModalOpen, isDateModalOpen]);

  const validateStep = (step: number): boolean => {
    setErrorMsg(null);
    if (step === 1) {
      if (category === 'other' && (!customCategoryName.trim() || customCategoryName.trim().length < 2)) {
        setErrorMsg('Please specify the custom service name (e.g. AC Repair, Pet Bathing).');
        return false;
      }
      return true;
    }
    if (step === 2) {
      if (!title.trim() || title.trim().length < 3) {
        setErrorMsg('Please provide a specific job title (at least 3 characters).');
        return false;
      }
      if (description.length > 0 && description.trim().length === 0) {
        setErrorMsg('Problem description cannot be only whitespace.');
        return false;
      }
      return true;
    }
    if (step === 3) {
      if (!selectedDate) {
        setErrorMsg('Please select your preferred service date.');
        return false;
      }
      if (!selectedTime) {
        setErrorMsg('Please select your preferred individual service start time.');
        return false;
      }
      return true;
    }
    return true;
  };

  const handleNextStep = () => {
    if (validateStep(currentStep)) {
      setErrorMsg(null);
      setDirection(1);
      setCurrentStep((prev) => {
        const next = Math.min(prev + 1, 4);
        cardTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return next;
      });
    }
  };

  const handlePrevStep = () => {
    setErrorMsg(null);
    setDirection(-1);
    setCurrentStep((prev) => {
      const prevStep = Math.max(prev - 1, 1);
      cardTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return prevStep;
    });
  };

  const handleJumpToStep = (targetStep: number) => {
    if (targetStep < currentStep) {
      setErrorMsg(null);
      setDirection(-1);
      setCurrentStep(targetStep);
      cardTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else if (targetStep === currentStep + 1) {
      handleNextStep();
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
          scheduledDate: selectedDate,
          scheduledTimeSlot: selectedTime,
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

    // Step 1: Custom Category Validation
    if (category === 'other' && (!customCategoryName.trim() || customCategoryName.trim().length < 2)) {
      setCurrentStep(1);
      setErrorMsg('Please specify the custom service name (e.g. AC Repair, Pet Bathing).');
      return;
    }

    // Step 2: Title & Description Validation
    if (!title.trim() || title.trim().length < 3) {
      setCurrentStep(2);
      setErrorMsg('Please provide a specific job title (at least 3 characters).');
      return;
    }

    if (description.length > 0 && description.trim().length === 0) {
      setCurrentStep(2);
      setErrorMsg('Problem description cannot be only whitespace.');
      return;
    }

    // Step 3: Date & Time selection validation
    if (!selectedDate) {
      setCurrentStep(3);
      setErrorMsg('Please select your preferred service date.');
      return;
    }

    if (!selectedTime) {
      setCurrentStep(3);
      setErrorMsg('Please select your preferred individual service start time.');
      return;
    }

    // Step 4: Address & Coordinate Validation
    if (!addressLine.trim() || addressLine.trim().length < 3) {
      setCurrentStep(4);
      setErrorMsg('Please enter your complete street address (at least 3 characters).');
      return;
    }

    if (!city.trim()) {
      setCurrentStep(4);
      setErrorMsg('Please specify the service city.');
      return;
    }

    if (!/^\d{6}$/.test(pincode.trim())) {
      setCurrentStep(4);
      setErrorMsg('Please enter a valid 6-digit Indian postal pincode.');
      return;
    }

    // Strict validation: Do not invent coordinates or silently use fake location
    if (latitude === null || longitude === null || typeof latitude !== 'number' || typeof longitude !== 'number') {
      setCurrentStep(4);
      setShowManualCoords(true);
      setErrorMsg('Please click "Use Current GPS Location" or enter your service coordinates before submitting.');
      return;
    }

    if (latitude < 6 || latitude > 38 || longitude < 68 || longitude > 98) {
      setCurrentStep(4);
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
        scheduledDate: selectedDate,
        scheduledTimeSlot: selectedTime,
        latitude,
        longitude,
        addressLine: addressLine.trim(),
        landmark: landmark.trim() || undefined,
        city: city.trim(),
        pincode: pincode.trim(),
        estimatedBudgetInr: estimatedBudgetInr ? parseFloat(estimatedBudgetInr) : undefined,
        estimatedMinPriceInr: pricingEstimate?.recommendedMinInr,
        estimatedMaxPriceInr: pricingEstimate?.recommendedMaxInr,
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

      // Direct navigation to nearby worker discovery page (skip intermediate broadcast card)
      if (created?.id) {
        router.push(`/jobs/${created.id}`);
        return;
      } else {
        router.push('/bookings');
        return;
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Network error while creating job.');
    } finally {
      setSubmitting(false);
    }
  };

  const cardAnimationVariants = {
    enter: (dir: number) => ({
      x: dir > 0 ? 20 : -20,
      opacity: 0,
    }),
    center: {
      x: 0,
      opacity: 1,
      transition: { duration: 0.22, ease: 'easeOut' as const },
    },
    exit: (dir: number) => ({
      x: dir > 0 ? -20 : 20,
      opacity: 0,
      transition: { duration: 0.16, ease: 'easeIn' as const },
    }),
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && currentStep < 4 && (e.target as HTMLElement).tagName !== 'TEXTAREA') {
      e.preventDefault();
      handleNextStep();
    }
  };

  return (
    <div ref={cardTopRef} className="max-w-3xl mx-auto bg-white/95 backdrop-blur-md rounded-2xl border border-[#E5DFD2] p-6 sm:p-10 shadow-xl space-y-7">
      {/* Header */}
      <div className="space-y-4 border-b border-[#E5DFD2] pb-6">
        <div className="flex items-center justify-between gap-4">
          {currentStep > 1 ? (
            <button
              type="button"
              onClick={handlePrevStep}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#576563] hover:text-[#0D4A52] transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Step {currentStep - 1}</span>
            </button>
          ) : (
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#576563] hover:text-[#0D4A52] transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back</span>
            </Link>
          )}

          {authState === 'customer' && customerName && (
            <button
              type="button"
              onClick={() => setIsProfileOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#EDF7F4] border border-[#BCE5DA] text-xs font-semibold text-[#0D4A52] shadow-2xs hover:bg-[#D5EFE8] transition-colors cursor-pointer"
              title="Click to view & edit your profile"
            >
              <User className="w-3.5 h-3.5 text-[#217E66]" />
              <span>{customerName}</span>
            </button>
          )}
        </div>

        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#152220] tracking-tight mb-4">
            Create a Service Request
          </h1>

          {/* Full-Width Thin Progress Bar */}
          <div className="w-full h-2 bg-[#EBF4F3] border border-[#BCE5DA]/70 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-[#0D4A52] via-[#16605B] to-[#217E66] rounded-full"
              initial={false}
              animate={{ width: `${progressPercent}%` }}
              transition={{ duration: 0.45, ease: 'easeOut' }}
            />
          </div>
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

      {/* Main Form divided into 4 sequential cards */}
      <form onSubmit={handleSubmit} onKeyDown={handleKeyDown} className="space-y-6">
        <AnimatePresence mode="wait" custom={direction}>
          {/* CARD 1: Service Category Selection */}
          {currentStep === 1 && (
            <motion.div
              key="step-1"
              custom={direction}
              variants={cardAnimationVariants}
              initial="enter"
              animate="center"
              exit="exit"
              className="space-y-6"
            >
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

              {/* Navigation for Card 1 */}
              <div className="pt-4 border-t border-[#E5DFD2] flex items-center justify-between">
                <span className="text-xs text-[#576563]">
                  Selected: <strong className="text-[#0D4A52] capitalize">{category === 'other' ? (customCategoryName || 'Custom Service') : category}</strong>
                </span>
                <Button
                  type="button"
                  variant="primary"
                  size="md"
                  onClick={handleNextStep}
                  className="gap-1.5 min-w-[120px] justify-center"
                >
                  <span>Next</span>
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
            </motion.div>
          )}

          {/* CARD 2: Task Description & Media */}
          {currentStep === 2 && (
            <motion.div
              key="step-2"
              custom={direction}
              variants={cardAnimationVariants}
              initial="enter"
              animate="center"
              exit="exit"
              className="space-y-6"
            >
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
                          className="p-1 rounded-full text-[#83928E] hover:text-red-600 transition-colors cursor-pointer"
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

              {/* Navigation for Card 2 */}
              <div className="pt-4 border-t border-[#E5DFD2] flex items-center justify-between">
                <Button
                  type="button"
                  variant="secondary"
                  size="md"
                  onClick={handlePrevStep}
                  className="gap-1.5 min-w-[110px] justify-center"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Previous</span>
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  size="md"
                  onClick={handleNextStep}
                  className="gap-1.5 min-w-[120px] justify-center"
                >
                  <span>Next</span>
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
            </motion.div>
          )}

          {/* CARD 3: Urgency Level & Scheduling */}
          {currentStep === 3 && (
            <motion.div
              key="step-3"
              custom={direction}
              variants={cardAnimationVariants}
              initial="enter"
              animate="center"
              exit="exit"
              className="space-y-6"
            >
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
                        onClick={() => handleUrgencyChange(u.id as JobUrgency)}
                        className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
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

              {/* 4. Preferred Service Date & Time (Dynamic based on Urgency) */}
              <div className="space-y-3.5 p-4 bg-[#FAF9F5] border border-[#E5DFD2] rounded-2xl animate-in fade-in">
                <div className="flex items-center justify-between gap-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-[#152220] flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-[#0D4A52]" />
                    <span>4. Preferred Service Date &amp; Time</span>
                    <span className="text-red-500">*</span>
                  </label>
                </div>

                {/* 2 Small Boxes Side-by-Side: Left = Date & Day, Right = Timing */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Left Box: Service Date & Day */}
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      if (urgency === 'standard') {
                        setIsDateModalOpen(true);
                      }
                    }}
                    onKeyDown={(e) => {
                      if ((e.key === 'Enter' || e.key === ' ') && urgency === 'standard') {
                        e.preventDefault();
                        setIsDateModalOpen(true);
                      }
                    }}
                    className={`p-3 bg-white border border-[#E5DFD2] rounded-xl flex items-center justify-between gap-2.5 shadow-2xs transition-all select-none ${
                      urgency === 'standard'
                        ? 'hover:bg-[#FAF9F5] hover:border-[#0D4A52]/40 cursor-pointer group'
                        : 'cursor-default'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-[#EBF4F3] flex items-center justify-center text-[#0D4A52] group-hover:bg-[#D5EFE8] transition-colors shrink-0">
                        <Calendar className="w-4 h-4 text-[#0D4A52]" />
                      </div>
                      <div className="min-w-0">
                        <span className="text-xs font-bold text-[#152220] block group-hover:text-[#0D4A52] transition-colors truncate">
                          Service Date &amp; Day
                        </span>
                        <span className="text-[10px] text-[#576563] block truncate">
                          Select date and day
                        </span>
                      </div>
                    </div>

                    <div className="px-3 py-1.5 bg-[#0D4A52] group-hover:bg-[#09353B] text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-2xs shrink-0">
                      <Calendar className="w-3.5 h-3.5 text-white/80" />
                      <span>
                        {urgency === 'standard'
                          ? standardDateOptions.find((o) => o.dateStr === selectedDate)?.sub || selectedDate
                          : 'Today'}
                      </span>
                      {urgency === 'standard' && <ChevronDown className="w-3.5 h-3.5 text-white/80" />}
                    </div>
                  </div>

                  {/* Right Box: Timing */}
                  {urgency === 'emergency' ? (
                    <div className="p-3 bg-[#EDF7F4] border border-[#BCE5DA] rounded-xl flex items-center justify-between gap-2.5 shadow-2xs">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center text-[#217E66] shadow-2xs shrink-0">
                          <Zap className="w-4 h-4 fill-[#217E66]" />
                        </div>
                        <div className="min-w-0">
                          <span className="text-xs font-bold text-[#152220] block truncate">
                            Immediate Dispatch
                          </span>
                          <span className="text-[10px] text-[#0D4A52] font-semibold block truncate">
                            Arrival: {emergencyWindow.displayWindow}
                          </span>
                        </div>
                      </div>
                      <span className="text-[10px] font-bold text-[#217E66] bg-white border border-[#BCE5DA] px-2.5 py-1 rounded-full whitespace-nowrap shadow-2xs shrink-0">
                        1–2 hrs
                      </span>
                    </div>
                  ) : (
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => setIsTimeModalOpen(true)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setIsTimeModalOpen(true);
                        }
                      }}
                      className="p-3 bg-white hover:bg-[#FAF9F5] border border-[#E5DFD2] hover:border-[#0D4A52]/40 rounded-xl flex items-center justify-between gap-2.5 shadow-2xs transition-all cursor-pointer group select-none"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-[#EBF4F3] flex items-center justify-center text-[#0D4A52] group-hover:bg-[#D5EFE8] transition-colors shrink-0">
                          <Clock className="w-4 h-4 text-[#0D4A52]" />
                        </div>
                        <div className="min-w-0">
                          <span className="text-xs font-bold text-[#152220] block group-hover:text-[#0D4A52] transition-colors truncate">
                            Preferred Service Time
                          </span>
                          <span className="text-[10px] text-[#576563] block truncate">
                            Select arrival time
                          </span>
                        </div>
                      </div>

                      <div className="px-3.5 py-1.5 bg-[#0D4A52] group-hover:bg-[#09353B] text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-2xs shrink-0">
                        <Clock className="w-3.5 h-3.5 text-white/80" />
                        <span>{selectedTime || 'Select Time'}</span>
                        <ChevronDown className="w-3.5 h-3.5 text-white/80" />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Standalone Scheduled Preference Card (Separate card below the inner card, within Card 3) */}
              <div className="p-3.5 bg-white border border-[#E5DFD2] rounded-2xl flex items-center justify-between text-xs sm:text-sm shadow-2xs">
                <span className="text-[#576563] font-medium">Scheduled Preference:</span>
                <span className="font-semibold text-[#0D4A52]">
                  {urgency === 'emergency'
                    ? `Today between ${emergencyWindow.displayWindow} (Priority Emergency Dispatch)`
                    : formatScheduledDisplay(selectedDate, selectedTime)}
                </span>
              </div>

              {/* Navigation for Card 3 */}
              <div className="pt-4 border-t border-[#E5DFD2] flex items-center justify-between">
                <Button
                  type="button"
                  variant="secondary"
                  size="md"
                  onClick={handlePrevStep}
                  className="gap-1.5 min-w-[110px] justify-center"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Previous</span>
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  size="md"
                  onClick={handleNextStep}
                  className="gap-1.5 min-w-[120px] justify-center"
                >
                  <span>Next</span>
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
            </motion.div>
          )}

          {/* CARD 4: Service Address & Budget */}
          {currentStep === 4 && (
            <motion.div
              key="step-4"
              custom={direction}
              variants={cardAnimationVariants}
              initial="enter"
              animate="center"
              exit="exit"
              className="space-y-6"
            >
              {/* 5. Service Location */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#152220]">
                    5. Service Address <span className="text-red-500">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={handleGetLocation}
                    disabled={locating}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#EBF4F3] border border-[#BCE5DA] text-xs text-[#0D4A52] font-semibold hover:bg-[#D8ECE8] transition-colors cursor-pointer"
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

                {/* Door Details (Box 1) */}
                <div className="space-y-1.5">
                  <input
                    type="text"
                    required
                    value={addressLine}
                    onChange={(e) => setAddressLine(e.target.value)}
                    placeholder="Flat / House / Office No., Floor, Building / Apartment Name"
                    className="w-full p-2.5 sm:p-3 rounded-xl border border-[#E5DFD2] text-xs text-[#152220] focus:ring-2 focus:ring-[#0D4A52] outline-none font-medium bg-white"
                  />
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-[#576563] pl-1">
                    <span>• Flat / House / Office Number</span>
                    <span>• Floor Number</span>
                    <span>• Wing / Block / Tower Name</span>
                    <span>• Building / Apartment Name</span>
                  </div>
                </div>

                {/* Sub-details (Boxes 2, 3, 4) */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 pt-1">
                  {/* Local Area Details */}
                  <div className="space-y-1.5">
                    <input
                      type="text"
                      value={landmark}
                      onChange={(e) => setLandmark(e.target.value)}
                      placeholder="Road Name, Street, Area"
                      className="w-full p-2.5 rounded-xl border border-[#E5DFD2] text-xs text-[#152220] focus:ring-2 focus:ring-[#0D4A52] outline-none font-medium bg-white"
                    />
                    <div className="space-y-0.5 text-[10px] text-[#576563] pl-1">
                      <div>• Road Name / Street / Lane</div>
                      <div>• Area / Sector Name</div>
                    </div>
                  </div>

                  {/* Region & City Details */}
                  <div className="space-y-1.5">
                    <input
                      type="text"
                      required
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder="City, District, State"
                      className="w-full p-2.5 rounded-xl border border-[#E5DFD2] text-xs text-[#152220] focus:ring-2 focus:ring-[#0D4A52] outline-none font-medium bg-white"
                    />
                    <div className="space-y-0.5 text-[10px] text-[#576563] pl-1">
                      <div>• City / District / State</div>
                    </div>
                  </div>

                  {/* Postal Routing */}
                  <div className="space-y-1.5">
                    <input
                      type="text"
                      required
                      maxLength={6}
                      value={pincode}
                      onChange={(e) => setPincode(e.target.value)}
                      placeholder="PIN Code / Postal Code"
                      className="w-full p-2.5 rounded-xl border border-[#E5DFD2] text-xs text-[#152220] focus:ring-2 focus:ring-[#0D4A52] outline-none font-medium bg-white"
                    />
                    <div className="space-y-0.5 text-[10px] text-[#576563] pl-1">
                      <div>• PIN Code / Postal Code</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* 6. Estimated Budget & Fair Pricing Engine */}
              <div className="pt-2 border-t border-[#E5DFD2] space-y-4">
                <div className="space-y-1">
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#152220] flex items-center gap-1.5">
                    <Calculator className="w-3.5 h-3.5 text-[#0D4A52]" />
                    <span>6. Estimated Budget &amp; Fair Price Recommendation</span>
                  </label>
                </div>

                {/* Centralized Fair Price Recommendation Card */}
                <div className="p-4 bg-[#FAF9F5] border border-[#BCE5DA] rounded-2xl space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-semibold text-[#576563]">Recommended Fair Range:</span>
                        {loadingEstimate && (
                          <span className="inline-flex items-center gap-1 text-[10px] text-[#217E66]">
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>Refining...</span>
                          </span>
                        )}
                      </div>
                      <div className="text-xl sm:text-2xl font-black text-[#0D4A52] tracking-tight">
                        ₹{pricingEstimate.recommendedMinInr} – ₹{pricingEstimate.recommendedMaxInr}
                      </div>
                      {pricingEstimate.aiAssessment?.detectedProblem && (
                        <p className="text-[11px] text-[#217E66] font-medium flex items-center gap-1 mt-0.5">
                          <Sparkles className="w-3 h-3 shrink-0" />
                          <span>Issue: {pricingEstimate.aiAssessment.detectedProblem}</span>
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        type="button"
                        onClick={() => setEstimatedBudgetInr(pricingEstimate.suggestedBudgetInr.toString())}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#EDF7F4] border border-[#BCE5DA] text-xs font-semibold text-[#0D4A52] hover:bg-[#D8ECE8] transition-colors cursor-pointer shadow-2xs"
                        title="Click to populate with recommended fair budget"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-[#217E66]" />
                        <span>Use Suggested Budget: ₹{pricingEstimate.suggestedBudgetInr}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setShowPricingBreakdown((prev) => !prev)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-white border border-[#E5DFD2] text-xs font-medium text-[#576563] hover:text-[#152220] transition-colors cursor-pointer"
                        title="View transparent formula breakdown"
                      >
                        <span>{showPricingBreakdown ? 'Hide Breakdown' : 'Breakdown'}</span>
                        {showPricingBreakdown ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  {/* Collapsible Transparent Breakdown Drawer */}
                  {showPricingBreakdown && (
                    <div className="mt-3 pt-3 border-t border-[#E5DFD2] space-y-2.5 text-xs text-[#152220] animate-in fade-in">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] bg-white p-3 rounded-xl border border-[#E5DFD2]">
                        <div className="flex items-center justify-between border-b border-[#FAF9F5] sm:border-b-0 pb-1 sm:pb-0">
                          <span className="text-[#576563]">Base Category Labour:</span>
                          <span className="font-semibold text-[#152220]">₹{pricingEstimate.breakdown.baseLabourInr}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-[#576563]">
                            Complexity ({pricingEstimate.breakdown.complexityLevel.toUpperCase()}):
                          </span>
                          <span className="font-semibold text-[#152220]">
                            ×{pricingEstimate.breakdown.complexityMultiplier.toFixed(2)} (₹{pricingEstimate.breakdown.adjustedLabourInr})
                          </span>
                        </div>
                        <div className="flex items-center justify-between border-b border-[#FAF9F5] sm:border-b-0 pb-1 sm:pb-0">
                          <span className="text-[#576563]">Estimated Parts/Materials:</span>
                          <span className="font-semibold text-[#152220]">
                            {pricingEstimate.breakdown.estimatedMaterialsInr > 0
                              ? `₹${pricingEstimate.breakdown.estimatedMaterialsInr}`
                              : 'None estimated'}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-[#576563]">Urgency Adjustment ({pricingEstimate.breakdown.urgencyLabel}):</span>
                          <span className="font-semibold text-[#0D4A52]">
                            {pricingEstimate.breakdown.urgencyFeeNotice}
                          </span>
                        </div>
                        <div className="flex items-center justify-between col-span-1 sm:col-span-2 pt-1 border-t border-[#E5DFD2]">
                          <span className="text-[#576563]">Minimum Fair Visitation Floor:</span>
                          <span className="font-semibold text-[#217E66]">₹{pricingEstimate.breakdown.minimumFairChargeInr}</span>
                        </div>
                      </div>

                      <p className="text-[11px] text-[#576563] italic leading-relaxed">
                        <strong>Why this price?</strong> {pricingEstimate.explanation}
                      </p>
                    </div>
                  )}
                </div>

                {/* Customer Custom Budget Input */}
                <div className="max-w-md space-y-2">
                  <label className="block text-xs font-semibold text-[#152220]">
                    Your Target Budget (₹ INR, Optional)
                  </label>
                  <div className="relative">
                    <IndianRupee className="w-4 h-4 text-[#83928E] absolute left-3 top-3" />
                    <input
                      type="number"
                      min={0}
                      value={estimatedBudgetInr}
                      onChange={(e) => setEstimatedBudgetInr(e.target.value)}
                      placeholder={`e.g. ${pricingEstimate.suggestedBudgetInr}`}
                      className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-[#E5DFD2] text-xs text-[#152220] focus:ring-2 focus:ring-[#0D4A52] outline-none bg-white font-medium"
                    />
                  </div>

                  {/* Dynamic Real-Time Budget Comparison Warning / Reassurance */}
                  {pricingEstimate.budgetValidation.status === 'BELOW_MINIMUM' && (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-1.5 animate-in fade-in">
                      <div className="flex items-start gap-2 text-xs text-amber-900 font-semibold">
                        <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                        <span>Budget below recommended minimum</span>
                      </div>
                      <p className="text-[11px] text-amber-800 leading-relaxed">
                        {pricingEstimate.budgetValidation.message}
                      </p>
                      <button
                        type="button"
                        onClick={() => setEstimatedBudgetInr(pricingEstimate.recommendedMinInr.toString())}
                        className="text-[11px] font-bold text-amber-900 underline hover:text-amber-950 cursor-pointer block"
                      >
                        Adjust to Minimum Fair Floor (₹{pricingEstimate.recommendedMinInr})
                      </button>
                    </div>
                  )}

                  {pricingEstimate.budgetValidation.status === 'FAIR_MARKET' && (
                    <div className="p-2.5 bg-[#EDF7F4] border border-[#BCE5DA] rounded-xl flex items-center gap-2 text-xs text-[#0D4A52] animate-in fade-in">
                      <CheckCircle2 className="w-4 h-4 text-[#217E66] shrink-0" />
                      <span>{pricingEstimate.budgetValidation.message}</span>
                    </div>
                  )}

                  {pricingEstimate.budgetValidation.status === 'PREMIUM' && (
                    <div className="p-2.5 bg-teal-50 border border-teal-200 rounded-xl flex items-center gap-2 text-xs text-[#0D4A52] animate-in fade-in">
                      <Zap className="w-4 h-4 text-[#217E66] shrink-0" />
                      <span>{pricingEstimate.budgetValidation.message}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Navigation & Submit for Card 4 */}
              <div className="pt-4 border-t border-[#E5DFD2] flex flex-col sm:flex-row items-center justify-between gap-3">
                <Button
                  type="button"
                  variant="secondary"
                  size="md"
                  onClick={handlePrevStep}
                  className="gap-1.5 min-w-[110px] justify-center w-full sm:w-auto"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Previous</span>
                </Button>

                <div className="w-full sm:w-auto">
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
                            customCategoryName,
                            title,
                            description,
                            urgency,
                            scheduledDate: selectedDate,
                            scheduledTimeSlot: selectedTime,
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
                    <div className="space-y-1">
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
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </form>

      <CustomerProfileModal
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
        onProfileUpdated={(newName) => {
          setCustomerName(newName);
        }}
      />

      {/* Time Selection Full-screen Pop-up Modal (Portaled to document.body for true full-screen overlay) */}
      {mounted &&
        createPortal(
          <AnimatePresence>
            {isTimeModalOpen && (
              <div
                role="dialog"
                aria-modal="true"
                className="fixed inset-0 z-[99999] flex items-center justify-center p-4 sm:p-6"
              >
                {/* Full-screen backdrop blurring the entire window */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setIsTimeModalOpen(false)}
                  className="fixed inset-0 bg-black/60 backdrop-blur-md modal-backdrop"
                />

                {/* Modal Dialog */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 16 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 16 }}
                  transition={{ duration: 0.2 }}
                  onClick={(e) => e.stopPropagation()}
                  className="relative z-10 w-full max-w-lg bg-[#FAF9F5] border border-[#E5DFD2] rounded-3xl p-5 sm:p-6 shadow-2xl space-y-4"
                >
                  {/* Header */}
                  <div className="flex items-center justify-between pb-3 border-b border-[#E5DFD2]">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-[#EBF4F3] flex items-center justify-center text-[#0D4A52]">
                        <Clock className="w-5 h-5 text-[#0D4A52]" />
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-[#152220]">
                          Select Preferred Start Time
                        </h3>
                        <p className="text-xs text-[#576563]">
                          {urgency === 'standard'
                            ? standardDateOptions.find((o) => o.dateStr === selectedDate)?.label || selectedDate
                            : 'Today (Same Day Service)'}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsTimeModalOpen(false)}
                      className="p-1.5 rounded-full text-[#576563] hover:text-[#152220] hover:bg-[#E5DFD2]/60 transition-colors cursor-pointer"
                      aria-label="Close modal"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Time Slots */}
                  <div>
                    {availableTimeOptions.length === 0 ? (
                      <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-800">
                        It is currently past standard same-day operating hours. Please switch Urgency to <strong>Standard</strong> to choose upcoming dates.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-[#576563]">
                            Available Service Slots
                          </span>
                          <span className="text-[11px] text-[#217E66] font-medium">
                            Click a slot to set arrival time
                          </span>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-[50vh] overflow-y-auto p-1">
                          {availableTimeOptions.map((timeOpt) => {
                            const isTimeSelected = selectedTime === timeOpt.value;
                            return (
                              <button
                                key={timeOpt.value}
                                type="button"
                                onClick={() => {
                                  setSelectedTime(timeOpt.value);
                                  setIsTimeModalOpen(false);
                                }}
                                className={`p-3 rounded-xl border text-center transition-all cursor-pointer flex items-center justify-center gap-2 ${
                                  isTimeSelected
                                    ? 'bg-[#0D4A52] border-[#0D4A52] text-white font-bold shadow-md ring-2 ring-[#0D4A52]/20'
                                    : 'bg-white border-[#E5DFD2] text-[#152220] hover:bg-[#EBF4F3] hover:border-[#BCE5DA] font-medium'
                                }`}
                              >
                                <Clock className={`w-3.5 h-3.5 ${isTimeSelected ? 'text-white' : 'text-[#217E66]'}`} />
                                <span className="text-xs font-semibold">{timeOpt.label}</span>
                              </button>
                            );
                          })}
                        </div>
                        <p className="text-[11px] text-[#83928E] text-center pt-1">
                          * Select your preferred arrival start time (not a duration window).
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Modal Footer */}
                  <div className="pt-3 border-t border-[#E5DFD2] flex justify-end">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => setIsTimeModalOpen(false)}
                    >
                      Done
                    </Button>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>,
          document.body
        )}

      {/* Date Selection Full-screen Pop-up Modal (Portaled to document.body for true full-screen overlay) */}
      {mounted &&
        createPortal(
          <AnimatePresence>
            {isDateModalOpen && (
              <div
                role="dialog"
                aria-modal="true"
                className="fixed inset-0 z-[99999] flex items-center justify-center p-4 sm:p-6"
              >
                {/* Full-screen backdrop blurring the entire window */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setIsDateModalOpen(false)}
                  className="fixed inset-0 bg-black/60 backdrop-blur-md modal-backdrop"
                />

                {/* Modal Dialog */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 16 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 16 }}
                  transition={{ duration: 0.2 }}
                  onClick={(e) => e.stopPropagation()}
                  className="relative z-10 w-full max-w-md bg-[#FAF9F5] border border-[#E5DFD2] rounded-3xl p-5 sm:p-6 shadow-2xl space-y-4"
                >
                  {/* Header */}
                  <div className="flex items-center justify-between pb-3 border-b border-[#E5DFD2]">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-[#EBF4F3] flex items-center justify-center text-[#0D4A52]">
                        <Calendar className="w-5 h-5 text-[#0D4A52]" />
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-[#152220]">
                          Select Preferred Date &amp; Day
                        </h3>
                        <p className="text-xs text-[#576563]">
                          Standard flexible service appointment
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsDateModalOpen(false)}
                      className="p-1.5 rounded-full text-[#576563] hover:text-[#152220] hover:bg-[#E5DFD2]/60 transition-colors cursor-pointer"
                      aria-label="Close modal"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Date Options */}
                  <div className="space-y-2.5">
                    <span className="text-xs font-semibold text-[#576563] block">
                      Available Service Days (Next 2–3 Days)
                    </span>
                    <div className="grid grid-cols-1 gap-2.5">
                      {standardDateOptions.map((opt) => {
                        const isDateSelected = selectedDate === opt.dateStr;
                        return (
                          <button
                            key={opt.dateStr}
                            type="button"
                            onClick={() => {
                              setSelectedDate(opt.dateStr);
                              setIsDateModalOpen(false);
                            }}
                            className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between ${
                              isDateSelected
                                ? 'bg-[#0D4A52] border-[#0D4A52] text-white font-bold shadow-md ring-2 ring-[#0D4A52]/20'
                                : 'bg-white border-[#E5DFD2] text-[#152220] hover:bg-[#FAF9F5] hover:border-[#0D4A52]/30'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <div
                                className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                                  isDateSelected ? 'bg-white/20 text-white' : 'bg-[#EBF4F3] text-[#0D4A52]'
                                }`}
                              >
                                <Calendar className="w-4 h-4" />
                              </div>
                              <div>
                                <span className="text-sm font-bold block">{opt.label}</span>
                                <span className={`text-xs block ${isDateSelected ? 'text-white/85' : 'text-[#576563]'}`}>
                                  {opt.sub}
                                </span>
                              </div>
                            </div>
                            {isDateSelected && (
                              <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center">
                                <Check className="w-4 h-4 text-white" />
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Modal Footer */}
                  <div className="pt-3 border-t border-[#E5DFD2] flex justify-end">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => setIsDateModalOpen(false)}
                    >
                      Done
                    </Button>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>,
          document.body
        )}
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
