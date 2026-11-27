'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { useProfile } from '@/hooks/use-profile';
import { useDb, useUser } from '@/lib/data';
import { doc, updateDoc, arrayUnion } from '@/lib/db';
import { SYSTEM_CONFIG } from '@/lib/config';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

type UpdateCategory = 'CLIENT' | 'STAFF' | 'ADMIN';

interface UpdateItem {
  id: string;
  title: string;
  description: string;
  category: UpdateCategory;
  audienceLabel: string;
}

const SYSTEM_UPDATES: UpdateItem[] = [
  // Client-facing changes released today
  {
    id: 'client-vehicle-recognition',
    title: 'Vehicle registration recognition',
    description: 'When checking in a vehicle or booking detailing services, the vehicle make and model are matched with manufacturer insignias and visual shade indicators to make vehicle identification clearer.',
    category: 'CLIENT',
    audienceLabel: 'Client update'
  },
  {
    id: 'client-account-security',
    title: 'Improved account registration and recovery',
    description: 'Registration now includes clearer password-strength guidance, show and hide password controls, terms acknowledgement for Google and manual sign-up, and a password recovery flow.',
    category: 'CLIENT',
    audienceLabel: 'Client update'
  },
  {
    id: 'client-queue-transparency',
    title: 'Service progress visibility',
    description: 'Customers can view the status of active wash bay detailing stages and carwash job progress directly from the customer portal.',
    category: 'CLIENT',
    audienceLabel: 'Client update'
  },
  {
    id: 'client-detailed-receipts',
    title: 'Itemized receipts with vehicle details',
    description: 'Receipts display vehicle make, model, registration details and transaction references for easier service and expense tracking.',
    category: 'CLIENT',
    audienceLabel: 'Client update'
  },
  {
    id: 'client-streamlined-ordering',
    title: 'Refined mobile self-service',
    description: 'Customer-facing service and product browsing has been refined for clearer navigation on mobile screens.',
    category: 'CLIENT',
    audienceLabel: 'Client update'
  },

  // Staff-facing operational changes released today
  {
    id: 'staff-mobile-pos-navigation',
    title: 'Mobile POS navigation',
    description: 'Staff can reach assigned POS stations and operational pages through grouped mobile navigation, with a persistent way back to the main workspace.',
    category: 'STAFF',
    audienceLabel: 'Staff update'
  },
  {
    id: 'staff-responsive-pos-workspace',
    title: 'Responsive POS workspace',
    description: 'POS product cards, cart controls, workspace sizing, tabs, forms and sheets have been refined for narrow mobile screens.',
    category: 'STAFF',
    audienceLabel: 'Staff update'
  },
  {
    id: 'staff-responsive-directory',
    title: 'Mobile staff directory',
    description: 'Personnel records now use compact mobile cards with clearer identity, role, salary and edit actions while retaining the desktop directory table.',
    category: 'STAFF',
    audienceLabel: 'Staff update'
  },
  {
    id: 'staff-multi-station',
    title: 'Multi-station operating mobility',
    description: 'Assigned personnel can move between authorized lounge, retail and carwash stations through the role-aware mobile workspace.',
    category: 'STAFF',
    audienceLabel: 'Staff update'
  },
  {
    id: 'staff-print-workflow',
    title: 'Simplified local printing workflow',
    description: 'The QZ Tray dependency has been removed while supported Direct Web Serial and local Python print-service workflows remain available.',
    category: 'STAFF',
    audienceLabel: 'Staff update'
  },
  {
    id: 'staff-plate-suggestions',
    title: 'Automatic registration suggestions',
    description: 'Typing a registration plate in the point of sale can suggest matching vehicle records, colour shades and models.',
    category: 'STAFF',
    audienceLabel: 'Staff update'
  },
  {
    id: 'staff-brand-logos',
    title: 'Manufacturer brand insignias',
    description: 'Manufacturer insignias appear alongside vehicle identification and selection details to help staff confirm the correct vehicle.',
    category: 'STAFF',
    audienceLabel: 'Staff update'
  },
  {
    id: 'staff-held-bills',
    title: 'Visual held bill cards',
    description: 'Parked orders in the recall register show vehicle identification and order totals for faster recognition and reconciliation.',
    category: 'STAFF',
    audienceLabel: 'Staff update'
  },
  {
    id: 'staff-kds-workflow',
    title: 'Dedicated kitchen display workflow',
    description: 'Kitchen personnel receive orders on a focused kitchen display board without unnecessary cashier controls.',
    category: 'STAFF',
    audienceLabel: 'Staff update'
  },

  // Administrator-facing changes released today
  {
    id: 'admin-responsive-navigation',
    title: 'Mobile administration navigation',
    description: 'Administrative destinations are grouped into a role-aware mobile menu, making management pages easier to reach without crowding the main screen.',
    category: 'ADMIN',
    audienceLabel: 'Administrator update'
  },
  {
    id: 'admin-staff-registry',
    title: 'Responsive staff registry and station access',
    description: 'The staff registry now presents mobile-friendly cards and keeps station authorization controls available from each staff record.',
    category: 'ADMIN',
    audienceLabel: 'Administrator update'
  },
  {
    id: 'admin-responsive-hubs',
    title: 'Responsive administration pages',
    description: 'Staff, Finance and Logistics administration views now use compact mobile layouts, improved tabs, safer dialog sizing and more accessible controls.',
    category: 'ADMIN',
    audienceLabel: 'Administrator update'
  },
  {
    id: 'admin-security-rules',
    title: 'Database security rules release',
    description: 'Firestore rules continue to enforce role-based access for users, orders, held bills, inventory and POS operations. Version acknowledgements are restricted to the signed-in account.',
    category: 'ADMIN',
    audienceLabel: 'Administrator update'
  },
  {
    id: 'admin-audit-logs',
    title: 'Administrative activity auditing',
    description: 'Administrative actions, station authorizations and operational handovers remain part of the activity audit workflow.',
    category: 'ADMIN',
    audienceLabel: 'Administrator update'
  }
];

