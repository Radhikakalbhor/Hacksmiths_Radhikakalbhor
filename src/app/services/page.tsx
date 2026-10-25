import type { Metadata } from 'next';
import { ServicesGrid } from '@/components/landing/ServicesGrid';
import { CheckCircle2, Shield, IndianRupee, Clock } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Local Services & Skilled Trades | Sahayak',
  description:
    'Browse verified local service categories from emergency plumbing and electrical to deep cleaning and appliance repairs. Fair prices, verified tradesmen, and zero hidden markups.',
};

export default function ServicesPage() {
  return (
    <main className="min-h-screen bg-transparent">
      {/* Hero Header */}
      <div className="bg-transparent border-b border-[#E5DFD2]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
          <div className="max-w-3xl space-y-4">
            <h1 className="text-3xl sm:text-5xl font-extrabold text-[#152220] tracking-tight">
              Skilled help for every home requirement
            </h1>
            <p className="text-base sm:text-lg text-[#576563] leading-relaxed">
              From emergency pipe leaks to daily household help, find verified neighborhood tradesmen ready to bid transparently.
            </p>
          </div>
        </div>
      </div>

      {/* Services Grid Section (Cards) */}
      <ServicesGrid />

      {/* Quick Value Badges placed below the cards */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-8 border-t border-[#E5DFD2]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#EBF4F3] flex items-center justify-center text-[#217E66] shrink-0">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-bold text-[#152220] block">Aadhaar Verified</span>
              <span className="text-[11px] text-[#576563]">100% Police Checked</span>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#EBF4F3] flex items-center justify-center text-[#217E66] shrink-0">
              <IndianRupee className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-bold text-[#152220] block">Fair Price Matrix</span>
              <span className="text-[11px] text-[#576563]">Zero Inflated Rates</span>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#EBF4F3] flex items-center justify-center text-[#217E66] shrink-0">
              <Shield className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-bold text-[#152220] block">Two-Stage OTP</span>
              <span className="text-[11px] text-[#576563]">Safe Job Handshakes</span>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#EBF4F3] flex items-center justify-center text-[#217E66] shrink-0">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-bold text-[#152220] block">Fast Local Dispatch</span>
              <span className="text-[11px] text-[#576563]">Under 15-min Bids</span>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
