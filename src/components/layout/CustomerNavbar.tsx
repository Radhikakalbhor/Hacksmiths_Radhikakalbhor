'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import {
  IconPlus,
  IconCalendar,
  IconTools,
  IconCalculator,
  IconShieldCheck,
  IconUser,
  IconArrowLeft,
  IconLogin,
} from '@tabler/icons-react';
import { motion } from 'motion/react';
import { Sidebar, SidebarBody, SidebarLink } from '@/components/ui/sidebar';
import { CustomerProfileModal } from '@/components/profile/CustomerProfileModal';

interface CustomerNavbarProps {
  userEmail: string | null;
  displayName: string | null;
  onSignOut: () => Promise<void>;
}

export const CustomerLogo = () => {
  return (
    <Link
      href="/post-job"
      className="relative z-20 flex items-center space-x-2.5 py-1 text-sm font-normal group"
    >
      <Image
        src="/images/logo.png"
        alt="Sahayak Logo"
        width={32}
        height={32}
        className="w-7 h-7 rounded-lg object-cover shadow-xs border border-[#E5DFD2]/60 shrink-0 group-hover:scale-105 transition-transform"
        priority
      />
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex flex-col overflow-hidden"
      >
        <span className="font-extrabold text-base text-[#0D4A52] tracking-tight whitespace-pre leading-none group-hover:text-[#072F35] transition">
          Sahayak
        </span>
        <span className="text-[9px] text-[#576563] tracking-wide whitespace-pre mt-0.5">
          Trusted help. Fair work.
        </span>
      </motion.div>
    </Link>
  );
};

export const CustomerLogoIcon = () => {
  return (
    <Link
      href="/post-job"
      className="relative z-20 flex items-center justify-center py-1 group"
      title="Sahayak"
    >
      <Image
        src="/images/logo.png"
        alt="Sahayak Logo"
        width={32}
        height={32}
        className="w-7 h-7 rounded-lg object-cover shadow-xs border border-[#E5DFD2]/60 shrink-0 group-hover:scale-105 transition-transform"
        priority
      />
    </Link>
  );
};

