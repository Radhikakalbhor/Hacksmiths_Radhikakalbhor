'use client';

import React from 'react';
import { Award, Star, CheckCircle, Shield, Clock, ThumbsUp, MapPin } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';

export function WorkerReputationPreview() {
  return (
    <section id="reputation" className="py-20 bg-white border-t border-[#E5DFD2]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          {/* Left Narrative */}
          <div className="lg:col-span-6 space-y-6">
            <Badge variant="teal">Worker Dignity & Passport</Badge>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-[#152220] tracking-tight leading-tight">
              A portable reputation passport for every honest worker
            </h2>
            <p className="text-sm sm:text-base text-[#576563] leading-relaxed">
              In traditional platforms, workers are anonymous laborers trapped behind opaque rating
              algorithms. On Sahayak, blue-collar professionals own their verifiable track record,
              police badges, and punctuality credentials.
            </p>

            <div className="space-y-4 pt-2">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-[#EBF4F3] flex items-center justify-center text-[#0D4A52] shrink-0">
                  <Shield className="w-4 h-4 text-[#217E66]" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-[#152220]">Aadhaar & Police KYC Verification</h4>
                  <p className="text-xs text-[#576563]">
                    Workers complete physical identity and background checks before bidding on jobs.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-[#EBF4F3] flex items-center justify-center text-[#0D4A52] shrink-0">
                  <Clock className="w-4 h-4 text-[#217E66]" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-[#152220]">Verified On-Time Metrics</h4>
                  <p className="text-xs text-[#576563]">
                    Automated GPS arrival logs confirm punctual arrival without subjective hearsay.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-[#EBF4F3] flex items-center justify-center text-[#0D4A52] shrink-0">
                  <ThumbsUp className="w-4 h-4 text-[#217E66]" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-[#152220]">Direct Worker Bidding & Fair Pay</h4>
                  <p className="text-xs text-[#576563]">
                    Workers set their rates based on transparent local benchmarks and take home 90%+
                    of their earnings.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Showcase Card: The Reputation Passport */}
          <div className="lg:col-span-6">
            <Card className="bg-[#FAF9F5] border-[#E5DFD2] p-6 sm:p-8 relative shadow-sm">
              <div className="flex items-start justify-between border-b border-[#E5DFD2] pb-5">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-2xl bg-[#0D4A52] flex items-center justify-center text-white font-bold text-2xl shadow-sm">
                    आर
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-bold text-[#152220]">Rameshwar Kumar</h3>
                      <span className="p-0.5 rounded-full bg-[#217E66] text-white">
                        <CheckCircle className="w-3.5 h-3.5" />
                      </span>
                    </div>
                    <p className="text-xs text-[#217E66] font-medium">Master Plumber & Pipe Fitter</p>
                    <div className="flex items-center gap-1 text-[11px] text-[#576563] mt-0.5">
                      <MapPin className="w-3 h-3 text-[#0D4A52]" />
                      <span>Dwarka Sector 7, Delhi (Serves within 7 km)</span>
                    </div>
                  </div>
                </div>

                <Badge variant="green" className="text-[11px]">
                  Gold Tier
                </Badge>
              </div>

              {/* Passport Key Metrics */}
              <div className="grid grid-cols-3 gap-3 my-6 text-center">
                <div className="p-3 rounded-xl bg-white border border-[#E5DFD2]">
                  <div className="flex items-center justify-center gap-1 text-sm font-extrabold text-[#152220]">
                    <span>4.92</span>
                    <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                  </div>
                  <span className="text-[10px] text-[#576563]">128 Reviews</span>
                </div>

                <div className="p-3 rounded-xl bg-white border border-[#E5DFD2]">
                  <span className="text-sm font-extrabold text-[#217E66] block">98.4%</span>
                  <span className="text-[10px] text-[#576563]">On-Time Arrival</span>
                </div>

                <div className="p-3 rounded-xl bg-white border border-[#E5DFD2]">
                  <span className="text-sm font-extrabold text-[#0D4A52] block">142</span>
                  <span className="text-[10px] text-[#576563]">Jobs Finished</span>
                </div>
              </div>

              {/* Verified Badges */}
              <div className="space-y-2">
                <span className="text-[11px] uppercase font-bold tracking-wider text-[#576563] block">
                  Verified Skill Badges:
                </span>
                <div className="flex flex-wrap gap-2">
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-[#E5DFD2] text-xs text-[#152220]">
                    <Award className="w-3.5 h-3.5 text-[#0D4A52]" />
                    PPR & CPVC Expert
                  </span>
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-[#E5DFD2] text-xs text-[#152220]">
                    <Shield className="w-3.5 h-3.5 text-[#217E66]" />
                    Police Verified 2026
                  </span>
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-[#E5DFD2] text-xs text-[#152220]">
                    <Star className="w-3.5 h-3.5 text-amber-500" />
                    Zero Dispute Record
                  </span>
                </div>
              </div>

              {/* Sample Recent Customer Note */}
              <div className="mt-5 p-3 rounded-xl bg-white border border-[#E5DFD2] text-xs text-[#576563] italic">
                &quot;Rameshwar arrived 5 mins ahead of schedule, solved the continuous concealed tank leak, and charged exactly the benchmark median ₹350 without drama.&quot;
                <span className="block not-italic font-semibold text-[#152220] text-[11px] mt-1">
                  — Priya S., Dwarka Sector 6
                </span>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </section>
  );
}