export function VersionUpdateBriefing() {
  const { profile, role, isSuperAdmin, isEmployee, loading: profileLoading } = useProfile();
  const { user } = useUser();
  const firestore = useDb();

  const [isOpen, setIsOpen] = useState(false);
  const [isAcknowledging, setIsAcknowledging] = useState(false);
  const [acknowledgementError, setAcknowledgementError] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<'ALL' | UpdateCategory>('ALL');

  const currentVersion = SYSTEM_CONFIG.BUSINESS.VERSION;

  const viewerRole: 'ADMIN' | 'STAFF' | 'CLIENT' = useMemo(() => {
    if (isSuperAdmin || role === 'ADMIN') return 'ADMIN';
    if (isEmployee) return 'STAFF';
    return 'CLIENT';
  }, [role, isSuperAdmin, isEmployee]);

  useEffect(() => {
    if (viewerRole === 'ADMIN') {
      setSelectedCategory('ALL');
    } else if (viewerRole === 'STAFF') {
      setSelectedCategory('STAFF');
    } else {
      setSelectedCategory('CLIENT');
    }
  }, [viewerRole]);

  useEffect(() => {
    const localKey = `urban_update_acknowledged_${currentVersion}`;

    // Wait for the signed-in user's profile before deciding whether to show the briefing.
    if (user && profileLoading) return;

    if (user) {
      const hasAcknowledgedInDb = Array.isArray(profile?.seenVersions)
        && profile.seenVersions.includes(currentVersion);
      if (!hasAcknowledgedInDb) {
        const timer = setTimeout(() => setIsOpen(true), 900);
        return () => clearTimeout(timer);
      }
      return;
    }

    if (!user && typeof window !== 'undefined') {
      const hasAcknowledgedLocally = localStorage.getItem(localKey) === 'true';
      if (!hasAcknowledgedLocally) {
        const timer = setTimeout(() => setIsOpen(true), 1200);
        return () => clearTimeout(timer);
      }
    }
  }, [profile, profileLoading, user, currentVersion]);

  const handleAcknowledge = async () => {
    setIsAcknowledging(true);
    setAcknowledgementError('');

    const localKey = `urban_update_acknowledged_${currentVersion}`;

    try {
      if (user?.uid) {
        if (!firestore) throw new Error('The account database is not available. Please try again.');
        const userRef = doc(firestore, 'users', user.uid);
        await updateDoc(userRef, {
          seenVersions: arrayUnion(currentVersion)
        });
      } else if (typeof window !== 'undefined') {
        localStorage.setItem(localKey, 'true');
      }

      setIsOpen(false);
    } catch (err) {
      console.error('[VERSION_UPDATE_ACK_ERROR]', err);
      setAcknowledgementError('We could not save your acknowledgement. Check your connection and try again.');
    } finally {
      setIsAcknowledging(false);
    }
  };

  const accessibleUpdates = useMemo(() => {
    if (viewerRole === 'ADMIN') return SYSTEM_UPDATES;
    if (viewerRole === 'STAFF') return SYSTEM_UPDATES.filter(item => item.category === 'STAFF');
    return SYSTEM_UPDATES.filter(item => item.category === 'CLIENT');
  }, [viewerRole]);

  const displayedUpdates = useMemo(() => {
    if (viewerRole !== 'ADMIN') return accessibleUpdates;
    if (selectedCategory === 'ALL') return SYSTEM_UPDATES;
    return SYSTEM_UPDATES.filter(item => item.category === selectedCategory);
  }, [viewerRole, accessibleUpdates, selectedCategory]);

  const counts = useMemo(() => {
    return {
      all: SYSTEM_UPDATES.length,
      client: SYSTEM_UPDATES.filter(u => u.category === 'CLIENT').length,
      staff: SYSTEM_UPDATES.filter(u => u.category === 'STAFF').length,
      admin: SYSTEM_UPDATES.filter(u => u.category === 'ADMIN').length,
    };
  }, []);

  const roleSubtitle = useMemo(() => {
    if (viewerRole === 'ADMIN') return `Version ${currentVersion} master briefing.`;
    if (viewerRole === 'STAFF') return `Version ${currentVersion} operational briefing.`;
    return `Version ${currentVersion} feature overview.`;
  }, [viewerRole, currentVersion]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center overflow-y-auto bg-zinc-950/55 p-3 backdrop-blur-[2px] sm:p-6"
      onClick={(event) => {
        if (event.target === event.currentTarget && !isAcknowledging) setIsOpen(false);
      }}
    >
      <main
        role="dialog"
        aria-modal="true"
        aria-labelledby="version-briefing-title"
        aria-describedby="version-briefing-description"
        className="flex max-h-[calc(100dvh-1.5rem)] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-50 text-zinc-900 shadow-2xl sm:max-h-[min(88dvh,860px)]"
      >
      <header className="shrink-0 border-b border-zinc-200 bg-white px-4 py-4 sm:px-7 sm:py-5">
        <div className="flex w-full items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-primary sm:text-xs">
              Urban Auto Express · Platform release
            </p>
            <h1 id="version-briefing-title" className="text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl">
              {viewerRole === 'ADMIN' ? 'Administrator briefing' : viewerRole === 'STAFF' ? 'Staff update' : 'What’s new for you'}
            </h1>
            <p id="version-briefing-description" className="mt-1 text-xs text-zinc-500 sm:text-sm">
              {roleSubtitle}
            </p>
          </div>
          <div className="shrink-0 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-right">
            <p className="text-[9px] font-semibold uppercase tracking-wider text-zinc-400">Current release</p>
            <p className="text-sm font-bold tabular-nums text-zinc-900">{currentVersion}</p>
          </div>
        </div>
      </header>

      {viewerRole === 'ADMIN' && (
        <nav aria-label="Update categories" className="shrink-0 border-b border-zinc-200 bg-white">
          <div className="flex w-full gap-2 overflow-x-auto px-4 py-3 sm:px-7">
            {([
              ['ALL', `All (${counts.all})`],
              ['CLIENT', `Client (${counts.client})`],
              ['STAFF', `Staff (${counts.staff})`],
              ['ADMIN', `Admin (${counts.admin})`]
            ] as const).map(([category, label]) => (
              <button
                key={category}
                type="button"
                onClick={() => setSelectedCategory(category)}
                aria-pressed={selectedCategory === category}
                className={cn(
                  "min-h-10 shrink-0 rounded-lg border px-4 text-xs font-semibold transition-colors",
                  selectedCategory === category
                    ? "border-primary bg-primary/5 text-primary"
                    : "border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50"
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </nav>
      )}

      <ScrollArea className="min-h-0 flex-1 bg-zinc-50">
        <div className="w-full space-y-4 px-4 py-4 sm:space-y-5 sm:px-7 sm:py-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-bold text-zinc-900 sm:text-base">
                {viewerRole === 'CLIENT' ? 'Client features' : viewerRole === 'STAFF' ? 'Operational improvements' : selectedCategory === 'ALL' ? 'Release highlights' : `${selectedCategory.toLowerCase()} updates`}
              </h2>
              <p className="mt-1 text-xs text-zinc-500">
                {viewerRole === 'ADMIN'
                  ? 'Updates are separated by the people and workflows they affect.'
                  : viewerRole === 'STAFF'
                    ? 'These changes apply to your staff workspace and assigned operations.'
                    : 'These changes apply to your customer account and service experience.'}
              </p>
            </div>
            <span className="rounded-full bg-white px-3 py-1.5 text-[10px] font-semibold text-zinc-500 ring-1 ring-zinc-200">
              {displayedUpdates.length} {displayedUpdates.length === 1 ? 'update' : 'updates'}
            </span>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {displayedUpdates.map((item) => (
              <article
                key={item.id}
                className="flex min-w-0 flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-5"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[9px] font-bold uppercase tracking-[0.14em] text-primary">
                    {item.audienceLabel}
                  </span>
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" aria-label="Included in this release" />
                </div>
                <div className="space-y-1.5">
                  <h3 className="text-sm font-semibold leading-snug text-zinc-900">{item.title}</h3>
                  <p className="text-xs leading-relaxed text-zinc-600">{item.description}</p>
                </div>
              </article>
            ))}
          </div>

          <section className="rounded-xl border border-zinc-200 bg-white p-4 sm:p-5">
            <h2 className="text-xs font-bold text-zinc-900">Your account and update record</h2>
            <p className="mt-1 text-xs leading-relaxed text-zinc-500">
              Acknowledging this briefing records {currentVersion} against your signed-in account. It does not change your role, permissions, or business data.
            </p>
            <p className="mt-2 text-[10px] font-medium text-zinc-400">
              Signed in as: {profile?.role ? `${profile.role} account` : user ? 'Account' : 'Guest'}
            </p>
          </section>
        </div>
      </ScrollArea>

      <footer className="shrink-0 border-t border-zinc-200 bg-white px-4 py-3 sm:px-7 sm:py-4">
        <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-zinc-800">Release {currentVersion}</p>
            <p className="mt-0.5 text-[10px] text-zinc-500">Review the changes before continuing.</p>
            {acknowledgementError && (
              <p role="alert" className="mt-2 text-xs font-medium text-red-600">{acknowledgementError}</p>
            )}
          </div>
          <div className="flex w-full flex-col-reverse gap-2 sm:w-auto sm:flex-row">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsOpen(false)}
              disabled={isAcknowledging}
              className="h-11 w-full rounded-lg border-zinc-300 bg-white px-6 text-xs font-semibold text-zinc-700 sm:w-auto"
            >
              Review later
            </Button>
            <Button
              type="button"
              onClick={handleAcknowledge}
              disabled={isAcknowledging}
              className="h-11 w-full rounded-lg px-7 text-xs font-semibold sm:w-auto"
            >
              {isAcknowledging ? 'Saving acknowledgement…' : 'Acknowledge briefing'}
            </Button>
          </div>
        </div>
      </footer>
      </main>
    </div>
  );
}
