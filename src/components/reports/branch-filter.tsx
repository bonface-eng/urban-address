'use client';

import React from 'react';
import { collection, query, orderBy } from '@/lib/db';
import { useDb, useCollection, useMemoSupabase } from '@/lib/data';
import { useProfile } from '@/hooks/use-profile';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { BusinessBranch } from '@/lib/types';

type BranchFilterProps = {
  value: string;
  onChange: (value: string) => void;
  className?: string;
};

export function BranchFilter({ value, onChange, className }: BranchFilterProps) {
  const firestore = useDb();
  const { profile, role, isSuperAdmin } = useProfile();
  const branchesQuery = useMemoSupabase(() => firestore
    ? query(collection(firestore, 'branches'), orderBy('createdAt', 'asc'))
    : null, [firestore]);
  const { data: branches } = useCollection<BusinessBranch>(branchesQuery);
  const canViewAll = isSuperAdmin || role === 'ADMIN' || role === 'MANAGER' || role === 'SUPERVISOR';
  const allowedIds = profile?.branchIds || [];
  const visible = (branches || []).filter(branch =>
    branch.status === 'ACTIVE' && (canViewAll || allowedIds.includes(branch.id) || (!allowedIds.length && branch.id === 'default-naka'))
  );

  return (
    <div className={className}>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-10 min-w-[190px] bg-white text-xs">
          <SelectValue placeholder="Select station" />
        </SelectTrigger>
        <SelectContent>
          {canViewAll && <SelectItem value="ALL">All stations</SelectItem>}
          {visible.map(branch => (
            <SelectItem key={branch.id} value={branch.id}>{branch.name}</SelectItem>
          ))}
          {!visible.some(branch => branch.id === 'default-naka') && !branches?.length && (
            <SelectItem value="default-naka">Default - Naka Branch</SelectItem>
          )}
        </SelectContent>
      </Select>
    </div>
  );
}

/** Missing branch IDs are treated as Naka only during the legacy transition. */
export function belongsToBranch(record: { branchId?: string | null }, branchId: string) {
  if (branchId === 'ALL') return true;
  return record.branchId ? record.branchId === branchId : branchId === 'default-naka';
}
