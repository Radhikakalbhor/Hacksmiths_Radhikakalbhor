'use client';

import React, { useState, useEffect } from 'react';
import { X, User, Mail, Phone, MapPin, CheckCircle2, AlertCircle, Loader2, Lock } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { validateIndianPhoneNumber } from '@/lib/validations/auth';

export interface CustomerProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProfileUpdated?: (newName: string) => void;
}

export function CustomerProfileModal({
  isOpen,
  onClose,
  onProfileUpdated,
}: CustomerProfileModalProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Form Fields
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [defaultAddress, setDefaultAddress] = useState('');
  const [fallbackPhone, setFallbackPhone] = useState('');

  // Close on Escape key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !saving) {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, saving, onClose]);

  // Fetch customer profile when modal opens
  useEffect(() => {
    if (!isOpen) return;

    let isCancelled = false;
    setErrorMsg(null);
    setSuccessMsg(null);
    setLoading(true);

    async function fetchProfile() {
      try {
        const supabase = getSupabaseBrowserClient();
        if (!supabase) {
          if (!isCancelled) {
            setErrorMsg('Supabase is not configured in this environment.');
            setLoading(false);
          }
          return;
        }

        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        const user = session?.user;
        if (sessionError || !user) {
          if (!isCancelled) {
            setErrorMsg('No authenticated session found. Please sign in to manage your profile.');
            setLoading(false);
          }
          return;
        }

        // Fetch via /api/profile
        let loadedViaApi = false;
        try {
          const headers: Record<string, string> = {};
          if (session.access_token) {
            headers['Authorization'] = `Bearer ${session.access_token}`;
          }
          const res = await fetch('/api/profile', { headers });
          if (res.ok) {
            const json = await res.json();
            if (json.success && json.data && !isCancelled) {
              const p = json.data;
              setEmail(p.email || user.email || '');
              setFullName(p.fullName || '');
              const rawP = p.phone || '';
              const isSynthetic = rawP.startsWith('email_') || rawP.startsWith('user_');
              setPhone(isSynthetic ? '' : rawP);
              setFallbackPhone(rawP);
              setDefaultAddress(p.defaultAddress || '');
              loadedViaApi = true;
            }
          }
        } catch {
          // Fall back to client query
        }

        if (loadedViaApi || isCancelled) return;

        // Fallback: direct Supabase query
        const { data: profile } = await supabase
          .from('profiles')
          .select('id, full_name, email, phone, primary_city, role')
          .eq('id', user.id)
          .maybeSingle();

        if (isCancelled) return;

        // 1. Email (Read-only from authenticated account)
        const userEmail = user.email || profile?.email || '';
        setEmail(userEmail);

        // 2. Full Name
        const resolvedName =
          profile?.full_name ||
          user.user_metadata?.full_name ||
          user.user_metadata?.name ||
          (userEmail ? userEmail.split('@')[0] : 'Customer');
        setFullName(resolvedName);

        // 3. Phone
        const rawPhone = profile?.phone || user.phone || user.user_metadata?.phone || '';
        const isSyntheticPhone =
          rawPhone.startsWith('email_') || rawPhone.startsWith('user_');
        const cleanPhone = isSyntheticPhone ? '' : rawPhone;
        setPhone(cleanPhone);
        setFallbackPhone(rawPhone);

        // 4. Default Service Address
        const rawAddress =
          user.user_metadata?.default_service_address ||
          user.user_metadata?.address ||
          profile?.primary_city ||
          '';
        setDefaultAddress(rawAddress);
      } catch (err) {
        if (!isCancelled) {
          setErrorMsg(err instanceof Error ? err.message : 'Failed to load profile data.');
        }
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    }

    fetchProfile();

    return () => {
      isCancelled = true;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;

    setErrorMsg(null);
    setSuccessMsg(null);

    const cleanName = fullName.trim();
    if (!cleanName || cleanName.length < 2) {
      setErrorMsg('Full Name must be at least 2 characters.');
      return;
    }

    const trimmedPhone = phone.trim();
    if (trimmedPhone && !validateIndianPhoneNumber(trimmedPhone)) {
      setErrorMsg('Please enter a valid 10-digit Indian phone number (e.g. 9876543210).');
      return;
    }

    setSaving(true);

    try {
      const supabase = getSupabaseBrowserClient();
      if (!supabase) {
        throw new Error('Supabase client unavailable.');
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user) {
        throw new Error('You must be signed in to update your profile.');
      }

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (session.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }

      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          fullName: cleanName,
          phone: trimmedPhone,
          defaultAddress: defaultAddress.trim(),
          fallbackPhone,
        }),
      });

      const resData = await res.json();
      if (!res.ok) {
        throw new Error(resData.error || 'Failed to update profile.');
      }

      setSuccessMsg('Profile saved successfully!');
      if (onProfileUpdated) {
        onProfileUpdated(cleanName);
      }

      // Auto-close after brief confirmation
      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'An error occurred while saving profile.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget && !saving) onClose();
      }}
    >
      <div
        className="relative w-full max-w-md bg-[#FAF9F5] rounded-2xl border border-[#E5DFD2] p-6 shadow-2xl space-y-5 animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="profile-panel-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#E5DFD2] pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#EBF4F3] flex items-center justify-center text-[#0D4A52]">
              <User className="w-5 h-5 text-[#217E66]" />
            </div>
            <div>
              <h2 id="profile-panel-title" className="text-base font-bold text-[#152220]">
                Customer Profile
              </h2>
              <p className="text-xs text-[#576563]">Manage your personal details &amp; address</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="p-1.5 rounded-lg text-[#576563] hover:text-[#152220] hover:bg-[#F3EFE6] transition-colors focus:outline-none"
            aria-label="Close Profile Panel"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Status Alerts */}
        {errorMsg && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2.5 text-xs text-red-700 animate-in fade-in">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <span className="leading-relaxed">{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-2.5 text-xs text-emerald-800 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <span className="leading-relaxed font-medium">{successMsg}</span>
          </div>
        )}

        {/* Loading State Skeleton */}
        {loading ? (
          <div className="py-8 flex flex-col items-center justify-center gap-3 text-xs text-[#576563]">
            <Loader2 className="w-6 h-6 animate-spin text-[#0D4A52]" />
            <span>Loading profile details...</span>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* 1. Full Name */}
            <div className="space-y-1.5">
              <label htmlFor="profile-full-name" className="block text-xs font-semibold text-[#152220]">
                Full Name <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  id="profile-full-name"
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Radhika Kalbhor"
                  disabled={saving}
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-[#E5DFD2] text-xs text-[#152220] focus:ring-2 focus:ring-[#0D4A52] focus:border-transparent outline-none bg-white transition-all"
                />
                <User className="w-4 h-4 text-[#83928E] absolute left-3 top-2.5 pointer-events-none" />
              </div>
            </div>

            {/* 2. Email Address (Read-only from Auth) */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="profile-email" className="block text-xs font-semibold text-[#152220]">
                  Email Address
                </label>
                <span className="inline-flex items-center gap-1 text-[10px] text-[#83928E] bg-[#E5DFD2]/40 px-2 py-0.5 rounded-full">
                  <Lock className="w-2.5 h-2.5" />
                  Read-only
                </span>
              </div>
              <div className="relative">
                <input
                  id="profile-email"
                  type="email"
                  readOnly
                  disabled
                  value={email}
                  placeholder="user@example.com"
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-[#E5DFD2] text-xs text-[#576563] bg-[#F3EFE6]/60 cursor-not-allowed outline-none"
                />
                <Mail className="w-4 h-4 text-[#83928E] absolute left-3 top-2.5 pointer-events-none" />
              </div>
              <p className="text-[11px] text-[#83928E]">
                Email is managed securely by your Google or OTP sign-in account.
              </p>
            </div>

            {/* 3. Phone Number */}
            <div className="space-y-1.5">
              <label htmlFor="profile-phone" className="block text-xs font-semibold text-[#152220]">
                Phone Number
              </label>
              <div className="relative">
                <input
                  id="profile-phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="10-digit mobile number (e.g. 9876543210)"
                  disabled={saving}
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-[#E5DFD2] text-xs text-[#152220] focus:ring-2 focus:ring-[#0D4A52] focus:border-transparent outline-none bg-white transition-all"
                />
                <Phone className="w-4 h-4 text-[#83928E] absolute left-3 top-2.5 pointer-events-none" />
              </div>
            </div>

            {/* 4. Default Service Address */}
            <div className="space-y-1.5">
              <label htmlFor="profile-address" className="block text-xs font-semibold text-[#152220]">
                Default Service Address
              </label>
              <div className="relative">
                <textarea
                  id="profile-address"
                  rows={2}
                  value={defaultAddress}
                  onChange={(e) => setDefaultAddress(e.target.value)}
                  placeholder="e.g. Flat 302, Sea View Apartments, Hill Road, Bandra West, Mumbai"
                  disabled={saving}
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-[#E5DFD2] text-xs text-[#152220] focus:ring-2 focus:ring-[#0D4A52] focus:border-transparent outline-none bg-white transition-all resize-none"
                />
                <MapPin className="w-4 h-4 text-[#83928E] absolute left-3 top-2.5 pointer-events-none" />
              </div>
            </div>

            {/* Actions */}
            <div className="pt-2 flex items-center justify-end gap-2.5 border-t border-[#E5DFD2]">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={onClose}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="sm"
                disabled={saving}
                className="gap-1.5"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <span>Save Changes</span>
                )}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
