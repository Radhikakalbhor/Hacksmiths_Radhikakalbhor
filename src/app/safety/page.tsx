import type { Metadata } from 'next';
import Link from 'next/link';
import { WorkerReputationPreview } from '@/components/landing/WorkerReputationPreview';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { KeyRound, CheckCircle2, ShieldAlert, ShieldCheck, ArrowRight, Lock, PhoneCall } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Safety Protocols & OTP Verification | Sahayak',
  description:
    'Learn how Sahayak protects homeowners and service workers with Aadhaar KYC, two-stage OTP job handshakes, portable reputation passports, and 1-tap SOS emergency response.',
};

export default function SafetyPage() {
  return (
    <main className="min-h-screen bg-transparent">
      {/* Hero Header & Quick Safety Pillars */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 space-y-6">
        {/* Nice Hero Header Card */}
        <div className="bg-white/95 backdrop-blur-md rounded-2xl border border-[#E5DFD2] p-6 sm:p-8 shadow-xl">
          <div className="max-w-3xl space-y-3">
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-[#152220] tracking-tight">
              Safety engineered into every single job
            </h1>
            <p className="text-base sm:text-lg text-[#576563] leading-relaxed">
              Inviting someone into your home requires complete confidence. Sahayak eliminates impersonation, fraud, and disputes through multi-layer verification, cryptographic OTP handshakes, and 24/7 emergency response.
            </p>
          </div>
        </div>

        {/* Independent Safety Pillar Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="flex items-start gap-3 p-4 rounded-xl bg-white/95 backdrop-blur-md border border-[#E5DFD2] shadow-xl">
            <div className="w-9 h-9 rounded-lg bg-[#EBF4F3] flex items-center justify-center text-[#0D4A52] shrink-0 mt-0.5">
              <KeyRound className="w-5 h-5 text-[#217E66]" />
            </div>
            <div>
              <span className="text-xs font-bold text-[#152220] block">Start OTP Handshake</span>
              <span className="text-xs text-[#576563]">Workers cannot begin without physical doorstep verification. Zero impersonation.</span>
            </div>
          </div>

          <div className="flex items-start gap-3 p-4 rounded-xl bg-white/95 backdrop-blur-md border border-[#E5DFD2] shadow-xl">
            <div className="w-9 h-9 rounded-lg bg-[#EBF4F3] flex items-center justify-center text-[#0D4A52] shrink-0 mt-0.5">
              <CheckCircle2 className="w-5 h-5 text-[#217E66]" />
            </div>
            <div>
              <span className="text-xs font-bold text-[#152220] block">Completion OTP Release</span>
              <span className="text-xs text-[#576563]">Payment is released only after you inspect the completed repair and furnish the code.</span>
            </div>
          </div>

          <div className="flex items-start gap-3 p-4 rounded-xl bg-white/95 backdrop-blur-md border border-[#E5DFD2] shadow-xl">
            <div className="w-9 h-9 rounded-lg bg-amber-50 flex items-center justify-center text-amber-600 shrink-0 mt-0.5">
              <ShieldAlert className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <span className="text-xs font-bold text-[#152220] block">1-Tap Emergency SOS</span>
              <span className="text-xs text-[#576563]">Instant GPS broadcast to registered emergency contacts and local authorities.</span>
            </div>
          </div>
        </div>
      </div>

      {/* Worker Reputation & KYC Verification Section */}
      <WorkerReputationPreview />

      {/* Safety Rules for Homeowners & Workers */}
      <section className="py-16 bg-transparent border-t border-[#E5DFD2]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto space-y-3 mb-12">
            <Badge variant="green">Safety First Standard</Badge>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[#152220]">
              The Sahayak 4-Point Safety Guarantee
            </h2>
            <p className="text-sm text-[#576563]">
              Every booking is shielded by automated safeguards to keep both homeowners and blue-collar professionals safe.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card className="bg-[#FAF9F5] border-[#E5DFD2] p-5 space-y-3">
              <div className="w-9 h-9 rounded-lg bg-[#EBF4F3] flex items-center justify-center text-[#0D4A52]">
                <ShieldCheck className="w-5 h-5 text-[#217E66]" />
              </div>
              <h3 className="text-sm font-bold text-[#152220]">1. Verified Identity</h3>
              <p className="text-xs text-[#576563] leading-relaxed">
                Govt-issued Aadhaar identity matches the live photo profile before any worker receives access to job details.
              </p>
            </Card>

            <Card className="bg-[#FAF9F5] border-[#E5DFD2] p-5 space-y-3">
              <div className="w-9 h-9 rounded-lg bg-[#EBF4F3] flex items-center justify-center text-[#0D4A52]">
                <Lock className="w-5 h-5 text-[#217E66]" />
              </div>
              <h3 className="text-sm font-bold text-[#152220]">2. Private Number Masking</h3>
              <p className="text-xs text-[#576563] leading-relaxed">
                Personal phone numbers remain confidential. In-app communication protects privacy for both homeowner and worker.
              </p>
            </Card>

            <Card className="bg-[#FAF9F5] border-[#E5DFD2] p-5 space-y-3">
              <div className="w-9 h-9 rounded-lg bg-[#EBF4F3] flex items-center justify-center text-[#0D4A52]">
                <KeyRound className="w-5 h-5 text-[#217E66]" />
              </div>
              <h3 className="text-sm font-bold text-[#152220]">3. Doorstep OTP Auth</h3>
              <p className="text-xs text-[#576563] leading-relaxed">
                Work begins only when the home owner verifies the worker in person and provides the unique 4-digit session code.
              </p>
            </Card>

            <Card className="bg-[#FAF9F5] border-[#E5DFD2] p-5 space-y-3">
              <div className="w-9 h-9 rounded-lg bg-[#EBF4F3] flex items-center justify-center text-[#0D4A52]">
                <PhoneCall className="w-5 h-5 text-[#217E66]" />
              </div>
              <h3 className="text-sm font-bold text-[#152220]">4. 24/7 SOS Escort</h3>
              <p className="text-xs text-[#576563] leading-relaxed">
                Both parties can trigger emergency response in one touch, transmitting real-time coordinates to trusted family contacts.
              </p>
            </Card>
          </div>

          <div className="mt-10 text-center">
            <Link
              href="/post-job"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-[#0D4A52] text-white font-medium text-sm hover:bg-[#072F35] shadow-sm transition-all"
            >
              <span>Book Verified & Safe Service Now</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
