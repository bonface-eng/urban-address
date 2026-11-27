'use client';

import React from 'react';
import { ChevronRight, BrainCircuit } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { cn } from '@/lib/utils';

export default function IntelligenceHub() {
  return (
    <div className="space-y-8 pb-20 max-w-[1200px] mx-auto pt-4 px-2">
      <div className="space-y-2">
        <div className="flex items-center gap-2">
           <BrainCircuit className="w-4 h-4 text-primary" />
           <span className="text-[9px] font-black uppercase tracking-[0.3em] text-zinc-400">Analysis Node</span>
        </div>
        <h1 className="text-4xl font-black font-headline text-zinc-900 uppercase tracking-tighter leading-none">Intelligence Center</h1>
        <p className="text-zinc-500 uppercase text-[10px] font-bold tracking-widest">Ask questions about business performance or monitor system health</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <HubCard 
          title="AI Insights" 
          desc="Consult our neural intelligence engine about sales trends, profit margins, and stock predictions using natural language." 
          href="/admin/intelligence"
          badge="AI Active"
        />
        <HubCard 
          title="Security Monitoring" 
          desc="Monitor the system for suspicious activity, unexpected voids, and high-value refund patterns in real-time." 
          href="/reports/fraud"
          badge="Live"
        />
        <HubCard 
          title="System Health" 
          desc="Inspect the real-time status of the database nodes, network connectivity, and active terminal synchronization." 
          href="/admin/database"
          badge="Nominal"
        />
      </div>
    </div>
  );
}

function HubCard({ title, desc, href, badge }: any) {
  return (
    <Link href={href}>
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
