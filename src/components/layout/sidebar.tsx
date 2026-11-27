'use client';

import React, { useMemo } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  LayoutDashboard, 
  Settings,
  ChevronLeft,
  ChevronRight,
  MonitorPlay, 
  ChefHat, 
  Lock,
  Bot,
  Users,
  DollarSign,
  Package,
  ShieldCheck,
  Coffee,
  Store,
  MessageSquare,
  HardDrive,
  Banknote,
  FileText,
  ClipboardList,
  Contact,
  Truck,
  Receipt,
  BarChart3,
  ShieldAlert,
  BookOpen,
  UserCircle,
  Car,
  Smartphone
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useProfile } from '@/hooks/use-profile';
import { useDoc, useFirestore, useUser } from '@/firebase';
import { doc } from 'firebase/firestore';
import { useTerminal } from '@/hooks/use-terminal';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type NavItem = {
  icon: any;
  label: string;
  href: string;
  superOnly?: boolean;
  unit?: 'LOUNGE' | 'STORE' | 'CARWASH';
};

type NavGroup = {
  title: string;
  items: NavItem[];
};

const NAV_GROUPS: NavGroup[] = [
  {
    title: 'Operations',
    items: [
      { icon: LayoutDashboard, label: 'Dashboard', href: '/dashboard' },
      { icon: ChefHat, label: 'Kitchen Board', href: '/kds', unit: 'LOUNGE' },
      { icon: Coffee, label: 'Lounge Station', href: '/lounge', unit: 'LOUNGE' },
      { icon: Store, label: 'Store Station', href: '/store', unit: 'STORE' },
      { icon: MonitorPlay, label: 'Carwash Station', href: '/carwash/pos', unit: 'CARWASH' },
    ]
  },
  {
    title: 'Intelligence',
    items: [
      { icon: Bot, label: 'Neural AI', href: '/admin/intelligence' },
      { icon: ShieldAlert, label: 'Security Monitor', href: '/reports/fraud' },
      { icon: HardDrive, label: 'System Health', href: '/admin/database' },
    ]
  },
  {
    title: 'Personnel',
    items: [
      { icon: Users, label: 'Staff Registry', href: '/employees' },
      { icon: UserCircle, label: 'Performance', href: '/attendants', unit: 'CARWASH' },
      { icon: Banknote, label: 'Staff Payroll', href: '/admin/payroll' },
    ]
  },
  {
    title: 'Financials',
    items: [
      { icon: ClipboardList, label: 'Sales', href: '/sales-history' },
      { icon: Receipt, label: 'Petty Cash', href: '/finance' },
      { icon: BarChart3, label: 'Daily Reports', href: '/reports' },
      { icon: Contact, label: 'Customers', href: '/customers' },
    ]
  },
  {
    title: 'Logistics',
    items: [
      { icon: Package, label: 'Inventory', href: '/inventory' },
      { icon: Truck, label: 'Suppliers', href: '/suppliers' },
      { icon: Car, label: 'Service Queue', href: '/carwash', unit: 'CARWASH' },
    ]
  },
  {
    title: 'Governance',
    items: [
      { icon: ShieldCheck, label: 'Access Matrix', href: '/admin', superOnly: true },
      { icon: Smartphone, label: 'App Release', href: '/admin/app-manager', superOnly: true },
      { icon: MessageSquare, label: 'Support Inbox', href: '/admin/support' },
      { icon: FileText, label: 'OS Documents', href: '/admin/documents' },
      { icon: BookOpen, label: 'Help Guide', href: '/admin/help' },
    ]
  }
];

interface SidebarProps {
  isCollapsed: boolean;
  onToggle: () => void;
}

export function Sidebar({ isCollapsed, onToggle }: SidebarProps) {
  const pathname = usePathname();
  const { user } = useUser();
  const { role, isSuperAdmin, profile } = useProfile();
  const firestore = useFirestore();

  // Guard document request with user session to prevent permission errors before auth resolution
  const permissionsRef = useMemo(() => {
    if (!firestore || !user) return null;
    return doc(firestore, 'system', 'permissions');
  }, [firestore, user]);

  const { data: permMap } = useDoc<any>(permissionsRef);

  const filteredGroups = useMemo(() => {
    const userUnits = profile?.assignedUnits || [];

    return NAV_GROUPS.map(group => {
      const filteredItems = group.items.filter(item => {
        if (isSuperAdmin) return true;
        if (!role) return false;

        const baseline = ['/dashboard', '/settings'];
        const roleAllowedHrefs = permMap?.[role] || [];
        
        // 1. Check general role-based page authorization
        if (!baseline.includes(item.href) && !roleAllowedHrefs.includes(item.href)) return false;

        // 2. Enforce Station Authorization (Unit filtering)
        if (item.unit && !isSuperAdmin) {
           if (!userUnits.includes(item.unit)) return false;
        }

        return true;
      });
      return { ...group, items: filteredItems };
    }).filter(group => group.items.length > 0);
  }, [role, permMap, isSuperAdmin, profile?.assignedUnits]);

  return (
    <aside className={cn("hidden md:flex border-r border-zinc-200 bg-white flex-col shrink-0 h-full transition-all duration-300", isCollapsed ? "w-20" : "w-64")}>
      <div className={cn("p-4 flex items-center border-b border-zinc-50 h-16 shrink-0", isCollapsed ? "justify-center" : "justify-between")}>
        {!isCollapsed && <span className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-400 px-2">Terminal Hubs</span>}
        <button onClick={onToggle} className="h-10 w-10 text-zinc-400 hover:text-primary hover:bg-zinc-50 rounded-xl flex items-center justify-center active:scale-90 transition-all">
          {isCollapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
        </button>
      </div>

      <nav className="flex-1 p-2 space-y-6 overflow-y-auto no-scrollbar pt-4">
        {filteredGroups.map((group, groupIdx) => (
          <div key={groupIdx} className="space-y-1">
            {!isCollapsed && <p className="px-4 text-[8px] font-black text-zinc-300 uppercase tracking-[0.3em] mb-2">{group.title}</p>}
            {group.items.map((item, idx) => {
              const active = pathname === item.href;
              const Icon = item.icon;
              return (
                <Link key={idx} href={item.href} className={cn("w-full flex items-center rounded-xl text-sm font-bold transition-all py-2.5", isCollapsed ? "justify-center h-12" : "gap-3 px-4", active ? "bg-primary text-white shadow-lg shadow-primary/20" : "text-zinc-500 hover:bg-zinc-50")}>
                  <Icon className={cn("shrink-0", isCollapsed ? "w-5 h-5" : "w-3.5 h-3.5", active ? "text-white" : "text-zinc-300")} />
                  {!isCollapsed && <span className="truncate tracking-tight uppercase text-[9px] font-black">{item.label}</span>}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="p-4 border-t border-zinc-50 bg-zinc-50/10 shrink-0 text-center">
         <p className="text-[7px] font-black text-zinc-300 uppercase tracking-[0.4em]">Business OS v2.5</p>
      </div>
    </aside>
  );
}
