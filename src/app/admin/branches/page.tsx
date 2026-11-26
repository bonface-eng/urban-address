'use client';

import { PageHeader } from '@/components/shared/page-layout';

import React, { useEffect, useMemo, useState } from 'react';
import { addDoc, collection, doc, orderBy, query, updateDoc, writeBatch } from 'firebase/firestore';
import { Building2, MapPin, Plus, Pencil, Check, X, ExternalLink, MapPinned, Phone, Search, Loader2, Archive, Star } from 'lucide-react';
import { useFirestore, useCollection, useMemoFirebase, useUser } from '@/firebase';
import { useProfile } from '@/hooks/use-profile';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import type { BusinessBranch } from '@/lib/types';

type BranchForm = {
  name: string;
  code: string;
  address: string;
  town: string;
  county: string;
  country: string;
  postalCode: string;
  landmark: string;
  latitude: string;
  longitude: string;
  mapsUrl: string;
  phone: string;
  status: 'ACTIVE' | 'INACTIVE';
};

const EMPTY_FORM: BranchForm = {
  name: '', code: '', address: '', town: '', county: '', country: 'Kenya',
  postalCode: '', landmark: '', latitude: '', longitude: '', mapsUrl: '',
  phone: '', status: 'ACTIVE'
};

const slugify = (value: string) => value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export default function BranchManagementPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const { isSuperAdmin } = useProfile();
  const { toast } = useToast();
  const [form, setForm] = useState<BranchForm>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const branchesQuery = useMemoFirebase(() => {
    if (!firestore || !user || !isSuperAdmin) return null;
    return query(collection(firestore, 'branches'), orderBy('createdAt', 'asc'));
  }, [firestore, user, isSuperAdmin]);
  const { data: branches, loading } = useCollection<BusinessBranch>(branchesQuery);

  const visibleBranches = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return branches || [];
    return (branches || []).filter(branch =>
      [branch.name, branch.code, branch.location?.town, branch.location?.county, branch.location?.address]
        .some(value => String(value || '').toLowerCase().includes(term))
    );
  }, [branches, search]);

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
  };

  const beginEdit = (branch: BusinessBranch) => {
    setEditingId(branch.id);
    setForm({
      name: branch.name || '',
      code: branch.code || '',
      address: branch.location?.address || '',
      town: branch.location?.town || '',
      county: branch.location?.county || '',
      country: branch.location?.country || 'Kenya',
      postalCode: branch.location?.postalCode || '',
      landmark: branch.location?.landmark || '',
      latitude: branch.location?.latitude == null ? '' : String(branch.location.latitude),
      longitude: branch.location?.longitude == null ? '' : String(branch.location.longitude),
      mapsUrl: branch.location?.mapsUrl || '',
      phone: branch.phone || '',
      status: branch.status || 'ACTIVE'
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const saveBranch = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (loading || branches === null) {
      toast({ title: 'Branch list is still loading', description: 'Wait for the branch directory to finish loading before saving.', variant: 'destructive' });
      return;
    }
    if (!firestore || !user || !form.name.trim() || !form.town.trim() || !form.county.trim()) {
      toast({ title: 'Complete the required fields', description: 'Branch name, town and county are required.', variant: 'destructive' });
      return;
    }
    const code = slugify(form.code || form.name);
    if (!code) {
      toast({ title: 'Invalid branch code', variant: 'destructive' });
      return;
    }
    const duplicate = (branches || []).some(branch => branch.code === code && branch.id !== editingId);
    if (duplicate) {
      toast({ title: 'Branch code already exists', description: 'Use a unique branch code.', variant: 'destructive' });
      return;
    }
    if (form.mapsUrl.trim()) {
      try {
        const parsed = new URL(form.mapsUrl.trim());
        if (parsed.protocol !== 'https:') throw new Error('HTTPS required');
      } catch {
        toast({ title: 'Invalid map link', description: 'Use a valid HTTPS Google Maps link.', variant: 'destructive' });
        return;
      }
    }
    const latitude = form.latitude.trim() ? Number(form.latitude) : null;
    const longitude = form.longitude.trim() ? Number(form.longitude) : null;
    if ((latitude !== null && (!Number.isFinite(latitude) || latitude < -90 || latitude > 90)) ||
        (longitude !== null && (!Number.isFinite(longitude) || longitude < -180 || longitude > 180))) {
      toast({ title: 'Invalid map coordinates', description: 'Latitude must be between -90 and 90 and longitude between -180 and 180.', variant: 'destructive' });
      return;
    }
    if ((latitude === null) !== (longitude === null)) {
      toast({ title: 'Add both coordinates', description: 'Latitude and longitude must be entered together.', variant: 'destructive' });
      return;
    }

    setSaving(true);
    const now = Date.now();
    const location = {
      address: form.address.trim(),
      town: form.town.trim(),
      county: form.county.trim(),
      country: form.country.trim() || 'Kenya',
      postalCode: form.postalCode.trim(),
      landmark: form.landmark.trim(),
      latitude,
      longitude,
      mapsUrl: form.mapsUrl.trim()
    };
    try {
      if (editingId) {
        await updateDoc(doc(firestore, 'branches', editingId), {
          name: form.name.trim(), code, location, phone: form.phone.trim(),
          status: form.status, updatedAt: now, updatedBy: user.uid
        });
        toast({ title: 'Branch updated', description: 'Branch details and location have been saved.' });
      } else {
        await addDoc(collection(firestore, 'branches'), {
          businessId: 'urban-address',
          name: form.name.trim(), code, location, phone: form.phone.trim(),
          status: form.status, isPrimary: (branches || []).length === 0,
          createdAt: now, createdBy: user.uid, updatedAt: now, updatedBy: user.uid
        });
        toast({ title: 'Branch created', description: 'The new branch is now in the branch directory.' });
      }
      resetForm();
    } catch (error) {
      toast({ title: 'Could not save branch', description: 'Check your connection and administrator permissions, then try again.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const setPrimary = async (branchId: string) => {
    if (!firestore || !user) return;
    const batch = writeBatch(firestore);
    (branches || []).forEach(branch => batch.update(doc(firestore, 'branches', branch.id), {
      isPrimary: branch.id === branchId, updatedAt: Date.now(), updatedBy: user.uid
    }));
    try {
      await batch.commit();
      toast({ title: 'Primary branch updated' });
    } catch {
      toast({ title: 'Could not update primary branch', variant: 'destructive' });
    }
  };

  const toggleStatus = async (branch: BusinessBranch) => {
    if (!firestore || !user) return;
    const now = Date.now();
    const nextPrimary = branch.status === 'ACTIVE' && branch.isPrimary
      ? (branches || []).find(item => item.id !== branch.id && item.status === 'ACTIVE')
      : undefined;
    if (branch.status === 'ACTIVE' && branch.isPrimary && !nextPrimary) {
      toast({ title: 'Keep one active primary branch', description: 'Activate another branch before deactivating the only active branch.', variant: 'destructive' });
      return;
    }
    try {
      if (nextPrimary) {
        const batch = writeBatch(firestore);
        batch.update(doc(firestore, 'branches', branch.id), {
          status: 'INACTIVE', isPrimary: false, updatedAt: now, updatedBy: user.uid
        });
        batch.update(doc(firestore, 'branches', nextPrimary.id), {
          isPrimary: true, updatedAt: now, updatedBy: user.uid
        });
        await batch.commit();
      } else {
        await updateDoc(doc(firestore, 'branches', branch.id), {
          status: branch.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE',
          updatedAt: now, updatedBy: user.uid
        });
      }
      toast({ title: branch.status === 'ACTIVE' ? 'Branch deactivated' : 'Branch activated' });
    } catch {
      toast({ title: 'Could not change branch status', variant: 'destructive' });
    }
  };

  if (!mounted) return null;
  if (!isSuperAdmin) return <div className="mx-auto max-w-xl p-8 text-center text-sm text-zinc-500">You do not have permission to manage business branches.</div>;

  return (
    <main className="mx-auto max-w-[1500px] space-y-6 px-3 pb-28 pt-4 sm:px-6 sm:pt-6">
      <header className="flex flex-col justify-between gap-4 border-b border-zinc-200 pb-5 sm:flex-row sm:items-end">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-primary">Business administration</p>
          <PageHeader title="Branches & locations" breadcrumb={["Admin", "Branches & locations"]} className="mb-0" />
          <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-500">Manage Urban Address locations centrally. Each branch keeps its own identity while remaining part of the same business.</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="h-8 rounded-lg px-3 text-[10px] font-bold">{branches?.length || 0} branches</Badge>
          <Button type="button" variant="outline" onClick={resetForm} className="h-10 rounded-lg border-zinc-200 text-xs font-bold"><Plus className="mr-2 h-4 w-4" />New branch</Button>
        </div>
      </header>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(360px,0.95fr)]">
        <Card className="overflow-hidden rounded-xl border-zinc-200 shadow-sm">
          <CardHeader className="border-b border-zinc-100 bg-zinc-50/60 px-4 py-4 sm:px-5">
            <CardTitle className="flex items-center gap-2 text-sm font-black uppercase tracking-wide"><Building2 className="h-4 w-4 text-primary" /> Branch directory</CardTitle>
            <CardDescription className="text-xs">Active and inactive business locations</CardDescription>
            <div className="relative pt-2"><Search className="absolute left-3 top-[22px] h-4 w-4 text-zinc-400" /><Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search branch, town or county" className="h-10 rounded-lg pl-9" /></div>
          </CardHeader>
          <CardContent className="space-y-3 p-3 sm:p-4">
            {loading && <div className="flex items-center justify-center gap-2 py-12 text-sm text-zinc-500"><Loader2 className="h-4 w-4 animate-spin" />Loading branches</div>}
            {!loading && visibleBranches.length === 0 && <div className="rounded-lg border border-dashed border-zinc-300 px-5 py-12 text-center"><MapPinned className="mx-auto h-8 w-8 text-zinc-300" /><p className="mt-3 text-sm font-bold text-zinc-700">No branches found</p><p className="mt-1 text-xs text-zinc-500">Create the first branch and add its physical location.</p></div>}
            {visibleBranches.map(branch => {
              const mapHref = branch.location?.mapsUrl || (branch.location?.latitude != null && branch.location?.longitude != null
                ? `https://www.google.com/maps?q=${branch.location.latitude},${branch.location.longitude}`
                : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([branch.location?.address, branch.location?.town, branch.location?.county, branch.location?.country].filter(Boolean).join(', '))}`);
              return (
                <article key={branch.id} className="rounded-lg border border-zinc-200 bg-white p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-zinc-700"><Building2 className="h-5 w-5" /></div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2"><h3 className="break-words text-sm font-black text-zinc-950">{branch.name}</h3>{branch.isPrimary && <Badge className="h-5 rounded-md bg-orange-50 px-2 text-[9px] font-bold text-orange-800 hover:bg-orange-50"><Star className="mr-1 h-3 w-3" />Primary</Badge>}</div>
                        <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-zinc-400">{branch.code}</p>
                      </div>
                    </div>
                    <Badge variant="outline" className={branch.status === 'ACTIVE' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-zinc-200 bg-zinc-100 text-zinc-500'}>{branch.status}</Badge>
                  </div>
                  <div className="mt-4 space-y-2 border-t border-zinc-100 pt-3 text-xs text-zinc-600">
                    <p className="flex items-start gap-2"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-zinc-400" /><span>{[branch.location?.address, branch.location?.landmark, branch.location?.town, branch.location?.county, branch.location?.country].filter(Boolean).join(', ') || 'Location details not added'}</span></p>
                    {branch.phone && <p className="flex items-center gap-2"><Phone className="h-4 w-4 text-zinc-400" />{branch.phone}</p>}
                    <a href={mapHref} target="_blank" rel="noreferrer" className="inline-flex min-h-10 items-center gap-2 font-bold text-primary hover:underline"><MapPinned className="h-4 w-4" />Open location in Maps <ExternalLink className="h-3 w-3" /></a>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 border-t border-zinc-100 pt-3">
                    {!branch.isPrimary && branch.status === 'ACTIVE' && <Button type="button" variant="outline" onClick={() => setPrimary(branch.id)} className="h-9 rounded-lg px-3 text-[10px] font-bold"><Star className="mr-1.5 h-3.5 w-3.5" />Set primary</Button>}
                    <Button type="button" variant="outline" onClick={() => beginEdit(branch)} className="h-9 rounded-lg px-3 text-[10px] font-bold"><Pencil className="mr-1.5 h-3.5 w-3.5" />Edit details</Button>
                    <Button type="button" variant="outline" onClick={() => toggleStatus(branch)} className="h-9 rounded-lg px-3 text-[10px] font-bold">{branch.status === 'ACTIVE' ? <><Archive className="mr-1.5 h-3.5 w-3.5" />Deactivate</> : <><Check className="mr-1.5 h-3.5 w-3.5" />Activate</>}</Button>
                  </div>
                </article>
              );
            })}
          </CardContent>
        </Card>

        <Card className="h-fit overflow-hidden rounded-xl border-zinc-200 shadow-sm">
          <CardHeader className="border-b border-zinc-100 bg-zinc-50/60 px-4 py-4 sm:px-5">
            <CardTitle className="flex items-center gap-2 text-sm font-black uppercase tracking-wide"><MapPinned className="h-4 w-4 text-primary" />{editingId ? 'Edit branch' : 'Add a branch'}</CardTitle>
            <CardDescription className="text-xs">Enter the branch identity and its physical address. Map coordinates are optional.</CardDescription>
          </CardHeader>
          <CardContent className="p-4 sm:p-5">
            <form onSubmit={saveBranch} className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="branch-name">Branch name *</Label><Input id="branch-name" required value={form.name} onChange={e => setForm(p => ({...p, name:e.target.value, code: p.code || slugify(e.target.value)}))} placeholder="e.g. Nakuru Main Branch" className="h-11 rounded-lg" /></div>
                <div className="space-y-1.5"><Label htmlFor="branch-code">Branch code</Label><Input id="branch-code" value={form.code} onChange={e => setForm(p => ({...p, code:slugify(e.target.value)}))} placeholder="nakuru-main" className="h-11 rounded-lg" /></div>
                <div className="space-y-1.5"><Label htmlFor="branch-phone">Branch phone</Label><Input id="branch-phone" value={form.phone} onChange={e => setForm(p => ({...p, phone:e.target.value}))} placeholder="+254..." className="h-11 rounded-lg" /></div>
                <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="branch-address">Street / building / plot</Label><Input id="branch-address" value={form.address} onChange={e => setForm(p => ({...p, address:e.target.value}))} placeholder="Street, building or plot number" className="h-11 rounded-lg" /></div>
                <div className="space-y-1.5"><Label htmlFor="branch-town">Town / city *</Label><Input id="branch-town" required value={form.town} onChange={e => setForm(p => ({...p, town:e.target.value}))} placeholder="Town or city" className="h-11 rounded-lg" /></div>
                <div className="space-y-1.5"><Label htmlFor="branch-county">County / region *</Label><Input id="branch-county" required value={form.county} onChange={e => setForm(p => ({...p, county:e.target.value}))} placeholder="County" className="h-11 rounded-lg" /></div>
                <div className="space-y-1.5"><Label htmlFor="branch-country">Country</Label><Input id="branch-country" value={form.country} onChange={e => setForm(p => ({...p, country:e.target.value}))} className="h-11 rounded-lg" /></div>
                <div className="space-y-1.5"><Label htmlFor="branch-postal">Postal code</Label><Input id="branch-postal" value={form.postalCode} onChange={e => setForm(p => ({...p, postalCode:e.target.value}))} className="h-11 rounded-lg" /></div>
                <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="branch-landmark">Nearby landmark</Label><Input id="branch-landmark" value={form.landmark} onChange={e => setForm(p => ({...p, landmark:e.target.value}))} placeholder="A recognizable nearby place" className="h-11 rounded-lg" /></div>
                <div className="space-y-1.5"><Label htmlFor="branch-lat">Latitude</Label><Input id="branch-lat" inputMode="decimal" value={form.latitude} onChange={e => setForm(p => ({...p, latitude:e.target.value}))} placeholder="-0.3031" className="h-11 rounded-lg" /></div>
                <div className="space-y-1.5"><Label htmlFor="branch-lng">Longitude</Label><Input id="branch-lng" inputMode="decimal" value={form.longitude} onChange={e => setForm(p => ({...p, longitude:e.target.value}))} placeholder="36.0800" className="h-11 rounded-lg" /></div>
                <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="branch-map-url">Google Maps link (optional)</Label><Input id="branch-map-url" type="url" value={form.mapsUrl} onChange={e => setForm(p => ({...p, mapsUrl:e.target.value}))} placeholder="https://maps.google.com/..." className="h-11 rounded-lg" /></div>
                <div className="space-y-1.5"><Label htmlFor="branch-status">Branch status</Label><select id="branch-status" value={form.status} onChange={e => setForm(p => ({...p, status:e.target.value as BranchForm['status']}))} className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm"><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option></select></div>
              </div>
              <div className="flex flex-col-reverse gap-2 border-t border-zinc-100 pt-4 sm:flex-row">
                {editingId && <Button type="button" variant="outline" onClick={resetForm} className="h-11 flex-1 rounded-lg"><X className="mr-2 h-4 w-4" />Cancel edit</Button>}
                <Button type="submit" disabled={saving} className="h-11 flex-1 rounded-lg bg-zinc-900 text-white hover:bg-zinc-800">{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}{editingId ? 'Save branch changes' : 'Create branch'}</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
      <p className="text-[11px] leading-5 text-zinc-500">Branch records are part of the shared Urban Address business. Deactivation preserves historical records; branches are never hard-deleted from this screen.</p>
    </main>
  );
}
