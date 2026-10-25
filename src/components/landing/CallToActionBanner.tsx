'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowRight, UserCheck } from 'lucide-react';

export function CallToActionBanner() {
  return (
    <section className="py-16 bg-[#FAF9F5] border-t border-[#E5DFD2]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-[#0D4A52] rounded-3xl p-8 sm:p-14 text-white relative overflow-hidden shadow-lg">
          {/* Subtle background ambient circles */}
          <div className="absolute -top-16 -right-16 w-64 h-64 bg-[#217E66]/30 rounded-full blur-2xl pointer-events-none" />
          <div className="absolute -bottom-16 -left-16 w-64 h-64 bg-[#072F35] rounded-full blur-2xl pointer-events-none" />

          <div className="relative z-10 max-w-2xl space-y-5">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-white/10 text-emerald-200 border border-white/15">
              <span>Hyperlocal Community Revolution</span>
            </span>

            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white leading-tight">
              Ready to find honest local help or earn fair wages?
            </h2>

            <p className="text-sm sm:text-base text-teal-100/80 leading-relaxed">
              Join thousands of neighbors and skilled tradesmen experiencing fair price benchmarks,
              verified credentials, and mutual safety on Sahayak.
            </p>

            <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <Link
                href="/post-job"
                className="inline-flex items-center justify-center font-semibold rounded-lg transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-offset-2 px-6 py-3 text-base gap-2 text-white bg-[#217E66] hover:bg-[#165646] focus:ring-[#217E66] shadow-sm"
              >
                <span>Post a Job Free</span>
                <ArrowRight className="w-4 h-4" />
              </Link>

              <Link
                href="/login?role=worker"
                className="inline-flex items-center justify-center font-semibold rounded-lg transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-offset-2 px-6 py-3 text-base gap-2 bg-transparent text-white border border-white/30 hover:bg-white/10 focus:ring-[#0D4A52]"
              >
                <UserCheck className="w-4 h-4 text-emerald-300" />
                <span>Register as a Sahayak Partner</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
