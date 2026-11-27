'use client';

import { useMemo, useState } from 'react';
import { collection, doc, setDoc } from '@/lib/db';
import { useDb, useCollection, useMemoSupabase } from '@/lib/data';
import { useProfile } from '@/hooks/use-profile';
import { Product } from '@/lib/types';
import { PageHeader } from '@/components/shared/page-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { toast } from '@/hooks/use-toast';
import { Monitor, MonitorPlay, Search, Save, ExternalLink, Image as ImageIcon, Eye, EyeOff } from 'lucide-react';

type MenuTemplate = 'HERO' | 'GRID' | 'EDITORIAL';
type MenuItem = { productId: string; name: string; category: string; price: number; image?: string; featured: boolean; available: boolean };
type MenuDoc = { status: 'DRAFT' | 'PUBLISHED'; items: MenuItem[]; updatedAt: number; updatedBy: string; rotationSeconds: number; headline: string; promotion: string; template?: MenuTemplate };

export default function DigitalMenuAdminPage() {
  const db = useDb();
  const { profile, isSuperAdmin } = useProfile();
  const productsQuery = useMemoSupabase(() => db && isSuperAdmin ? collection(db, 'inventory') : null, [db, isSuperAdmin]);
  const { data: products, loading } = useCollection<Product>(productsQuery);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [featured, setFeatured] = useState<Record<string, boolean>>({});
  const [headline, setHeadline] = useState('Freshly prepared. Made for you.');
  const [promotion, setPromotion] = useState('');
  const [rotationSeconds, setRotationSeconds] = useState(14);
  const [template, setTemplate] = useState<MenuTemplate>('GRID');
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [publishedCount, setPublishedCount] = useState<number | null>(null);

  const loungeProducts = useMemo(() => (products || []).filter(p => !p.archived && p.unit === 'LOUNGE' && p.id), [products]);
  const visibleProducts = useMemo(() => loungeProducts.filter(p => !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.category.toLowerCase().includes(search.toLowerCase())), [loungeProducts, search]);
  const toggle = (id: string, value: boolean) => setSelected(current => ({ ...current, [id]: value }));
  const toggleFeatured = (id: string, value: boolean) => setFeatured(current => ({ ...current, [id]: value }));

  const publish = async (status: 'DRAFT' | 'PUBLISHED') => {
    if (!db || !profile?.uid) return;
    const items: MenuItem[] = loungeProducts.filter(p => selected[p.id!] && p.id).map(p => ({
      productId: p.id!, name: p.name, category: p.category, price: Number(p.price || 0),
      image: p.image || undefined, featured: !!featured[p.id!], available: Number(p.stockLevel ?? 1) > 0
    }));
    if (!items.length) { toast({ variant: 'destructive', title: 'Select at least one lounge product' }); return; }
    setSaving(true);
    try {
      const payload: MenuDoc = { status, items, headline: headline.trim() || 'Welcome to Urban Address', promotion: promotion.trim(), rotationSeconds: Math.min(30, Math.max(8, Number(rotationSeconds) || 14)), template, updatedAt: Date.now(), updatedBy: profile.uid };
      await setDoc(doc(db, 'digitalMenus', 'main'), payload);
      setPublishedCount(items.length);
      toast({ title: status === 'PUBLISHED' ? 'Digital menu published' : 'Draft saved', description: status === 'PUBLISHED' ? 'The customer display will update automatically.' : 'Your changes are saved but not visible on the TV.' });
    } catch (error) {
      toast({ variant: 'destructive', title: 'Could not save digital menu', description: 'Check your administrator permissions and database policies.' });
    } finally { setSaving(false); }
  };

  if (!isSuperAdmin) return <div className="p-12 text-center font-semibold">Access denied. Administrator permission required.</div>;

  return <main className="mx-auto max-w-[1500px] space-y-6 px-3 py-5 pb-28">
    <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div><div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[.2em] text-muted-foreground"><Monitor className="h-4 w-4"/> Customer experience</div><PageHeader title="Digital Menu Display" breadcrumb={['Admin', 'Digital Menu']} className="mb-1"/><p className="text-sm text-muted-foreground">Manage the menu shown on your restaurant TV. Changes go live only when published.</p></div>
      <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => window.open('/display/menu', '_blank')}><ExternalLink className="mr-2 h-4 w-4"/> Open TV display</Button><Button disabled={saving} variant="outline" onClick={() => publish('DRAFT')}><Save className="mr-2 h-4 w-4"/> Save draft</Button><Button disabled={saving} onClick={() => publish('PUBLISHED')}><MonitorPlay className="mr-2 h-4 w-4"/>{saving ? 'Publishing…' : 'Publish to TV'}</Button></div>
    </div>
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(300px,1fr)]">
      <Card><CardHeader><CardTitle className="text-base">Choose menu products</CardTitle><p className="text-sm text-muted-foreground">Only active Lounge catalogue items are listed. Prices and photos are taken from your existing inventory.</p></CardHeader><CardContent className="space-y-4">
        <div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"/><Input aria-label="Search lounge products" placeholder="Search meals or categories…" className="pl-9" value={search} onChange={e=>setSearch(e.target.value)}/></div>
        {loading ? <p className="py-10 text-center text-sm text-muted-foreground">Loading lounge catalogue…</p> : visibleProducts.length === 0 ? <p className="py-10 text-center text-sm text-muted-foreground">No active Lounge products found in inventory.</p> : <div className="grid gap-2 sm:grid-cols-2">{visibleProducts.map(product => <div key={product.id} className="flex min-w-0 items-center gap-3 rounded-xl border p-3">
          <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-muted">{product.image ? <img src={product.image} alt="" className="h-full w-full object-cover"/> : <div className="flex h-full items-center justify-center"><ImageIcon className="h-5 w-5 text-muted-foreground"/></div>}</div>
          <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{product.name}</p><p className="text-xs text-muted-foreground">{product.category} · KES {Number(product.price || 0).toLocaleString('en-KE')}</p><div className="mt-1 flex gap-1"><Badge variant="secondary">{Number(product.stockLevel ?? 0) > 0 ? 'In stock' : 'Out of stock'}</Badge>{featured[product.id!] && <Badge>Featured</Badge>}</div></div>
          <div className="flex flex-col gap-2"><label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={!!selected[product.id!]} onChange={e=>toggle(product.id!,e.target.checked)}/> Show</label><label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={!!featured[product.id!]} onChange={e=>toggleFeatured(product.id!,e.target.checked)} disabled={!selected[product.id!]}/> Feature</label></div>
        </div>)}</div>}
      </CardContent></Card>
      <div className="space-y-4"><Card><CardHeader><CardTitle className="text-base">Display settings</CardTitle></CardHeader><CardContent className="space-y-4"><label className="block space-y-1 text-sm font-medium">Headline<Input value={headline} onChange={e=>setHeadline(e.target.value)} maxLength={80}/></label><label className="block space-y-1 text-sm font-medium">Promotion banner (optional)<Input value={promotion} onChange={e=>setPromotion(e.target.value)} placeholder="e.g. Family meal offer this weekend" maxLength={100}/></label><div className="space-y-2"><p className="text-sm font-medium">Display template</p><div className="grid grid-cols-1 gap-2">{[{id:"HERO",name:"Featured Hero",description:"One signature meal with supporting items"},{id:"GRID",name:"Classic Grid",description:"Six products with large photos and prices"},{id:"EDITORIAL",name:"Editorial Split",description:"Premium menu list beside a featured dish"}].map(option => <button key={option.id} type="button" onClick={()=>setTemplate(option.id as MenuTemplate)} className={"rounded-lg border p-3 text-left transition-colors " + (template === option.id ? "border-primary bg-primary/5 ring-1 ring-primary" : "hover:bg-muted")}><span className="block text-sm font-semibold">{option.name}</span><span className="mt-1 block text-xs text-muted-foreground">{option.description}</span></button>)}</div></div><label className="block space-y-1 text-sm font-medium">Slide duration (seconds)<Input type="number" min={8} max={30} value={rotationSeconds} onChange={e=>setRotationSeconds(Number(e.target.value))}/></label><div className="rounded-lg bg-muted p-3 text-xs text-muted-foreground">Recommended: 12–15 seconds per slide. All three templates are designed for landscape 16:9 TV displays. Select a template, then publish to apply it immediately.</div></CardContent></Card>
      <Card><CardHeader><CardTitle className="text-base">Main TV display</CardTitle></CardHeader><CardContent className="space-y-3"><div className="flex items-center gap-3"><Monitor className="h-8 w-8 text-primary"/><div><p className="font-semibold">Urban Address · Main Screen</p><p className="text-xs text-muted-foreground">One display · Browser or HDMI device</p></div></div><div className="rounded-lg border p-3 text-xs text-muted-foreground"><p className="font-semibold text-foreground">Display address</p><code className="break-all">https://urbanaddress.com/display/menu</code></div><Button className="w-full" variant="outline" onClick={()=>navigator.clipboard.writeText('https://urbanaddress.com/display/menu')}><ExternalLink className="mr-2 h-4 w-4"/> Copy display address</Button>{publishedCount !== null && <p className="text-xs text-muted-foreground">Last publish in this session: {publishedCount} products.</p>}</CardContent></Card></div>
    </div>
  </main>;
}
