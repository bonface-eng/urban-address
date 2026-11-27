
'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { 
  ChevronLeft, 
  ShoppingCart, 
  ShieldCheck, 
  Clock, 
  Plus, 
  Minus,
  Info
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

import { Product } from '@/lib/types';
import { toast } from '@/hooks/use-toast';
import { useCart } from '@/hooks/use-cart';
import { cn } from '@/lib/utils';
import Image from 'next/image';

const WhatsAppIcon = ({ className }: { className?: string }) => (
  <svg 
    viewBox="0 0 24 24" 
    fill="currentColor" 
    className={className}
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.353-.883-.788-1.48-1.76-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.131.57-.074 1.758-.706 2.006-1.388.248-.682.248-1.265.174-1.388-.074-.124-.272-.198-.57-.347m-4.821 7.454c-1.679 0-3.325-.43-4.767-1.245l-.342-.192-3.542.928.943-3.454-.21-.334c-.896-1.428-1.371-3.085-1.371-4.783 0-4.834 3.931-8.765 8.765-8.765 2.342 0 4.545.912 6.199 2.567s2.567 3.857 2.567 6.199c0 4.835-3.931 8.765-8.765 8.765m8.191-17.032c-2.188-2.187-5.1-3.392-8.191-3.392-6.38 0-11.57 5.19-11.57 11.57 0 2.04.532 4.032 1.542 5.795l-1.639 5.986 6.126-1.606c1.71 1.037 3.684-1.585 5.541 1.585 6.38 0 11.57-5.19 11.57-11.57 0-3.091-1.205-5.992-3.391-8.179"/>
  </svg>
);

