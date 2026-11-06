'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';

export function Footer() {
  const pathname = usePathname();

  // Hide footer on admin routes or auth pages
  if (pathname?.startsWith('/admin') || pathname === '/login') {
    return null;
  }

  return (
    <footer className="w-full border-t border-[#E5DFD2] bg-[#FAF9F5]/90 backdrop-blur-sm mt-auto py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          {/* Logo & Brand Info */}
          <div className="flex items-center gap-3.5">
            <Link href="/" className="flex items-center gap-3 group">
              <Image
                src="/images/logo.png"
                alt="Sahayak Logo"
                width={44}
                height={44}
                className="w-11 h-11 rounded-xl object-cover shadow-xs border border-[#E5DFD2] group-hover:scale-105 transition-transform"
              />
              <div className="flex flex-col">
                <span className="font-extrabold text-xl text-[#0D4A52] tracking-tight group-hover:text-[#072F35] transition-colors leading-none">
                  Sahayak
                </span>
                <span className="text-xs text-[#576563] font-medium mt-1">
                  Aapka Bharosemand Sahayak &bull; Home Services
                </span>
              </div>
            </Link>
          </div>

          {/* Quick Links */}
          <div className="flex flex-wrap items-center justify-center gap-6 text-xs sm:text-sm font-medium text-[#576563]">
            <Link href="/services" className="hover:text-[#0D4A52] transition-colors">
              Find Services
            </Link>
            <Link href="/fair-pricing" className="hover:text-[#0D4A52] transition-colors">
              Fair Pricing
            </Link>
            <Link href="/safety" className="hover:text-[#0D4A52] transition-colors">
              Trust &amp; Safety
            </Link>
            <Link href="/login?role=worker" className="hover:text-[#0D4A52] transition-colors">
              Become a Partner
            </Link>
          </div>

          {/* Copyright */}
          <div className="text-xs text-[#576563] text-center md:text-right">
            <span>&copy; {new Date().getFullYear()} Sahayak Technologies. All rights reserved.</span>
          </div>
        </div>
      </div>
    </footer>
  );
}


