'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { Trash2, Minus, Plus, ShoppingBag, ArrowRight, ShieldCheck, ChevronRight, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import Link from 'next/link';
import { useCart } from '@/hooks/use-cart';
import { cn } from '@/lib/utils';

export default function ClientCartPage() {
  const router = useRouter();
  const { items, updateQuantity, removeFromCart, clearCart, subtotal, isLoaded } = useCart();

  // --- VAT INCLUSIVE CALCULATIONS ---
  // Shelf price is the final price. We extract the VAT portion.
  const total = subtotal;
  const tax = total - (total / 1.16);
  const netTotal = total - tax;

  if (!isLoaded) return null;

  if (items.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-20 bg-white text-center space-y-8 animate-in fade-in duration-700 h-[70vh]">
        <div className="w-32 h-32 rounded-xl bg-zinc-50 flex items-center justify-center text-zinc-200 border border-zinc-100">
           <ShoppingBag className="w-12 h-12" />
        </div>
        <div className="space-y-2">
          <h2 className="text-3xl font-black uppercase font-headline tracking-tighter text-zinc-900">Your cart is empty</h2>
          <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest max-w-xs leading-relaxed mx-auto">Browse our premium selection to find what you need.</p>
        </div>
        <Button onClick={() => router.push('/')} className="h-14 px-12 bg-primary rounded-xl uppercase font-black text-[10px] tracking-[0.2em] shadow-xl shadow-primary/20">
          Start Exploring
        </Button>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col">
      <section className="bg-zinc-50 border-b border-zinc-100 py-8">
        <div className="max-w-7xl mx-auto px-6 w-full flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.3em] text-zinc-400 mb-2">
              <Link href="/" className="hover:text-primary transition-colors">HOME</Link> <ChevronRight className="w-2.5 h-2.5" /> <span className="text-primary">YOUR SELECTION</span>
            </div>
            <h1 className="text-3xl md:text-4xl font-black font-headline uppercase text-zinc-900 tracking-tighter">
              Your <span className="text-primary">Cart.</span>
            </h1>
          </div>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-6 w-full py-8 md:py-10 pb-[calc(13rem+env(safe-area-inset-bottom))] md:pb-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 md:gap-10 items-start">
          <div className="lg:col-span-8 space-y-12">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-4">
              <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-400">Selected Items</h3>
              <Button variant="ghost" onClick={clearCart} className="text-red-500 font-black uppercase text-[9px] tracking-widest hover:bg-red-50 rounded-lg px-4 h-8">
                 Remove All
              </Button>
            </div>

            <div className="divide-y divide-zinc-50">
              {items.map((item) => (
                <div key={item.id} className="py-8 flex gap-8 group">
                  <div 
                    className="w-24 h-24 md:w-32 md:h-32 rounded-2xl bg-zinc-50 overflow-hidden shrink-0 shadow-sm border border-zinc-100 cursor-pointer flex items-center justify-center"
                    onClick={() => router.push(`/client/product/${item.id}`)}
                  >
                    <img 
                      src={item.image || '/assets/logo.png'} 
                      className={cn(
                        "w-full h-full object-cover group-hover:scale-105 transition-transform",
                        !item.image && "p-6 opacity-10"
                      )} 
                      alt={item.name} 
                    />
                  </div>
                  <div className="flex-1 flex flex-col justify-between py-1">
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-1">
                        <h4 
                          className="font-black text-zinc-900 uppercase text-sm md:text-lg tracking-tight group-hover:text-primary transition-colors cursor-pointer"
                          onClick={() => router.push(`/client/product/${item.id}`)}
                        >
                          {item.name}
                        </h4>
                        <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest">{item.size}{item.sizeUnit} Premium Quality</p>
                      </div>
                      <span className="text-zinc-900 font-black text-sm md:text-xl tracking-tighter leading-none">KES {(item.price * item.quantity).toLocaleString()}</span>
                    </div>
                    
                    <div className="flex items-center gap-6 mt-4">
                      <div className="flex items-center bg-zinc-50 rounded-xl p-0.5 border border-zinc-100">
                        <button onClick={() => updateQuantity(item.id!, -1)} className="w-8 h-8 flex items-center justify-center text-zinc-400 hover:text-primary hover:bg-white rounded-lg transition-all"><Minus className="w-3 h-3"/></button>
                        <span className="w-10 text-center text-xs font-black">{item.quantity}</span>
                        <button
                          onClick={() => updateQuantity(item.id!, 1)}
                          disabled={item.unit !== 'CARWASH' && item.quantity >= Math.max(0, Number(item.stockLevel) || 0)}
                          aria-label={item.unit === 'CARWASH' || item.quantity < (Number(item.stockLevel) || 0) ? 'Increase quantity' : 'Maximum available stock reached'}
                          className="w-8 h-8 flex items-center justify-center text-zinc-400 hover:text-primary hover:bg-white rounded-lg transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                        ><Plus className="w-3 h-3"/></button>
                      </div>
                      {item.unit !== 'CARWASH' && Number(item.stockLevel) <= 0 && <span className="text-[8px] font-black uppercase text-red-500">Out of stock</span>}
                      <button onClick={() => removeFromCart(item.id!)} className="ml-auto text-zinc-200 hover:text-red-500 transition-colors uppercase font-black text-[9px] tracking-widest flex items-center gap-2">
                        <Trash2 className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Remove</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <aside className="lg:col-span-4 lg:sticky lg:top-32">
            <div className="bg-white text-zinc-900 rounded-xl p-10 shadow-2xl border border-zinc-100 space-y-10 overflow-hidden relative">
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full translate-x-1/2 -translate-y-1/2" />
              
              <h3 className="text-[9px] font-black uppercase tracking-[0.3em] text-zinc-400 border-b border-zinc-50 pb-6 relative z-10">Order Summary</h3>
              
              <div className="space-y-4 relative z-10">
                <div className="flex justify-between text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">
                  <span>Net Amount</span>
                  <span className="text-zinc-900">KES {netTotal.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">
                  <span>VAT (16% Inc.)</span>
                  <span className="text-zinc-900">KES {tax.toLocaleString()}</span>
                </div>
                <Separator className="bg-zinc-50" />
                <div className="flex justify-between items-end py-2">
                  <span className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-400">Total Selection</span>
                  <span className="text-3xl font-black text-primary font-headline tracking-tighter leading-none">KES {total.toLocaleString()}</span>
                </div>
              </div>

              <div className="space-y-4 pt-4 relative z-10">
                <Button 
                  onClick={() => router.push('/client/payment')}
                  className="hidden lg:flex w-full min-h-16 h-16 bg-zinc-900 text-white font-black uppercase text-[10px] tracking-[0.2em] rounded-xl shadow-xl shadow-zinc-100 transition-transform active:scale-95 group touch-manipulation"
                >
                  Proceed to Payment <ArrowRight className="w-4 h-4 ml-3 group-hover:translate-x-1 transition-transform" />
                </Button>
                <div className="hidden lg:flex items-center justify-center gap-3 text-[8px] font-black text-zinc-300 uppercase tracking-[0.3em]">
                  <Lock className="w-3 h-3" /> Secured Checkout
                </div>
              </div>
            </div>
            
            <div className="mt-8 p-6 bg-zinc-50 rounded-2xl border border-zinc-100 flex items-start gap-4">
               <ShieldCheck className="w-5 h-5 text-green-500 shrink-0 mt-1" />
               <div className="space-y-1">
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-zinc-900">Quality Assured</h4>
                  <p className="text-[9px] font-bold text-zinc-400 uppercase leading-relaxed">Prices are final and include all applicable hospitality taxes.</p>
               </div>
            </div>
          </aside>
        </div>
      </section>

      <div className="lg:hidden fixed inset-x-0 z-[1050] bottom-[calc(4rem+env(safe-area-inset-bottom))] border-t border-zinc-200 bg-white/95 backdrop-blur-md px-4 py-3 shadow-[0_-8px_24px_rgba(0,0,0,0.08)]">
        <div className="mx-auto flex max-w-xl items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-400">Total</p>
            <p className="text-lg font-black tracking-tight text-zinc-900">KES {total.toLocaleString()}</p>
          </div>
          <Button
            onClick={() => router.push('/client/payment')}
            className="h-12 min-w-[56%] rounded-lg bg-zinc-900 px-4 text-[10px] font-black uppercase tracking-widest text-white shadow-lg touch-manipulation"
          >
            Proceed to Payment <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
