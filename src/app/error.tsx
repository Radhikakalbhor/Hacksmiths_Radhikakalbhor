'use client';

import { useEffect } from 'react';
import Link from 'next/link';

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log unexpected errors securely without leaking sensitive payload data
    console.error('[Sahayak App Error]:', error);
  }, [error]);

  return (
    <main className="min-h-screen flex items-center justify-center bg-[#FAF9F5] px-6">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-amber-500/10 text-amber-700 font-bold text-xl">
          !
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-[#142624]">Something went wrong</h1>
          <p className="text-sm text-[#4E615D]">
            An unexpected error occurred while loading this section. You can retry or navigate back to the home page.
          </p>
        </div>
        <div className="flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => reset()}
            className="px-4 py-2 rounded-lg bg-[#0D4A52] text-white text-sm font-medium hover:bg-[#08343A] transition-colors"
          >
            Try again
          </button>
          <Link
            href="/"
            className="px-4 py-2 rounded-lg border border-[#DCD6C8] text-[#142624] text-sm font-medium hover:bg-[#F3EFE6] transition-colors"
          >
            Return Home
          </Link>
        </div>
      </div>
    </main>
  );
}
