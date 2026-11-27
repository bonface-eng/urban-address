'use client';

import React, { useEffect, useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useProfile } from '@/hooks/use-profile';
import { useFirestore, useUser } from '@/firebase';
import { doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { SYSTEM_CONFIG } from '@/lib/config';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { X } from 'lucide-react';

type UpdateCategory = 'CLIENT' | 'STAFF' | 'ADMIN';

interface UpdateItem {
  id: string;
  title: string;
  description: string;
  category: UpdateCategory;
  audienceLabel: string;
}

const SYSTEM_UPDATES: UpdateItem[] = [
  // Client Side Updates
  {
    id: 'client-vehicle-recognition',
    title: 'Vehicle registration recognition',
    description: 'When checking in a vehicle or booking detailing services, your vehicle manufacturer and model are now matched with official brand insignias and shade indicators for clear identification.',
    category: 'CLIENT',
    audienceLabel: 'Client update'
  },
  {
    id: 'client-queue-transparency',
    title: 'Service progress visibility',
    description: 'Customers can now view the status of active wash bay detailing stages and carwash job progress directly from the customer portal.',
    category: 'CLIENT',
    audienceLabel: 'Client update'
  },
  {
    id: 'client-detailed-receipts',
    title: 'Itemized receipts with vehicle details',
    description: 'Receipts now display full vehicle make, model, and registration numbers alongside transaction reference numbers for warranty and expense tracking.',
    category: 'CLIENT',
    audienceLabel: 'Client update'
  },
  {
    id: 'client-streamlined-ordering',
    title: 'Refined mobile self-service',
    description: 'Navigation across lounge beverages, kitchen specialties, and auto accessories has been streamlined for quick mobile browsing and checkout.',
    category: 'CLIENT',
    audienceLabel: 'Client update'
  },

  // Staff Side Updates
  {
    id: 'staff-plate-suggestions',
    title: 'Automatic registration suggestions',
    description: 'Typing a registration plate in the point of sale instantly queries past records to suggest matching vehicles, color shades, and models.',
    category: 'STAFF',
    audienceLabel: 'Staff update'
  },
  {
    id: 'staff-brand-logos',
    title: 'Manufacturer brand insignias',
    description: 'Official brand logos are now integrated into plate suggestions, the vehicle make selection list, and the checkout cart summary.',
    category: 'STAFF',
    audienceLabel: 'Staff update'
  },
  {
    id: 'staff-held-bills',
    title: 'Visual held bill cards',
    description: 'Parked orders in the recall register now display the vehicle brand insignia, registration plate, and total amount for swift identification and reconciliation.',
    category: 'STAFF',
    audienceLabel: 'Staff update'
  },
  {
    id: 'staff-kds-workflow',
    title: 'Dedicated kitchen display workflow',
    description: 'Kitchen personnel receive orders directly on a focused kitchen display board without non-essential sales controls or cashier steps.',
    category: 'STAFF',
    audienceLabel: 'Staff update'
  },
  {
    id: 'staff-multi-station',
    title: 'Multi-station operating mobility',
    description: 'Assigned personnel can move between the lounge, retail store, and carwash stations without losing current checkout selections.',
    category: 'STAFF',
    audienceLabel: 'Staff update'
  },

  // Admin Side Updates
  {
    id: 'admin-kitchen-role',
    title: 'Kitchen role and permission controls',
    description: 'Administrators can assign the dedicated kitchen role through the central access matrix, granting kitchen staff isolated access to live order boards.',
    category: 'ADMIN',
    audienceLabel: 'Administrator update'
  },
  {
    id: 'admin-security-rules',
    title: 'Database security rules release 2.8.0',
    description: 'Updated cloud database security rules strictly enforce role verification across users, orders, held bills, inventory, and point of sale stations.',
    category: 'ADMIN',
    audienceLabel: 'Administrator update'
  },
  {
    id: 'admin-stock-audit',
    title: 'Inventory management and stock audit',
    description: 'Store supervisors can review real-time stock balances and print immediate audit reports for low-stock and depleted items.',
    category: 'ADMIN',
    audienceLabel: 'Administrator update'
  },
  {
    id: 'admin-audit-logs',
    title: 'Comprehensive activity auditing',
    description: 'Administrative actions, station authorizations, broadcast messages, and shift handovers are permanently logged in the audit registry.',
    category: 'ADMIN',
    audienceLabel: 'Administrator update'
  }
];

export function VersionUpdateBriefing() {
  const { profile, role, isSuperAdmin, isEmployee } = useProfile();
  const { user } = useUser();
  const firestore = useFirestore();

  const [isOpen, setIsOpen] = useState(false);
  const [isAcknowledging, setIsAcknowledging] = useState(false);
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

    if (profile) {
      const hasAcknowledgedInDb = Array.isArray(profile.seenVersions) && profile.seenVersions.includes(currentVersion);
      if (!hasAcknowledgedInDb) {
        const timer = setTimeout(() => setIsOpen(true), 1200);
        return () => clearTimeout(timer);
      }
      return;
    }

    if (!user && typeof window !== 'undefined') {
      const hasAcknowledgedLocally = localStorage.getItem(localKey) === 'true';
      if (!hasAcknowledgedLocally) {
        const timer = setTimeout(() => setIsOpen(true), 1600);
        return () => clearTimeout(timer);
      }
    }
  }, [profile, user, currentVersion]);

  const handleAcknowledge = async () => {
    setIsAcknowledging(true);
    const localKey = `urban_update_acknowledged_${currentVersion}`;

    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem(localKey, 'true');
      }

      if (firestore && profile?.uid) {
        const userRef = doc(firestore, 'users', profile.uid);
        await updateDoc(userRef, {
          seenVersions: arrayUnion(currentVersion)
        });
      }

      setIsOpen(false);
    } catch (err) {
      console.error('[VERSION_UPDATE_ACK_ERROR]', err);
      setIsOpen(false);
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

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && !isAcknowledging && setIsOpen(false)}>
      <DialogContent 
        hideCloseButton={true}
        overlayClassName="bg-zinc-700/30 backdrop-blur-sm"
        className="sm:max-w-[760px] w-[95vw] rounded-3xl border border-zinc-200 shadow-2xl p-0 overflow-hidden bg-white max-h-[95vh] flex flex-col"
      >
        {/* Responsive Header with Standard Close Positioning */}
        <div className="bg-white p-5 sm:p-8 border-b border-zinc-100 relative shrink-0">
          <button 
            onClick={() => setIsOpen(false)}
            disabled={isAcknowledging}
            className="absolute top-4 right-4 sm:top-6 sm:right-6 w-10 h-10 rounded-full bg-zinc-50 flex items-center justify-center text-zinc-400 hover:bg-zinc-100 hover:text-zinc-900 transition-all z-10"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="pr-12 sm:pr-0">
            <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-primary mb-1">
              System Update
            </p>
            <DialogHeader className="text-left p-0 space-y-0">
              <DialogTitle className="text-lg sm:text-2xl font-bold text-zinc-800 leading-tight">
                {viewerRole === 'ADMIN' ? 'Administrator Briefing' : viewerRole === 'STAFF' ? 'Staff Operational Briefing' : 'Client Updates'}
              </DialogTitle>
              <DialogDescription className="text-[10px] sm:text-xs text-zinc-500 mt-1">
                {roleSubtitle}
              </DialogDescription>
            </DialogHeader>
          </div>
        </div>

        {/* Category Filters: Optimized for touch devices */}
        {viewerRole === 'ADMIN' && (
          <div className="bg-white px-5 sm:px-8 pt-4 pb-2 border-b border-zinc-100 flex items-center gap-2 overflow-x-auto no-scrollbar shrink-0">
            <button
              type="button"
              onClick={() => setSelectedCategory('ALL')}
              className={cn(
                "px-3.5 py-1.5 rounded-xl text-[10px] sm:text-xs font-medium transition-colors border whitespace-nowrap",
                selectedCategory === 'ALL'
                  ? "border-primary text-primary font-semibold bg-white"
                  : "border-zinc-200 text-zinc-600 hover:text-zinc-800 bg-white"
              )}
            >
              All ({counts.all})
            </button>
            <button
              type="button"
              onClick={() => setSelectedCategory('ADMIN')}
              className={cn(
                "px-3.5 py-1.5 rounded-xl text-[10px] sm:text-xs font-medium transition-colors border whitespace-nowrap",
                selectedCategory === 'ADMIN'
                  ? "border-primary text-primary font-semibold bg-white"
                  : "border-zinc-200 text-zinc-600 hover:text-zinc-800 bg-white"
              )}
            >
              Admin ({counts.admin})
            </button>
            <button
              type="button"
              onClick={() => setSelectedCategory('STAFF')}
              className={cn(
                "px-3.5 py-1.5 rounded-xl text-[10px] sm:text-xs font-medium transition-colors border whitespace-nowrap",
                selectedCategory === 'STAFF'
                  ? "border-primary text-primary font-semibold bg-white"
                  : "border-zinc-200 text-zinc-600 hover:text-zinc-800 bg-white"
              )}
            >
              Staff ({counts.staff})
            </button>
            <button
              type="button"
              onClick={() => setSelectedCategory('CLIENT')}
              className={cn(
                "px-3.5 py-1.5 rounded-xl text-[10px] sm:text-xs font-medium transition-colors border whitespace-nowrap",
                selectedCategory === 'CLIENT'
                  ? "border-primary text-primary font-semibold bg-white"
                  : "border-zinc-200 text-zinc-600 hover:text-zinc-800 bg-white"
              )}
            >
              Client ({counts.client})
            </button>
          </div>
        )}

        {/* Main Content: Scaled padding and better grid gaps */}
        <ScrollArea className="flex-1 bg-white">
          <div className="p-5 sm:p-8 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
              {displayedUpdates.map((item) => (
                <div
                  key={item.id}
                  className="bg-white border border-zinc-200 rounded-2xl p-4 sm:p-5 flex flex-col justify-between"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-primary">
                        {item.audienceLabel}
                      </span>
                    </div>
                    <h3 className="text-xs sm:text-sm font-semibold text-zinc-800 leading-snug">
                      {item.title}
                    </h3>
                    <p className="text-[11px] sm:text-xs text-zinc-600 leading-relaxed">
                      {item.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-zinc-50 border border-zinc-200 rounded-2xl p-4 sm:p-5 text-left mt-4">
              <p className="text-[11px] sm:text-xs font-semibold text-zinc-800">
                Identity synchronization notice
              </p>
              <p className="text-[10px] sm:text-xs text-zinc-500 mt-1 leading-relaxed">
                Acknowledgment records this briefing to the master database for your account role.
              </p>
            </div>
          </div>
        </ScrollArea>

        {/* Modal Action Footer: Stacked on mobile */}
        <div className="p-5 sm:p-8 border-t border-zinc-100 bg-white flex flex-col sm:flex-row items-center justify-between gap-5 shrink-0">
          <div className="text-center sm:text-left w-full sm:w-auto">
            <p className="text-[10px] font-medium text-zinc-700">
              Session: {profile?.role ? `${profile.role} account` : 'Guest'}
            </p>
            <p className="text-[10px] text-zinc-400">
              Database security release {currentVersion}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-2.5 w-full sm:w-auto">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsOpen(false)}
              disabled={isAcknowledging}
              className="bg-white border-zinc-200 text-zinc-700 hover:text-zinc-800 hover:bg-white text-xs font-medium h-11 px-6 rounded-xl w-full sm:w-auto"
            >
              Review later
            </Button>
            <Button
              type="button"
              onClick={handleAcknowledge}
              disabled={isAcknowledging}
              className="bg-primary hover:bg-orange-600 text-white text-xs font-semibold h-11 px-8 rounded-xl shadow-sm transition-all w-full sm:w-auto"
            >
              {isAcknowledging ? 'Saving...' : 'Acknowledge briefing'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
