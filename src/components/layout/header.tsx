'use client';

import React, { useState, useEffect } from 'react';
import { Notifications } from './notifications';
import { useProfile } from '@/hooks/use-profile';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuth } from '@/firebase';
import { signOut } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { 
  LogOut, 
  UserCircle, 
  Clock, 
  Lock,
  User,
  Fingerprint
} from 'lucide-react';
import { useTerminal } from '@/hooks/use-terminal';
import { cn } from '@/lib/utils';
import Link from 'next/link';

/**
 * Staff Terminal Header
 * Redesigned for logo-only branding and high-density telemetry.
 * Telemetry is hidden on mobile to maximize space.
 */
export function Header() {
  const { profile, role } = useProfile();
  const { locationName, lockTerminal } = useTerminal();
  const auth = useAuth();
  const router = useRouter();
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const handleLogout = async () => {
    if (auth) {
      await signOut(auth);
      router.replace('/login');
    }
  };

  return (
    <header className="h-16 bg-white flex items-center justify-between px-4 md:px-6 shrink-0 z-[1000] border-b border-zinc-100 shadow-sm relative">
      {/* 1. BRANDING NODE (LEFT) - Clean Logo Only */}
      <Link href="/dashboard" className="flex items-center group">
        <img 
          src="/assets/logo.png" 
          alt="Urban Express" 
          className="h-8 md:h-10 w-auto object-contain transition-transform duration-500 group-hover:scale-105" 
        />
      </Link>
      
      {/* 2. TELEMETRY & IDENTITY (RIGHT) */}
      <div className="flex items-center gap-3 md:gap-4">
        
        {/* Time & Location Pulse - Refined for mobile PWA */}
        <div className="hidden md:flex flex-col items-end">
           <div className="flex items-center gap-1.5 md:gap-2 text-zinc-900 leading-none">
              <Clock className="w-3 md:w-3.5 h-3 md:h-3.5 text-primary opacity-40" />
              <span className="text-[13px] md:text-[15px] font-black tracking-tighter">
                {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })}
              </span>
           </div>
           <div className="hidden md:flex items-center gap-1.5 mt-0.5">
              <div className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[9px] font-black uppercase tracking-[0.2em] text-emerald-500">
                {locationName || 'STATION NODE'}
              </span>
           </div>
        </div>

        <div className="hidden md:block h-8 w-px bg-zinc-100 mx-1" />

        {/* Action Triggers */}
        <div className="flex items-center gap-0.5 md:gap-1">
           <button 
             onClick={lockTerminal}
             className="h-9 w-9 md:h-10 md:w-10 flex items-center justify-center text-zinc-300 hover:text-zinc-900 transition-colors active:scale-90"
             title="Lock Terminal"
           >
              <Lock className="w-3.5 h-3.5 md:w-4 h-4" />
           </button>

           <Notifications />
           
           <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 hover:bg-zinc-50 p-1 rounded-xl transition-all shrink-0 active:scale-95 ml-1">
                <Avatar className="h-8 w-8 md:h-9 md:w-9 rounded-xl border-2 border-primary/10 shrink-0 shadow-sm transition-all hover:border-primary">
                  <AvatarImage src={profile?.photoURL || undefined} />
                  <AvatarFallback className="bg-primary/10 text-primary text-[10px] md:text-[11px] font-black uppercase">
                    {profile?.displayName?.slice(0, 2) || 'UE'}
                  </AvatarFallback>
                </Avatar>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64 rounded-2xl border-none shadow-2xl p-2 mt-2">
              <DropdownMenuLabel className="px-3 py-3">
                <div className="flex items-center gap-2 mb-2">
                   <Fingerprint className="w-3 h-3 text-primary" />
                   <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">Clearance: {role}</p>
                </div>
                <p className="text-sm font-black uppercase text-zinc-900 truncate">{profile?.displayName || 'Staff Member'}</p>
                <p className="text-[9px] font-bold text-zinc-400 uppercase mt-0.5 truncate">{profile?.email}</p>
              </DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-zinc-50" />
              
              <DropdownMenuItem onClick={() => router.push('/settings')} className="rounded-xl gap-3 py-3 cursor-pointer">
                <UserCircle className="w-4 h-4 text-zinc-400" />
                <span className="text-xs font-black uppercase tracking-widest">Profile</span>
              </DropdownMenuItem>
              
              <DropdownMenuSeparator className="bg-zinc-50" />
              <DropdownMenuItem onClick={handleLogout} className="rounded-xl gap-3 py-3 text-red-500 focus:text-red-600 focus:bg-red-50 cursor-pointer">
                <LogOut className="w-4 h-4" />
                <span className="text-xs font-black uppercase tracking-widest">Logout</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
