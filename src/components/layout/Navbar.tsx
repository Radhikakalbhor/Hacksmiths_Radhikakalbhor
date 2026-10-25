'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X, ArrowRight, Briefcase, CalendarClock, User, LogOut } from 'lucide-react';
import { motion, AnimatePresence, useScroll, useMotionValueEvent } from 'motion/react';
import { getSupabaseClient } from '@/lib/supabase/client';
import { LiquidMetalButton } from '@/components/ui/liquid-metal-button';
import { CustomerProfileModal } from '@/components/profile/CustomerProfileModal';

function NavbarContent() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const pathname = usePathname();

  // Floating navbar animation (reveals on scroll up, hides on scroll down)
  const { scrollY } = useScroll();
  const [visible, setVisible] = useState(true);

  useMotionValueEvent(scrollY, 'change', (current) => {
    if (typeof current === 'number') {
      const prev = scrollY.getPrevious() ?? 0;
      const direction = current - prev;

      // Always visible near top of page
      if (current < 50) {
        setVisible(true);
      } else {
        // Scrolling UP reveals navbar; scrolling DOWN hides it
        if (direction < 0) {
          setVisible(true);
        } else if (direction > 5) {
          setVisible(false);
        }
      }
    }
  });

  useEffect(() => {
    const supabase = getSupabaseClient();
    if (!supabase) return;

    const resolveUserInfo = async (sessionUser: any) => {
      if (!sessionUser) {
        setUserEmail(null);
        setDisplayName(null);
        return;
      }
      setUserEmail(sessionUser.email ?? null);
      const metaName = sessionUser.user_metadata?.full_name || sessionUser.user_metadata?.name;
      if (metaName) {
        setDisplayName(metaName);
      } else {
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', sessionUser.id)
          .maybeSingle();
        if (profile?.full_name) {
          setDisplayName(profile.full_name);
        } else if (sessionUser.email) {
          setDisplayName(sessionUser.email.split('@')[0]);
        }
      }
    };

    supabase.auth.getSession().then(({ data: { session } }) => {
      resolveUserInfo(session?.user);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      resolveUserInfo(session?.user);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSignOut = async () => {
    const supabase = getSupabaseClient();
    if (supabase) {
      await supabase.auth.signOut();
      setUserEmail(null);
      setDisplayName(null);
    }
  };

  const isAuthPage = pathname === '/login' || pathname.startsWith('/login');

  return (
    <>
    <AnimatePresence mode="wait">
      <motion.header
        initial={{ y: 0, opacity: 1 }}
        animate={{
          y: visible ? 0 : -100,
          opacity: visible ? 1 : 0,
        }}
        transition={{
          duration: 0.25,
          ease: 'easeInOut',
        }}
        className="sticky top-0 z-50 w-full bg-transparent"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-18">
          {/* Brand Name & Tagline */}
          <Link href="/" className="flex flex-col group">
            <span className="font-extrabold text-2xl text-[#0D4A52] tracking-tight group-hover:text-[#072F35] transition-colors">
              Sahayak
            </span>
            <p className="text-[11px] text-[#576563] hidden sm:block">Trusted help. Fair work.</p>
          </Link>

          {/* Desktop Nav Links - Single Horizontal Card */}
          <nav className="hidden md:flex items-center p-1 bg-white/95 backdrop-blur-sm border border-[#E5DFD2] rounded-full shadow-xs gap-0.5 lg:gap-1">
            <Link
              href="/dashboard"
              className={`text-xs lg:text-sm font-medium flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all whitespace-nowrap ${
                pathname === '/dashboard'
                  ? 'bg-[#EBF4F3] text-[#0D4A52] font-semibold shadow-xs'
                  : 'text-[#576563] hover:text-[#0D4A52] hover:bg-[#F3EFE6]/80'
              }`}
            >
              <Briefcase className={`w-3.5 h-3.5 ${pathname === '/dashboard' ? 'text-[#0D4A52]' : 'text-[#217E66]'}`} />
              <span>Marketplace & Jobs</span>
            </Link>

            <Link
              href="/bookings"
              className={`text-xs lg:text-sm font-medium flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all whitespace-nowrap ${
                pathname === '/bookings'
                  ? 'bg-[#EBF4F3] text-[#0D4A52] font-semibold shadow-xs'
                  : 'text-[#576563] hover:text-[#0D4A52] hover:bg-[#F3EFE6]/80'
              }`}
            >
              <CalendarClock className={`w-3.5 h-3.5 ${pathname === '/bookings' ? 'text-[#0D4A52]' : 'text-[#217E66]'}`} />
              <span>Booking History</span>
            </Link>

            <Link
              href="/services"
              className={`text-xs lg:text-sm font-medium px-3 py-1.5 rounded-full transition-all whitespace-nowrap ${
                pathname === '/services'
                  ? 'bg-[#EBF4F3] text-[#0D4A52] font-semibold shadow-xs'
                  : 'text-[#576563] hover:text-[#0D4A52] hover:bg-[#F3EFE6]/80'
              }`}
            >
              Services
            </Link>

            <Link
              href="/fair-pricing"
              className={`text-xs lg:text-sm font-medium px-3 py-1.5 rounded-full transition-all whitespace-nowrap ${
                pathname === '/fair-pricing' || pathname === '/pricing'
                  ? 'bg-[#EBF4F3] text-[#0D4A52] font-semibold shadow-xs'
                  : 'text-[#576563] hover:text-[#0D4A52] hover:bg-[#F3EFE6]/80'
              }`}
            >
              Fair Pricing
            </Link>

            <Link
              href="/safety"
              className={`text-xs lg:text-sm font-medium px-3 py-1.5 rounded-full transition-all whitespace-nowrap ${
                pathname === '/safety'
                  ? 'bg-[#EBF4F3] text-[#0D4A52] font-semibold shadow-xs'
                  : 'text-[#576563] hover:text-[#0D4A52] hover:bg-[#F3EFE6]/80'
              }`}
            >
              Safety & OTP
            </Link>
          </nav>

          {/* Desktop Action Buttons */}
          <div className="hidden md:flex items-center gap-3">
            {isAuthPage ? null : userEmail ? (
              <div className="flex items-center gap-1.5 bg-white px-2.5 py-1 rounded-lg border border-[#E5DFD2] text-xs text-[#152220] shadow-2xs">
                <button
                  type="button"
                  onClick={() => setIsProfileModalOpen(true)}
                  className="flex items-center gap-1.5 hover:text-[#0D4A52] transition-colors cursor-pointer text-left"
                  title="View & Edit Profile"
                  aria-label="Open customer profile"
                >
                  <User className="w-3.5 h-3.5 text-[#217E66] shrink-0" />
                  <span className="font-semibold max-w-[130px] truncate">
                    {displayName || userEmail}
                  </span>
                </button>
                <div className="h-3 w-px bg-[#E5DFD2] mx-0.5" />
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="text-red-600 hover:text-red-700 p-0.5 transition-colors cursor-pointer"
                  title="Sign Out"
                  aria-label="Sign out"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <LiquidMetalButton
                href="/login"
                label="Sign In"
                width={92}
              />
            )}
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
            className={`block px-3 py-2 rounded-md text-base ${
              pathname === '/dashboard'
                ? 'font-semibold text-[#0D4A52] bg-[#EBF4F3]'
                : 'font-medium text-[#152220] hover:bg-[#F3EFE6]'
            }`}
          >
            Marketplace & Jobs Dashboard
          </Link>
          <Link
            href="/bookings"
            onClick={() => setMobileMenuOpen(false)}
            className={`block px-3 py-2 rounded-md text-base ${
              pathname === '/bookings'
                ? 'font-semibold text-[#0D4A52] bg-[#EBF4F3]'
                : 'font-medium text-[#152220] hover:bg-[#F3EFE6]'
            }`}
          >
            Booking History
          </Link>
          <Link
            href="/services"
            onClick={() => setMobileMenuOpen(false)}
            className={`block px-3 py-2 rounded-md text-base ${
              pathname === '/services'
                ? 'font-semibold text-[#0D4A52] bg-[#EBF4F3]'
                : 'font-medium text-[#152220] hover:bg-[#F3EFE6]'
            }`}
          >
            Services & Trades
          </Link>
          <Link
            href="/fair-pricing"
            onClick={() => setMobileMenuOpen(false)}
            className={`block px-3 py-2 rounded-md text-base ${
              pathname === '/fair-pricing' || pathname === '/pricing'
                ? 'font-semibold text-[#0D4A52] bg-[#EBF4F3]'
                : 'font-medium text-[#152220] hover:bg-[#F3EFE6]'
            }`}
          >
            Local Price Benchmarks
          </Link>
          <Link
            href="/safety"
            onClick={() => setMobileMenuOpen(false)}
            className={`block px-3 py-2 rounded-md text-base ${
              pathname === '/safety'
                ? 'font-semibold text-[#0D4A52] bg-[#EBF4F3]'
                : 'font-medium text-[#152220] hover:bg-[#F3EFE6]'
            }`}
          >
            Safety Protocols & OTP
          </Link>

          {!isAuthPage && (
            <div className="pt-3 flex flex-col gap-2">
              {userEmail ? (
                <div className="flex items-center justify-between p-2 rounded-lg bg-white border border-[#E5DFD2] text-xs shadow-2xs">
                  <button
                    type="button"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      setIsProfileModalOpen(true);
                    }}
                    className="flex items-center gap-2 text-left font-semibold text-[#152220] hover:text-[#0D4A52] truncate cursor-pointer"
                    title="View & Edit Profile"
                  >
                    <User className="w-4 h-4 text-[#217E66] shrink-0" />
                    <span className="truncate">{displayName || userEmail}</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleSignOut}
                    className="text-red-600 font-semibold text-xs ml-2 cursor-pointer hover:text-red-700"
                  >
                    Sign Out
                  </button>
                </div>
              ) : (
                <div>
                  <Link
                    href="/login"
                    onClick={() => setMobileMenuOpen(false)}
                    className="w-full inline-flex items-center justify-center font-medium rounded-lg px-4 py-2.5 text-xs bg-white text-[#152220] border border-[#E5DFD2] hover:bg-[#F3EFE6]"
                  >
                    Sign In
                  </Link>
                </div>
              )}
            </div>
          )}
        </div>
      )}
      </motion.header>
    </AnimatePresence>

    <CustomerProfileModal
      isOpen={isProfileModalOpen}
      onClose={() => setIsProfileModalOpen(false)}
      onProfileUpdated={(newName) => {
        setDisplayName(newName);
      }}
    />
    </>
  );
}

