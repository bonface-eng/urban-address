'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * StaffLoginPage (Obsolete)
 * The system now uses unified authentication at /login.
 * This file remains as a secure redirect to the primary portal.
 */
export default function ObsoleteStaffLoginPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/login');
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="flex flex-col items-center gap-6">
        <div className="animate-pulse">
          <img src="/assets/logo.png" className="h-16 w-auto opacity-30" alt="Urban Express" />
        </div>
        <p className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-300">Redirecting to Unified Portal...</p>
      </div>
    </div>
  );
}
