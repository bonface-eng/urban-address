'use client';

import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import { ArrowLeft, ArrowRight, Headphones, MapPin, X } from 'lucide-react';
import Link from 'next/link';
import { BusinessUnit } from '@/lib/types';

type TerminalWelcomeProps = {
  onStart: () => void;
  currentTime: Date | null;
  locationName: string;
  unit?: BusinessUnit;
};

const THOUGHTS = [
  { kicker: 'A thought for today', small: 'The smallest details', highlight: 'create the', ending: 'biggest impressions.', note: 'Make every interaction count.' },
  { kicker: 'A thought for today', small: 'Great service', highlight: 'is not', ending: 'a task. It is a feeling.', note: 'Give every guest a reason to return.' },
  { kicker: 'A thought for today', small: 'Consistency turns', highlight: 'ordinary work', ending: 'into excellence.', note: 'Bring your best to every shift.' },
  { kicker: 'A thought for today', small: 'A warm welcome', highlight: 'can change', ending: 'someone’s entire day.', note: 'Lead with care. Finish with pride.' },
  { kicker: 'A thought for today', small: 'The work you do', highlight: 'with pride', ending: 'speaks for itself.', note: 'Own the details. Raise the standard.' },
  { kicker: 'A thought for today', small: 'Every guest deserves', highlight: 'your best', ending: 'not just your routine.', note: 'Make excellence a habit.' },
  { kicker: 'A thought for today', small: 'Small acts of care', highlight: 'build trust', ending: 'one moment at a time.', note: 'Be present in every detail.' },
  { kicker: 'A thought for today', small: 'A strong team', highlight: 'lifts together', ending: 'and succeeds together.', note: 'Support the people beside you.' },
  { kicker: 'A thought for today', small: 'Progress begins', highlight: 'with purpose', ending: 'and grows through action.', note: 'Take the next step with confidence.' },
  { kicker: 'A thought for today', small: 'Leave every space', highlight: 'better', ending: 'than you found it.', note: 'Your standards shape our reputation.' }
];

const UNIT_LABELS: Record<BusinessUnit, string> = {
  LOUNGE: 'Lounge service',
  STORE: 'Retail operations',
  CARWASH: 'Vehicle care'
};

