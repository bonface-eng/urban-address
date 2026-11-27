'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useProfile } from '@/hooks/use-profile';
import { useDoc, useDb, useUser } from '@/lib/data';
import { doc } from '@/lib/db';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetClose,
} from '@/components/ui/sheet';
import { getVisibleNavGroups, type NavItem } from './navigation-config';

export function BottomNav() {
  const pathname = usePathname();
  const { user } = useUser();
  const { role, isSuperAdmin, profile } = useProfile();
  const firestore = useDb();
  const [isOpen, setIsOpen] = useState(false);

  const permissionsRef = useMemo(() => {
    if (!firestore || !user) return null;
    return doc(firestore, 'system', 'permissions');
  }, [firestore, user]);
  const { data: permMap } = useDoc<Record<string, string[]>>(permissionsRef);

  const visibleGroups = useMemo(
    () => getVisibleNavGroups({
      role,
      isSuperAdmin,
      assignedUnits: profile?.assignedUnits || [],
      permMap,
    }),
    [role, isSuperAdmin, profile?.assignedUnits, permMap]
  );

  const allItems = visibleGroups.flatMap(group => group.items);
  const preferred = [
    '/dashboard',
    '/lounge',
    '/store',
    '/carwash/pos',
    '/kds',
    '/sales-history',
    '/settings',
  ];
  const primaryItems = useMemo(() => {
    const selected = preferred
      .map(href => allItems.find(item => item.href === href))
      .filter((item): item is NavItem => Boolean(item));
    const unique = selected.filter((item, index) => selected.findIndex(other => other.href === item.href) === index);
    if (unique.length >= 3) return unique.slice(0, 3);
    const fill = allItems.filter(item => !unique.some(existing => existing.href === item.href));
    return [...unique, ...fill].slice(0, 3);
  }, [allItems]);

  const isActive = (href: string) => pathname === href;
  const hasActiveMore = allItems.some(item => isActive(item.href) && !primaryItems.some(primary => primary.href === item.href));

  return (
    <nav
      aria-label="Mobile primary navigation"
      className="fixed inset-x-0 bottom-0 z-[60] flex h-[calc(4.25rem+env(safe-area-inset-bottom))] items-center justify-around border-t border-zinc-200 bg-white/95 px-1 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_28px_rgba(0,0,0,0.06)] backdrop-blur md:hidden"
    >
      {primaryItems.map(item => {
        const Icon = item.icon;
        const active = isActive(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex min-w-0 flex-1 flex-col items-center justify-center gap-1 px-1 py-2 text-center transition-colors active:scale-95',
              active ? 'text-primary' : 'text-zinc-500'
            )}
          >
            <Icon className="h-5 w-5 shrink-0" />
            <span className="w-full truncate text-[9px] font-bold uppercase tracking-wide">{item.label}</span>
          </Link>
        );
      })}

      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetTrigger asChild>
          <button
            type="button"
            aria-label="Open all navigation"
            aria-expanded={isOpen}
            className={cn(
              'flex min-w-0 flex-1 flex-col items-center justify-center gap-1 px-1 py-2 text-center active:scale-95',
              isOpen || hasActiveMore ? 'text-primary' : 'text-zinc-500'
            )}
          >
            <Menu className="h-5 w-5" />
            <span className="text-[9px] font-bold uppercase tracking-wide">All pages</span>
          </button>
        </SheetTrigger>

        <SheetContent
          side="bottom"
          className="flex h-[88dvh] max-h-[88dvh] min-h-0 flex-col overflow-hidden rounded-t-2xl border-zinc-200 bg-white px-0 pb-[max(1rem,env(safe-area-inset-bottom))]"
        >
          <SheetHeader className="shrink-0 border-b border-zinc-100 px-5 pb-3 text-left">
            <SheetTitle className="text-sm font-black uppercase tracking-wider text-zinc-900">
              All modules
            </SheetTitle>
            <p className="text-xs text-zinc-500">Every page available to your role and assigned stations.</p>
          </SheetHeader>

          <div className="min-h-0 flex-1 touch-pan-y overflow-y-scroll overscroll-y-contain px-4 py-4 pb-8 [-webkit-overflow-scrolling:touch]">
            {visibleGroups.map(group => (
              <section key={group.title} aria-label={group.title} className="mb-6 space-y-2 last:mb-0">
                <h3 className="px-1 text-[10px] font-black uppercase tracking-[0.16em] text-zinc-400">
                  {group.title}
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  {group.items.map(item => {
                    const Icon = item.icon;
                    const active = isActive(item.href);
                    return (
                      <SheetClose asChild key={item.href}>
                        <Link
                          href={item.href}
                          aria-current={active ? 'page' : undefined}
                          className={cn(
                            'flex min-h-12 min-w-0 items-center gap-2 rounded-lg border px-3 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                            active ? 'border-primary bg-primary/5 text-primary' : 'border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50'
                          )}
                        >
                          <Icon className="h-4 w-4 shrink-0" />
                          <span className="min-w-0 text-[11px] font-semibold leading-tight">{item.label}</span>
                        </Link>
                      </SheetClose>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </nav>
  );
}
