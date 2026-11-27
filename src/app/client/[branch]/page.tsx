'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { 
  Search, 
  Plus, 
  ShoppingCart, 
  ChevronRight, 
  ChevronLeft,
  Tag, 
  ArrowRight, 
  Filter, 
  ShoppingBag, 
  Coffee,
  X,
  Check,
  DollarSign,
  ChevronDown,
  RotateCcw,
  LayoutGrid,
  SlidersHorizontal,
  Loader2
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { 
  Sheet, 
  SheetContent, 
  SheetHeader, 
  SheetTitle, 
  SheetTrigger,
  SheetClose
} from '@/components/ui/sheet';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from '@/components/ui/separator';
import { Product } from '@/lib/types';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import Link from 'next/link';
import Image from 'next/image';
import { useCart } from '@/hooks/use-cart';

const PRICE_RANGES = [
  { label: 'All Prices', min: 0, max: Infinity },
  { label: 'Under KES 1,000', min: 0, max: 1000 },
  { label: 'KES 1,000 - 5,000', min: 1000, max: 5000 },
  { label: 'KES 5,000 - 15,000', min: 5000, max: 15000 },
  { label: 'Above KES 15,000', min: 15000, max: Infinity },
];

const PAGE_SIZE_OPTIONS = [12, 24, 48, 96];

