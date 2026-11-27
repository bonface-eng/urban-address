'use client';

import React, { useEffect } from 'react';
import { AlertTriangle, RefreshCcw, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

/**
 * Global Error Boundary
 * This catches client-side exceptions and prevents the "White Screen of Death".
 * As requested, errors are logged to the console, and the UI remains interactive.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to the developer console as requested
    console.group('--- SYSTEM EXCEPTION DETECTED ---');
    console.error('Error Message:', error.message);
    console.error('Stack Trace:', error.stack);
    console.error('Digest:', error.digest);
    console.groupEnd();
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-white">
      <div className="max-w-md w-full text-center space-y-8 animate-in fade-in zoom-in duration-500">
        <div className="relative mx-auto w-24 h-24">
           <div className="absolute inset-0 bg-red-50 rounded-[2.5rem] animate-pulse" />
           <div className="relative w-full h-full flex items-center justify-center text-red-500">
              <AlertTriangle className="w-12 h-12" />
           </div>
        </div>

        <div className="space-y-3">
          <h1 className="text-3xl font-black font-headline text-zinc-900 uppercase tracking-tighter">System Interrupted</h1>
          <p className="text-xs text-zinc-400 font-bold uppercase tracking-[0.2em] leading-relaxed px-4">
            A client-side exception occurred. The error details have been sent to the developer console.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 pt-4">
          <Button 
            onClick={() => reset()}
            className="h-16 bg-zinc-900 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl hover:bg-zinc-800 transition-all gap-3"
          >
            <RefreshCcw className="w-4 h-4 text-primary" /> Reload Module
          </Button>
          
          <Button asChild variant="outline" className="h-14 border-zinc-100 rounded-2xl font-bold uppercase text-[9px] tracking-widest text-zinc-500">
            <Link href="/">Return to Home</Link>
          </Button>
        </div>

        <div className="pt-8">
           <p className="text-[8px] font-black text-zinc-200 uppercase tracking-[0.4em]">Urban Express Engineering</p>
        </div>
      </div>
    </div>
  );
}
