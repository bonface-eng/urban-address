'use client';

import React from 'react';
import { ChevronRight, Lock } from 'lucide-react';
import { Card } from '@/components/ui/card';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

export default function GovernanceHub() {
  return (
    <div className="space-y-8 pb-20 max-w-[1200px] mx-auto pt-4 px-2">
      <div className="space-y-2">
        <div className="flex items-center gap-2">
           <Lock className="w-4 h-4 text-primary" />
           <span className="text-[9px] font-black uppercase tracking-[0.3em] text-zinc-400">Master Control</span>
        </div>
        <h1 className="text-4xl font-black font-headline text-zinc-900 uppercase tracking-tighter leading-none">Admin & Control</h1>
        <p className="text-zinc-500 uppercase text-[10px] font-bold tracking-widest">Global settings, permissions, and system documentation</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <HubCard 
          title="Access Matrix" 
          desc="Configure page permissions, register new terminal stations, and adjust global business rates." 
          href="/admin"
          badge="Core"
        />
        <HubCard 
          title="App Release" 
          desc="Provision the mobile APK binary and manage app store visual assets for the download portal." 
          href="/admin/app-manager"
          badge="Deployment"
        />
        <HubCard 
          title="Support Inbox" 
          desc="Manage customer support queries, special requests, and site feedback received from the contact portal." 
          href="/admin/support"
          badge="Inbox"
        />
        <HubCard 
          title="Documents" 
          desc="Manage thermal receipt templates and generate high-density inventory audit forms." 
          href="/admin/documents"
          badge="Templates"
        />
        <HubCard 
          title="Operations Guide" 
          desc="Access the system operational manual and training documentation for staff members." 
          href="/admin/help"
          badge="Training"
        />
      </div>
    </div>
  );
}

function HubCard({ title, desc, href, badge }: any) {
  return (
    <Link href={href} className="block">
      <Card className="p-8 bg-white border border-zinc-100 rounded-[2.5rem] shadow-sm hover:shadow-xl transition-all group active:scale-[0.98] h-full flex flex-col justify-between relative overflow-hidden">
        <div>
          <div className="flex items-center justify-between mb-6 h-6">
            {badge && <Badge variant="outline" className="text-[8px] font-black uppercase border-zinc-100 px-3 h-5">{badge}</Badge>}
          </div>
          <h3 className="text-2xl font-black uppercase text-zinc-900 tracking-tighter mb-3 leading-tight">{title}</h3>
          <p className="text-[11px] text-zinc-400 font-bold uppercase tracking-widest leading-relaxed line-clamp-4">{desc}</p>
        </div>
        
        <div className="mt-12 flex justify-end">
          <div className="h-12 px-6 bg-zinc-900 text-white rounded-xl flex items-center gap-3 group-hover:bg-primary transition-all shadow-lg">
            <span className="text-[10px] font-black uppercase tracking-widest">Open Module</span>
            <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-all" />
          </div>
        </div>
      </Card>
    </Link>
  );
}
