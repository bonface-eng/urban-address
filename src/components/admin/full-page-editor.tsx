'use client';
import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
interface FullPageEditorProps { open: boolean; title: string; description?: string; onClose: () => void; children: React.ReactNode; }
/** Viewport-filling editor workspace; deliberately not a modal or Dialog. */
export function FullPageEditor({ open, title, description, onClose, children }: FullPageEditorProps) {
  if (!open) return null;
  return <div className="fixed inset-0 z-[120] flex min-h-0 flex-col overflow-hidden bg-[#f1f3f6] text-zinc-900" data-full-page-editor="true">
    <header className="flex shrink-0 items-center gap-3 border-b border-zinc-200 bg-white px-4 py-3 sm:px-6">
      <Button type="button" variant="outline" onClick={onClose} className="h-10 shrink-0 rounded-md px-3" aria-label="Return to list"><ArrowLeft className="mr-2 h-4 w-4" /> Back</Button>
      <div className="min-w-0"><p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-zinc-400">Full-page workspace</p><h1 className="truncate text-base font-semibold text-zinc-900 sm:text-lg">{title}</h1>{description && <p className="hidden truncate text-xs text-zinc-500 sm:block">{description}</p>}</div>
    </header>
    <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-4 pb-8 sm:px-6 sm:py-6"><div className="mx-auto w-full max-w-5xl overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm">{children}</div></main>
  </div>;
}
