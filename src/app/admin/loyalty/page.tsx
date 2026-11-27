'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useUser } from '@/lib/data';
import { useProfile } from '@/hooks/use-profile';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, CheckCircle2, Loader2, RefreshCw, ShieldCheck, Users, CarFront, Coins } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

type Customer = { uid: string; displayName: string; email: string; totalSpent: number; loyaltyPoints: number; previousPoints: number };
type Plate = { plateNumber: string; customerId: string | null; customerName: string | null; totalSpent: number; loyaltyPoints: number; ownerMatch: string; fleetPath: string | null };
type Preview = {
  previewHash: string;
  migrationId: string;
  pointRate: string;
  applied: boolean;
  summary: Record<string, number>;
  customers: Customer[];
  plates: Plate[];
};

const money = (value: number) => 'KES ' + Number(value || 0).toLocaleString('en-KE', { maximumFractionDigits: 2 });

export default function LoyaltyReconciliationPage() {
  const { user, loading: authLoading } = useUser();
  const { loading: profileLoading, isSuperAdmin, role } = useProfile();
  const [preview, setPreview] = useState<Preview | null>(null);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [showAll, setShowAll] = useState(false);

  const allowed = isSuperAdmin || role === 'ADMIN' || role === 'MANAGER' || role === 'SUPERVISOR';

  const loadPreview = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const token = await user.getIdToken();
      const response = await fetch('/api/admin/loyalty/reconcile', { headers: { Authorization: 'Bearer ' + token }, cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to load reconciliation preview.');
      setPreview(data);
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Preview unavailable', description: error.message });
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (allowed && user) void loadPreview();
  }, [allowed, user, loadPreview]);

  const applyMigration = async () => {
    if (!user || !preview || preview.applied) return;
    const confirmed = window.confirm('Apply this one-time historical loyalty reconciliation? Customer and matched vehicle balances will be updated from eligible PAID orders. This action is recorded and cannot be repeated.');
    if (!confirmed) return;
    setApplying(true);
    try {
      const token = await user.getIdToken();
      const response = await fetch('/api/admin/loyalty/reconcile', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm: true, previewHash: preview.previewHash }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Reconciliation could not be applied.');
      toast({ title: 'Loyalty balances reconciled', description: 'Historical customer and matched vehicle points have been written.' });
      await loadPreview();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Reconciliation not applied', description: error.message });
    } finally {
      setApplying(false);
    }
  };

  if (authLoading || profileLoading) return <div className="p-10 text-center text-sm text-zinc-500">Checking administrator access…</div>;
  if (!user || !allowed) return <div className="mx-auto max-w-xl p-10"><Card><CardContent className="p-8 text-center"><ShieldCheck className="mx-auto mb-3 h-8 w-8 text-zinc-400" /><h1 className="text-lg font-semibold">Administrator access required</h1><p className="mt-2 text-sm text-zinc-500">This reconciliation is restricted to authorized administrators.</p></CardContent></Card></div>;

  const summary = preview?.summary;
  const customers = preview?.customers || [];
  const plates = preview?.plates || [];
  const visibleCustomers = showAll ? customers : customers.slice(0, 12);
  const visiblePlates = showAll ? plates : plates.slice(0, 12);

  return (
    <main className="mx-auto max-w-7xl space-y-6 px-4 py-8 md:px-8">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Customer rewards</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-zinc-900">Historical loyalty reconciliation</h1>
          <p className="mt-2 max-w-2xl text-sm text-zinc-500">Preview historic paid spending, resolve vehicle ownership and calculate the initial customer and vehicle reward balances.</p>
        </div>
        <Button variant="outline" onClick={loadPreview} disabled={loading || applying} className="rounded-lg">{loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}Refresh preview</Button>
      </div>

      <Card className="rounded-xl border-zinc-200 shadow-sm">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><CardTitle className="text-base">Calculation rules</CardTitle><CardDescription className="mt-1">1 point for every KES 10 in eligible paid spending.</CardDescription></div>
            <Badge variant="outline" className="rounded-md">{preview?.applied ? 'Already applied' : 'Preview only'}</Badge>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 text-sm text-zinc-600 md:grid-cols-3">
          <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4"><p className="font-semibold text-zinc-900">Customer balances</p><p className="mt-1">All PAID order types with a verified customer UID, including uniquely matched historical plate orders.</p></div>
          <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4"><p className="font-semibold text-zinc-900">Vehicle balances</p><p className="mt-1">PAID vehicle car-wash orders grouped by normalized registration number.</p></div>
          <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4"><p className="font-semibold text-zinc-900">Excluded / unresolved</p><p className="mt-1">Pending, voided and refunded orders are excluded. Plates with multiple or unknown owners are not assigned to an account.</p></div>
        </CardContent>
      </Card>

      {loading && !preview ? <div className="py-16 text-center text-sm text-zinc-500"><Loader2 className="mx-auto mb-3 h-6 w-6 animate-spin" />Scanning historical orders and registered fleets…</div> : null}
      {preview && summary ? <>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: 'Orders scanned', value: summary.scannedOrders, icon: Coins },
            { label: 'Matched customers', value: summary.matchedCustomers, icon: Users },
            { label: 'Matched vehicles', value: summary.matchedPlates, icon: CarFront },
            { label: 'Unassigned plates', value: summary.unassignedOrAmbiguousPlates, icon: AlertTriangle },
          ].map(item => <Card key={item.label} className="rounded-xl border-zinc-200 shadow-sm"><CardContent className="flex items-center gap-4 p-5"><div className="rounded-lg bg-orange-50 p-3 text-primary"><item.icon className="h-5 w-5" /></div><div><p className="text-xs text-zinc-500">{item.label}</p><p className="text-2xl font-semibold tabular-nums text-zinc-900">{Number(item.value || 0).toLocaleString()}</p></div></CardContent></Card>)}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Card className="rounded-xl border-zinc-200 shadow-sm"><CardContent className="p-5"><p className="text-xs text-zinc-500">Customer points to be populated</p><p className="mt-1 text-3xl font-semibold tabular-nums text-zinc-900">{Number(summary.customerPoints || 0).toLocaleString()}</p></CardContent></Card>
          <Card className="rounded-xl border-zinc-200 shadow-sm"><CardContent className="p-5"><p className="text-xs text-zinc-500">Vehicle points calculated</p><p className="mt-1 text-3xl font-semibold tabular-nums text-zinc-900">{Number(summary.vehiclePoints || 0).toLocaleString()}</p></CardContent></Card>
        </div>

        <Card className="rounded-xl border-zinc-200 shadow-sm">
          <CardHeader><CardTitle className="text-base">Customer allocation</CardTitle><CardDescription>Balances use all eligible paid orders associated with each customer account.</CardDescription></CardHeader>
          <CardContent>
            <div className="overflow-x-auto"><table className="w-full min-w-[650px] text-left text-sm"><thead><tr className="border-b text-xs text-zinc-500"><th className="pb-3 font-medium">Customer</th><th className="pb-3 font-medium">Email</th><th className="pb-3 text-right font-medium">Historical spend</th><th className="pb-3 text-right font-medium">Existing</th><th className="pb-3 text-right font-medium">New points</th></tr></thead><tbody>{visibleCustomers.map(row => <tr key={row.uid} className="border-b last:border-0"><td className="py-3 font-medium text-zinc-900">{row.displayName}</td><td className="py-3 text-zinc-500">{row.email || '—'}</td><td className="py-3 text-right tabular-nums">{money(row.totalSpent)}</td><td className="py-3 text-right tabular-nums">{row.previousPoints.toLocaleString()}</td><td className="py-3 text-right font-semibold tabular-nums text-primary">{row.loyaltyPoints.toLocaleString()}</td></tr>)}</tbody></table></div>
            {customers.length > 12 && <Button variant="ghost" onClick={() => setShowAll(v => !v)} className="mt-3">{showAll ? 'Show fewer' : 'Show all customers'}</Button>}
            {!customers.length && <p className="py-8 text-center text-sm text-zinc-500">No customer-linked paid spending was found.</p>}
          </CardContent>
        </Card>

        <Card className="rounded-xl border-zinc-200 shadow-sm">
          <CardHeader><CardTitle className="text-base">Vehicle allocation</CardTitle><CardDescription>Vehicle balances are a per-plate breakdown of customer points, not an additional award. Assignment requires one confidently identified owner.</CardDescription></CardHeader>
          <CardContent>
            <div className="overflow-x-auto"><table className="w-full min-w-[650px] text-left text-sm"><thead><tr className="border-b text-xs text-zinc-500"><th className="pb-3 font-medium">Registration</th><th className="pb-3 font-medium">Assigned customer</th><th className="pb-3 font-medium">Match</th><th className="pb-3 text-right font-medium">Spend</th><th className="pb-3 text-right font-medium">Points</th></tr></thead><tbody>{visiblePlates.map(row => <tr key={row.plateNumber} className="border-b last:border-0"><td className="py-3 font-mono font-semibold text-zinc-900">{row.plateNumber}</td><td className="py-3 text-zinc-600">{row.customerName || 'Needs assignment'}</td><td className="py-3"><Badge variant="outline" className="rounded-md">{row.ownerMatch}</Badge></td><td className="py-3 text-right tabular-nums">{money(row.totalSpent)}</td><td className="py-3 text-right font-semibold tabular-nums text-primary">{row.loyaltyPoints.toLocaleString()}</td></tr>)}</tbody></table></div>
            {plates.length > 12 && <Button variant="ghost" onClick={() => setShowAll(v => !v)} className="mt-3">{showAll ? 'Show fewer' : 'Show all vehicles'}</Button>}
            {!plates.length && <p className="py-8 text-center text-sm text-zinc-500">No historical paid vehicle washes were found.</p>}
          </CardContent>
        </Card>

        <Card className="rounded-xl border-amber-200 bg-amber-50/70 shadow-none">
          <CardContent className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between">
            <div className="flex gap-3"><AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" /><div><p className="font-semibold text-zinc-900">{preview.applied ? 'Historical reconciliation already applied' : 'Review before applying'}</p><p className="mt-1 text-sm text-zinc-600">{preview.applied ? 'This one-time migration is locked against duplicate execution.' : "Applying writes customer balances and each vehicle's plate balance. Only uniquely matched plates are linked to a customer account; unresolved plates remain in the vehicle registry."}</p></div></div>
            <Button onClick={applyMigration} disabled={preview.applied || applying || loading} className="rounded-lg bg-primary text-white hover:bg-primary/90">{applying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}{preview.applied ? 'Already reconciled' : 'Apply historical points'}</Button>
          </CardContent>
        </Card>
      </> : null}
    </main>
  );
}
