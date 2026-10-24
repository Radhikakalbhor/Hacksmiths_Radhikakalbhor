import React from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'accent' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
}

export function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  children,
  ...props
}: ButtonProps) {
  const baseStyles =
    'inline-flex items-center justify-center font-medium rounded-lg transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed';

  const sizeStyles = {
    sm: 'px-3 py-1.5 text-xs font-medium',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base font-semibold',
  }[size];

  const variantStyles = {
    primary:
      'bg-[#0D4A52] text-white hover:bg-[#072F35] focus:ring-[#0D4A52] shadow-sm hover:shadow',
    secondary:
      'bg-white text-[#152220] border border-[#E5DFD2] hover:bg-[#F3EFE6] focus:ring-[#0D4A52]',
    accent:
      'bg-[#217E66] text-white hover:bg-[#165646] focus:ring-[#217E66] shadow-sm',
    ghost:
      'text-[#576563] hover:text-[#152220] hover:bg-[#F3EFE6] focus:ring-[#0D4A52]',
  }[variant];

  return (
    <button className={`${baseStyles} ${sizeStyles} ${variantStyles} ${className}`} {...props}>
      {children}
    </button>
  );
}
