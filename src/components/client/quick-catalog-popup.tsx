'use client';

import React, { useEffect, useState } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription 
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

import { Product, BusinessUnit } from '@/lib/types';
import { Coffee, ShoppingBag, Plus, X, ArrowRight, Star, Tag, ShoppingCart, Cigarette, UtensilsCrossed } from 'lucide-react';
import { useCart } from '@/hooks/use-cart';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import Image from 'next/image';

interface QuickCatalogPopupProps {
  isOpen: boolean;
  onClose: () => void;
  unit: BusinessUnit;
  initialCategory?: string | null;
}

export function QuickCatalogPopup({ isOpen, onClose, unit, initialCategory }: QuickCatalogPopupProps) {
  const { addToCart } = useCart();
  const [selectedCat, setSelectedCat] = useState<string | null>(initialCategory || null);

  useEffect(() => {
    if (initialCategory) setSelectedCat(initialCategory);
    else setSelectedCat(null);
  }, [initialCategory, isOpen]);

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isOpen) return;
    const controller = new AbortController();
    async function loadProducts() {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          unit,
          page: '1',
          pageSize: '12',
          category: selectedCat || 'All',
          sort: 'name',
        });
        const response = await fetch(`/api/public/catalogue?${params.toString()}`, {
          signal: controller.signal,
          cache: 'no-store',
        });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || 'Catalogue unavailable');
        if (!controller.signal.aborted) setProducts(Array.isArray(payload.products) ? payload.products : []);
      } catch (error) {
        if (!controller.signal.aborted) {
          console.error('[QUICK_CATALOGUE_LOAD_FAILED]', error);
          setProducts([]);
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    loadProducts();
    return () => controller.abort();
  }, [isOpen, unit, selectedCat]);

  const handleAddToCart = (e: React.MouseEvent, product: Product) => {
    e.stopPropagation();
    addToCart(product);
    toast({
      title: "Added to Cart",
      description: `${product.name} is ready for checkout.`,
      duration: 2000
    });
  };

  const isLounge = unit === 'LOUNGE';
  const Icon = isLounge ? Coffee : ShoppingBag;
  const brandColor = isLounge ? "text-amber-500" : "text-blue-500";
  
  const categories = isLounge ? ['All', 'Drinks', 'Food', 'Tobacco'] : ['All', 'Accessories', 'Oils', 'Cleaning'];

  return (
    <Dialog open={isOpen} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[1000px] rounded-[3rem] border-none shadow-2xl p-0 overflow-hidden bg-white/95 backdrop-blur-xl flex flex-col h-[85vh]">
        {/* MODAL HEADER */}
        <div className="p-8 border-b border-zinc-100 bg-white/50 shrink-0 space-y-6">
           <div className="flex items-center justify-between">
              <div className="flex items-center gap-6">
                 <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center shadow-xl bg-white", brandColor)}>
                    <Icon className="w-7 h-7" />
                 </div>
                 <div>
                   <DialogTitle className="font-headline uppercase tracking-widest text-2xl text-zinc-900 leading-none">
                     Quick <span className={brandColor}>{isLounge ? 'Lounge' : 'Accessory'}</span> Picks.
                   </DialogTitle>
                   <DialogDescription className="text-[10px] font-black uppercase text-zinc-400 tracking-[0.4em] mt-2">
                     High-Fidelity Service Synchronization
                   </DialogDescription>
                 </div>
              </div>
              <button onClick={onClose} className="w-12 h-12 rounded-full bg-zinc-100 flex items-center justify-center text-zinc-400 hover:bg-zinc-200 transition-colors">
                 <X className="w-5 h-5" />
              </button>
           </div>

           {/* Category Sub-Filters */}
           <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setSelectedCat(cat)}
                  className={cn(
                    "px-6 h-10 rounded-full text-[9px] font-black uppercase tracking-widest transition-all whitespace-nowrap",
                    (selectedCat === cat || (!selectedCat && cat === 'All'))
                      ? "bg-zinc-900 text-white shadow-lg"
                      : "bg-zinc-100 text-zinc-400 hover:bg-zinc-200"
                  )}
                >
                  {cat}
                </button>
              ))}
           </div>
        </div>

        {/* CATALOG GRID */}
        <div className="flex-1 overflow-hidden flex flex-col">
           <ScrollArea className="flex-1 p-8">
              {loading ? (
                <div className="h-[400px] flex flex-col items-center justify-center gap-6 opacity-30">
                   <div className="animate-pulse">
                      <Icon className="w-16 h-16 text-zinc-200" />
                   </div>
                   <p className="text-[10px] font-black uppercase tracking-[0.4em]">Updating Inventory...</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                   {products?.map((product) => (
                     <div 
                        key={product.id} 
                        className="group bg-white border border-zinc-100 rounded-3xl overflow-hidden hover:shadow-2xl transition-all duration-500 relative"
                     >
                        <div className="aspect-square bg-zinc-50 relative overflow-hidden">
                           <Image 
                              src={product.image || '/assets/logo.png'} 
                              alt={product.name}
                              fill
                              className={cn(
                                "object-cover group-hover:scale-110 transition-transform duration-700",
                                !product.image && "p-12 opacity-10"
                              )}
                              sizes="25vw"
                           />
                           <div className="absolute top-3 left-3 flex gap-2">
                              <Badge className="bg-white/90 backdrop-blur-md text-zinc-900 border-none font-black text-[7px] uppercase px-2 shadow-sm">
                                 {product.category}
                              </Badge>
                           </div>
                           {product.stockLevel <= 0 && (
                              <div className="absolute inset-0 bg-white/60 backdrop-blur-sm flex items-center justify-center">
                                 <Badge className="bg-red-500 text-white font-black text-[8px] uppercase px-4 py-1">Out of Stock</Badge>
                              </div>
                           )}
                        </div>
                        
                        <div className="p-5 space-y-4">
                           <div className="min-h-[40px]">
                              <h4 className="text-[11px] font-black text-zinc-900 uppercase leading-tight line-clamp-2 tracking-tight">
                                {product.name}
                              </h4>
                              {product.size && <p className="text-[8px] font-bold text-zinc-400 uppercase tracking-widest mt-1">{product.size}{product.sizeUnit}</p>}
                           </div>
                           
                           <div className="flex items-center justify-between pt-4 border-t border-zinc-50">
                              <span className="text-sm font-black text-zinc-900 tracking-tighter">KES {product.price.toLocaleString()}</span>
                              <Button 
                                onClick={(e) => handleAddToCart(e, product)}
                                disabled={product.stockLevel <= 0}
                                size="sm" 
                                className="h-9 px-4 bg-zinc-900 text-white hover:bg-primary rounded-xl font-black uppercase text-[8px] tracking-widest gap-2 shadow-lg transition-all"
                              >
                                 <Plus className="w-3 h-3" /> Quick Add
                              </Button>
                           </div>
                        </div>
                     </div>
                   ))}
                </div>
              )}

              {!loading && products?.length === 0 && (
                 <div className="h-[400px] flex flex-col items-center justify-center gap-4 opacity-20">
                    <Tag className="w-16 h-16" />
                    <p className="text-[11px] font-black uppercase tracking-[0.4em]">No current availability</p>
                 </div>
              )}
           </ScrollArea>
        </div>

        {/* FOOTER ACTION */}
        <div className="p-8 border-t border-zinc-100 bg-white/50 shrink-0">
           <div className="flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="flex items-center gap-4 text-zinc-400">
                 <Star className="w-5 h-5 text-primary" />
                 <p className="text-[10px] font-bold uppercase tracking-widest leading-relaxed max-w-sm">
                   Prices are inclusive of standard 16% VAT. Available for immediate fulfillment at Nakuru Flagship.
                 </p>
              </div>
              <Button 
                onClick={() => {
                   window.location.href = `/client/${unit.toLowerCase()}`;
                   onClose();
                }}
                className="h-16 px-10 bg-zinc-900 text-white rounded-2xl font-black uppercase text-[10px] tracking-[0.2em] shadow-2xl active:scale-95 transition-all group"
              >
                Explore Full Collection <ArrowRight className="w-4 h-4 ml-3 group-hover:translate-x-1 transition-transform" />
              </Button>
           </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}