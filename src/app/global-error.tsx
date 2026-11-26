'use client';

import React from 'react';

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[#f7f8fa] text-zinc-900">
        <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-6 py-12">
          <div className="rounded-xl border border-zinc-200 bg-white p-8 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-widest text-orange-600">Urban Auto Express</p>
            <h1 className="mt-3 text-2xl font-semibold">The application needs to restart</h1>
            <p className="mt-2 text-sm leading-6 text-zinc-600">A system-level error interrupted this page. Reload the application to try again. If the issue continues, contact support.</p>
            <button onClick={() => reset()} className="mt-6 h-11 rounded-md bg-orange-600 px-5 text-sm font-semibold text-white hover:bg-orange-700">Reload application</button>
            <a href="/" className="ml-4 text-sm font-medium text-zinc-600 hover:text-orange-600">Return home</a>
          </div>
        </main>
      </body>
    </html>
  );
}
