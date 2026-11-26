'use client';

import React, { useState, useEffect } from 'react';
import { Smartphone, Download, X, Star, Zap, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';

export function PWAPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    // Check if device is mobile
    const checkMobile = () => {
      const userAgent = typeof window !== 'undefined' ? navigator.userAgent : '';
      return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
    };
    
    setIsMobile(checkMobile());

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      
      // Check if already installed
      if (window.matchMedia('(display-mode: standalone)').matches) {
        return;
      }

      // Show prompt after a delay if on mobile
      if (checkMobile()) {
        const timer = setTimeout(() => setIsVisible(true), 5000);
        return () => clearTimeout(timer);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    setIsVisible(false);
    deferredPrompt.prompt();
    
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      toast({ title: "OS Installed", description: "Urban Express is now available on your home screen." });
    }
    setDeferredPrompt(null);
  };

  if (!isVisible || !isMobile) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-6 md:max-w-sm z-[6000] animate-in slide-in-from-bottom-20 duration-1000">
      <div className="bg-white rounded-[2rem] shadow-[0_20px_50px_rgba(0,0,0,0.3)] border border-zinc-100 p-4 md:p-6 flex flex-col gap-6 md:gap-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full translate-x-1/2 -translate-y-1/2" />
        
        <button 
          onClick={() => setIsVisible(false)}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-zinc-50 flex items-center justify-center text-zinc-300 hover:text-zinc-900 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-4 relative z-10">
          <div className="w-12 h-12 md:w-14 md:h-14 rounded-[1.25rem] bg-zinc-900 flex items-center justify-center text-primary shadow-2xl shrink-0 border border-white/10">
            <Smartphone className="w-6 h-6 md:w-7 md:h-7" />
          </div>
          <div className="space-y-0.5">
            <p className="text-[8px] md:text-[9px] font-black text-primary uppercase tracking-[0.4em]">Urban Business OS</p>
            <h3 className="text-lg md:text-xl font-black uppercase font-headline tracking-tighter text-zinc-900 leading-none">Add to Home.</h3>
          </div>
        </div>

        <div className="space-y-4 relative z-10">
          <p className="text-[10px] font-bold text-zinc-400 uppercase leading-relaxed tracking-wider">
            Experience high-speed POS, real-time tracking, and exclusive rewards as a standalone mobile application.
          </p>
          
          <div className="grid grid-cols-2 gap-3">
             <div className="flex items-center gap-2">
                <CheckCircle2 className="w-3 h-3 text-green-500" />
                <span className="text-[7px] md:text-[8px] font-black uppercase text-zinc-500">Offline Ready</span>
             </div>
             <div className="flex items-center gap-2">
                <CheckCircle2 className="w-3 h-3 text-green-500" />
                <span className="text-[7px] md:text-[8px] font-black uppercase text-zinc-500">Fast Launch</span>
             </div>
          </div>
        </div>

        <Button 
          onClick={handleInstall}
          className="w-full h-14 bg-zinc-900 text-white rounded-xl font-black uppercase text-[10px] tracking-[0.2em] shadow-xl active:scale-95 transition-all gap-3 relative z-10"
        >
          <Download className="w-4 h-4 text-primary" />
          Install Mobile App
        </Button>

        <div className="text-center">
           <p className="text-[7px] font-black text-zinc-200 uppercase tracking-[0.4em]">Powered by Urban Express Engineering</p>
        </div>
      </div>
    </div>
  );
}