export function TerminalWelcome({ onStart, currentTime, locationName, unit }: TerminalWelcomeProps) {
  const [thoughtIndex, setThoughtIndex] = useState(0);
  const [showHelp, setShowHelp] = useState(false);
  const thought = THOUGHTS[thoughtIndex];

  useEffect(() => {
    if (showHelp || typeof document === 'undefined' || document.visibilityState !== 'visible') return;
    const slideshow = window.setInterval(() => {
      setThoughtIndex(current => (current + 1) % THOUGHTS.length);
    }, 9000);
    return () => window.clearInterval(slideshow);
  }, [showHelp]);
  const time = currentTime ? currentTime.toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit', hour12: false }) : '--:--';
  const date = currentTime ? currentTime.toLocaleDateString('en-KE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : 'Your service station';

  return (
    <main className="fixed inset-0 z-[2000] h-[100dvh] w-screen overflow-hidden bg-[#171916] text-white selection:bg-[#F36B0A]/25">
      <Image src="/assets/hero3.png" alt="Urban Address service experience" fill priority sizes="100vw" className="pointer-events-none object-cover object-center" />
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#111411]/90 via-[#171916]/70 to-[#171916]/55" />
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#111411]/75 via-transparent to-[#111411]/45" />

      <header className="absolute inset-x-0 top-0 z-10 flex items-center justify-between gap-4 px-5 py-5 sm:px-9 sm:py-7 lg:px-14">
        <div className="flex min-w-0 items-center gap-3">
          <div className="inline-flex items-center rounded-xl border border-white/25 bg-[#171916]/45 px-3 py-2 shadow-[0_8px_28px_rgba(0,0,0,0.22)] backdrop-blur-md ring-1 ring-white/10 sm:px-4 sm:py-2.5"><Image src="/assets/logo.png" alt="Urban Address" width={176} height={64} priority className="h-8 w-auto max-w-[145px] object-contain object-left sm:h-10 sm:max-w-[180px]" /></div>
          <span className="hidden h-7 w-px bg-white/25 sm:block" />
          <span className="hidden text-[9px] font-bold uppercase tracking-[0.22em] text-white/65 sm:block">Staff point of sale</span>
        </div>
        <div className="flex shrink-0 items-center gap-3 sm:gap-5">
          <Link href="/" aria-label="Back to home" className="inline-flex min-h-10 items-center gap-2 border border-white/25 bg-black/25 px-3 text-[9px] font-bold uppercase tracking-[0.14em] text-white/85 backdrop-blur-md transition hover:border-[#F36B0A] hover:bg-[#F36B0A]/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F36B0A] sm:min-h-11 sm:px-4 sm:text-[10px]">
            <ArrowLeft className="h-4 w-4 text-[#F36B0A]" />
            <span className="hidden sm:inline">Back to home</span>
            <span className="sm:hidden">Home</span>
          </Link>
          <div className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-[0.16em] text-white/75 sm:text-[10px]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#F36B0A]" />
            <span className="hidden sm:inline">Ready for staff</span>
          </div>
        </div>
      </header>

      <section className="pointer-events-auto absolute inset-x-0 top-[20%] z-20 px-6 sm:top-[23%] sm:px-10 lg:left-[8%] lg:right-auto lg:max-w-[48%] lg:px-0">
        <p className="mb-3 text-[9px] font-bold uppercase tracking-[0.28em] text-[#F36B0A] sm:text-[10px]">The Urban Address experience</p>
        <h1 className="max-w-2xl text-[clamp(1.25rem,3vw,2.9rem)] font-black leading-[0.94] tracking-[-0.06em]">
          Make every<br /><span className="text-[#F36B0A]">moment matter.</span>
        </h1>
        <p className="mt-4 max-w-md text-xs leading-5 text-white/70 sm:mt-6 sm:text-sm sm:leading-6">The details you take care of today become the experience people remember tomorrow.</p>
        <div className="mt-4 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/60 sm:mt-6">
          <MapPin className="h-3.5 w-3.5 text-[#F36B0A]" />
          <span className="truncate">{locationName || 'Service station'} · {unit ? UNIT_LABELS[unit] : 'Operations'}</span>
        </div>
        <div className="mt-6 sm:mt-8">
          <button type="button" onClick={() => onStart()} aria-label="Begin your shift and continue to staff access" className="group relative z-30 inline-flex min-h-12 cursor-pointer touch-manipulation items-center gap-4 border border-[#F36B0A] px-5 text-[10px] font-black uppercase tracking-[0.17em] text-white transition hover:bg-[#F36B0A]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F36B0A] sm:min-h-14 sm:px-7">
            Begin your shift <ArrowRight className="h-4 w-4 text-[#F36B0A] transition-transform group-hover:translate-x-1" />
          </button>
        </div>
      </section>

      <div className="absolute inset-x-0 bottom-0 z-10 flex items-end justify-between gap-5 px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-8 sm:px-9 sm:pb-8 lg:px-14">
        <div className="min-w-0 shrink-0">
          <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-white/55 sm:text-[10px]">{date}</p>
          <p className="mt-1 font-mono text-4xl font-light leading-none tracking-[-0.07em] text-white sm:text-5xl lg:text-6xl">{time}</p>
          <button type="button" onClick={() => setShowHelp(true)} className="mt-3 inline-flex items-center gap-2 text-[9px] font-bold uppercase tracking-[0.15em] text-white/55 transition hover:text-[#F36B0A] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F36B0A]">
            <Headphones className="h-3.5 w-3.5" /> Need assistance?
          </button>
        </div>

        <section className="min-w-0 max-w-[62%] text-right sm:max-w-[54%] lg:max-w-[46%]" aria-label="Daily inspiration" aria-roledescription="automatic quote slideshow">
          <p className="mb-2 text-[8px] font-bold uppercase tracking-[0.24em] text-[#F36B0A] sm:text-[9px]">{thought.kicker}</p>
          <div aria-live="polite">
            <p className="text-xs font-medium text-white/65 sm:text-base">{thought.small}</p>
            <p className="mt-0.5 text-lg font-bold leading-tight tracking-tight text-[#F36B0A] sm:text-2xl lg:text-3xl">{thought.highlight}</p>
            <p className="mt-0.5 text-xl font-black leading-[1.05] tracking-[-0.04em] text-white sm:text-3xl lg:text-4xl">{thought.ending}</p>
          </div>
          <p className="mt-2 hidden text-[10px] text-white/50 sm:block">{thought.note}</p>
          <p className="mt-3 text-[9px] text-white/40">A new thought every 9 seconds</p>
        </section>
      </div>

      {showHelp && (
        <div className="fixed inset-0 z-[2200] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="terminal-help-title">
          <div className="w-full max-w-md border border-white/15 bg-[#20231F] p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-[#F36B0A]">Terminal support</p>
                <h2 id="terminal-help-title" className="mt-2 text-2xl font-bold text-white">Need a hand?</h2>
              </div>
              <button type="button" onClick={() => setShowHelp(false)} aria-label="Close assistance" className="p-2 text-white/60 hover:text-white"><X className="h-5 w-5" /></button>
            </div>
            <p className="mt-3 text-sm leading-6 text-white/65">Call either support line below for assistance with this workstation or your shift.</p>
            <div className="mt-5 grid gap-3">
              <a href="tel:+254707590734" className="flex min-h-12 items-center justify-between gap-3 border border-white/15 bg-white/[0.04] px-4 text-sm font-semibold text-white transition hover:border-[#F36B0A]/70 hover:bg-white/[0.07] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F36B0A]"><span>+254 707 590 734</span><span className="text-[9px] font-bold uppercase tracking-[0.16em] text-[#F36B0A]">Call support</span></a>
              <a href="tel:+254743079034" className="flex min-h-12 items-center justify-between gap-3 border border-white/15 bg-white/[0.04] px-4 text-sm font-semibold text-white transition hover:border-[#F36B0A]/70 hover:bg-white/[0.07] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F36B0A]"><span>+254 743 079 034</span><span className="text-[9px] font-bold uppercase tracking-[0.16em] text-[#F36B0A]">Call support</span></a>
            </div>
            <p className="mt-4 border-t border-white/10 pt-4 text-xs text-white/50">{unit ? UNIT_LABELS[unit] : 'Staff operations'} · {locationName || 'Location unavailable'}</p>
            <button type="button" onClick={() => setShowHelp(false)} className="mt-5 min-h-11 w-full border border-[#F36B0A] text-xs font-bold uppercase tracking-widest text-white hover:bg-[#F36B0A]/10">Close</button>
          </div>
        </div>
      )}
    </main>
  );
}
