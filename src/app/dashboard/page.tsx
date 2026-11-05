'use client';

import React, { Suspense } from 'react';
import { RefreshCw } from 'lucide-react';
import { WorkerDashboardView } from '@/components/worker/WorkerDashboardView';

export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#FBF9F5] flex items-center justify-center">
          <div className="flex items-center gap-2 text-xs text-[#576563]">
            <RefreshCw className="w-4 h-4 animate-spin text-[#0D4A52]" />
            <span>Loading Sahayak Dashboard...</span>
          </div>
        </div>
      }
    >
      <WorkerDashboardView />
    </Suspense>
  );
}
