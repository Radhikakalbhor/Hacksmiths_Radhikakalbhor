'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { Menu, X, PlusCircle, CalendarClock, Wrench, ShieldCheck, Calculator, User, LogOut } from 'lucide-react';
import { CustomerProfileModal } from '@/components/profile/CustomerProfileModal';

interface CustomerNavbarProps {
  userEmail: string | null;
  displayName: string | null;
  onSignOut: () => Promise<void>;
}

export function CustomerNavbar({ userEmail, displayName, onSignOut }: CustomerNavbarProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const pathname = usePathname();

  const isPostJobActive = pathname === '/post-job' || pathname === '/';
  const isBookingsActive = pathname === '/bookings' || pathname === '/my-jobs' || pathname === '/booking-history';
  const isServicesActive = pathname === '/services' || pathname === '/search-workers';
  const isPricingActive = pathname === '/fair-pricing' || pathname === '/pricing';
  const isSafetyActive = pathname === '/safety';

  return (
    <>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-18">
          {/* Brand Name & Tagline */}
          <Link href="/post-job" className="flex items-center gap-2.5 group">
            <Image
              src="/images/logo.png"
              alt="Sahayak Logo"
              width={38}
              height={38}
              className="w-9 h-9 rounded-xl object-cover shadow-xs border border-[#E5DFD2]/60 group-hover:scale-105 transition-transform"
              priority
            />
            <div className="flex flex-col">
              <span className="font-extrabold text-xl text-[#0D4A52] tracking-tight group-hover:text-[#072F35] transition-colors leading-none">
                Sahayak
              </span>
              <p className="text-[10px] text-[#576563] hidden sm:block font-medium mt-0.5">Trusted help. Fair work.</p>
            </div>
          </Link>

          {/* Desktop Nav Links - Customer Focused */}
          <nav className="hidden md:flex items-center p-1 bg-white/95 backdrop-blur-sm border border-[#E5DFD2] rounded-full shadow-xs gap-0.5 lg:gap-1">
            <Link
              href="/post-job"
              className={`text-xs lg:text-sm font-medium flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all whitespace-nowrap ${
                isPostJobActive
                  ? 'bg-[#EBF4F3] text-[#0D4A52] font-semibold shadow-xs'
                  : 'text-[#576563] hover:text-[#0D4A52] hover:bg-[#F3EFE6]/80'
              }`}
            >
              <PlusCircle className={`w-3.5 h-3.5 ${isPostJobActive ? 'text-[#0D4A52]' : 'text-[#217E66]'}`} />
              <span>Post a Job</span>
            </Link>

            <Link
              href="/bookings"
              className={`text-xs lg:text-sm font-medium flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all whitespace-nowrap ${
                isBookingsActive
                  ? 'bg-[#EBF4F3] text-[#0D4A52] font-semibold shadow-xs'
                  : 'text-[#576563] hover:text-[#0D4A52] hover:bg-[#F3EFE6]/80'
              }`}
            >
              <CalendarClock className={`w-3.5 h-3.5 ${isBookingsActive ? 'text-[#0D4A52]' : 'text-[#217E66]'}`} />
              <span>My Bookings</span>
            </Link>

            <Link
              href="/services"
              className={`text-xs lg:text-sm font-medium flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all whitespace-nowrap ${
                isServicesActive
                  ? 'bg-[#EBF4F3] text-[#0D4A52] font-semibold shadow-xs'
                  : 'text-[#576563] hover:text-[#0D4A52] hover:bg-[#F3EFE6]/80'
              }`}
            >
              <Wrench className={`w-3.5 h-3.5 ${isServicesActive ? 'text-[#0D4A52]' : 'text-[#217E66]'}`} />
              <span>Services</span>
            </Link>

            <Link
              href="/fair-pricing"
              className={`text-xs lg:text-sm font-medium flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all whitespace-nowrap ${
                isPricingActive
                  ? 'bg-[#EBF4F3] text-[#0D4A52] font-semibold shadow-xs'
                  : 'text-[#576563] hover:text-[#0D4A52] hover:bg-[#F3EFE6]/80'
              }`}
            >
              <Calculator className={`w-3.5 h-3.5 ${isPricingActive ? 'text-[#0D4A52]' : 'text-[#217E66]'}`} />
              <span>Fair Pricing</span>
            </Link>

            <Link
              href="/safety"
              className={`text-xs lg:text-sm font-medium flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all whitespace-nowrap ${
                isSafetyActive
                  ? 'bg-[#EBF4F3] text-[#0D4A52] font-semibold shadow-xs'
                  : 'text-[#576563] hover:text-[#0D4A52] hover:bg-[#F3EFE6]/80'
              }`}
            >
              <ShieldCheck className={`w-3.5 h-3.5 ${isSafetyActive ? 'text-[#0D4A52]' : 'text-[#217E66]'}`} />
              <span>Safety & OTP</span>
            </Link>
          </nav>

          {/* Right Action Area */}
          <div className="hidden md:flex items-center gap-3">
            {userEmail ? (
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
                <div className="w-px h-3.5 bg-[#E5DFD2] my-auto" />
                <button
                  type="button"
                  onClick={onSignOut}
                  className="p-1 hover:text-red-600 hover:bg-red-50 rounded transition-colors text-[#576563] cursor-pointer"
                  title="Sign Out"
                  aria-label="Sign out"
                >
                  <LogOut className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <Link
                href="/login?role=customer"
                className="text-xs font-semibold px-4 py-2 rounded-full bg-[#0D4A52] text-white hover:bg-[#072F35] shadow-xs transition"
              >
                Sign In
              </Link>
            )}
          </div>

          {/* Mobile Menu Toggle Button */}
          <div className="flex md:hidden items-center gap-2">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg text-[#576563] hover:text-[#0D4A52] hover:bg-[#F3EFE6] transition-colors cursor-pointer"
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden border-b border-[#E5DFD2] bg-white/98 backdrop-blur-md px-4 pt-2 pb-6 space-y-3">
          <Link
            href="/post-job"
            onClick={() => setMobileMenuOpen(false)}
            className="block text-sm font-semibold px-3 py-2 rounded-lg text-[#0D4A52] hover:bg-[#EBF4F3]"
          >
            Post a Job
          </Link>
          <Link
            href="/bookings"
            onClick={() => setMobileMenuOpen(false)}
            className="block text-sm font-semibold px-3 py-2 rounded-lg text-[#576563] hover:text-[#0D4A52] hover:bg-[#F3EFE6]"
          >
            My Bookings
          </Link>
          <Link
            href="/services"
            onClick={() => setMobileMenuOpen(false)}
            className="block text-sm font-semibold px-3 py-2 rounded-lg text-[#576563] hover:text-[#0D4A52] hover:bg-[#F3EFE6]"
          >
            Services
          </Link>
          <Link
            href="/fair-pricing"
            onClick={() => setMobileMenuOpen(false)}
            className="block text-sm font-semibold px-3 py-2 rounded-lg text-[#576563] hover:text-[#0D4A52] hover:bg-[#F3EFE6]"
          >
            Fair Pricing
          </Link>
          <Link
            href="/safety"
            onClick={() => setMobileMenuOpen(false)}
            className="block text-sm font-semibold px-3 py-2 rounded-lg text-[#576563] hover:text-[#0D4A52] hover:bg-[#F3EFE6]"
          >
            Safety & OTP
          </Link>

          <div className="pt-2 border-t border-[#E5DFD2]">
            {userEmail ? (
              <div className="flex items-center justify-between">
                <button
                  onClick={() => {
                    setIsProfileModalOpen(true);
                    setMobileMenuOpen(false);
                  }}
                  className="text-xs font-semibold text-[#0D4A52] flex items-center gap-1.5"
                >
                  <User className="w-3.5 h-3.5" />
                  <span>{displayName || userEmail}</span>
                </button>
                <button
                  onClick={onSignOut}
                  className="text-xs font-medium text-red-600 hover:underline flex items-center gap-1"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sign Out</span>
                </button>
              </div>
            ) : (
              <Link
                href="/login?role=customer"
                onClick={() => setMobileMenuOpen(false)}
                className="block text-center text-xs font-semibold py-2 px-4 rounded-full bg-[#0D4A52] text-white"
              >
                Sign In
              </Link>
            )}
          </div>
        </div>
      )}

      {/* Profile Modal */}
      <CustomerProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
      />
    </>
  );
}

