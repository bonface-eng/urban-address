'use client';

import React, { useMemo } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useProfile } from '@/hooks/use-profile';
import { useDoc, useFirestore, useUser } from '@/firebase';
import { doc } from 'firebase/firestore';
import { getVisibleNavGroups } from './navigation-config';

interface SidebarProps {
  isCollapsed: boolean;
  onToggle: () => void;
}

export function Sidebar({ isCollapsed, onToggle }: SidebarProps) {
  const pathname = usePathname();
  const { user } = useUser();
  const { role, isSuperAdmin, profile } = useProfile();
  const firestore = useFirestore();

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

  return (
    <aside className={cn(
      'hidden md:flex h-full min-h-0 shrink-0 flex-col border-r border-zinc-200 bg-white transition-[width] duration-200',
      isCollapsed ? 'w-[72px]' : 'w-[248px]'
    )}>
      <div className={cn(
        'flex h-16 shrink-0 items-center border-b border-zinc-100 p-4',
        isCollapsed ? 'justify-center' : 'justify-between'
      )}>
        {!isCollapsed && (
          <span className="px-2 text-[9px] font-black uppercase tracking-[0.2em] text-zinc-400">
            Workspace
          </span>
        )}
        <button
          type="button"
          onClick={onToggle}
          aria-label={isCollapsed ? 'Expand navigation' : 'Collapse navigation'}
          aria-expanded={!isCollapsed}
          className="flex h-10 w-10 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          {isCollapsed ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
        </button>
      </div>

      <nav aria-label="Desktop navigation" className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-3 py-4">
        {visibleGroups.map(group => (
          <section key={group.title} aria-label={group.title} className="space-y-1.5">
            {!isCollapsed && (
              <h2 className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-400">
                {group.title}
              </h2>
            )}
            {group.items.map(item => {
              const active = pathname === item.href;
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  title={isCollapsed ? item.label : undefined}
                  className={cn(
                    'relative flex min-h-11 w-full items-center rounded-md py-2.5 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                    isCollapsed ? 'justify-center px-2' : 'gap-3 px-3',
                    active ? 'bg-primary/10 text-primary' : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'
                  )}
                >
                  <Icon className={cn('h-4 w-4 shrink-0', active ? 'text-primary' : 'text-zinc-400')} />
                  {!isCollapsed && <span className="min-w-0 truncate">{item.label}</span>}
                </Link>
              );
            })}
          </section>
        ))}
      </nav>

      <div className="shrink-0 border-t border-zinc-100 px-3 py-4 text-center">
        <p className="text-[7px] font-black uppercase tracking-[0.35em] text-zinc-300">Urban Address</p>
      </div>
    </aside>
  );
}
