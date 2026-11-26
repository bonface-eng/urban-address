
'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowLeft, Home, Search, MessageSquare, Car } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-white text-center">
      <div className="max-w-md w-full space-y-8 animate-in fade-in zoom-in duration-700">
        
        <div className="relative">
           <div className="text-[180px] font-black font-headline text-zinc-50 tracking-tighter leading-none select-none">404</div>
           <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-20 h-20 bg-primary/5 rounded-[2.5rem] flex items-center justify-center text-primary shadow-sm border border-primary/10">
                 <Search className="w-10 h-10" />
              </div>
           </div>
        </div>

        <div className="space-y-3">
          <h1 className="text-4xl font-black font-headline text-zinc-900 uppercase tracking-tighter">Route Lost.</h1>
          <p className="text-xs text-zinc-400 font-bold uppercase tracking-[0.2em] leading-relaxed px-8">
            The page you are looking for has been moved, renamed, or is currently undergoing detailing.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 pt-4">
          <Button asChild className="h-14 bg-zinc-900 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl shadow-zinc-100 hover:bg-zinc-800 transition-all">
            <Link href="/"><Home className="w-4 h-4 mr-2 text-primary" /> Return to HQ</Link>
          </Button>
          
          <div className="grid grid-cols-2 gap-3">
             <Button asChild variant="outline" className="h-12 border-zinc-100 rounded-xl font-bold uppercase text-[9px] tracking-widest text-zinc-500">
               <Link href="/about">Our Story</Link>
             </Button>
             <Button asChild variant="outline" className="h-12 border-zinc-100 rounded-xl font-bold uppercase text-[9px] tracking-widest text-zinc-500">
               <Link href="/contact">Concierge</Link>
             </Button>
          </div>
        </div>

        <div className="pt-12 flex flex-col items-center gap-4">
           <p className="text-[8px] font-black text-zinc-200 uppercase tracking-[0.4em]">Urban Express Business OS</p>
           <div className="flex items-center gap-4 opacity-10">
              <Car className="w-5 h-5" />
              <MessageSquare className="w-5 h-5" />
              <Search className="w-5 h-5" />
           </div>
        </div>
      </div>
    </div>
  );
}
