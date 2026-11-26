'use client';

import React, { useMemo, useState } from 'react';
import { collection, limit, orderBy, query, updateDoc, doc } from 'firebase/firestore';
import { AlertTriangle, CheckCircle2, Clock3, ShieldCheck } from 'lucide-react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { useProfile } from '@/hooks/use-profile';
import { PageHeader } from '@/components/shared/page-layout';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

type Incident = { id: string; incidentId: string; category: string; message: string; route: string; status: 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED'; createdAt: number };

export default function SystemErrorsPage() {
  const firestore = useFirestore();
  const { isSuperAdmin } = useProfile();
  const [filter, setFilter] = useState<'ALL' | Incident['status']>('ALL');
  const [busyId, setBusyId] = useState<string | null>(null);
  const incidentsQuery = useMemoFirebase(() => firestore && isSuperAdmin ? query(collection(firestore, 'system_incidents'), orderBy('createdAt', 'desc'), limit(100)) : null, [firestore, isSuperAdmin]);
  const { data, loading, error } = useCollection<Incident>(incidentsQuery);
  const incidents = useMemo(() => (data || []).filter(item => filter === 'ALL' || item.status === filter), [data, filter]);
  const openCount = (data || []).filter(item => item.status === 'OPEN').length;
  const acknowledgedCount = (data || []).filter(item => item.status === 'ACKNOWLEDGED').length;
  const resolvedCount = (data || []).filter(item => item.status === 'RESOLVED').length;

  const updateStatus = async (incident: Incident, status: Incident['status']) => {
    if (!firestore || !isSuperAdmin || busyId) return;
    setBusyId(incident.id);
    try {
      await updateDoc(doc(firestore, 'system_incidents', incident.id), { status, ...(status === 'RESOLVED' ? { resolvedAt: Date.now(), resolvedBy: 'ADMIN' } : {}) });
      toast({ title: 'Incident updated', description: 'Incident status saved.' });
    } catch {
      toast({ variant: 'destructive', title: 'Update failed', description: 'The incident could not be updated. Check your access and try again.' });
    } finally { setBusyId(null); }
  };

  if (!isSuperAdmin) return <div className="p-10 text-center text-sm text-zinc-600">You do not have access to system incidents.</div>;

  return (
    <div className="mx-auto max-w-[1400px] space-y-5 px-1 pb-20 pt-3 sm:px-2 ua-compact-page">
      <PageHeader title="System Errors" breadcrumb={['Admin', 'System Errors']} description="Review application exceptions and track recovery." />
      <div className="grid gap-3 sm:grid-cols-3">
        <Card><CardContent className="flex items-center gap-3 p-4"><AlertTriangle className="h-5 w-5 text-red-500" /><div><p className="text-2xl font-semibold tabular-nums">{openCount}</p><p className="text-xs text-zinc-500">Open incidents</p></div></CardContent></Card>
        <Card><CardContent className="flex items-center gap-3 p-4"><Clock3 className="h-5 w-5 text-amber-500" /><div><p className="text-2xl font-semibold tabular-nums">{acknowledgedCount}</p><p className="text-xs text-zinc-500">Acknowledged</p></div></CardContent></Card>
        <Card><CardContent className="flex items-center gap-3 p-4"><CheckCircle2 className="h-5 w-5 text-emerald-600" /><div><p className="text-2xl font-semibold tabular-nums">{resolvedCount}</p><p className="text-xs text-zinc-500">Resolved · last 100</p></div></CardContent></Card>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">{(['ALL', 'OPEN', 'ACKNOWLEDGED', 'RESOLVED'] as const).map(value => <Button key={value} size="sm" variant={filter === value ? 'default' : 'outline'} onClick={() => setFilter(value)} className="h-9 rounded-md text-xs">{value === 'ALL' ? 'All incidents' : value}</Button>)}</div>
        <Badge variant="outline" className="gap-1.5 bg-white"><ShieldCheck className="h-3.5 w-3.5" /> Restricted admin feed</Badge>
      </div>
      {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">Incident feed could not be loaded. Check Firestore permissions and connection.</div>}
      <Card><CardContent className="p-0">
        {loading ? <div className="p-8 text-center text-sm text-zinc-500">Loading incident feed…</div> : incidents.length === 0 ? <div className="p-10 text-center"><CheckCircle2 className="mx-auto h-8 w-8 text-emerald-600" /><p className="mt-3 text-sm font-semibold text-zinc-800">No incidents in this view</p><p className="mt-1 text-xs text-zinc-500">New signed-in client errors will appear here when reported.</p></div> :
          <div className="divide-y divide-zinc-100">{incidents.map(incident => <article key={incident.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="text-xs font-semibold text-zinc-900">{incident.category.replaceAll('_', ' ')}</span><Badge variant="outline" className={cn('text-[10px]', incident.status === 'OPEN' ? 'border-red-200 text-red-700' : incident.status === 'ACKNOWLEDGED' ? 'border-amber-200 text-amber-700' : 'border-emerald-200 text-emerald-700')}>{incident.status}</Badge><span className="text-[10px] text-zinc-400">{new Date(incident.createdAt).toLocaleString()}</span></div>
              <p className="mt-1 break-words text-sm text-zinc-700">{incident.message}</p><p className="mt-1 text-xs text-zinc-400">Route: {incident.route || 'Unknown'} · Ref: {incident.incidentId}</p></div>
            <div className="flex shrink-0 flex-wrap gap-2">{incident.status === 'OPEN' && <Button size="sm" variant="outline" disabled={busyId === incident.id} onClick={() => updateStatus(incident, 'ACKNOWLEDGED')}>Acknowledge</Button>}{incident.status !== 'RESOLVED' && <Button size="sm" disabled={busyId === incident.id} onClick={() => updateStatus(incident, 'RESOLVED')}>Resolve</Button>}</div>
          </article>)}</div>}
      </CardContent></Card>
      <p className="text-xs leading-5 text-zinc-500">Reports contain a bounded error summary, route, timestamp and signed-in user ID. Stack traces, request bodies, payment details and credentials are not collected.</p>
    </div>
  );
}