export function NavbarFallback() {
  return (
    <header className="sticky top-0 z-50 w-full bg-transparent">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-18">
          {/* Brand Name & Tagline */}
          <Link href="/" className="flex flex-col group">
            <span className="font-extrabold text-2xl text-[#0D4A52] tracking-tight group-hover:text-[#072F35] transition-colors">
              Sahayak
            </span>
            <p className="text-[11px] text-[#576563] hidden sm:block">Trusted help. Fair work.</p>
          </Link>

          {/* Desktop Nav Links */}
          <nav className="hidden md:flex items-center p-1 bg-white/95 backdrop-blur-sm border border-[#E5DFD2] rounded-full shadow-xs gap-0.5 lg:gap-1">
            <Link
              href="/dashboard"
              className="text-xs lg:text-sm font-medium flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[#576563] hover:text-[#0D4A52] hover:bg-[#F3EFE6]/80 transition-all whitespace-nowrap"
            >
              <Briefcase className="w-3.5 h-3.5 text-[#217E66]" />
              <span>Marketplace & Jobs</span>
            </Link>

            <Link
              href="/bookings"
              className="text-xs lg:text-sm font-medium flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[#576563] hover:text-[#0D4A52] hover:bg-[#F3EFE6]/80 transition-all whitespace-nowrap"
            >
              <CalendarClock className="w-3.5 h-3.5 text-[#217E66]" />
              <span>Booking History</span>
            </Link>

            <Link
              href="/services"
              className="text-xs lg:text-sm font-medium px-3 py-1.5 rounded-full text-[#576563] hover:text-[#0D4A52] hover:bg-[#F3EFE6]/80 transition-all whitespace-nowrap"
            >
              Services
            </Link>

            <Link
              href="/fair-pricing"
              className="text-xs lg:text-sm font-medium px-3 py-1.5 rounded-full text-[#576563] hover:text-[#0D4A52] hover:bg-[#F3EFE6]/80 transition-all whitespace-nowrap"
            >
              Fair Pricing
            </Link>

            <Link
              href="/safety"
              className="text-xs lg:text-sm font-medium px-3 py-1.5 rounded-full text-[#576563] hover:text-[#0D4A52] hover:bg-[#F3EFE6]/80 transition-all whitespace-nowrap"
            >
              Safety & OTP
            </Link>
          </nav>

          {/* Desktop Action Buttons */}
          <div className="hidden md:flex items-center gap-3">
            <LiquidMetalButton
              href="/login"
              label="Sign In"
              width={92}
            />
          </div>

          {/* Mobile menu toggle */}
          <div className="flex md:hidden">
            <div className="p-2 rounded-lg text-[#576563]">
              <Menu className="w-6 h-6" />
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}

export function Navbar() {
  return (
    <React.Suspense fallback={<NavbarFallback />}>
      <NavbarContent />
    </React.Suspense>
  );
}

