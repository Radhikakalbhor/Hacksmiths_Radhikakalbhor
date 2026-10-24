'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Sparkles, Menu, X, ArrowRight, Briefcase, User, LogOut } from 'lucide-react';
import { getSupabaseClient } from '@/lib/supabase/client';

export function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    const supabase = getSupabaseClient();
    if (!supabase) return;

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUserEmail(session?.user?.email ?? null);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserEmail(session?.user?.email ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSignOut = async () => {
    const supabase = getSupabaseClient();
    if (supabase) {
      await supabase.auth.signOut();
      setUserEmail(null);
    }
  };

  return (
    <header className="sticky top-0 z-50 w-full bg-[#FAF9F5]/90 backdrop-blur-md border-b border-[#E5DFD2]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-18">
          {/* Logo & Tagline */}
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-xl bg-[#0D4A52] flex items-center justify-center text-white font-bold text-xl shadow-sm group-hover:bg-[#072F35] transition-colors">
              स
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-xl text-[#0D4A52] tracking-tight">Sahayak</span>
                <span className="text-[10px] uppercase font-semibold tracking-wider px-1.5 py-0.5 rounded bg-[#EBF4F3] text-[#0D4A52]">
                  Hyperlocal
                </span>
              </div>
              <p className="text-[11px] text-[#576563] hidden sm:block">Trusted help. Fair work.</p>
            </div>
          </Link>

          {/* Desktop Nav Links */}
          <nav className="hidden md:flex items-center gap-6">
            <Link
              href="/dashboard"
              className="text-sm font-semibold text-[#0D4A52] hover:text-[#072F35] flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#EBF4F3] transition-colors"
            >
              <Briefcase className="w-3.5 h-3.5 text-[#217E66]" />
              <span>Marketplace & Jobs</span>
            </Link>
            <Link
              href="/#services"
              className="text-sm font-medium text-[#576563] hover:text-[#0D4A52] transition-colors"
            >
              Services
            </Link>
            <Link
              href="/#benchmarks"
              className="text-sm font-medium text-[#576563] hover:text-[#0D4A52] transition-colors"
            >
              Fair Pricing
            </Link>
            <Link
              href="/#safety"
              className="text-sm font-medium text-[#576563] hover:text-[#0D4A52] transition-colors"
            >
              Safety & OTP
            </Link>
          </nav>

          {/* Desktop Action Buttons */}
          <div className="hidden md:flex items-center gap-3">
            {userEmail ? (
              <div className="flex items-center gap-2 bg-white px-2.5 py-1 rounded-lg border border-[#E5DFD2] text-xs text-[#152220]">
                <User className="w-3.5 h-3.5 text-[#217E66]" />
                <span className="font-medium max-w-[120px] truncate">{userEmail}</span>
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="text-red-600 hover:text-red-700 ml-1 p-0.5"
                  title="Sign Out"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <>
                <Link
                  href="/login?role=worker"
                  className="inline-flex items-center justify-center font-medium rounded-lg transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-offset-2 px-3 py-1.5 text-xs bg-white text-[#152220] border border-[#E5DFD2] hover:bg-[#F3EFE6] focus:ring-[#0D4A52]"
                >
                  Worker Portal
                </Link>
                <Link
                  href="/login"
                  className="inline-flex items-center justify-center font-medium rounded-lg transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-offset-2 px-3 py-1.5 text-xs text-[#576563] hover:text-[#152220] hover:bg-[#F3EFE6]"
                >
                  Sign In
                </Link>
              </>
            )}

            <Link
              href="/post-job"
              className="inline-flex items-center justify-center font-medium rounded-lg transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-offset-2 px-3 py-1.5 text-xs bg-[#0D4A52] text-white hover:bg-[#072F35] focus:ring-[#0D4A52] shadow-sm hover:shadow gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5 text-emerald-300" />
              <span>Post a Job</span>
            </Link>
          </div>

          {/* Mobile menu toggle */}
          <div className="flex md:hidden">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg text-[#576563] hover:text-[#152220] hover:bg-[#F3EFE6]"
              aria-label="Toggle Navigation Menu"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div className="md:hidden border-b border-[#E5DFD2] bg-[#FAF9F5] px-4 pt-2 pb-6 space-y-3">
          <Link
            href="/dashboard"
            onClick={() => setMobileMenuOpen(false)}
            className="block px-3 py-2 rounded-md text-base font-semibold text-[#0D4A52] bg-[#EBF4F3]"
          >
            Marketplace & Jobs Dashboard
          </Link>
          <Link
            href="/#services"
            onClick={() => setMobileMenuOpen(false)}
            className="block px-3 py-2 rounded-md text-base font-medium text-[#152220] hover:bg-[#F3EFE6]"
          >
            Services & Trades
          </Link>
          <Link
            href="/#benchmarks"
            onClick={() => setMobileMenuOpen(false)}
            className="block px-3 py-2 rounded-md text-base font-medium text-[#152220] hover:bg-[#F3EFE6]"
          >
            Local Price Benchmarks
          </Link>
          <Link
            href="/#safety"
            onClick={() => setMobileMenuOpen(false)}
            className="block px-3 py-2 rounded-md text-base font-medium text-[#152220] hover:bg-[#F3EFE6]"
          >
            Safety Protocols & OTP
          </Link>

          <div className="pt-3 flex flex-col gap-2">
            {userEmail ? (
              <div className="flex items-center justify-between p-2 rounded-lg bg-white border border-[#E5DFD2] text-xs">
                <span className="font-medium text-[#152220] truncate">{userEmail}</span>
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="text-red-600 font-semibold text-xs"
                >
                  Sign Out
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <Link
                  href="/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className="inline-flex items-center justify-center font-medium rounded-lg px-3 py-2 text-xs bg-white text-[#152220] border border-[#E5DFD2]"
                >
                  Sign In
                </Link>
                <Link
                  href="/login?role=worker"
                  onClick={() => setMobileMenuOpen(false)}
                  className="inline-flex items-center justify-center font-medium rounded-lg px-3 py-2 text-xs bg-white text-[#152220] border border-[#E5DFD2]"
                >
                  Worker Portal
                </Link>
              </div>
            )}

            <Link
              href="/post-job"
              onClick={() => setMobileMenuOpen(false)}
              className="w-full inline-flex items-center justify-center font-medium rounded-lg transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-offset-2 px-4 py-2 text-sm bg-[#0D4A52] text-white hover:bg-[#072F35] shadow-sm gap-2"
            >
              <span>Post a Job</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