export function CustomerNavbar({ userEmail, displayName, onSignOut }: CustomerNavbarProps) {
  const [open, setOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const pathname = usePathname();

  const isPostJobActive = pathname === '/post-job' || pathname === '/';
  const isBookingsActive = pathname === '/bookings' || pathname === '/my-jobs' || pathname === '/booking-history';
  const isServicesActive = pathname === '/services' || pathname === '/search-workers';
  const isPricingActive = pathname === '/fair-pricing' || pathname === '/pricing';
  const isSafetyActive = pathname === '/safety';

  const customerLinks = [
    {
      label: 'Assign a Job',
      href: '/post-job',
      active: isPostJobActive,
      icon: (
        <IconPlus
          className={`h-5 w-5 shrink-0 transition-colors ${
            isPostJobActive ? 'text-[#0D4A52]' : 'text-[#217E66]'
          }`}
        />
      ),
    },
    {
      label: 'My Bookings',
      href: '/bookings',
      active: isBookingsActive,
      icon: (
        <IconCalendar
          className={`h-5 w-5 shrink-0 transition-colors ${
            isBookingsActive ? 'text-[#0D4A52]' : 'text-neutral-600'
          }`}
        />
      ),
    },
    {
      label: 'Services',
      href: '/services',
      active: isServicesActive,
      icon: (
        <IconTools
          className={`h-5 w-5 shrink-0 transition-colors ${
            isServicesActive ? 'text-[#0D4A52]' : 'text-neutral-600'
          }`}
        />
      ),
    },
    {
      label: 'Fair Pricing',
      href: '/fair-pricing',
      active: isPricingActive,
      icon: (
        <IconCalculator
          className={`h-5 w-5 shrink-0 transition-colors ${
            isPricingActive ? 'text-[#0D4A52]' : 'text-neutral-600'
          }`}
        />
      ),
    },
    {
      label: 'Safety & OTP',
      href: '/safety',
      active: isSafetyActive,
      icon: (
        <IconShieldCheck
          className={`h-5 w-5 shrink-0 transition-colors ${
            isSafetyActive ? 'text-[#0D4A52]' : 'text-neutral-600'
          }`}
        />
      ),
    },
  ];

  return (
    <>
      {/* Desktop Left Collapsible Sidebar */}
      <div className="fixed top-0 left-0 bottom-0 z-50 h-screen hidden md:block">
        <Sidebar open={open} setOpen={setOpen}>
          <SidebarBody className="justify-between gap-10 h-full bg-white/95 backdrop-blur-md border-r border-[#E5DFD2] shadow-xs">
            <div className="flex flex-1 flex-col overflow-x-hidden overflow-y-auto">
              {open ? <CustomerLogo /> : <CustomerLogoIcon />}
              <div className="mt-8 flex flex-col gap-1.5">
                {customerLinks.map((link, idx) => (
                  <SidebarLink key={idx} link={link} active={link.active} />
                ))}
              </div>
            </div>
            <div className="border-t border-[#E5DFD2] pt-3 flex flex-col gap-1">
              {userEmail ? (
                <>
                  <SidebarLink
                    link={{
                      label: displayName || userEmail.split('@')[0],
                      icon: (
                        <div className="h-6 w-6 rounded-full bg-[#0D4A52] text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-2xs">
                          {(displayName || userEmail)[0]?.toUpperCase()}
                        </div>
                      ),
                      onClick: () => setIsProfileModalOpen(true),
                    }}
                  />
                  <SidebarLink
                    link={{
                      label: 'Sign Out',
                      icon: <IconArrowLeft className="h-5 w-5 text-rose-600 shrink-0" />,
                      onClick: onSignOut,
                    }}
                  />
                </>
              ) : (
                <SidebarLink
                  link={{
                    label: 'Sign In',
                    href: '/login?role=customer',
                    icon: <IconLogin className="h-5 w-5 text-[#0D4A52] shrink-0" />,
                  }}
                />
              )}
            </div>
          </SidebarBody>
        </Sidebar>
      </div>

      {/* Mobile Top Navbar with Drawer */}
      <div className="md:hidden sticky top-0 z-50 w-full bg-white/95 backdrop-blur-md border-b border-[#E5DFD2]">
        <Sidebar open={open} setOpen={setOpen}>
          <SidebarBody className="justify-between gap-8">
            <div className="flex flex-1 flex-col overflow-x-hidden overflow-y-auto">
              <CustomerLogo />
              <div className="mt-8 flex flex-col gap-2">
                {customerLinks.map((link, idx) => (
                  <SidebarLink
                    key={idx}
                    link={link}
                    active={link.active}
                    onClick={() => setOpen(false)}
                  />
                ))}
              </div>
            </div>
            <div className="border-t border-[#E5DFD2] pt-4 flex flex-col gap-2">
              {userEmail ? (
                <>
                  <SidebarLink
                    link={{
                      label: displayName || userEmail.split('@')[0],
                      icon: (
                        <div className="h-6 w-6 rounded-full bg-[#0D4A52] text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-2xs">
                          {(displayName || userEmail)[0]?.toUpperCase()}
                        </div>
                      ),
                      onClick: () => {
                        setOpen(false);
                        setIsProfileModalOpen(true);
                      },
                    }}
                  />
                  <SidebarLink
                    link={{
                      label: 'Sign Out',
                      icon: <IconArrowLeft className="h-5 w-5 text-rose-600 shrink-0" />,
                      onClick: async () => {
                        setOpen(false);
                        await onSignOut();
                      },
                    }}
                  />
                </>
              ) : (
                <SidebarLink
                  link={{
                    label: 'Sign In',
                    href: '/login?role=customer',
                    icon: <IconLogin className="h-5 w-5 text-[#0D4A52] shrink-0" />,
                    onClick: () => setOpen(false),
                  }}
                />
              )}
            </div>
          </SidebarBody>
        </Sidebar>
      </div>

      {/* Profile Modal */}
      {isProfileModalOpen && (
        <CustomerProfileModal
          isOpen={isProfileModalOpen}
          onClose={() => setIsProfileModalOpen(false)}
          onProfileUpdated={() => {
            if (typeof window !== 'undefined') {
              window.location.reload();
            }
          }}
        />
      )}
    </>
  );
}
