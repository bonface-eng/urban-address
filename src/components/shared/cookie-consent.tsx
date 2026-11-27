'use client';

import React, { useState, useEffect } from 'react';
import { Cookie, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import Link from 'next/link';

export function CookieConsent() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem('uax_cookie_consent');
    if (!consent) {
      const timer = setTimeout(() => setIsVisible(true), 2000);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem('uax_cookie_consent', 'accepted');
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-6 left-6 right-6 md:left-auto md:max-w-sm z-[5000] animate-in slide-in-from-bottom-10 duration-700">
      <div className="bg-white text-zinc-900 p-6 rounded-[2.5rem] shadow-2xl border border-zinc-100 flex flex-col gap-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full translate-x-1/2 -translate-y-1/2 blur-2xl" />
        
        <div className="flex items-start gap-4 relative z-10">
          <div className="w-10 h-10 rounded-xl bg-zinc-50 flex items-center justify-center text-primary shrink-0 border border-zinc-100">
            <Cookie className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <h4 className="text-sm font-black uppercase tracking-tight">Cookies & Privacy</h4>
            <p className="text-[10px] font-medium text-zinc-400 uppercase leading-relaxed tracking-wider">
              We use cookies to improve your experience and ensure our services work correctly.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 relative z-10">
          <Button 
            onClick={handleAccept}
            className="flex-1 h-12 bg-zinc-900 text-white hover:bg-zinc-800 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-xl transition-all"
          >
            Accept Cookies
          </Button>
          <Button asChild variant="ghost" className="h-12 px-6 text-[9px] font-black uppercase text-zinc-400">
            <Link href="/privacy">Policy</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}