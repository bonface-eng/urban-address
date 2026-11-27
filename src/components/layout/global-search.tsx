'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Search, Command, ShoppingBag, Coffee, Car, ArrowRight, X } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useDb, useCollection } from '@/lib/data';
import { collection, query, limit } from '@/lib/db';
import { useProfile } from '@/hooks/use-profile';
import { useRouter } from 'next/navigation';
import { Product, CarwashJob } from '@/lib/types';
import { cn } from '@/lib/utils';

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const router = useRouter();
  const { role, profile } = useProfile();
  const firestore = useDb();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  const productsQuery = useMemo(() => firestore ? query(collection(firestore, 'inventory'), limit(5)) : null, [firestore]);
  const jobsQuery = useMemo(() => firestore ? query(collection(firestore, 'carwash_jobs'), limit(5)) : null, [firestore]);

  const { data: products } = useCollection<Product>(productsQuery);
  const { data: jobs } = useCollection<CarwashJob>(jobsQuery);

  const filteredResults = useMemo(() => {
    if (!searchTerm) return { products: [], jobs: [] };
    
    const term = searchTerm.toLowerCase();
    
    const p = products?.filter(i => i.name.toLowerCase().includes(term)) || [];
    let j = jobs?.filter(i => i.plateNumber.toLowerCase().includes(term) || i.service.toLowerCase().includes(term)) || [];

    if (role === 'ATTENDANT') {
      j = j.filter(job => job.attendantId === profile?.displayName);
    }

    return { products: p, jobs: j };
  }, [searchTerm, products, jobs, role, profile]);

  const handleSelect = (href: string) => {
    setOpen(false);
    setSearchTerm('');
    router.push(href);
  };

  return (
    <>
      <div 
        onClick={() => setOpen(true)}
        className="hidden md:flex relative max-w-xs group cursor-pointer"
      >
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 group-hover:text-primary transition-colors" />
        <div className="w-64 h-9 bg-zinc-50 border-none rounded-full px-9 flex items-center text-zinc-400 text-xs font-bold uppercase tracking-widest">
          Search products...
        </div>
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 bg-white border border-zinc-200 px-1.5 py-0.5 rounded-md">
          <Command className="w-2 h-2 text-zinc-400" />
          <span className="text-[8px] font-black text-zinc-400">K</span>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl p-0 border-none shadow-2xl bg-white rounded-[2rem] overflow-hidden">
          <div className="sr-only">
             <DialogTitle>Search Interface</DialogTitle>
             <DialogDescription>Search through the Urban Express operations database.</DialogDescription>
          </div>
          <div className="p-6 border-b border-zinc-100 flex items-center gap-4">
            <Search className="w-6 h-6 text-primary" />
            <Input 
              autoFocus
              placeholder="Search products, orders, or vehicles..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="border-none bg-transparent h-12 text-lg focus-visible:ring-0 px-0 placeholder:text-zinc-300 font-bold"
            />
            <Button variant="ghost" size="icon" onClick={() => setOpen(false)} className="rounded-2xl">
              <X className="w-5 h-5 text-zinc-300" />
            </Button>
          </div>

          <div className="max-h-[60vh] overflow-y-auto p-4 space-y-6">
            {!searchTerm ? (
              <div className="py-12 text-center space-y-2 opacity-30">
                <Search className="w-12 h-12 mx-auto" />
                <p className="text-[10px] font-black uppercase tracking-[0.2em]">Start typing to search database</p>
              </div>
            ) : (
              <>
                {filteredResults.products.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="px-2 text-[10px] font-black text-zinc-400 uppercase tracking-widest">Stock Items</h3>
                    {filteredResults.products.map(p => (
                      <SearchResultItem 
                        key={p.id} 
                        icon={p.unit === 'LOUNGE' ? Coffee : ShoppingBag}
                        title={p.name}
                        subtitle={`${p.category} • KES ${p.price}`}
                        onClick={() => handleSelect('/inventory')}
                      />
                    ))}
                  </div>
                )}

                {filteredResults.jobs.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="px-2 text-[10px] font-black text-zinc-400 uppercase tracking-widest">Active Jobs</h3>
                    {filteredResults.jobs.map(j => (
                      <SearchResultItem 
                        key={j.id} 
                        icon={Car}
                        title={j.plateNumber}
                        subtitle={`${j.service} • ${j.status}`}
                        onClick={() => handleSelect('/carwash')}
                      />
                    ))}
                  </div>
                )}

                {filteredResults.products.length === 0 && filteredResults.jobs.length === 0 && (
                  <div className="py-12 text-center opacity-30">
                    <p className="text-[10px] font-black uppercase tracking-widest">No matching results found</p>
                  </div>
                )}
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function SearchResultItem({ icon: Icon, title, subtitle, onClick }: any) {
  return (
    <div 
      onClick={onClick}
      className="flex items-center gap-4 p-4 rounded-3xl hover:bg-zinc-50 cursor-pointer group transition-all"
    >
      <div className="w-12 h-12 rounded-2xl bg-zinc-100 flex items-center justify-center text-zinc-400 group-hover:bg-primary/10 group-hover:text-primary transition-colors">
        <Icon className="w-5 h-5" />
      </div>
      <div className="flex-1">
        <h4 className="text-sm font-bold text-zinc-900">{title}</h4>
        <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">{subtitle}</p>
      </div>
      <ArrowRight className="w-4 h-4 text-zinc-200 group-hover:text-primary transition-all group-hover:translate-x-1" />
    </div>
  );
}
