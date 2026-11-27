'use client';

import React from 'react';
import { Users, ChevronRight } from 'lucide-react';
import { Card } from '@/components/ui/card';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

export default function StaffHub() {
  return (
    <div className="space-y-8 pb-20 max-w-[1200px] mx-auto pt-4 px-2">
      <div className="space-y-2">
        <div className="flex items-center gap-2">
           <Users className="w-4 h-4 text-primary" />
           <span className="text-[9px] font-black uppercase tracking-[0.3em] text-zinc-400">Personnel Hub</span>
        </div>
        <h1 className="text-4xl font-black font-headline text-zinc-900 uppercase tracking-tighter leading-none">Staff Management</h1>
        <p className="text-zinc-500 uppercase text-[10px] font-bold tracking-widest">Manage your team, track performance, and handle payroll</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <HubCard 
          title="Team Registry" 
          desc="Manage employee profiles, adjust security roles, and update terminal access PINs for all station nodes." 
          href="/employees"
          badge="Profiles"
        />
        <HubCard 
          title="Performance" 
          desc="Monitor individual yields, job counts, and service success metrics across all operational departments." 
          href="/attendants"
          badge="Metrics"
        />
        <HubCard 
          title="Payroll & Advances" 
          desc="Handle salary advances, commission payouts, and M-Pesa disbursements directly to staff wallets." 
          href="/admin/payroll"
          badge="Financials"
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
