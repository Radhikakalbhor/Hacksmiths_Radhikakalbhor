'use client';

import { KeyRound, ShieldAlert, CheckCircle2, PhoneForwarded } from 'lucide-react';
import { Card } from '@/components/ui/Card';

export function SafetyFlow() {
  return (
    <section id="safety" className="py-20 bg-transparent border-t border-[#E5DFD2]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-2xl mx-auto space-y-3 mb-14">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-[#152220] tracking-tight">
            Safety engineered into every single job
          </h2>
          <p className="text-sm sm:text-base text-[#576563]">
            Inviting someone into your home requires complete confidence. Sahayak eliminates fraud
            and protects both customers and service providers.
          </p>
        </div>

        {/* 3 Step Safety Protocol Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Step 1: Start OTP */}
          <Card className="bg-white border-[#E5DFD2] relative overflow-hidden space-y-4">
            <div className="w-10 h-10 rounded-xl bg-[#EBF4F3] flex items-center justify-center text-[#0D4A52]">
              <KeyRound className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <span className="text-[10px] uppercase font-bold tracking-wider text-[#217E66]">
                Protocol 01
              </span>
              <h3 className="text-lg font-bold text-[#152220]">Start OTP Verification</h3>
            </div>
            <p className="text-xs text-[#576563] leading-relaxed">
              When the worker arrives at your doorstep, verify their identity against their photo ID.
              Work can only commence once you reveal your 4-digit Job Start OTP.
            </p>
            <div className="p-3 rounded-lg bg-[#FAF9F5] border border-[#E5DFD2] text-[11px] font-mono text-[#0D4A52] flex items-center justify-between">
              <span>Start Code: • • • •</span>
              <span className="text-[#217E66] font-semibold text-[10px]">Zero Impersonation</span>
            </div>
          </Card>

          {/* Step 2: Completion OTP */}
          <Card className="bg-white border-[#E5DFD2] relative overflow-hidden space-y-4">
            <div className="w-10 h-10 rounded-xl bg-[#EDF7F4] flex items-center justify-center text-[#217E66]">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <span className="text-[10px] uppercase font-bold tracking-wider text-[#217E66]">
                Protocol 02
              </span>
              <h3 className="text-lg font-bold text-[#152220]">Job Completion Handshake</h3>
            </div>
            <p className="text-xs text-[#576563] leading-relaxed">
              Never pay upfront for incomplete repairs. Inspect the repair work, verify that the site
              is clean, and only then furnish the Completion OTP to authorize payment release.
            </p>
            <div className="p-3 rounded-lg bg-[#FAF9F5] border border-[#E5DFD2] text-[11px] font-mono text-[#217E66] flex items-center justify-between">
              <span>Payment Release Guard</span>
              <span className="font-semibold text-[10px]">Verified Quality</span>
            </div>
          </Card>

          {/* Step 3: SOS Emergency Guard */}
          <Card className="bg-white border-[#FDE68A] relative overflow-hidden space-y-4">
            <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-700">
              <ShieldAlert className="w-5 h-5 text-amber-600" />
            </div>
            <div className="space-y-1">
              <span className="text-[10px] uppercase font-bold tracking-wider text-amber-700">
                Protocol 03
              </span>
              <h3 className="text-lg font-bold text-[#152220]">1-Tap SOS Emergency Shield</h3>
            </div>
            <p className="text-xs text-[#576563] leading-relaxed">
              Both customer and worker have immediate access to a discreet SOS button. Tapping it
              broadcasts live GPS coordinates to your registered emergency contacts and local responders.
            </p>
            <div className="p-3 rounded-lg bg-amber-50/70 border border-amber-200 text-[11px] text-amber-900 flex items-center justify-between">
              <span className="flex items-center gap-1.5 font-medium">
                <PhoneForwarded className="w-3.5 h-3.5" />
                Trusted Contacts Sync
              </span>
              <span className="font-bold text-[10px]">Active 24/7</span>
            </div>
          </Card>
        </div>
      </div>
    </section>
  );
}
