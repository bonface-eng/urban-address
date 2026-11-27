'use client';

import { useEffect, useMemo, useState } from 'react';
import { doc, onSnapshot } from '@/lib/db';
import { useDb } from '@/lib/data';
import { Monitor, Utensils, WifiOff, Star, X, Maximize2 } from 'lucide-react';

type MenuItem = { productId: string; name: string; category: string; price: number; image?: string; featured: boolean; available: boolean };
type MenuTemplate = 'HERO' | 'GRID' | 'EDITORIAL';
type MenuDoc = { status: 'DRAFT' | 'PUBLISHED'; items: MenuItem[]; updatedAt: number; rotationSeconds?: number; headline?: string; promotion?: string; template?: MenuTemplate };

const money = (price: number) => 'KES ' + Number(price || 0).toLocaleString('en-KE');

function ProductImage({ item, onOpen }: { item: MenuItem; onOpen?: () => void }) {
  return <button type="button" onClick={onOpen} aria-label={`View ${item.name} image full screen`} className="group relative block h-full w-full cursor-zoom-in overflow-hidden bg-zinc-900 text-left">{item.image ? <img src={item.image} alt={item.name} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" /> : <div className="flex h-full w-full items-center justify-center bg-zinc-200 text-zinc-400"><Utensils className="h-10 w-10" /></div>}<span className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center bg-black/55 text-white opacity-0 transition-opacity group-hover:opacity-100"><Maximize2 className="h-4 w-4"/></span></button>;
}
function Price({ value, light = false }: { value: number; light?: boolean }) {
  return <span className={'shrink-0 font-black tracking-tight ' + (light ? 'text-white' : 'text-[#f36b16]')}>{money(value)}</span>;
}

export default function DigitalMenuDisplayPage() {
  const db = useDb();
  const [menu, setMenu] = useState<MenuDoc | null>(null);
  const [connected, setConnected] = useState(true);
  const [slide, setSlide] = useState(0);
  const [clock, setClock] = useState('');
  const [viewingImage, setViewingImage] = useState<MenuItem | null>(null);

  useEffect(() => {
    if (!db) return;
    return onSnapshot(doc(db, 'digitalMenus', 'main'), snap => {
      const data = snap.exists() ? snap.data() as MenuDoc : null;
      setMenu(data?.status === 'PUBLISHED' ? data : null);
      setConnected(true);
      setSlide(0);
    }, () => setConnected(false));
  }, [db]);

  const items = useMemo(() => (menu?.items || []).filter(item => item.available), [menu]);
  const slides = useMemo(() => {
    const ordered = [...items.filter(item => item.featured), ...items.filter(item => !item.featured)];
    const chunks: MenuItem[][] = [];
    for (let i = 0; i < ordered.length; i += 6) chunks.push(ordered.slice(i, i + 6));
    return chunks;
  }, [items]);

  useEffect(() => {
    if (slides.length < 2) return;
    const timer = window.setInterval(() => setSlide(current => (current + 1) % slides.length), Math.max(8, menu?.rotationSeconds || 14) * 1000);
    return () => window.clearInterval(timer);
  }, [slides.length, menu?.rotationSeconds]);

  useEffect(() => {
    const update = () => setClock(new Date().toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' }));
    update();
    const timer = window.setInterval(update, 30000);
    return () => window.clearInterval(timer);
  }, []);

  const current = slides[slide] || [];
  useEffect(() => {
    if (!viewingImage) return;
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') setViewingImage(null); };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [viewingImage]);
  const template = menu?.template || 'GRID';
  const hero = current.find(item => item.featured) || current[0];
  const supporting = current.filter(item => item.productId !== hero?.productId).slice(0, 4);

  return <main className="fixed inset-0 flex h-[100dvh] w-screen flex-col overflow-hidden bg-[#f5f3ef] text-[#171717]">
    <header className="flex shrink-0 items-center justify-between gap-6 border-b border-black/10 bg-white px-8 py-4 xl:px-12">
      <div className="flex min-w-0 items-center gap-4"><img src="/assets/logo.png" alt="Urban Address" className="h-12 w-auto max-w-[220px] object-contain xl:h-14"/><div className="hidden border-l border-zinc-200 pl-4 sm:block"><p className="text-[10px] font-black uppercase tracking-[.2em] text-zinc-800">Food & Lounge</p><p className="mt-1 text-[9px] font-semibold uppercase tracking-[.18em] text-zinc-500">Customer menu</p></div></div>
      <div className="flex items-center gap-8"><p className="text-2xl font-black tabular-nums">{clock}</p><p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.18em] text-zinc-500">{connected ? <span className="h-2 w-2 rounded-full bg-emerald-500"/> : <WifiOff className="h-4 w-4"/>}{connected ? 'Live menu' : 'Reconnecting'}</p></div>
    </header>
    {!menu ? <section className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 text-center"><Monitor className="h-16 w-16 text-zinc-300"/><h1 className="text-3xl font-black">Your menu is being prepared</h1><p className="text-base text-zinc-500">Please check back shortly.</p></section> : <>
      <section className="flex min-h-0 flex-1 flex-col px-8 py-6 xl:px-12 xl:py-8">
        <div className="mb-5 flex shrink-0 items-end justify-between gap-6"><div><p className="mb-2 text-[10px] font-black uppercase tracking-[.24em] text-[#f36b16]">Our menu</p><h1 className="text-4xl font-black leading-none tracking-tight xl:text-5xl">{menu.headline || 'Freshly prepared. Made for you.'}</h1></div>{menu.promotion && <div className="max-w-[35%] bg-[#171717] px-6 py-3 text-right text-lg font-bold text-white">{menu.promotion}</div>}</div>

        {current.length === 0 ? <div className="flex min-h-0 flex-1 items-center justify-center bg-white text-xl font-bold text-zinc-500">No available menu items are currently published.</div> : <>{template === 'HERO' && <div className="grid min-h-0 flex-1 grid-cols-[1.35fr_1fr] gap-5">
          {hero && <article className="relative min-h-0 overflow-hidden bg-[#171717]"><ProductImage item={hero} onOpen={() => setViewingImage(hero)}/><div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black via-black/75 to-transparent px-8 pb-8 pt-24"><p className="mb-2 text-xs font-black uppercase tracking-[.22em] text-[#ff9a50]">{hero.category}{hero.featured ? ' · Featured' : ''}</p><div className="flex items-end justify-between gap-5"><h2 className="max-w-[70%] text-4xl font-black leading-tight text-white xl:text-5xl">{hero.name}</h2><Price value={hero.price} light/></div></div></article>}
          <div className="grid min-h-0 grid-cols-2 grid-rows-2 gap-4">{supporting.map(item => <article key={item.productId} className="flex min-h-0 flex-col overflow-hidden border border-black/10 bg-white"><div className="min-h-0 flex-1"><ProductImage item={item} onOpen={() => setViewingImage(item)}/></div><div className="flex items-center justify-between gap-3 px-4 py-3"><div className="min-w-0"><p className="text-[9px] font-bold uppercase tracking-widest text-zinc-400">{item.category}</p><h3 className="truncate text-lg font-extrabold">{item.name}</h3></div><Price value={item.price}/></div></article>)}</div>
        </div>}

        {template === 'GRID' && <div className="grid min-h-0 flex-1 grid-cols-3 grid-rows-2 gap-4">{current.map(item => <article key={item.productId} className="relative min-h-0 overflow-hidden bg-[#171717]"><ProductImage item={item}/><div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black via-black/85 to-transparent px-5 pb-5 pt-16"><p className="mb-1 text-[10px] font-bold uppercase tracking-[.2em] text-[#ff9a50]">{item.category}</p><div className="flex items-end justify-between gap-3"><h2 className="text-2xl font-black leading-tight text-white xl:text-3xl">{item.name}</h2><div className="bg-[#f36b16] px-3 py-2"><Price value={item.price} light/></div></div></div>{item.featured && <span className="absolute left-4 top-4 flex items-center gap-1 bg-[#f36b16] px-3 py-2 text-[10px] font-black uppercase tracking-widest text-white"><Star className="h-3 w-3"/> Featured</span>}</article>)}</div>}

        {template === 'EDITORIAL' && current.length > 0 && <div className="grid min-h-0 flex-1 grid-cols-[.92fr_1.08fr] overflow-hidden bg-[#171717] text-white">
          <div className="flex min-h-0 flex-col justify-between p-7 xl:p-10"><div><p className="mb-5 text-[10px] font-black uppercase tracking-[.24em] text-[#ff9a50]">Made fresh for you</p>{current.slice(0, 5).map((item, index) => <div key={item.productId} className={'flex items-center justify-between gap-4 border-b border-white/15 py-4 ' + (index === 0 ? 'bg-[#f36b16] px-4' : '')}><div className="min-w-0"><p className="text-[9px] font-bold uppercase tracking-widest text-white/55">{item.category}</p><h2 className="truncate text-xl font-extrabold xl:text-2xl">{item.name}</h2></div><Price value={item.price} light/></div>)}</div><div className="flex items-center gap-5 pt-5 text-[10px] font-bold uppercase tracking-[.16em] text-white/65"><span>Freshly prepared</span><span className="h-1 w-1 rounded-full bg-[#f36b16]"/><span>Great taste</span></div></div>
          <div className="relative min-h-0"><ProductImage item={hero || current[0]} onOpen={() => setViewingImage(hero || current[0])}/><div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent px-8 pb-8 pt-28"><p className="mb-2 text-xs font-black uppercase tracking-[.22em] text-[#ff9a50]">The Urban favourite</p><h2 className="text-4xl font-black xl:text-5xl">{hero?.name || 'Our favourites'}</h2>{hero && <p className="mt-3 text-3xl font-black text-[#ff9a50]">{money(hero.price)}</p>}</div></div>
        </div>}</>}
      </section>
      {viewingImage?.image && <div role="dialog" aria-modal="true" aria-label={`${viewingImage.name} full image`} onClick={() => setViewingImage(null)} className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 p-4 md:p-8"><button type="button" onClick={() => setViewingImage(null)} aria-label="Close full image" className="absolute right-5 top-5 z-10 flex h-11 w-11 items-center justify-center border border-white/25 bg-black/50 text-white hover:bg-white/15"><X className="h-5 w-5"/></button><img src={viewingImage.image} alt={viewingImage.name} onClick={e => e.stopPropagation()} className="max-h-[88dvh] max-w-[94vw] object-contain"/><div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent px-6 pb-6 pt-16 text-center text-white"><p className="text-xs font-bold uppercase tracking-[.2em] text-[#ff9a50]">{viewingImage.category}</p><h2 className="mt-1 text-2xl font-black">{viewingImage.name}</h2><p className="mt-1 text-lg font-extrabold text-[#ff9a50]">{money(viewingImage.price)}</p></div></div>}
      <footer className="flex shrink-0 items-center justify-between bg-[#171717] px-8 py-3 text-[10px] font-bold uppercase tracking-[.2em] text-white/65 xl:px-12"><span>Urban Address · Freshly prepared</span><span>{slides.length > 1 ? 'Menu ' + (slide + 1) + ' / ' + slides.length : 'Welcome'}</span></footer>
    </>}
  </main>;
}
