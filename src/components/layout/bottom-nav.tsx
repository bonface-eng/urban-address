'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { 
  LayoutDashboard, 
  Menu, 
  Settings,
  ChevronRight,
  MonitorPlay,
  X,
  ChefHat,
  Coffee,
  Store,
  Bot,
  Users,
  DollarSign,
  Package,
  ShieldCheck,
  HardDrive,
  MessageSquare,
  FileText,
  Car,
  UserCircle,
  ClipboardList,
  Contact,
  Truck,
  Receipt,
  BarChart3,
  ShieldAlert,
  BookOpen,
  Banknote,
  Smartphone
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useProfile } from '@/hooks/use-profile';
import { useDoc, useFirestore, useUser } from '@/firebase';
import { doc } from 'firebase/firestore';
import { 
  Sheet, 
  SheetContent, 
  SheetHeader, 
  SheetTitle, 
  SheetTrigger,
  SheetClose
} from '@/components/ui/sheet';

type NavItem = {
  icon: any;
  label: string;
  href: string;
  superOnly?: boolean;
  unit?: 'LOUNGE' | 'STORE' | 'CARWASH';
};

const ALL_NAV_ITEMS: NavItem[] = [
  { icon: LayoutDashboard, label: 'Dashboard', href: '/dashboard' },
  { icon: ChefHat, label: 'Kitchen', href: '/kds', unit: 'LOUNGE' },
  { icon: Coffee, label: 'Lounge', href: '/lounge', unit: 'LOUNGE' },
  { icon: Store, label: 'Store', href: '/store', unit: 'STORE' },
  { icon: MonitorPlay, label: 'Carwash', href: '/carwash/pos', unit: 'CARWASH' },
  
  // Operational Hubs
  { icon: Bot, label: 'Intelligence', href: '/admin/hubs/intelligence' },
  { icon: Users, label: 'Staff Hub', href: '/admin/hubs/staff' },
  { icon: DollarSign, label: 'Finance', href: '/admin/hubs/finance' },
  { icon: Package, label: 'Logistics', href: '/admin/hubs/logistics' },
  { icon: ShieldCheck, label: 'Governance', href: '/admin/hubs/governance', superOnly: true },

  // Specialized Modules
  { icon: Bot, label: 'Neural AI', href: '/admin/intelligence' },
  { icon: Smartphone, label: 'App Release', href: '/admin/app-manager', superOnly: true },
  { icon: MessageSquare, label: 'Support', href: '/admin/support' },
  { icon: HardDrive, label: 'Database', href: '/admin/database' },
  { icon: Banknote, label: 'Payroll', href: '/admin/payroll' },
  { icon: FileText, label: 'Documents', href: '/admin/documents' },
  { icon: Package, label: 'Stock', href: '/inventory' },
  { icon: Car, label: 'Queue', href: '/carwash', unit: 'CARWASH' },
  { icon: Users, label: 'Team', href: '/employees' },
  { icon: UserCircle, label: 'Metrics', href: '/attendants', unit: 'CARWASH' },
  { icon: ClipboardList, label: 'Sales', href: '/sales-history' },
  { icon: Contact, label: 'CRM', href: '/customers' },
  { icon: Truck, label: 'Suppliers', href: '/suppliers' },
  { icon: Receipt, label: 'Expenses', href: '/finance' },
  { icon: BarChart3, label: 'Analytics', href: '/reports' },
  { icon: ShieldAlert, label: 'Security', href: '/reports/fraud' },
  { icon: BookOpen, label: 'Help', href: '/admin/help' },
  { icon: Settings, label: 'Matrix', href: '/admin', superOnly: true },
];

export function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useUser();
  const { role, isSuperAdmin, profile } = useProfile();
  const firestore = useFirestore();
  const [isOpen, setIsOpen] = useState(false);

  // Guard document request with user session to prevent permission errors before auth resolution
  const permissionsRef = useMemo(() => {
    if (!firestore || !user) return null;
    return doc(firestore, 'system', 'permissions');
  }, [firestore, user]);

  const { data: permMap } = useDoc<any>(permissionsRef);

  const allowedItems = useMemo(() => {
    if (isSuperAdmin) return ALL_NAV_ITEMS;

    if (!role) return [];
    const baseline = ['/dashboard', '/settings'];
    const roleAllowedHrefs = permMap?.[role] || [];
    const userUnits = profile?.assignedUnits || [];

    return ALL_NAV_ITEMS.filter(item => {
      // 1. Role-based check
      const isAllowedByRole = baseline.includes(item.href) || roleAllowedHrefs.includes(item.href);
      if (!isAllowedByRole) return false;

      // 2. Station-based check
      if (item.unit && !isSuperAdmin) {
        if (!userUnits.includes(item.unit)) return false;
      }

      return true;
    });
  }, [role, permMap, isSuperAdmin, profile?.assignedUnits]);

  const primaryNav = allowedItems.slice(0, 4);
  const extendedNav = allowedItems.slice(4);

  return (
    <nav className="fixed bottom-0 left-0 right-0 h-20 bg-white border-t border-zinc-100 flex items-center justify-around px-1 z-50 md:hidden shadow-[0_-8px_32px_rgba(0,0,0,0.05)]">
      {primaryNav.map((item) => {
        const active = pathname === item.href;
        const Icon = item.icon;

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex flex-col items-center gap-1 min-w-[64px] transition-all py-2 active:scale-90",
              active ? "text-primary" : "text-zinc-400"
            )}
          >
            <Icon className={cn("w-5 h-5", active && "animate-in fade-in zoom-in duration-300")} />
            <span className="text-[9px] font-black uppercase tracking-widest text-center truncate w-full px-1">{item.label}</span>
          </Link>
        );
      })}

      {extendedNav.length > 0 && (
        <Sheet open={isOpen} onOpenChange={setIsOpen}>
          <SheetTrigger asChild>
            <button className={cn("flex flex-col items-center gap-1 min-w-[64px] transition-all py-2 active:scale-90", isOpen ? "text-primary" : "text-zinc-400")}>
              <Menu className="w-5 h-5" />
              <span className="text-[9px] font-black uppercase tracking-widest">More</span>
            </button>
          </SheetTrigger>
          <SheetContent side="bottom" className="rounded-none border-none px-0 pb-6 bg-white max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
            <SheetHeader className="px-8 border-b border-zinc-50 flex items-center h-14 shrink-0">
              <SheetTitle className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-400">Navigation Hubs</SheetTitle>
            </SheetHeader>
            
            <div className="flex-1 overflow-y-auto p-2 grid grid-cols-2 gap-2 no-scrollbar h-fit">
              {extendedNav.map((item) => {
                const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
                const Icon = item.icon;

                return (
                  <div key={item.href} onClick={() => { router.push(item.href); setIsOpen(false); }}>
                    <div className={cn(
                      "w-full flex flex-col items-center justify-center p-3 rounded-none border border-zinc-50 transition-all active:scale-[0.98] select-none gap-1.5 text-center",
                      active ? "bg-primary text-white shadow-xl shadow-primary/20" : "bg-white text-zinc-600 hover:bg-zinc-50"
                    )}>
                      <div className={cn("w-9 h-9 rounded-none flex items-center justify-center transition-colors shadow-inner border border-zinc-100", active ? "bg-white text-primary" : "bg-zinc-50 text-zinc-400")}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <span className="text-[8px] font-black uppercase tracking-widest">{item.label}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </SheetContent>
        </Sheet>
      )}
    </nav>
  );
}
