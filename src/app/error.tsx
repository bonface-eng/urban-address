'use client';

import React, { useEffect, useState } from 'react';
import { AlertTriangle, RefreshCcw, Home, Copy, Headset } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [reference, setReference] = useState('UE-ERROR');
  useEffect(() => {
    const id = typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().slice(0, 8).toUpperCase()
      : Date.now().toString(36).toUpperCase();
    setReference(`UE-${id}`);
    // Deliberately avoid printing stack traces or raw error payloads in production.
    if (process.env.NODE_ENV !== 'production') console.error('[APP ERROR]', error);
  }, [error]);

  return (
    <main className="min-h-screen bg-[#f7f8fa] px-5 py-12 flex items-center justify-center">
      <section className="w-full max-w-xl rounded-xl border border-zinc-200 bg-white p-7 sm:p-10 shadow-sm">
        <div className="mb-7 flex h-12 w-12 items-center justify-center rounded-lg bg-orange-50 text-primary">
          <AlertTriangle className="h-6 w-6" />
        </div>
        <p className="text-[11px] font-semibold uppercase tracking-[.16em] text-primary">Urban Auto Express · System notice</p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight text-zinc-900">We couldn’t load this page</h1>
        <p className="mt-2 max-w-lg text-sm leading-6 text-zinc-600">
          The page encountered an unexpected problem. Your account and saved records have not been intentionally changed. Try loading the page again.
        </p>
        <div className="mt-6 rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Support reference</p>
          <div className="mt-1 flex items-center justify-between gap-3">
            <code className="text-sm font-semibold text-zinc-800">{reference}</code>
            <Button type="button" variant="ghost" size="sm" className="h-8 gap-2" onClick={() => navigator.clipboard?.writeText(reference)}>
              <Copy className="h-3.5 w-3.5" /> Copy
            </Button>
          </div>
        </div>
        <div className="mt-7 grid gap-3 sm:grid-cols-2">
          <Button onClick={() => reset()} className="h-11 gap-2 rounded-lg">
            <RefreshCcw className="h-4 w-4" /> Try again
          </Button>
          <Button asChild variant="outline" className="h-11 rounded-lg">
            <Link href="/"><Home className="mr-2 h-4 w-4" /> Return home</Link>
          </Button>
        </div>
        <a href="mailto:urbanautoexpressnakuru@gmail.com?subject=System%20error%20support" className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-zinc-600 hover:text-primary">
          <Headset className="h-4 w-4" /> Contact support
        </a>
      </section>
    </main>
  );
}
