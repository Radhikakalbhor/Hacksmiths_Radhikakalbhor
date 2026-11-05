import React from 'react';

export type StatusCategory = 'job' | 'verification' | 'dispute' | 'sos' | 'generic';

interface StatusBadgeProps {
  status: string;
  type?: StatusCategory;
  className?: string;
}

export function StatusBadge({ status, type = 'generic', className = '' }: StatusBadgeProps) {
  const norm = (status || '').toUpperCase();

  let styles = 'bg-[#F3EFE6] text-[#576563] border-[#E5DFD2]'; // default neutral

  // 1. Job Statuses
  if (['COMPLETED', 'OTP_COMPLETION_VERIFIED'].includes(norm)) {
    styles = 'bg-emerald-50 text-emerald-800 border-emerald-200';
  } else if (['IN_PROGRESS', 'OTP_START_VERIFIED'].includes(norm)) {
    styles = 'bg-teal-50 text-teal-800 border-teal-200';
  } else if (['ASSIGNED'].includes(norm)) {
    styles = 'bg-blue-50 text-blue-800 border-blue-200';
  } else if (['BIDDING_OPEN', 'POSTED'].includes(norm)) {
    styles = 'bg-amber-50 text-amber-800 border-amber-200';
  } else if (['CANCELLED', 'REJECTED'].includes(norm)) {
    styles = 'bg-red-50 text-red-800 border-red-200';
  } else if (['DISPUTED'].includes(norm)) {
    styles = 'bg-purple-50 text-purple-800 border-purple-200';
  }

  // 2. Verification Statuses
  if (type === 'verification') {
    if (['VERIFIED', 'APPROVED'].includes(norm)) {
      styles = 'bg-emerald-50 text-emerald-800 border-emerald-200';
    } else if (['PENDING', 'UNVERIFIED'].includes(norm)) {
      styles = 'bg-amber-50 text-amber-800 border-amber-200';
    } else if (['NEEDS_INFO'].includes(norm)) {
      styles = 'bg-indigo-50 text-indigo-800 border-indigo-200';
    } else if (['REJECTED', 'SUSPENDED'].includes(norm)) {
      styles = 'bg-rose-50 text-rose-800 border-rose-200';
    }
  }

  // 3. SOS Statuses
  if (type === 'sos') {
    if (['TRIGGERED'].includes(norm)) {
      styles = 'bg-red-100 text-red-900 border-red-300 animate-pulse font-semibold';
    } else if (['ACKNOWLEDGED'].includes(norm)) {
      styles = 'bg-amber-100 text-amber-900 border-amber-300 font-semibold';
    } else if (['ESCALATED'].includes(norm)) {
      styles = 'bg-purple-100 text-purple-900 border-purple-300 font-semibold';
    } else if (['RESOLVED'].includes(norm)) {
      styles = 'bg-emerald-50 text-emerald-800 border-emerald-200';
    }
  }

  // 4. Dispute Statuses
  if (type === 'dispute') {
    if (['OPEN'].includes(norm)) {
      styles = 'bg-rose-50 text-rose-800 border-rose-200';
    } else if (['UNDER_REVIEW'].includes(norm)) {
      styles = 'bg-amber-50 text-amber-800 border-amber-200';
    } else if (['RESOLVED'].includes(norm)) {
      styles = 'bg-emerald-50 text-emerald-800 border-emerald-200';
    } else if (['REJECTED'].includes(norm)) {
      styles = 'bg-gray-100 text-gray-700 border-gray-300';
    }
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border shadow-2xs tracking-wide ${styles} ${className}`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />
      {status ? status.replace(/_/g, ' ') : 'UNKNOWN'}
    </span>
  );
}

