'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCw } from 'lucide-react';

export default function CustomerHomePage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/post-job');
  }, [router]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="flex items-center gap-2 text-xs text-[#576563]">
        <RefreshCw className="w-4 h-4 animate-spin text-[#0D4A52]" />
        <span>Loading Sahayak Home...</span>
      </div>
    </div>
  );
}

