import type { Metadata } from 'next';
import { BenchmarkPreview } from '@/components/landing/BenchmarkPreview';
import { TrendingDown, Coins, Scale } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Fair & Transparent Pricing | Sahayak',
  description:
    'Compare transparent local price benchmarks against inflated aggregators. Discover real neighborhood median costs where workers take home 90%+ and homeowners save up to 50%.',
};

export default function FairPricingPage() {
  return (
    <main className="min-h-screen bg-transparent">
      {/* Hero Header & Key Pricing Metrics */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 space-y-6">
        {/* Nice Hero Header Card */}
        <div className="bg-white/95 backdrop-blur-md rounded-2xl border border-[#E5DFD2] p-6 sm:p-8 shadow-xl">
          <div className="max-w-3xl space-y-3">
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-[#152220] tracking-tight">
              Fair & transparent local price benchmarks
            </h1>
            <p className="text-base sm:text-lg text-[#576563] leading-relaxed">
              Traditional aggregators mark up services by 30%–70% while squeezing workers. Sahayak introduces open-source hyper-local price benchmarks so you know the honest market rate before booking.
            </p>
          </div>
        </div>

        {/* Independent Metric Cards (Average Savings, Worker Pockets, Open Benchmark) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 rounded-xl bg-white/95 backdrop-blur-md border border-[#E5DFD2] shadow-xl">
            <div className="flex items-center gap-2 text-[#217E66] mb-1">
              <TrendingDown className="w-4 h-4" />
              <span className="text-xs font-bold uppercase tracking-wider">Average Savings</span>
            </div>
            <div className="text-2xl font-extrabold text-[#152220]">Up to 48%</div>
            <p className="text-xs text-[#576563] mt-1">Lower costs compared to bloated corporate aggregator platform fees.</p>
          </div>

          <div className="p-4 rounded-xl bg-white/95 backdrop-blur-md border border-[#E5DFD2] shadow-xl">
            <div className="flex items-center gap-2 text-[#0D4A52] mb-1">
              <Coins className="w-4 h-4" />
              <span className="text-xs font-bold uppercase tracking-wider">Worker Pockets</span>
            </div>
            <div className="text-2xl font-extrabold text-[#152220]">90%+ Take-Home</div>
            <p className="text-xs text-[#576563] mt-1">Direct bidding means hardworking tradesmen retain what they earn.</p>
          </div>

          <div className="p-4 rounded-xl bg-white/95 backdrop-blur-md border border-[#E5DFD2] shadow-xl">
            <div className="flex items-center gap-2 text-[#217E66] mb-1">
              <Scale className="w-4 h-4" />
              <span className="text-xs font-bold uppercase tracking-wider">Open Benchmark</span>
            </div>
            <div className="text-2xl font-extrabold text-[#152220]">100% Transparent</div>
            <p className="text-xs text-[#576563] mt-1">Empirical minimum, median, and maximum rates visible to everyone.</p>
          </div>
        </div>
      </div>

      {/* Interactive Benchmark Comparison Section */}
      <BenchmarkPreview />
    </main>
  );
}