export default function BranchOrderingPage() {
  const { branch } = useParams();
  const router = useRouter();
  const { addToCart, totalItems } = useCart();
  
  const [activeCategory, setActiveCategory] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [minPrice, setMinPrice] = useState<string>('');
  const [maxPrice, setMaxPrice] = useState<string>('');
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(12);
  const [sortBy, setSortBy] = useState('name');
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<string[]>(['All']);
  const [totalProducts, setTotalProducts] = useState(0);
  const [loading, setLoading] = useState(true);
  const [catalogueError, setCatalogueError] = useState('');

  const branchName = Array.isArray(branch) ? branch[0] : String(branch || '');
  const unitType = branchName.toLowerCase() === 'lounge' ? 'LOUNGE' : 'STORE';
  const isLounge = unitType === 'LOUNGE';

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, activeCategory, minPrice, maxPrice, itemsPerPage]);

  useEffect(() => {
    const controller = new AbortController();
    async function loadCatalogue() {
      setLoading(true);
      setCatalogueError('');
      try {
        const params = new URLSearchParams({
          unit: unitType,
          page: String(currentPage),
          pageSize: String(itemsPerPage),
          search: searchTerm.trim(),
          category: activeCategory,
          sort: sortBy,
        });
        if (minPrice !== '') params.set('minPrice', minPrice);
        if (maxPrice !== '') params.set('maxPrice', maxPrice);
        const response = await fetch(`/api/public/catalogue?${params.toString()}`, {
          signal: controller.signal,
          cache: 'no-store',
        });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || 'The catalogue could not be loaded.');
        setProducts(Array.isArray(payload.products) ? payload.products : []);
        setCategories(['All', ...(Array.isArray(payload.categories) ? payload.categories : [])]);
        setTotalProducts(Number(payload.total) || 0);
      } catch (error) {
        if (controller.signal.aborted) return;
        console.error('[CLIENT_CATALOGUE_LOAD_FAILED]', error);
        setProducts([]);
        setTotalProducts(0);
        setCatalogueError(error instanceof Error ? error.message : 'The catalogue could not be loaded.');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    loadCatalogue();
    return () => controller.abort();
  }, [unitType, currentPage, itemsPerPage, searchTerm, activeCategory, minPrice, maxPrice, sortBy]);

  const totalPages = Math.max(1, Math.ceil(totalProducts / itemsPerPage));
  const activePriceRange = PRICE_RANGES.find(range =>
    (range.min === 0 ? minPrice === '' : minPrice === String(range.min)) &&
    (Number.isFinite(range.max) ? maxPrice === String(range.max) : maxPrice === '')
  );
  const paginatedProducts = products;
  const currentRangeStart = totalProducts === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1;
  const currentRangeEnd = Math.min(currentPage * itemsPerPage, totalProducts);

  return (
    <div className="flex flex-col min-h-screen bg-[#FDFDFD]">
      <section className="bg-white border-b border-zinc-100 py-12">
        <div className="max-w-7xl mx-auto px-6 w-full">
           <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.4em] text-zinc-300 mb-4">
              <Link href="/" className="hover:text-primary transition-colors">HOME</Link> 
              <ChevronRight className="w-2.5 h-2.5" /> 
              <span className="text-primary">{branchName.toUpperCase()}</span>
           </div>
           <div className="flex flex-col md:flex-row md:items-end justify-between gap-8">
              <div className="space-y-2">
                 <h1 className="text-5xl md:text-7xl font-black font-headline uppercase text-zinc-900 tracking-tighter leading-none">
                    {isLounge ? 'Lounge' : 'Shop'} <span className="text-primary">Catalog.</span>
                 </h1>
                 <p className="text-[10px] md:text-xs font-bold uppercase tracking-[0.3em] text-zinc-400">
                    Premium {isLounge ? 'Hospitality' : 'Automotive'} Excellence
                 </p>
              </div>
           </div>
        </div>
      </section>

      <section className="sticky top-20 z-40 bg-white/80 backdrop-blur-xl border-b border-zinc-100 shadow-sm py-5">
        <div className="max-w-7xl mx-auto px-6 w-full space-y-4">
           <div className="flex items-center justify-between gap-6">
              <div className="relative flex-1 lg:max-w-md">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-300" />
                <Input 
                  placeholder={`Search for products...`} 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-12 h-14 bg-zinc-50 border-none rounded-2xl font-bold text-sm focus:ring-2 focus:ring-primary/10 shadow-inner"
                />
              </div>

              <div className="flex items-center gap-4">
                <div className="hidden md:flex items-center gap-2">
                    <span className="text-[9px] font-black uppercase tracking-widest text-zinc-400 whitespace-nowrap">Display:</span>
                    <Select value={itemsPerPage.toString()} onValueChange={(v) => setItemsPerPage(parseInt(v))}>
                      <SelectTrigger className="h-10 w-24 border-zinc-100 bg-white rounded-xl font-bold text-[10px] uppercase shadow-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl border-none shadow-2xl">
                        {PAGE_SIZE_OPTIONS.map(opt => (
                          <SelectItem key={opt} value={opt.toString()} className="text-[10px] font-bold uppercase">{opt} Items</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                </div>
                <div className="hidden md:flex items-center gap-2">
                  <span className="text-[9px] font-black uppercase tracking-widest text-zinc-400">Category:</span>
                  <Select value={activeCategory} onValueChange={setActiveCategory}>
                    <SelectTrigger className="h-10 w-36 border-zinc-100 bg-white rounded-xl font-bold text-[10px] uppercase shadow-sm">
                      <SelectValue placeholder="All categories" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border-none shadow-2xl">
                      {categories.map(category => <SelectItem key={category} value={category} className="text-[10px] font-bold uppercase">{category}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="hidden md:flex items-center gap-2">
                  <span className="text-[9px] font-black uppercase tracking-widest text-zinc-400">Sort:</span>
                  <Select value={sortBy} onValueChange={setSortBy}>
                    <SelectTrigger className="h-10 w-36 border-zinc-100 bg-white rounded-xl font-bold text-[10px] uppercase shadow-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border-none shadow-2xl">
                      <SelectItem value="name" className="text-[10px] font-bold uppercase">Name</SelectItem>
                      <SelectItem value="price-asc" className="text-[10px] font-bold uppercase">Price: low to high</SelectItem>
                      <SelectItem value="price-desc" className="text-[10px] font-bold uppercase">Price: high to low</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="hidden md:flex items-center gap-2">
                  <span className="text-[9px] font-black uppercase tracking-widest text-zinc-400">Price:</span>
                  <Select
                    value={activePriceRange ? `${activePriceRange.min}:${activePriceRange.max}` : '0:Infinity'}
                    onValueChange={(value) => {
                      const range = PRICE_RANGES.find(item => `${item.min}:${item.max}` === value);
                      if (range) {
                        setMinPrice(range.min === 0 ? '' : String(range.min));
                        setMaxPrice(Number.isFinite(range.max) ? String(range.max) : '');
                      }
                    }}
                  >
                    <SelectTrigger className="h-10 w-44 border-zinc-100 bg-white rounded-xl font-bold text-[10px] uppercase shadow-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border-none shadow-2xl">
                      {PRICE_RANGES.map(range => <SelectItem key={`${range.min}:${range.max}`} value={`${range.min}:${range.max}`} className="text-[10px] font-bold uppercase">{range.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
           </div>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-6 w-full py-16">
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-8">
             <p className="text-[8px] md:text-[10px] font-black uppercase tracking-widest text-zinc-300">
               Showing {currentRangeStart} - {currentRangeEnd} of {totalProducts} items
             </p>
          </div>

          {loading ? (
            <div className="py-40 text-center flex flex-col items-center gap-8">
              <Loader2 className="w-10 h-10 animate-spin text-zinc-200" />
              <p className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-200">Synchronizing Identity...</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-8">
              {paginatedProducts.map((product) => (
                <div 
                  key={product.id} 
                  onClick={() => router.push(`/client/product/${product.id}`)}
                  className="flex flex-col bg-white border border-zinc-100 rounded-[1.5rem] md:rounded-[2rem] overflow-hidden group cursor-pointer hover:shadow-2xl transition-all duration-500 hover:-translate-y-1"
                >
                  <div className="aspect-[4/5] bg-zinc-50 relative overflow-hidden">
                    <Image 
                      src={product.image || '/assets/logo.png'} 
                      alt={product.name} 
                      fill
                      className={cn(
                        "object-cover group-hover:scale-110 transition-transform duration-700",
                        !product.image && "p-8 md:p-16 opacity-10"
                      )}
                      sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 25vw"
                    />
                    <div className="absolute top-2 left-2 md:top-5 md:left-5">
                       <Badge className="bg-white/90 backdrop-blur-md text-zinc-900 border-none font-black text-[6px] md:text-[7px] uppercase px-1.5 md:px-3 h-5 md:h-6 shadow-sm">
                          {product.category}
                       </Badge>
                    </div>
                  </div>

                  <div className="p-3 md:p-6 flex flex-col flex-1 justify-between gap-3 md:gap-6">
                    <div className="space-y-0.5 md:space-y-1">
                      <h4 className="text-[10px] md:text-sm font-black text-zinc-900 uppercase tracking-tight leading-tight line-clamp-2">{product.name}</h4>
                    </div>
                    <div className="flex items-center justify-between pt-3 md:pt-5 border-t border-zinc-50">
                      <div className="space-y-0 min-w-0">
                         <p className="text-[7px] md:text-[8px] font-black uppercase text-zinc-300 tracking-widest truncate">KES</p>
                         <p className="text-xs md:text-lg font-black text-zinc-900 tracking-tighter truncate">{product.price.toLocaleString()}</p>
                      </div>
                      <button 
                        onClick={(e) => handleAdd(e, product)}
                        className="w-8 h-8 md:w-12 md:h-12 rounded-xl md:rounded-2xl flex items-center justify-center transition-all shadow-lg active:scale-90 bg-zinc-900 text-white hover:bg-primary"
                      >
                        <Plus className="w-4 h-4 md:w-5 md:h-5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {!loading && totalProducts > itemsPerPage && (
            <div className="mt-16 flex flex-col items-center gap-6 py-8 border-t border-zinc-100">
               <div className="flex items-center gap-2">
                  <Button variant="outline" size="icon" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="h-12 w-12 rounded-xl shadow-sm"><ChevronLeft className="w-5 h-5" /></Button>
                  <Button variant="outline" size="icon" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="h-12 w-12 rounded-xl shadow-sm"><ChevronRight className="w-5 h-5" /></Button>
               </div>
               <p className="text-[8px] font-black uppercase text-zinc-300 tracking-[0.4em]">Page {currentPage} of {totalPages}</p>
            </div>
          )}
          {!loading && catalogueError && <p role="alert" className="mt-8 text-center text-sm text-red-600">{catalogueError}</p>}
          {!loading && !catalogueError && totalProducts === 0 && <p className="py-20 text-center text-sm font-semibold text-zinc-400">No products match your filters right now.</p>}
        </div>
      </section>

      {totalItems > 0 && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 w-[90%] max-w-sm z-50 animate-in slide-in-from-bottom-12 duration-700">
          <Button 
            onClick={() => router.push('/client/cart')}
            className="w-full h-18 py-8 bg-zinc-900 text-white rounded-3xl shadow-2xl flex items-center justify-between px-10 font-black uppercase text-[11px] tracking-[0.2em] group border-t border-white/5"
          >
            <div className="flex items-center gap-4">
              <div className="relative">
                 <ShoppingCart className="w-6 h-6 text-primary" />
                 <span className="absolute -top-2 -right-2 w-5 h-5 bg-primary text-white rounded-full flex items-center justify-center text-[9px] border-2 border-zinc-900">{totalItems}</span>
              </div>
              <span>View Selection</span>
            </div>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Button>
        </div>
      )}
    </div>
  );
}