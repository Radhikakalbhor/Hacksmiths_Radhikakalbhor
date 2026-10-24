'use client';

import React from 'react';
import Link from 'next/link';
import {
  Wrench,
  Zap,
  Sparkles,
  Paintbrush,
  Home,
  Utensils,
  Hammer,
  Tv,
  ArrowRight,
} from 'lucide-react';
import { SERVICE_CATEGORIES } from '@/lib/config/constants';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';

const ICON_MAP: Record<string, React.ReactNode> = {
  Wrench: <Wrench className="w-5 h-5 text-[#0D4A52]" />,
  Zap: <Zap className="w-5 h-5 text-[#0D4A52]" />,
  Sparkles: <Sparkles className="w-5 h-5 text-[#0D4A52]" />,
  Paintbrush: <Paintbrush className="w-5 h-5 text-[#0D4A52]" />,
  Home: <Home className="w-5 h-5 text-[#0D4A52]" />,
  Utensils: <Utensils className="w-5 h-5 text-[#0D4A52]" />,
  Hammer: <Hammer className="w-5 h-5 text-[#0D4A52]" />,
  Tv: <Tv className="w-5 h-5 text-[#0D4A52]" />,
};

export function ServicesGrid() {
  return (
    <section id="services" className="py-20 bg-white border-t border-[#E5DFD2]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-2xl mx-auto space-y-3 mb-14">
          <Badge variant="teal">Vetted Blue-Collar Trades</Badge>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-[#152220] tracking-tight">
            Skilled help for every home requirement
          </h2>
          <p className="text-sm sm:text-base text-[#576563]">
            From emergency pipe leaks to daily household helpers, find verified neighborhood
            tradesmen ready to bid transparently.
          </p>
        </div>

        {/* 8 Category Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {SERVICE_CATEGORIES.map((category) => (
            <Link
              key={category.id}
              href={`/post-job?category=${encodeURIComponent(category.id)}`}
              className="group block rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0D4A52] focus:ring-offset-2 transition-transform"
              aria-label={`Post a job for ${category.name} (${category.hindiName})`}
            >
              <Card
                hoverEffect
                className="h-full flex flex-col justify-between border-[#E5DFD2] bg-[#FAF9F5] group-hover:bg-white transition-colors"
              >
                <div className="space-y-3">
                  <div className="w-12 h-12 rounded-xl bg-[#EBF4F3] flex items-center justify-center group-hover:scale-105 transition-transform duration-200">
                    {ICON_MAP[category.iconName] || <Wrench className="w-5 h-5 text-[#0D4A52]" />}
                  </div>

                  <div>
                    <h3 className="text-base font-bold text-[#152220] group-hover:text-[#0D4A52] transition-colors">
                      {category.name}
                    </h3>
                    <p className="text-xs text-[#217E66] font-medium">{category.hindiName}</p>
                  </div>

                  <p className="text-xs text-[#576563] line-clamp-2 leading-relaxed">
                    {category.description}
                  </p>

                  {/* Popular tasks tags */}
                  <div className="pt-2 flex flex-wrap gap-1.5">
                    {category.popularTasks.slice(0, 2).map((task, idx) => (
                      <span
                        key={idx}
                        className="text-[10px] bg-white border border-[#E5DFD2] text-[#4E615D] px-2 py-0.5 rounded"
                      >
                        {task}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Price benchmark footer */}
                <div className="mt-6 pt-4 border-t border-[#E5DFD2] flex items-center justify-between text-xs">
                  <div>
                    <span className="text-[10px] text-[#83928E] block">Typical Rate</span>
                    <span className="font-bold text-[#0D4A52]">
                      ₹{category.typicalBenchmarkRangeInr[0]} – ₹{category.typicalBenchmarkRangeInr[1]}
                    </span>
                  </div>
                  <div className="w-7 h-7 rounded-full bg-white border border-[#E5DFD2] flex items-center justify-center text-[#576563] group-hover:bg-[#0D4A52] group-hover:text-white transition-colors">
                    <ArrowRight className="w-3.5 h-3.5" />
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
