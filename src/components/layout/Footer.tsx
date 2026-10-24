import React from 'react';
import Link from 'next/link';
import { ShieldCheck, HeartHandshake, MapPin } from 'lucide-react';
import { APP_TAGLINE } from '@/lib/config/constants';

export function Footer() {
  return (
    <footer className="bg-[#FAF9F5] border-t border-[#E5DFD2] pt-14 pb-10 text-[#576563]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10 pb-12 border-b border-[#E5DFD2]">
          {/* Brand Info */}
          <div className="space-y-4 md:col-span-1">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#0D4A52] flex items-center justify-center text-white font-bold text-base">
                स
              </div>
              <span className="font-extrabold text-lg text-[#0D4A52]">Sahayak</span>
            </div>
            <p className="text-xs leading-relaxed text-[#576563]">{APP_TAGLINE}</p>
            <div className="flex items-center gap-2 text-xs text-[#217E66] font-medium pt-1">
              <ShieldCheck className="w-4 h-4" />
              <span>Verified Identity & Police Checked</span>
            </div>
          </div>

          {/* Core Marketplace Services */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-[#152220] mb-3">
              Hyperlocal Trades
            </h4>
            <ul className="space-y-2 text-xs">
              <li>
                <a href="#services" className="hover:text-[#0D4A52] transition-colors">
                  Plumbing & Leak Repairs
                </a>
              </li>
              <li>
                <a href="#services" className="hover:text-[#0D4A52] transition-colors">
                  Electricians & Rewiring
                </a>
              </li>
              <li>
                <a href="#services" className="hover:text-[#0D4A52] transition-colors">
                  Deep Home & Kitchen Cleaning
                </a>
              </li>
              <li>
                <a href="#services" className="hover:text-[#0D4A52] transition-colors">
                  Painters & Moisture Proofing
                </a>
              </li>
              <li>
                <a href="#services" className="hover:text-[#0D4A52] transition-colors">
                  House Help & Daily Maids
                </a>
              </li>
              <li>
                <a href="#services" className="hover:text-[#0D4A52] transition-colors">
                  Home Cooks & Party Chefs
                </a>
              </li>
            </ul>
          </div>

          {/* Platform Pillars */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-[#152220] mb-3">
              Trust & Architecture
            </h4>
            <ul className="space-y-2 text-xs">
              <li>
                <a href="#benchmarks" className="hover:text-[#0D4A52] transition-colors">
                  Local Price Benchmarks
                </a>
              </li>
              <li>
                <a href="#safety" className="hover:text-[#0D4A52] transition-colors">
                  Two-Stage OTP Verification
                </a>
              </li>
              <li>
                <a href="#safety" className="hover:text-[#0D4A52] transition-colors">
                  1-Tap SOS Emergency Alerts
                </a>
              </li>
              <li>
                <a href="#reputation" className="hover:text-[#0D4A52] transition-colors">
                  Worker Reputation Passport
                </a>
              </li>
              <li>
                <Link href="/api/health" className="hover:text-[#0D4A52] transition-colors">
                  System Health & API Diagnostics
                </Link>
              </li>
            </ul>
          </div>

          {/* Community & Safety Commitment */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-[#152220] mb-3">
              Community Shield
            </h4>
            <p className="text-xs text-[#576563] leading-relaxed">
              Sahayak is committed to fair wages for unorganized blue-collar trades and zero-fraud
              transparency for homeowners.
            </p>
            <div className="p-3 rounded-lg bg-[#EBF4F3] border border-[#CDE3E1] text-[11px] text-[#0D4A52] space-y-1">
              <div className="font-semibold flex items-center gap-1.5">
                <HeartHandshake className="w-3.5 h-3.5" />
                <span>Fair Pay Guarantee</span>
              </div>
              <p className="text-[#3F5B57]">
                Real-time micro-market median pricing prevents worker exploitation and price gouging.
              </p>
            </div>
          </div>
        </div>

        <div className="pt-6 flex flex-col sm:flex-row items-center justify-between text-xs text-[#83928E] gap-3">
          <p>© 2026 Sahayak Technologies. Built for 24-hour Hackathon.</p>
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <MapPin className="w-3 h-3 text-[#217E66]" />
              <span>Hyperlocal PostGIS Engine</span>
            </span>
            <span>•</span>
            <span>Supabase + Next.js App Router</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
