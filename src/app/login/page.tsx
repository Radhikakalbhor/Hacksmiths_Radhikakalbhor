'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import Image from 'next/image';
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
import { getDestinationForRole } from '@/lib/auth/roles';
import {
  validateIndianPhoneNumber,
  validateEmail,
  validateNumericOtp,
  validateWorkerRegistration,
} from '@/lib/validations/auth';

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialRole = searchParams.get('role') === 'worker' ? 'worker' : 'customer';
  const initialIsRegister = searchParams.get('tab') === 'register';
  const rawRedirect = searchParams.get('redirect');

  const [role, setRole] = useState<'customer' | 'worker'>(initialRole);
  const [authMode, setAuthMode] = useState<'otp' | 'password'>('otp');
  const [isRegisteringWorker, setIsRegisteringWorker] = useState(initialIsRegister);

  // Authoritative role-bounded destination router
  const computeDestination = (targetRole: 'customer' | 'worker' | 'admin', isSuspended?: boolean) => {
    return getDestinationForRole(targetRole, rawRedirect, { isSuspended });
  };

  // Input states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpRequestedAt, setOtpRequestedAt] = useState<number | null>(null);
  const [otpRequestedEmail, setOtpRequestedEmail] = useState<string>('');
  const SUPABASE_OTP_LENGTH =
    typeof process.env.NEXT_PUBLIC_SUPABASE_OTP_LENGTH === 'string'
      ? parseInt(process.env.NEXT_PUBLIC_SUPABASE_OTP_LENGTH, 10) || 8
      : 8;

  // Worker onboarding registration fields
  const [fullName, setFullName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [primaryCategory, setPrimaryCategory] = useState(SERVICE_CATEGORIES[0].id);
  const [yearsExperience, setYearsExperience] = useState('2');
  const [bio, setBio] = useState('');
  const [verifiedSession, setVerifiedSession] = useState<{ accessToken?: string; user?: any } | null>(null);

  // Status & error states
  const [loading, setLoading] = useState(false);
  // Catch OAuth callback error query params directly in initial state
  const rawUrlError = searchParams.get('error');
  const errorEmail = searchParams.get('email');
  const errorActualRole = searchParams.get('actualRole');

  const formatInitialError = (raw: string | null) => {
    if (!raw) return null;
    if (raw === 'account_role_mismatch') {
      const emailDisplay = errorEmail ? ` (${errorEmail})` : '';
      return `Account Role Mismatch: This Google account${emailDisplay} is registered in Sahayak as a Customer. To access the Worker / Partner Dashboard, please sign in with your registered Partner account, or register a new partner profile.`;
    }
    if (raw === 'account_suspended') {
      return 'Account Suspended: Your administrator account has been suspended. Please contact platform support.';
    }
    return decodeURIComponent(raw);
  };

  const [errorMsg, setErrorMsg] = useState<string | null>(formatInitialError(rawUrlError));
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  // Active session
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<'customer' | 'worker' | 'admin' | null>(null);

  // Check active user session on mount
  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;

    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (user?.email) {
        setCurrentUserEmail(user.email);
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .maybeSingle();
        if (profile?.role) {
          const norm = String(profile.role).toLowerCase();
          if (norm === 'admin' || norm === 'worker' || norm === 'customer') {
            setCurrentUserRole(norm as 'customer' | 'worker' | 'admin');
          }
        }
      }
    });

    const { data: authListener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user?.email) {
        setCurrentUserEmail(session.user.email);
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', session.user.id)
          .maybeSingle();
        if (profile?.role) {
          const norm = String(profile.role).toLowerCase();
          if (norm === 'admin' || norm === 'worker' || norm === 'customer') {
            setCurrentUserRole(norm as 'customer' | 'worker' | 'admin');
          }
        }
      } else {
        setCurrentUserEmail(null);
        setCurrentUserRole(null);
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  // Restore preserved worker registration details if page was refreshed during OTP entry
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem('sahayak_pending_worker_reg');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.email) setEmail(parsed.email);
        if (parsed.fullName) setFullName(parsed.fullName);
        if (parsed.phoneNumber) setPhoneNumber(parsed.phoneNumber);
        if (parsed.primaryCategory) setPrimaryCategory(parsed.primaryCategory);
        if (parsed.yearsExperience) setYearsExperience(parsed.yearsExperience);
        if (parsed.bio) setBio(parsed.bio);
      }
    } catch {
      // Ignore sessionStorage parsing errors
    }
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
      const targetRedirect = rawRedirect || computeDestination(role);
      const callbackUrl = `${origin}/auth/callback?role=${role}&redirect=${encodeURIComponent(targetRedirect)}`;

      console.log(`[Google OAuth Initiation] selectedRole=${role}, targetRedirect=${targetRedirect}`);

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

    if (isRegisteringWorker && role === 'worker') {
      const regValidation = validateWorkerRegistration({
        fullName,
        phone: phoneNumber,
        primaryCategory,
        yearsExperience,
        bio,
        email: cleanEmail,
      });

      if (!regValidation.success || !regValidation.data) {
        setErrorMsg(
          Object.values(regValidation.errors || {})[0] ||
            'Please complete all required partner details.'
        );
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
      // 1. Authoritative Server Pre-Check for Worker Flows
      if (role === 'worker') {
        const preCheckRes = await fetch('/api/auth/worker/pre-check', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: cleanEmail,
            intent: isRegisteringWorker ? 'register' : 'signin',
          }),
        });

        const preCheckData = await preCheckRes.json();

        if (!preCheckRes.ok || preCheckData.data?.allowed === false) {
          setErrorMsg(
            preCheckData.data?.error ||
              preCheckData.error?.message ||
              (isRegisteringWorker
                ? 'This email is already registered as a worker partner. Please use "Existing Worker Sign In" to log in.'
                : 'This email is not registered as a worker. Please register as a new partner first.')
          );
          setLoading(false);
          return;
        }

        if (isRegisteringWorker && preCheckData.data?.isExistingCustomer) {
          setSuccessMsg(preCheckData.data.message);
        }
      }

      const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
      const targetRedirect = rawRedirect || computeDestination(role);
      const callbackUrl = `${origin}/auth/callback?role=${role}&redirect=${encodeURIComponent(targetRedirect)}`;

      const { error } = await supabase.auth.signInWithOtp({
        email: cleanEmail,
        options: {
          shouldCreateUser: role === 'worker' ? isRegisteringWorker : true,
          emailRedirectTo: callbackUrl,
          data: role === 'worker'
            ? {
                role: 'worker',
                ...(isRegisteringWorker
                  ? {
                      full_name: fullName.trim(),
                      phone: phoneNumber.trim(),
                      primary_category: primaryCategory,
                      years_experience: parseInt(yearsExperience, 10) || 0,
                      bio: bio.trim(),
                      verification_status: 'unverified',
                    }
                  : {}),
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
        if (role === 'worker' && isRegisteringWorker) {
          try {
            sessionStorage.setItem(
              'sahayak_pending_worker_reg',
              JSON.stringify({
                fullName: fullName.trim(),
                phoneNumber: phoneNumber.trim(),
                primaryCategory,
                yearsExperience,
                bio: bio.trim(),
                email: cleanEmail,
              })
            );
          } catch {
            // Ignore sessionStorage quota error
          }
        }
        setOtpSent(true);
        setVerifiedSession(null);
        setOtpCode('');
        setCooldown(60);
        setOtpRequestedAt(Date.now());
        setOtpRequestedEmail(cleanEmail);
        setSuccessMsg(
          `An ${SUPABASE_OTP_LENGTH}-digit numeric verification code has been requested for ${cleanEmail}. Please check your inbox and enter all ${SUPABASE_OTP_LENGTH} digits below.`
        );
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'An unexpected error occurred sending OTP.');
    } finally {
      setLoading(false);
    }
  };

  const executeCompleteWorkerRegistration = async (
    accessToken?: string,
    authUser?: { id?: string; email?: string }
  ) => {
    setLoading(true);
    setErrorMsg(null);

    const cleanEmail = authUser?.email || email.trim().toLowerCase();

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (accessToken) {
        headers['Authorization'] = `Bearer ${accessToken}`;
      }

      const compRes = await fetch('/api/auth/worker/complete-registration', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          fullName: fullName.trim(),
          phone: phoneNumber.trim(),
          primaryCategory,
          yearsExperience: parseInt(yearsExperience, 10) || 0,
          bio: bio.trim(),
          email: cleanEmail,
        }),
      });

      const compData = await compRes.json();
      if (!compRes.ok || !compData.success) {
        const rawErr = compData.error;
        const errMsg =
          typeof rawErr === 'string'
            ? rawErr
            : rawErr?.message || compData.message || 'Failed to complete partner profile setup. Please try again.';
        setErrorMsg(errMsg);
        setLoading(false);
        return;
      }

      try {
        sessionStorage.removeItem('sahayak_pending_worker_reg');
      } catch {}

      setSuccessMsg('Partner registration verified and completed! Redirecting to Partner Dashboard...');
      setTimeout(() => {
        router.push('/worker/dashboard');
        router.refresh();
      }, 800);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to finalize partner registration.');
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
    const isValidOtp =
      validateNumericOtp(cleanCode, SUPABASE_OTP_LENGTH) ||
      (SUPABASE_OTP_LENGTH !== 6 && validateNumericOtp(cleanCode, 6));

    if (!isValidOtp) {
      setErrorMsg(`Please enter the full ${SUPABASE_OTP_LENGTH}-digit numeric verification code.`);
      return;
    }

    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;

    setLoading(true);

    try {
      // 1. Authoritative OTP Verification
      // For all email OTPs sent via signInWithOtp, GoTrue registers the verification token under type 'email'.
      // We pass 'email' as primary, with a resilient fallback to 'signup' if needed.
      let verifyResult = await supabase.auth.verifyOtp({
        email: cleanEmail,
        token: cleanCode,
        type: 'email',
      });

      // If 'email' type fails, try 'signup' fallback before treating as invalid
      if (
        verifyResult.error &&
        (verifyResult.error.message?.toLowerCase().includes('token') ||
          verifyResult.error.message?.toLowerCase().includes('invalid') ||
          (verifyResult.error as { code?: string }).code === 'otp_expired')
      ) {
        const fallbackResult = await supabase.auth.verifyOtp({
          email: cleanEmail,
          token: cleanCode,
          type: 'signup',
        });

        if (!fallbackResult.error && fallbackResult.data?.session) {
          verifyResult = fallbackResult;
        }
      }

      const { data, error } = verifyResult;

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
        } else if (isTimeExpired) {
          setErrorMsg('The verification code has expired. Please click "Resend Code" to receive a fresh code.');
        } else if (errorCode === 'otp_expired' || errorText.includes('expired') || errorText.includes('invalid') || errorCode === 'validation_failed') {
          // If within the validity window, GoTrue's generic 'otp_expired' indicates mismatched or invalid code digits
          setErrorMsg(`Invalid verification code. Please check your email and make sure you entered all ${SUPABASE_OTP_LENGTH} digits correctly.`);
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

      // 1. New Partner Registration: provision authoritative profile & worker_profiles
      if (role === 'worker' && isRegisteringWorker) {
        setVerifiedSession({
          accessToken: data.session.access_token,
          user: data.user,
        });
        await executeCompleteWorkerRegistration(data.session.access_token, data.user);
        return;
      }

      // 2. Fetch authoritative user profile to verify role and status
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('id, role, is_suspended')
        .eq('id', user.id)
        .maybeSingle();

      const profileRole = existingProfile?.role ? String(existingProfile.role).toLowerCase() : null;

      // Explicit Admin Case: immediately route to /admin
      if (profileRole === 'admin') {
        if (existingProfile?.is_suspended) {
          setErrorMsg('Your administrator account has been suspended. Please contact platform support.');
          await supabase.auth.signOut();
          setLoading(false);
          return;
        }

        setSuccessMsg('Administrator authenticated successfully! Redirecting to Admin Panel...');
        const targetDestination = computeDestination('admin');
        setTimeout(() => {
          router.push(targetDestination);
          router.refresh();
        }, 800);
        return;
      }

      // Existing Worker Sign In: verify authoritative worker role
      if (role === 'worker' && !isRegisteringWorker) {
        if (profileRole !== 'worker') {
          setErrorMsg('This email is not registered as a worker. Please register as a new partner first.');
          await supabase.auth.signOut();
          setLoading(false);
          return;
        }

        setSuccessMsg('Worker authenticated successfully! Redirecting to Worker Dashboard...');
        const targetDestination = computeDestination('worker');
        setTimeout(() => {
          router.push(targetDestination);
          router.refresh();
        }, 800);
        return;
      }

      // 3. Customer Sign In / Registration
      if (!existingProfile) {
        const fullNameVal =
          user.user_metadata?.full_name ||
          user.email?.split('@')[0] ||
          'Sahayak Customer';
        const phoneVal =
          user.phone ||
          user.user_metadata?.phone ||
          `email_${user.id.replace(/-/g, '').slice(0, 10)}`;

        await supabase.from('profiles').insert({
          id: user.id,
          email: user.email || cleanEmail,
          phone: phoneVal,
          full_name: fullNameVal,
          avatar_url: user.user_metadata?.avatar_url || null,
          role: 'customer',
          verification_status: 'unverified',
          primary_city: 'Delhi NCR',
        });
      }

      setSuccessMsg('Authentication verified successfully! Establishing session and redirecting...');
      const targetDestination = computeDestination(profileRole === 'worker' ? 'worker' : 'customer');

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
          const targetDestination = computeDestination(isRegisteringWorker || role === 'worker' ? 'worker' : 'customer');
          setTimeout(() => {
            router.push(targetDestination);
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
        } else if (data.session && data.user) {
          // Fetch authoritative user profile to determine role
          const { data: profile } = await supabase
            .from('profiles')
            .select('role, is_suspended')
            .eq('id', data.user.id)
            .maybeSingle();

          const profileRole = profile?.role ? String(profile.role).toLowerCase() : null;

          // Explicit Admin Case: immediately route to /admin
          if (profileRole === 'admin') {
            if (profile?.is_suspended) {
              setErrorMsg('Your administrator account has been suspended. Please contact platform support.');
              await supabase.auth.signOut();
              setLoading(false);
              return;
            }
            setSuccessMsg('Signed in as Administrator. Redirecting to Admin Panel...');
            const targetDestination = computeDestination('admin');
            setTimeout(() => {
              router.push(targetDestination);
              router.refresh();
            }, 800);
            return;
          }

          setSuccessMsg('Signed in successfully! Redirecting...');
          const targetDestination = computeDestination(
            profileRole === 'worker' || role === 'worker' ? 'worker' : 'customer'
          );
          setTimeout(() => {
            router.push(targetDestination);
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
    <div className="max-w-lg w-full bg-white/95 backdrop-blur-md rounded-2xl border border-[#E5DFD2] p-6 sm:p-8 shadow-xl space-y-6">
      {/* Header Banner with Brand Logo */}
      <div className="text-center space-y-3 flex flex-col items-center">
        <Link href="/" className="inline-block transition-transform hover:scale-105">
          <Image
            src="/images/logo.png"
            alt="Sahayak"
            width={68}
            height={68}
            className="w-16 h-16 rounded-2xl object-cover shadow-md border border-[#E5DFD2]/80 mx-auto"
            priority
          />
        </Link>
        <div className="space-y-1">
          <h1 className="text-2xl font-extrabold text-[#152220] tracking-tight">
            {role === 'worker'
              ? isRegisteringWorker
                ? 'Register as a Professional Partner'
                : 'Worker Sign In'
              : 'Sign in to Sahayak'}
          </h1>
          <p className="text-xs text-[#576563] leading-relaxed max-w-sm mx-auto">
            {role === 'worker'
              ? 'Access transparent bids, keep 90%+ of earnings, and build a verified local reputation passport.'
              : 'Find verified local tradesmen, compare price benchmarks, and post service requests safely.'}
          </p>
        </div>
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
              onClick={() => {
                const target = computeDestination(currentUserRole || role);
                router.push(target);
              }}
            >
              Continue to {currentUserRole === 'admin' ? 'Admin Panel' : role === 'worker' ? 'Dashboard' : 'Create Service Request'}
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
            setVerifiedSession(null);
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
            setVerifiedSession(null);
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
              setVerifiedSession(null);
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
              setVerifiedSession(null);
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
            {isRegisteringWorker ? 'Register with Google' : 'Sign in with Google'}
          </span>
        </button>
      </div>

      {/* Email OTP Section Title */}
      <div className="pt-2 border-t border-[#E5DFD2]">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-[#152220]">
              Or continue with email
            </h2>
            <p className="text-[11px] text-[#576563]">
              We&apos;ll send an {SUPABASE_OTP_LENGTH}-digit OTP code directly to your email
            </p>
          </div>
          <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-[#EBF4F3] text-[#0D4A52] border border-[#BCE5DA]">
            Email OTP
          </span>
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
        verifiedSession && role === 'worker' && isRegisteringWorker ? (
          <div className="space-y-4">
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-2.5 text-xs text-emerald-800">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>
                Verification code confirmed! Please review your details below and click &quot;Complete Partner Registration&quot; to finalize setup.
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#152220] mb-1">
                Full Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g. Ramesh Kumar Sharma"
                className="w-full p-2.5 text-xs rounded-xl border border-[#E5DFD2] focus:ring-2 focus:ring-[#0D4A52] outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#152220] mb-1">
                Mobile Phone (India 10-digit) <span className="text-red-500">*</span>
              </label>
              <input
                type="tel"
                required
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="e.g. 9876543210"
                maxLength={14}
                className="w-full p-2.5 text-xs rounded-xl border border-[#E5DFD2] focus:ring-2 focus:ring-[#0D4A52] outline-none"
              />
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
                  Experience (Years) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  required
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
                Brief Bio / Skills Summary <span className="text-red-500">*</span>
              </label>
              <textarea
                rows={2}
                required
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="e.g., Licensed electrician specializing in domestic wiring and MCB upgrades..."
                className="w-full p-2.5 text-xs rounded-xl border border-[#E5DFD2] focus:ring-2 focus:ring-[#0D4A52] outline-none resize-none"
              />
            </div>

            <div className="flex gap-2 pt-1">
              <Button
                type="button"
                variant="secondary"
                className="py-2.5 text-xs font-semibold border-[#E5DFD2]"
                onClick={() => {
                  setVerifiedSession(null);
                  setOtpSent(false);
                  setOtpCode('');
                }}
              >
                Start Over
              </Button>
              <Button
                type="button"
                variant="primary"
                onClick={() => executeCompleteWorkerRegistration(verifiedSession.accessToken, verifiedSession.user)}
                className="flex-1 justify-center gap-2 py-2.5 text-xs font-semibold"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Completing Setup...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Complete Partner Registration</span>
                  </>
                )}
              </Button>
            </div>
          </div>
        ) : !otpSent ? (
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
                      Experience (Years) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      required
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
                    Brief Bio / Skills Summary <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    rows={2}
                    required
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
                    if (otpSent || verifiedSession) {
                      setOtpSent(false);
                      setVerifiedSession(null);
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
                  Enter {SUPABASE_OTP_LENGTH}-Digit OTP Code
                </label>
                <button
                  type="button"
                  onClick={() => {
                    try {
                      sessionStorage.removeItem('sahayak_pending_worker_reg');
                    } catch {}
                    setOtpSent(false);
                    setVerifiedSession(null);
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
                Enter the {SUPABASE_OTP_LENGTH}-digit numeric verification code requested for{' '}
                <span className="font-semibold text-[#152220]">{email}</span>.
              </p>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]*"
                required
                maxLength={SUPABASE_OTP_LENGTH}
                value={otpCode}
                onChange={(e) =>
                  setOtpCode(e.target.value.replace(/\D/g, '').slice(0, SUPABASE_OTP_LENGTH))
                }
                placeholder={SUPABASE_OTP_LENGTH === 8 ? '••••••••' : '••••••'}
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
    <div className="min-h-[85vh] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 bg-transparent">
      <Suspense fallback={<div className="text-xs text-[#576563]">Loading Authentication Portal...</div>}>
        <LoginContent />
      </Suspense>
    </div>
  );
}
