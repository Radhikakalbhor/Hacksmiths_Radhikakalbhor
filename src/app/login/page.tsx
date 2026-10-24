'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowLeft,
  ShieldCheck,
  UserCheck,
  Mail,
  KeyRound,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Phone,
  User as UserIcon,
  LogOut,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { SERVICE_CATEGORIES } from '@/lib/config/constants';
import {
  validateIndianPhoneNumber,
  validateEmail,
  validateNumericOtp,
} from '@/lib/validations/auth';

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialRole = searchParams.get('role') === 'worker' ? 'worker' : 'customer';
  const redirectTo = searchParams.get('redirect') || (initialRole === 'worker' ? '/dashboard?role=worker' : '/dashboard');

  const [role, setRole] = useState<'customer' | 'worker'>(initialRole);
  const [authMode, setAuthMode] = useState<'otp' | 'password'>('otp');
  const [isRegisteringWorker, setIsRegisteringWorker] = useState(initialRole === 'worker');

  // Input states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpRequestedAt, setOtpRequestedAt] = useState<number | null>(null);
  const [otpRequestedEmail, setOtpRequestedEmail] = useState<string>('');
  const SUPABASE_OTP_LENGTH = 8;

  // Worker onboarding registration fields
  const [fullName, setFullName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [primaryCategory, setPrimaryCategory] = useState(SERVICE_CATEGORIES[0].id);
  const [yearsExperience, setYearsExperience] = useState('2');
  const [bio, setBio] = useState('');

  // Status & error states
  const [loading, setLoading] = useState(false);
  // Catch OAuth callback error query params directly in initial state
  const rawUrlError = searchParams.get('error');
  const [errorMsg, setErrorMsg] = useState<string | null>(
    rawUrlError ? decodeURIComponent(rawUrlError) : null
  );
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  // Active session
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);

  // Check active user session on mount
  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user?.email) {
        setCurrentUserEmail(user.email);
      }
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user?.email) {
        setCurrentUserEmail(session.user.email);
      } else {
        setCurrentUserEmail(null);
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  // Handle countdown timer
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  // Handle Google OAuth Sign-in with role preservation
  const handleGoogleSignIn = async () => {
    setErrorMsg(null);
    setSuccessMsg(null);

    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setErrorMsg('Supabase client is not configured.');
      return;
    }

    setLoading(true);

    try {
      const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
      const targetRedirect = redirectTo || (role === 'worker' ? '/dashboard?role=worker' : '/dashboard');
      const callbackUrl = `${origin}/auth/callback?role=${role}&redirect=${encodeURIComponent(targetRedirect)}`;

      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: callbackUrl,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      });

      if (error) {
        setErrorMsg(error.message);
        setLoading(false);
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to initialize Google sign-in.');
      setLoading(false);
    }
  };

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setErrorMsg(null);
    setSuccessMsg(null);

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !validateEmail(cleanEmail)) {
      setErrorMsg('Please enter a valid email address.');
      return;
    }

    if (isRegisteringWorker) {
      if (!fullName.trim() || fullName.trim().length < 2) {
        setErrorMsg('Please enter your full name (at least 2 characters).');
        return;
      }
      if (!phoneNumber.trim() || !validateIndianPhoneNumber(phoneNumber)) {
        setErrorMsg('Please enter a valid 10-digit Indian mobile number.');
        return;
      }
    }

    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setErrorMsg('Supabase client is not configured.');
      return;
    }

    setLoading(true);

    try {
      const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
      const targetRedirect = redirectTo || (role === 'worker' ? '/dashboard?role=worker' : '/dashboard');
      const callbackUrl = `${origin}/auth/callback?role=${role}&redirect=${encodeURIComponent(targetRedirect)}`;

      const { error } = await supabase.auth.signInWithOtp({
        email: cleanEmail,
        options: {
          shouldCreateUser: true,
          emailRedirectTo: callbackUrl,
          data: isRegisteringWorker
            ? {
                full_name: fullName.trim(),
                phone: phoneNumber.trim(),
                role: 'worker',
                primary_category: primaryCategory,
                years_experience: parseInt(yearsExperience, 10) || 0,
                bio: bio.trim(),
                verification_status: 'unverified',
              }
            : {
                role: 'customer',
              },
        },
      });

      if (error) {
        const errorText = error.message.toLowerCase();
        if (errorText.includes('rate limit') || (error as { status?: number }).status === 429) {
          setErrorMsg(
            'Email rate limit reached for Supabase Auth. Please wait a few minutes before requesting another code, or continue with Google.'
          );
        } else if (errorText.includes('provider') || errorText.includes('not enabled') || errorText.includes('disabled')) {
          setErrorMsg(
            'Email authentication is not enabled or restricted in your Supabase Auth configuration.'
          );
        } else {
          setErrorMsg(error.message);
        }
      } else {
        setOtpSent(true);
        setOtpCode('');
        setCooldown(60);
        setOtpRequestedAt(Date.now());
        setOtpRequestedEmail(cleanEmail);
        setSuccessMsg(
          `An 8-digit numeric verification code has been requested for ${cleanEmail}. Please check your inbox and enter all 8 digits below.`
        );
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'An unexpected error occurred sending OTP.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setErrorMsg(null);
    setSuccessMsg(null);

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      setErrorMsg('Email address is missing. Please re-enter your email.');
      setOtpSent(false);
      return;
    }

    if (otpRequestedEmail && cleanEmail !== otpRequestedEmail) {
      setErrorMsg('The email address has changed. Please request a new verification code for this email.');
      setOtpSent(false);
      return;
    }

    const cleanCode = otpCode.trim();
    if (!validateNumericOtp(cleanCode, SUPABASE_OTP_LENGTH)) {
      setErrorMsg(`Please enter the full ${SUPABASE_OTP_LENGTH}-digit numeric verification code.`);
      return;
    }

    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;

    setLoading(true);

    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email: cleanEmail,
        token: cleanCode,
        type: 'email',
      });

      if (error) {
        const errorText = error.message.toLowerCase();
        const errorCode = (error as { code?: string }).code || '';
        const elapsedMs = otpRequestedAt ? Date.now() - otpRequestedAt : 0;
        // Supabase OTP default validity is 10 to 60 minutes
        const isTimeExpired = elapsedMs > 10 * 60 * 1000;

        if (errorText.includes('rate limit') || (error as { status?: number }).status === 429) {
          setErrorMsg('Too many verification attempts. Please wait a few minutes before retrying.');
        } else if (errorText.includes('network') || errorText.includes('failed to fetch') || errorText.includes('fetch failed')) {
          setErrorMsg('Network error connecting to authentication service. Please check your internet connection.');
        } else if (errorCode === 'otp_expired' || errorText.includes('expired') || errorText.includes('invalid')) {
          if (isTimeExpired) {
            setErrorMsg('The verification code has expired. Please click "Resend Code" to receive a fresh code.');
          } else {
            setErrorMsg('Invalid verification code. Please check your email and make sure you entered all 8 digits correctly.');
          }
        } else {
          setErrorMsg(error.message);
        }
        return;
      }

      if (!data.session || !data.user) {
        setErrorMsg('Verification succeeded but no active session was returned. Please try logging in again.');
        return;
      }

      const user = data.user;

      // Zero-trust role determination: Query existing profile first
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('id, role')
        .eq('id', user.id)
        .maybeSingle();

      const finalRole: 'customer' | 'worker' =
        existingProfile?.role === 'worker' || existingProfile?.role === 'customer'
          ? existingProfile.role
          : role === 'worker'
          ? 'worker'
          : 'customer';

      if (!existingProfile) {
        const fullNameVal =
          fullName.trim() ||
          user.user_metadata?.full_name ||
          user.email?.split('@')[0] ||
          (finalRole === 'worker' ? 'Sahayak Partner' : 'Sahayak Customer');
        const phoneVal =
          phoneNumber.trim() ||
          user.phone ||
          user.user_metadata?.phone ||
          `email_${user.id.replace(/-/g, '').slice(0, 10)}`;

        await supabase.from('profiles').insert({
          id: user.id,
          email: user.email || cleanEmail,
          phone: phoneVal,
          full_name: fullNameVal,
          avatar_url: user.user_metadata?.avatar_url || null,
          role: finalRole,
          verification_status: 'unverified',
          primary_city: 'Delhi NCR',
        });

        if (finalRole === 'worker') {
          await supabase.from('worker_profiles').insert({
            user_id: user.id,
            primary_category: primaryCategory || 'plumbing',
            skills: ['general'],
            bio: bio.trim() || 'Partner registered via Email OTP',
            years_experience: parseInt(yearsExperience, 10) || 1,
            is_available: true,
            is_publicly_visible: false,
          });
        }
      }

      setSuccessMsg('Authentication verified successfully! Establishing session and redirecting...');

      const targetDestination =
        finalRole === 'worker' ? '/dashboard?role=worker' : redirectTo || '/dashboard';

      setTimeout(() => {
        router.push(targetDestination);
        router.refresh();
      }, 800);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to verify OTP code.');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !password) {
      setErrorMsg('Please provide both email and password.');
      return;
    }

    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;

    setLoading(true);

    try {
      if (isRegisteringWorker) {
        // Sign up with password
        if (!fullName.trim() || fullName.trim().length < 2) {
          setErrorMsg('Please enter your full name.');
          setLoading(false);
          return;
        }

        const { data, error } = await supabase.auth.signUp({
          email: cleanEmail,
          password,
          options: {
            data: {
              full_name: fullName.trim(),
              phone: phoneNumber.trim(),
              role: 'worker',
              primary_category: primaryCategory,
              years_experience: parseInt(yearsExperience, 10) || 0,
              bio: bio.trim(),
              verification_status: 'unverified',
            },
          },
        });

        if (error) {
          setErrorMsg(error.message);
        } else if (data.session) {
          setSuccessMsg('Account created and logged in! Redirecting...');
          setTimeout(() => {
            router.push(redirectTo);
            router.refresh();
          }, 1000);
        } else {
          setSuccessMsg('Account registered! Please check your email to confirm your account.');
        }
      } else {
        // Sign in with password
        const { data, error } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password,
        });

        if (error) {
          setErrorMsg(error.message);
        } else if (data.session) {
          setSuccessMsg('Signed in successfully! Redirecting...');
          setTimeout(() => {
            router.push(redirectTo);
            router.refresh();
          }, 1000);
        }
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Authentication failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    setLoading(true);
    await supabase.auth.signOut();
    setCurrentUserEmail(null);
    setSuccessMsg('You have been signed out successfully.');
    setLoading(false);
  };

  return (
    <div className="max-w-lg w-full bg-white rounded-2xl border border-[#E5DFD2] p-6 sm:p-8 shadow-sm space-y-6">
      {/* Header Banner */}
      <div className="text-center space-y-2">
        <div className="w-14 h-14 mx-auto rounded-2xl bg-[#EBF4F3] flex items-center justify-center text-[#0D4A52]">
          {role === 'worker' ? (
            <UserCheck className="w-7 h-7 text-[#217E66]" />
          ) : (
            <ShieldCheck className="w-7 h-7 text-[#0D4A52]" />
          )}
        </div>

        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#EDF7F4] text-[#217E66] border border-[#BCE5DA]">
          <span>{role === 'worker' ? 'Sahayak Partner Network' : 'Customer & Household Portal'}</span>
        </div>

        <h1 className="text-2xl font-extrabold text-[#152220] tracking-tight">
          {role === 'worker'
            ? isRegisteringWorker
              ? 'Register as a Professional Partner'
              : 'Worker Sign In'
            : 'Sign in to Sahayak'}
        </h1>
        <p className="text-xs text-[#576563] leading-relaxed">
          {role === 'worker'
            ? 'Access transparent bids, keep 90%+ of earnings, and build a verified local reputation passport.'
            : 'Find verified local tradesmen, compare price benchmarks, and post service requests safely.'}
        </p>
      </div>

      {/* Logged in state display */}
      {currentUserEmail && (
        <div className="bg-[#FAF9F5] border border-[#BCE5DA] rounded-xl p-4 text-xs space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[#576563]">Active Authenticated Session:</span>
            <Badge variant="green">Connected</Badge>
          </div>
          <p className="font-semibold text-[#152220] break-all">{currentUserEmail}</p>
          <div className="flex items-center gap-2 pt-1">
            <Button
              variant="primary"
              size="sm"
              className="w-full text-xs"
              onClick={() => router.push(redirectTo)}
            >
              Continue to {redirectTo === '/post-job' ? 'Post a Job' : 'Dashboard'}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              className="text-xs gap-1 text-red-600 border-red-200 hover:bg-red-50"
              onClick={handleSignOut}
              disabled={loading}
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </Button>
          </div>
        </div>
      )}

      {/* Role Selector Tabs */}
      <div className="grid grid-cols-2 gap-2 p-1 bg-[#FAF9F5] rounded-xl border border-[#E5DFD2]">
        <button
          type="button"
          onClick={() => {
            setRole('customer');
            setIsRegisteringWorker(false);
            setErrorMsg(null);
            setSuccessMsg(null);
          }}
          className={`py-2 rounded-lg text-xs font-semibold transition-all ${
            role === 'customer'
              ? 'bg-white text-[#0D4A52] shadow-sm border border-[#E5DFD2]'
              : 'text-[#576563] hover:text-[#152220]'
          }`}
        >
          Customer Login
        </button>
        <button
          type="button"
          onClick={() => {
            setRole('worker');
            setErrorMsg(null);
            setSuccessMsg(null);
          }}
          className={`py-2 rounded-lg text-xs font-semibold transition-all ${
            role === 'worker'
              ? 'bg-white text-[#0D4A52] shadow-sm border border-[#E5DFD2]'
              : 'text-[#576563] hover:text-[#152220]'
          }`}
        >
          Worker / Partner
        </button>
      </div>

      {/* Worker toggle: Sign in vs New partner registration */}
      {role === 'worker' && (
        <div className="flex items-center justify-center gap-4 text-xs font-medium border-b border-[#E5DFD2] pb-3">
          <button
            type="button"
            onClick={() => {
              setIsRegisteringWorker(false);
              setErrorMsg(null);
            }}
            className={`pb-1 transition-colors ${
              !isRegisteringWorker
                ? 'text-[#0D4A52] font-bold border-b-2 border-[#0D4A52]'
                : 'text-[#576563] hover:text-[#152220]'
            }`}
          >
            Existing Worker Sign In
          </button>
          <button
            type="button"
            onClick={() => {
              setIsRegisteringWorker(true);
              setErrorMsg(null);
            }}
            className={`pb-1 transition-colors ${
              isRegisteringWorker
                ? 'text-[#0D4A52] font-bold border-b-2 border-[#0D4A52]'
                : 'text-[#576563] hover:text-[#152220]'
            }`}
          >
            New Partner Registration
          </button>
        </div>
      )}

      {/* Google OAuth Quick Sign-In */}
      <div className="space-y-3 pt-1">
        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={loading}
          className="w-full flex items-center justify-center gap-3 py-2.5 px-4 bg-white hover:bg-[#FAF9F5] text-[#152220] border border-[#D5CEC0] rounded-xl text-xs font-bold shadow-sm transition-all hover:border-[#0D4A52] focus:outline-none focus:ring-2 focus:ring-[#0D4A52] disabled:opacity-60 cursor-pointer"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin text-[#0D4A52]" />
          ) : (
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
          )}
          <span>
            {role === 'worker'
              ? isRegisteringWorker
                ? 'Register with Google as Partner'
                : 'Sign in with Google as Partner'
              : 'Continue with Google'}
          </span>
        </button>

        <div className="relative flex items-center justify-center my-2">
          <div className="border-t border-[#E5DFD2] w-full" />
          <span className="bg-white px-3 text-[11px] uppercase tracking-wider text-[#83928E] font-medium absolute">
            or continue with email
          </span>
        </div>
      </div>

      {/* Authentication Method Selector (OTP / Magic Link vs Password) */}
      <div className="flex items-center justify-between text-xs text-[#576563] px-1">
        <span>Preferred Login Method:</span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setAuthMode('otp')}
            className={`px-2.5 py-1 rounded-md transition-colors ${
              authMode === 'otp'
                ? 'bg-[#EBF4F3] text-[#0D4A52] font-semibold'
                : 'hover:text-[#152220]'
            }`}
          >
            Email OTP / Magic Link
          </button>
          <button
            type="button"
            onClick={() => setAuthMode('password')}
            className={`px-2.5 py-1 rounded-md transition-colors ${
              authMode === 'password'
                ? 'bg-[#EBF4F3] text-[#0D4A52] font-semibold'
                : 'hover:text-[#152220]'
            }`}
          >
            Password
          </button>
        </div>
      </div>

      {/* Notifications */}
      {errorMsg && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2.5 text-xs text-red-700">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
          <span className="leading-relaxed">{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-2.5 text-xs text-emerald-800">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
          <span className="leading-relaxed">{successMsg}</span>
        </div>
      )}

      {/* Form Content */}
      {authMode === 'otp' ? (
        !otpSent ? (
          <form onSubmit={handleSendOtp} className="space-y-4">
            {isRegisteringWorker && (
              <>
                <div>
                  <label className="block text-xs font-semibold text-[#152220] mb-1">
                    Full Name <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <UserIcon className="w-4 h-4 text-[#83928E] absolute left-3 top-3" />
                    <input
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="e.g. Ramesh Kumar Sharma"
                      className="w-full pl-9 pr-3 py-2.5 text-xs rounded-xl border border-[#E5DFD2] focus:ring-2 focus:ring-[#0D4A52] outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#152220] mb-1">
                    Mobile Phone (India 10-digit) <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-[#83928E] absolute left-3 top-3" />
                    <input
                      type="tel"
                      required
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      placeholder="e.g. 9876543210"
                      maxLength={14}
                      className="w-full pl-9 pr-3 py-2.5 text-xs rounded-xl border border-[#E5DFD2] focus:ring-2 focus:ring-[#0D4A52] outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-[#152220] mb-1">
                      Primary Trade <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={primaryCategory}
                      onChange={(e) => setPrimaryCategory(e.target.value as typeof primaryCategory)}
                      className="w-full p-2.5 text-xs rounded-xl border border-[#E5DFD2] focus:ring-2 focus:ring-[#0D4A52] outline-none bg-white"
                    >
                      {SERVICE_CATEGORIES.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#152220] mb-1">
                      Experience (Years)
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={50}
                      value={yearsExperience}
                      onChange={(e) => setYearsExperience(e.target.value)}
                      className="w-full p-2.5 text-xs rounded-xl border border-[#E5DFD2] focus:ring-2 focus:ring-[#0D4A52] outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#152220] mb-1">
                    Brief Bio / Skills Summary
                  </label>
                  <textarea
                    rows={2}
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder="e.g., Licensed electrician specializing in domestic wiring and MCB upgrades..."
                    className="w-full p-2.5 text-xs rounded-xl border border-[#E5DFD2] focus:ring-2 focus:ring-[#0D4A52] outline-none resize-none"
                  />
                </div>
              </>
            )}

            <div>
              <label className="block text-xs font-semibold text-[#152220] mb-1">
                Email Address <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-[#83928E] absolute left-3 top-3" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (otpSent) {
                      setOtpSent(false);
                      setOtpCode('');
                      setOtpRequestedAt(null);
                      setOtpRequestedEmail('');
                      setErrorMsg(null);
                    }
                  }}
                  placeholder="name@example.com"
                  className="w-full pl-9 pr-3 py-2.5 text-xs rounded-xl border border-[#E5DFD2] focus:ring-2 focus:ring-[#0D4A52] outline-none"
                />
              </div>
            </div>

            <Button
              type="submit"
              variant="primary"
              className="w-full justify-center gap-2 py-2.5 text-xs font-semibold"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Requesting OTP...</span>
                </>
              ) : (
                <>
                  <KeyRound className="w-4 h-4" />
                  <span>Get OTP</span>
                </>
              )}
            </Button>
          </form>
        ) : (
          <form onSubmit={handleVerifyOtp} className="space-y-4">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-semibold text-[#152220]">
                  Enter 8-Digit OTP Code
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setOtpSent(false);
                    setOtpCode('');
                    setOtpRequestedAt(null);
                    setOtpRequestedEmail('');
                    setErrorMsg(null);
                    setSuccessMsg(null);
                  }}
                  className="text-[11px] text-[#0D4A52] underline font-semibold hover:text-[#217E66]"
                >
                  Change Email
                </button>
              </div>
              <p className="text-[11px] text-[#576563]">
                Enter the 8-digit numeric verification code requested for{' '}
                <span className="font-semibold text-[#152220]">{email}</span>.
              </p>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]*"
                required
                maxLength={8}
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 8))}
                placeholder="••••••••"
                className="w-full p-3 text-center text-xl tracking-[0.4em] font-mono rounded-xl border border-[#E5DFD2] focus:ring-2 focus:ring-[#0D4A52] outline-none font-bold placeholder:tracking-normal placeholder:text-gray-300"
              />
            </div>

            <div className="flex items-center justify-between text-xs text-[#576563]">
              <span>Didn&apos;t receive code?</span>
              <button
                type="button"
                disabled={cooldown > 0 || loading}
                onClick={handleSendOtp}
                className={`font-semibold ${
                  cooldown > 0 ? 'text-[#83928E] cursor-not-allowed' : 'text-[#0D4A52] hover:underline'
                }`}
              >
                {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend Code'}
              </button>
            </div>

            <p className="text-[11px] text-[#83928E] text-center">
              Verification codes expire according to Supabase OTP expiry settings (typically 10–60 minutes). Resend is available every 60 seconds.
            </p>

            <Button
              type="submit"
              variant="primary"
              className="w-full justify-center gap-2 py-2.5 text-xs font-semibold"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Verifying...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Verify Code &amp; Continue</span>
                </>
              )}
            </Button>
          </form>
        )
      ) : (
        /* Password Form */
        <form onSubmit={handlePasswordAuth} className="space-y-4">
          {isRegisteringWorker && (
            <>
              <div>
                <label className="block text-xs font-semibold text-[#152220] mb-1">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Ramesh Kumar"
                  className="w-full p-2.5 text-xs rounded-xl border border-[#E5DFD2] focus:ring-2 focus:ring-[#0D4A52] outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#152220] mb-1">
                  Primary Trade <span className="text-red-500">*</span>
                </label>
                <select
                  value={primaryCategory}
                  onChange={(e) => setPrimaryCategory(e.target.value as typeof primaryCategory)}
                  className="w-full p-2.5 text-xs rounded-xl border border-[#E5DFD2] focus:ring-2 focus:ring-[#0D4A52] outline-none bg-white"
                >
                  {SERVICE_CATEGORIES.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}

          <div>
            <label className="block text-xs font-semibold text-[#152220] mb-1">Email Address</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              className="w-full p-2.5 text-xs rounded-xl border border-[#E5DFD2] focus:ring-2 focus:ring-[#0D4A52] outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#152220] mb-1">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full p-2.5 text-xs rounded-xl border border-[#E5DFD2] focus:ring-2 focus:ring-[#0D4A52] outline-none"
            />
          </div>

          <Button
            type="submit"
            variant="primary"
            className="w-full justify-center gap-2 py-2.5 text-xs"
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Processing...</span>
              </>
            ) : (
              <span>{isRegisteringWorker ? 'Register Account' : 'Sign In with Password'}</span>
            )}
          </Button>
        </form>
      )}

      {/* Back Link */}
      <div className="pt-2 border-t border-[#E5DFD2] text-center">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-[#576563] hover:text-[#0D4A52] transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Return to Homepage</span>
        </Link>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-[85vh] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 bg-[#FAF9F5]">
      <Suspense fallback={<div className="text-xs text-[#576563]">Loading Authentication Portal...</div>}>
        <LoginContent />
      </Suspense>
    </div>
  );
}