export default function ProductDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const { addToCart } = useCart();
  const [quantity, setQuantity] = useState(1);

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) {
      setProduct(null);
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    async function loadProduct() {
      setLoading(true);
      try {
        const params = new URLSearchParams({ productId: String(id) });
        const response = await fetch(`/api/public/catalogue?${params.toString()}`, {
          signal: controller.signal,
          cache: 'no-store',
        });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || 'Product unavailable');
        if (!controller.signal.aborted) setProduct(payload.product || null);
      } catch (error) {
        if (!controller.signal.aborted) {
          console.error('[PUBLIC_PRODUCT_LOAD_FAILED]', error);
          setProduct(null);
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    loadProduct();
    return () => controller.abort();
  }, [id]);

  const handleAddToCart = () => {
    if (!product) return;
    addToCart(product, quantity);
    toast({
      title: "Order Updated",
      description: `${quantity}x ${product.name} has been added.`
    });
  };

  const handleWhatsAppOrder = () => {
    if (!product) return;
    const message = `Hi Urban Auto Express, I would like to order ${quantity}x ${product.name} (KES ${(product.price * quantity).toLocaleString()}). Product Ref: ${product.id}`;
    const encoded = encodeURIComponent(message);
    window.open(`https://wa.me/254785860753?text=${encoded}`, '_blank');
  };

  if (loading) {
    return (
      <div className="h-[60vh] flex items-center justify-center">
        <div className="animate-pulse">
          <img src="/assets/logo.png" className="h-16 w-auto opacity-30" alt="Urban Express" />
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center space-y-4">
         <h2 className="text-2xl font-black uppercase text-zinc-300">Item not available</h2>
         <Button variant="outline" onClick={() => router.back()}>Return to Shop</Button>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-12">
      <button 
        onClick={() => router.back()}
        className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 hover:text-primary transition-colors mb-12"
      >
        <ChevronLeft className="w-4 h-4" /> Back to Catalog
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-start">
        <div className="space-y-6">
          <div className="aspect-[4/5] bg-zinc-50 rounded-2xl overflow-hidden shadow-sm border border-zinc-100 flex items-center justify-center relative">
             <Image 
               src={product.image || '/assets/logo.png'} 
               fill
               className={cn(
                 "object-cover",
                 !product.image && "p-24 opacity-10"
               )} 
               alt={product.name} 
               sizes="(max-width: 768px) 100vw, 50vw"
               priority
             />
          </div>
          <div className="grid grid-cols-3 gap-4">
             {[1, 2, 3].map(i => (
               <div key={i} className="aspect-square bg-zinc-50 rounded-xl overflow-hidden border border-zinc-100 opacity-60 hover:opacity-100 transition-opacity cursor-pointer flex items-center justify-center relative">
                  <Image src={product.image || '/assets/logo.png'} fill className={cn("object-cover", !product.image && "p-6 opacity-10")} alt="" sizes="15vw" />
               </div>
             ))}
          </div>
        </div>

        <div className="space-y-10 lg:sticky lg:top-32">
          <div className="space-y-4">
             <Badge className="bg-primary/5 text-primary border-none text-[8px] font-black uppercase tracking-[0.2em] px-3 py-1">
               {product.category}
             </Badge>
             <h1 className="text-4xl lg:text-6xl font-black font-headline uppercase text-zinc-900 tracking-tighter leading-none">
               {product.name}
             </h1>
             <div className="flex items-center gap-6">
                <p className="text-3xl font-black text-zinc-900">KES {product.price.toLocaleString()}</p>
                {product.size && (
                  <>
                    <div className="h-6 w-px bg-zinc-100" />
                    <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                      {product.size}{product.sizeUnit} Edition
                    </p>
                  </>
                )}
             </div>
          </div>

          <div className="p-8 bg-zinc-50 rounded-2xl border border-zinc-100 space-y-6">
             <div className="flex items-center justify-between">
                <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Quantity</p>
                <div className="flex items-center bg-white rounded-xl p-1 shadow-sm border border-zinc-100">
                  <button onClick={() => setQuantity(Math.max(1, quantity - 1))} className="w-10 h-10 flex items-center justify-center text-zinc-400 hover:text-primary transition-all"><Minus className="w-4 h-4"/></button>
                  <span className="w-12 text-center text-sm font-black">{quantity}</span>
                  <button onClick={() => setQuantity(quantity + 1)} className="w-10 h-10 flex items-center justify-center text-zinc-400 hover:text-primary transition-all"><Plus className="w-4 h-4"/></button>
                </div>
             </div>

             <div className="grid gap-3">
               <Button 
                 onClick={handleAddToCart}
                 className="w-full h-16 bg-zinc-900 hover:bg-zinc-800 text-white rounded-xl font-black uppercase text-[10px] tracking-[0.2em] shadow-2xl transition-transform active:scale-95 flex items-center justify-center gap-4"
               >
                 <ShoppingCart className="w-4 h-4 text-primary" /> Purchase Online
               </Button>
               
               <Button 
                 variant="outline"
                 onClick={handleWhatsAppOrder}
                 className="w-full h-16 border-zinc-200 bg-white text-zinc-900 hover:bg-zinc-50 rounded-xl font-black uppercase text-[10px] tracking-[0.2em] shadow-sm transition-transform active:scale-95 flex items-center justify-center gap-4"
               >
                 <WhatsAppIcon className="w-5 h-5 text-[#25D366]" /> Order via WhatsApp
               </Button>
             </div>

             <div className="flex items-center justify-center gap-6 pt-2">
                <div className="flex items-center gap-2 text-[8px] font-black text-zinc-400 uppercase tracking-widest">
                  <ShieldCheck className="w-3.5 h-3.5 text-green-500" /> Quality Check Passed
                </div>
                <div className="flex items-center gap-2 text-[8px] font-black text-zinc-400 uppercase tracking-widest">
                  <Clock className="w-3.5 h-3.5 text-primary" /> Ready for Pickup
                </div>
             </div>
          </div>

          <div className="space-y-6">
             <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-zinc-900 flex items-center justify-center text-white">
                   <Info className="w-4 h-4" />
                </div>
                <h3 className="text-xs font-black uppercase tracking-[0.2em] text-zinc-900">Information</h3>
             </div>
             <p className="text-sm text-zinc-500 uppercase font-bold tracking-widest leading-relaxed">
                Premium {product.category.toLowerCase()} item sourced and verified to meet our quality standards. Available for immediate fulfillment at our main branch.
             </p>
             <div className="grid grid-cols-2 gap-4">
                <SpecPoint label="Condition" value="Brand New" />
                <SpecPoint label="Stock" value="In Store" />
                <SpecPoint label="Warranty" value="Verified" />
                <SpecPoint label="Support" value="Lifetime" />
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SpecPoint({ label, value }: { label: string, value: string }) {
  return (
    <div className="flex flex-col gap-1 border-l-2 border-zinc-100 pl-4">
       <span className="text-[8px] font-black text-zinc-300 uppercase tracking-widest">{label}</span>
       <span className="text-[10px] font-black text-zinc-900 uppercase tracking-tighter">{value}</span>
    </div>
  );
}
