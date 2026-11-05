import React from 'react';

export default function AdminLoading() {
  return (
    <div className="p-6 md:p-8 space-y-8 animate-pulse">
      {/* Top Header Skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-2">
          <div className="h-8 w-48 bg-[#E5DFD2]/60 rounded-xl" />
          <div className="h-4 w-72 bg-[#E5DFD2]/40 rounded-lg" />
        </div>
        <div className="h-10 w-36 bg-[#E5DFD2]/50 rounded-xl" />
      </div>

      {/* KPI Cards Grid Skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(8)].map((_, i) => (
          <div
            key={i}
            className="p-5 rounded-2xl bg-white border border-[#E5DFD2] shadow-2xs space-y-3"
          >
            <div className="flex justify-between items-center">
              <div className="h-3 w-24 bg-[#E5DFD2]/50 rounded" />
              <div className="h-8 w-8 bg-[#E5DFD2]/40 rounded-xl" />
            </div>
            <div className="h-7 w-20 bg-[#E5DFD2]/70 rounded-lg" />
            <div className="h-3 w-32 bg-[#E5DFD2]/40 rounded" />
          </div>
        ))}
      </div>

      {/* Charts Grid Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 h-80 rounded-2xl bg-white border border-[#E5DFD2] p-6 space-y-4">
          <div className="h-5 w-48 bg-[#E5DFD2]/60 rounded" />
          <div className="h-56 bg-[#FAF9F5] rounded-xl" />
        </div>
        <div className="h-80 rounded-2xl bg-white border border-[#E5DFD2] p-6 space-y-4">
          <div className="h-5 w-36 bg-[#E5DFD2]/60 rounded" />
          <div className="h-56 bg-[#FAF9F5] rounded-full mx-auto w-56" />
        </div>
      </div>
    </div>
  );
}

