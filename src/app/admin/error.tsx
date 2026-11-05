'use client';

import React, { useEffect } from 'react';
import { AlertTriangle, RotateCcw, Home } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import Link from 'next/link';

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[Admin Console Error Boundary]:', error);
  }, [error]);

  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 text-center">
      <div className="w-16 h-16 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mb-5 shadow-xs border border-rose-100">
        <AlertTriangle className="w-8 h-8" />
      </div>

      <h2 className="text-xl md:text-2xl font-bold text-[#152220] tracking-tight">
        Admin Console Encountered An Issue
      </h2>

      <p className="text-sm text-[#576563] max-w-md mt-2 mb-6 leading-relaxed">
        {error.message ||
          'A secure administrative operation failed or encountered unexpected database state.'}
      </p>

      <div className="flex items-center gap-3">
        <Button
          onClick={() => reset()}
          variant="primary"
          className="rounded-xl px-5 py-2.5 flex items-center gap-2"
        >
          <RotateCcw className="w-4 h-4" />
          <span>Try Again</span>
        </Button>

        <Link href="/">
          <Button
            variant="secondary"
            className="rounded-xl px-5 py-2.5 flex items-center gap-2"
          >
            <Home className="w-4 h-4" />
            <span>Return to Portal</span>
          </Button>
        </Link>
      </div>
    </div>
  );
}

