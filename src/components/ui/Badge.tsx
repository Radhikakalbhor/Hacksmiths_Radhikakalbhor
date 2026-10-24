import React from 'react';

export interface BadgeProps {
  variant?: 'teal' | 'green' | 'amber' | 'neutral' | 'red';
  children: React.ReactNode;
  className?: string;
}

export function Badge({ variant = 'teal', children, className = '' }: BadgeProps) {
  const styles = {
    teal: 'bg-[#EBF4F3] text-[#0D4A52] border border-[#CDE3E1]',
    green: 'bg-[#EDF7F4] text-[#217E66] border border-[#BCE5DA]',
    amber: 'bg-[#FEF3C7] text-[#92400E] border border-[#FDE68A]',
    neutral: 'bg-[#F3EFE6] text-[#576563] border border-[#E5DFD2]',
    red: 'bg-[#FEE2E2] text-[#991B1B] border border-[#FECACA]',
  }[variant];

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium tracking-wide ${styles} ${className}`}
    >
      {children}
    </span>
  );
}
