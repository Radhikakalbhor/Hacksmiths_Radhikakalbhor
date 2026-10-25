'use client';

import React, { useState } from 'react';
import { ShieldAlert, CheckCircle2 } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';

interface BenchmarkItem {
  id: string;
  category: string;
  task: string;
  marketInflatedPriceInr: number;
  sahayakMedianInr: number;
  minPriceInr: number;
  maxPriceInr: number;
  savingsPercentage: number;
  workerPocketsPercentage: number;
}

const SAMPLE_BENCHMARKS: BenchmarkItem[] = [
  {
    id: '1',
    category: 'Plumbing',
    task: 'Tap Leakage / Spindle Replacement',
    marketInflatedPriceInr: 650,
    sahayakMedianInr: 320,
    minPriceInr: 250,
    maxPriceInr: 400,
    savingsPercentage: 51,
    workerPocketsPercentage: 92,
  },
  {
    id: '2',
    category: 'Electrical',
    task: 'Ceiling Fan Installation & Balance',
    marketInflatedPriceInr: 550,
    sahayakMedianInr: 280,
    minPriceInr: 200,
    maxPriceInr: 350,
    savingsPercentage: 49,
    workerPocketsPercentage: 92,
  },
  {
    id: '3',
    category: 'Deep Cleaning',
    task: 'Kitchen Chimney & Counter Degreasing',
    marketInflatedPriceInr: 1600,
    sahayakMedianInr: 850,
    minPriceInr: 750,
    maxPriceInr: 1050,
    savingsPercentage: 47,
    workerPocketsPercentage: 94,
  },
  {
    id: '4',
    category: 'Appliance Repair',
    task: 'AC Jet Cleaning & Filter Wash',
    marketInflatedPriceInr: 899,
    sahayakMedianInr: 480,
    minPriceInr: 400,
    maxPriceInr: 600,
    savingsPercentage: 46,
    workerPocketsPercentage: 90,
  },
];

export function BenchmarkPreview() {
  const [selectedBenchmark, setSelectedBenchmark] = useState<BenchmarkItem>(SAMPLE_BENCHMARKS[0]);

  return (
    <section id="benchmarks" className="py-20 bg-transparent border-t border-[#E5DFD2]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-2xl mx-auto space-y-3 mb-14">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-[#152220] tracking-tight">
            No more inflated quotes. Zero hidden markups.
          </h2>
          <p className="text-sm sm:text-base text-[#576563]">
            Traditional aggregators take up to 30% cuts and inflate customer fees. Sahayak calculates
            hyper-local neighborhood price benchmarks so you know the honest rate before workers bid.
          </p>
        </div>

        {/* Interactive Comparison Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Selection List */}
          <div className="lg:col-span-5 space-y-3">
            <span className="text-xs uppercase font-bold tracking-wider text-[#576563] px-1">
              Select Sample Neighborhood Trade:
            </span>
            {SAMPLE_BENCHMARKS.map((item) => {
              const isSelected = selectedBenchmark.id === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelectedBenchmark(item)}
                  className={`w-full text-left p-4 rounded-xl border transition-all flex items-center justify-between ${
                    isSelected
                      ? 'bg-white border-[#0D4A52] shadow-sm ring-1 ring-[#0D4A52]'
                      : 'bg-white/60 border-[#E5DFD2] hover:bg-white hover:border-[#D4CCC0]'
                  }`}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-[#0D4A52]">{item.category}</span>
                      <span className="text-[10px] text-[#217E66] font-bold bg-[#EDF7F4] px-1.5 py-0.5 rounded">
                        Save {item.savingsPercentage}%
                      </span>
                    </div>
                    <p className="text-sm font-semibold text-[#152220] mt-1">{item.task}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-[#83928E] line-through block">
                      ₹{item.marketInflatedPriceInr}
                    </span>
                    <span className="text-base font-extrabold text-[#217E66]">
                      ₹{item.sahayakMedianInr}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Right Deep Dive Card */}
          <div className="lg:col-span-7">
            <Card className="p-6 sm:p-8 bg-white border-[#E5DFD2]">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E5DFD2] pb-5 mb-6">
                <div>
                  <div className="flex items-center gap-2">
                    <Badge variant="teal">{selectedBenchmark.category}</Badge>
                    <span className="text-xs text-[#576563]">Micro-Market: South West Delhi</span>
                  </div>
                  <h3 className="text-xl font-bold text-[#152220] mt-1.5">
                    {selectedBenchmark.task}
                  </h3>
                </div>
                <div className="text-right">
                  <span className="text-[11px] text-[#576563] block">Benchmark Range</span>
                  <span className="text-lg font-extrabold text-[#0D4A52]">
                    ₹{selectedBenchmark.minPriceInr} – ₹{selectedBenchmark.maxPriceInr}
                  </span>
                </div>
              </div>

              {/* Price Breakdown Comparison Bars */}
              <div className="space-y-6">
                {/* Traditional Aggregators */}
                <div className="p-4 rounded-xl bg-[#FFFBF7] border border-[#FEE2E2]">
                  <div className="flex items-center justify-between text-xs mb-2">
                    <span className="font-semibold text-[#991B1B] flex items-center gap-1.5">
                      <ShieldAlert className="w-4 h-4" />
                      Typical App Aggregator / Unorganized
                    </span>
                    <span className="font-bold text-sm text-[#991B1B]">
                      ₹{selectedBenchmark.marketInflatedPriceInr}
                    </span>
                  </div>
                  <div className="w-full bg-red-100 h-2.5 rounded-full overflow-hidden flex">
                    <div className="bg-red-300 w-[60%]" title="Worker Base Share" />
                    <div className="bg-red-500 w-[40%]" title="App Commission (up to 30-40%)" />
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-[#7F1D1D] mt-2">
                    <span>Includes 25-35% middleman aggregator platform cut</span>
                    <span>Worker takes: ~60%</span>
                  </div>
                </div>

                {/* Sahayak Verified Fair Median */}
                <div className="p-4 rounded-xl bg-[#F0FAF7] border border-[#A7F3D0]">
                  <div className="flex items-center justify-between text-xs mb-2">
                    <span className="font-semibold text-[#065F46] flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-[#059669]" />
                      Sahayak Local Fair Median
                    </span>
                    <span className="font-bold text-base text-[#065F46]">
                      ₹{selectedBenchmark.sahayakMedianInr}
                    </span>
                  </div>
                  <div className="w-full bg-emerald-100 h-2.5 rounded-full overflow-hidden flex">
                    <div className="bg-[#217E66] w-[92%]" title="Worker Direct Earnings" />
                    <div className="bg-[#0D4A52] w-[8%]" title="Micro Infrastructure Fee" />
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-[#065F46] mt-2 font-medium">
                    <span>Direct worker bidding with zero artificial price hikes</span>
                    <span>Worker keeps: {selectedBenchmark.workerPocketsPercentage}%+</span>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </section>
  );
}
