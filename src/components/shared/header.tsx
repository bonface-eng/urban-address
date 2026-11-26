"use client";

import React from 'react';
import { Bot, BrainCircuit, FlaskConical, ChevronDown, Cpu, Activity } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import type { AppView, UserProfile } from '@/lib/types';
import { useIsMobile } from '@/hooks/use-mobile';

interface HeaderProps {
  currentView: AppView;
  onNavigate: (view: AppView) => void;
  userProfile: UserProfile;
  onOpenAnalyst: () => void;
  onOpenBot: () => void;
  onOpenStrategy: () => void;
}

export function Header({
  onNavigate,
  userProfile,
  onOpenAnalyst,
  onOpenBot,
  onOpenStrategy,
}: HeaderProps) {
  const isMobile = useIsMobile();

  return (
    <header className="flex h-14 items-center gap-4 border-b border-cyan-500/30 bg-black/80 px-4 shrink-0 z-50">
      <div className="flex items-center gap-2 font-orbitron text-lg tracking-[0.3em] text-cyan-400">
        <Bot className="h-6 w-6 animate-pulse" />
        <span className="font-bold uppercase">Jarvis v1.0</span>
      </div>

      <div className="h-8 w-px bg-cyan-500/20 mx-2" />

      <div className="flex-1 flex items-center gap-6">
        <div className="hidden lg:flex gap-4 text-[10px] font-mono tracking-widest uppercase text-cyan-500/40">
           <span className="flex items-center gap-1.5"><Cpu className="h-3 w-3" /> Core: Stable</span>
           <span className="flex items-center gap-1.5"><Activity className="h-3 w-3" /> Telemetry: Nominal</span>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="hidden md:flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={onOpenAnalyst} title="Neural Analyst" className="text-cyan-500/40 hover:text-cyan-400">
            <BrainCircuit className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon" onClick={onOpenBot} title="Automation Core" className="text-cyan-500/40 hover:text-cyan-400">
            <Bot className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon" onClick={onOpenStrategy} title="Strategy Lab" className="text-cyan-500/40 hover:text-cyan-400">
            <FlaskConical className="h-5 w-5" />
          </Button>
        </div>
        
        <div className="h-8 w-px bg-cyan-500/20 mx-2" />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-9 w-9 rounded-none border border-cyan-500/20 p-0 overflow-hidden">
              <Avatar className="h-full w-full rounded-none">
                <AvatarImage src={`https://i.pravatar.cc/150?u=${userProfile.id}`} alt={userProfile.firstName} />
                <AvatarFallback className="rounded-none bg-cyan-500/10 text-cyan-400">{userProfile.firstName[0]}</AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56 bg-black/90 border-cyan-500/30 text-cyan-50 font-rajdhani rounded-none" align="end">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-bold tracking-widest uppercase">{userProfile.firstName} {userProfile.lastName}</p>
                <p className="text-xs text-cyan-500/60">{userProfile.email}</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-cyan-500/20" />
            <DropdownMenuItem onClick={() => onNavigate('account')} className="focus:bg-cyan-500/10 focus:text-cyan-400 rounded-none">Neural Profile</DropdownMenuItem>
            <DropdownMenuItem onClick={() => onNavigate('wallet')} className="focus:bg-cyan-500/10 focus:text-cyan-400 rounded-none">Asset Vault</DropdownMenuItem>
            <DropdownMenuSeparator className="bg-cyan-500/20" />
            <DropdownMenuItem className="text-red-400 focus:bg-red-500/10 rounded-none">Disconnect</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
