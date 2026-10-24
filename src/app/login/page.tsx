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
import { validateIndianPhoneNumber } from '@/lib/validations/auth';

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

  // Worker onboarding registration fields
  const [fullName, setFullName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [primaryCategory, setPrimaryCategory] = useState(SERVICE_CATEGORIES[0].id);
  const [yearsExperience, setYearsExperience] = useState('2');
  const [bio, setBio] = useState('');

  // Status & error states
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
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

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
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
      const { error } = await supabase.auth.signInWithOtp({
        email: cleanEmail,
        options: {
          shouldCreateUser: true,
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
        if (error.message.includes('rate limit')) {
          setErrorMsg(
            'Email rate limit reached for this project. If you have an account password, switch to the Password tab, or try again later.'
          );
        } else {
          setErrorMsg(error.message);
        }
      } else {
        setOtpSent(true);
        setCooldown(60);
        setSuccessMsg(`A one-time verification link or 6-digit code has been sent to ${cleanEmail}.`);
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'An unexpected error occurred sending OTP.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const cleanCode = otpCode.trim();
    if (!cleanCode || cleanCode.length < 6) {
      setErrorMsg('Please enter the full 6-digit OTP code.');
      return;
    }

    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;

    setLoading(true);

    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email: email.trim().toLowerCase(),
        token: cleanCode,
        type: 'email',
      });

      if (error) {
        setErrorMsg(error.message);
      } else if (data.session) {
        setSuccessMsg('Authentication verified successfully! Redirecting...');
        setTimeout(() => {
          router.push(redirectTo);
          router.refresh();
        }, 1000);
      } else {
        setErrorMsg('Verification completed but no active session was returned. Please try logging in.');
      }
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
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full pl-9 pr-3 py-2.5 text-xs rounded-xl border border-[#E5DFD2] focus:ring-2 focus:ring-[#0D4A52] outline-none"
                />
              </div>
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
                  <span>Sending Code...</span>
                </>
              ) : (
                <>
                  <KeyRound className="w-4 h-4" />
                  <span>Send One-Time Verification Code</span>
                </>
              )}
            </Button>
          </form>
        ) : (
          <form onSubmit={handleVerifyOtp} className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-[#152220]">
                  Enter 6-Digit OTP Code
                </label>
                <button
                  type="button"
                  onClick={() => setOtpSent(false)}
                  className="text-[11px] text-[#0D4A52] underline"
                >
                  Change Email
                </button>
              </div>
              <input
                type="text"
                required
                maxLength={8}
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value)}
                placeholder="123456"
                className="w-full p-3 text-center text-lg tracking-widest font-mono rounded-xl border border-[#E5DFD2] focus:ring-2 focus:ring-[#0D4A52] outline-none font-bold"
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

            <Button
              type="submit"
              variant="primary"
              className="w-full justify-center gap-2 py-2.5 text-xs"
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
