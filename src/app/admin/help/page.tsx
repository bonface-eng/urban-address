'use client';

import React from 'react';
import { 
  BookOpen, 
  UserPlus, 
  Package, 
  ShieldCheck, 
  Printer, 
  Banknote, 
  Zap, 
  Terminal, 
  ChevronRight, 
  AlertTriangle,
  Info,
  Activity,
  Key,
  Database
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useProfile } from '@/hooks/use-profile';

export default function AdminHelpPage() {
  const { isSuperAdmin } = useProfile();

  if (!isSuperAdmin) {
    return (
      <div className="h-[80vh] flex items-center justify-center p-6">
        <Card className="max-w-md w-full border-none shadow-2xl rounded-[3rem] p-12 text-center space-y-8 bg-white border border-zinc-100">
          <div className="w-20 h-20 bg-red-50 rounded-3xl flex items-center justify-center text-red-500 mx-auto">
             <AlertTriangle className="w-10 h-10" />
          </div>
          <div className="space-y-2 ua-compact-page">
            <h2 className="text-2xl font-black uppercase font-headline">Admin Access Required</h2>
            <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest leading-relaxed">This guide is reserved for system administrators.</p>
          </div>
          <Button onClick={() => window.history.back()} variant="outline" className="w-full h-12 rounded-xl">Go Back</Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-20 max-w-[1200px] mx-auto pt-4 ua-compact-page">
      <div className="px-2">
        <div className="flex items-center gap-2 mb-2">
          <BookOpen className="w-3.5 h-3.5 text-primary" />
          <span className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-400">User Manual v2.4</span>
        </div>
        <h1 className="text-4xl font-black font-headline text-zinc-900 uppercase tracking-tighter leading-none">Admin Operations Guide</h1>
        <p className="text-zinc-500 mt-2 uppercase text-[10px] font-bold tracking-widest max-w-2xl">Step-by-step instructions for managing staff, inventory, and finances.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 px-2">
        <aside className="lg:col-span-3 space-y-4">
           <div className="sticky top-24 space-y-1">
              <DocNavLink icon={UserPlus} label="Manage Staff" href="#staff" />
              <DocNavLink icon={Package} label="Inventory Setup" href="#inventory" />
              <DocNavLink icon={ShieldCheck} label="Permissions" href="#rbac" />
              <DocNavLink icon={Printer} label="Printers & Hardware" href="#hardware" />
              <DocNavLink icon={Banknote} label="Finance & Payroll" href="#finance" />
              <DocNavLink icon={Zap} label="Carwash Service" href="#carwash" />
           </div>
        </aside>

        <main className="lg:col-span-9 space-y-12 pb-20">
           
           <section id="staff" className="scroll-mt-24 space-y-6">
              <DocHeader icon={UserPlus} title="Managing Staff" />
              <div className="space-y-6 text-zinc-600">
                 <p className="text-sm font-medium leading-relaxed uppercase tracking-tight">Administrators are responsible for creating employee accounts. Staff cannot register themselves.</p>
                 
                 <Card className="border-none shadow-sm rounded-3xl bg-zinc-50 overflow-hidden">
                    <CardContent className="p-8 space-y-6">
                       <Step icon={Terminal} title="Account Creation">
                          Navigate to <strong>Admin Dashboard &gt; Staff List</strong>. Enter the employee details and assigned department. 
                       </Step>
                       <Step icon={Key} title="Station PINs">
                          Use the <strong>Hash icon</strong> on any staff record to set a 4-digit numeric PIN. This allows them to quickly unlock terminals.
                       </Step>
                       <Step icon={Activity} title="Mandatory Reset">
                          All new accounts require the user to change their temporary password upon first login.
                       </Step>
                    </CardContent>
                 </Card>
              </div>
           </section>

           <section id="inventory" className="scroll-mt-24 space-y-6">
              <DocHeader icon={Package} title="Inventory & Catalog" />
              <div className="space-y-6 text-zinc-600">
                 <p className="text-sm font-medium leading-relaxed uppercase tracking-tight">The <strong>Inventory Management</strong> section controls what appears on the POS stations.</p>
                 
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Card className="rounded-2xl border-zinc-100 p-6 space-y-3">
                       <h4 className="text-[10px] font-black uppercase text-primary">Products vs Services</h4>
                       <p className="text-xs leading-relaxed uppercase font-bold text-zinc-400">Products (Store/Lounge) track stock levels. Services (Carwash) are unlimited but generate team commissions.</p>
                    </Card>
                    <Card className="rounded-2xl border-zinc-100 p-6 space-y-3">
                       <h4 className="text-[10px] font-black uppercase text-blue-500">Image Management</h4>
                       <p className="text-xs leading-relaxed uppercase font-bold text-zinc-400">Always upload a clear image for catalog items to help staff identify products during checkout.</p>
                    </Card>
                 </div>
              </div>
           </section>

           <section id="rbac" className="scroll-mt-24 space-y-6">
              <DocHeader icon={ShieldCheck} title="Role Permissions" />
              <div className="space-y-6 text-zinc-600">
                 <p className="text-sm font-medium leading-relaxed uppercase tracking-tight">The <strong>Access Matrix</strong> determines which pages each staff role can see.</p>
                 <p className="text-xs font-bold text-zinc-400 uppercase leading-relaxed p-6 bg-zinc-900 text-white rounded-3xl">
                   Checking a box grants a role access to that route. Changes are instant and affect all active terminal nodes.
                 </p>
              </div>
           </section>

        </main>
      </div>
    </div>
  );
}

function DocHeader({ icon: Icon, title }: { icon: any, title: string }) {
  return (
    <div className="flex items-center gap-4 border-b border-zinc-100 pb-4">
       <div className="w-10 h-10 rounded-xl bg-primary/5 flex items-center justify-center text-primary">
          <Icon className="w-5 h-5" />
       </div>
       <h2 className="text-xl font-black font-headline uppercase tracking-tighter text-zinc-900">{title}</h2>
    </div>
  );
}

function DocNavLink({ icon: Icon, label, href }: { icon: any, label: string, href: string }) {
  return (
    <a 
      href={href} 
      className="flex items-center gap-3 p-3 rounded-xl hover:bg-zinc-50 text-zinc-400 hover:text-primary transition-all group"
    >
       <Icon className="w-4 h-4 shrink-0" />
       <span className="text-[10px] font-black uppercase tracking-widest">{label}</span>
       <ChevronRight className="w-3 h-3 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
    </a>
  );
}

function Step({ icon: Icon, title, children }: { icon: any, title: string, children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-4">
       <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center text-zinc-400 border border-zinc-100 shrink-0 shadow-xs">
          <Icon className="w-4 h-4" />
       </div>
       <div className="space-y-1">
          <h4 className="text-xs font-black uppercase text-zinc-900">{title}</h4>
          <p className="text-[11px] font-medium text-zinc-500 uppercase tracking-tight leading-relaxed">{children}</p>
       </div>
    </div>
  );
}
