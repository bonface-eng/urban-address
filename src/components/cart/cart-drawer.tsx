'use client';

import React from 'react';
import { 
  Sheet, 
  SheetContent, 
  SheetHeader, 
  SheetTitle, 
  SheetTrigger,
  SheetFooter
} from '@/components/ui/sheet';
import { ShoppingCart, Trash2, Minus, Plus, ShoppingBag, ArrowRight, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { useCart } from '@/hooks/use-cart';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';

export function CartDrawer({ children }: { children: React.ReactNode }) {
  const { items, updateQuantity, removeFromCart, subtotal, totalItems } = useCart();
  const router = useRouter();

  const tax = subtotal * 0.16;
  const total = subtotal + tax;

  return (
    <Sheet>
      <SheetTrigger asChild>
        {children}
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-md border-none p-0 bg-white flex flex-col shadow-2xl">
        <SheetHeader className="p-6 border-b border-zinc-50 flex-row items-center justify-between space-y-0">
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 rounded-xl bg-primary/5 flex items-center justify-center text-primary">
                <ShoppingCart className="w-5 h-5" />
             </div>
             <SheetTitle className="text-sm font-black uppercase tracking-[0.2em]">Your Cart</SheetTitle>
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-6 space-y-6 no-scrollbar">
          {items.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-30">
               <ShoppingBag className="w-16 h-16" />
               <p className="text-[10px] font-black uppercase tracking-[0.3em]">Your cart is empty</p>
            </div>
          ) : (
            <div className="divide-y divide-zinc-50">
              {items.map((item) => (
                <div key={item.id} className="py-6 flex gap-4 group">
                  <div className="w-20 h-20 rounded-xl bg-zinc-50 overflow-hidden shrink-0 border border-zinc-100">
                    <img src={item.image || `https://picsum.photos/seed/${item.name}/200/200`} className="w-full h-full object-cover" alt={item.name} />
                  </div>
                  <div className="flex-1 min-w-0 flex flex-col justify-between">
                    <div>
                      <div className="flex justify-between items-start gap-2">
                        <h4 className="text-[11px] font-black text-zinc-900 uppercase truncate">{item.name}</h4>
                        <button onClick={() => removeFromCart(item.id!)} className="text-zinc-200 hover:text-red-500 transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest mt-0.5">{item.category}</p>
                    </div>
                    
                    <div className="flex items-center justify-between mt-2">
                      <div className="flex items-center bg-zinc-50 rounded-lg p-0.5 border border-zinc-100">
                        <button onClick={() => updateQuantity(item.id!, -1)} className="w-6 h-6 flex items-center justify-center text-zinc-400 hover:text-primary"><Minus className="w-2.5 h-2.5"/></button>
                        <span className="w-8 text-center text-[10px] font-black">{item.quantity}</span>
                        <button onClick={() => updateQuantity(item.id!, 1)} className="w-6 h-6 flex items-center justify-center text-zinc-400 hover:text-primary"><Plus className="w-2.5 h-2.5"/></button>
                      </div>
                      <span className="text-[11px] font-black text-zinc-900 uppercase">KES {(item.price * item.quantity).toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {items.length > 0 && (
          <div className="p-6 bg-zinc-50/50 border-t border-zinc-100 space-y-6">
            <div className="space-y-2">
              <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-zinc-400">
                <span>Subtotal</span>
                <span className="text-zinc-900">KES {subtotal.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-zinc-400">
                <span>VAT (16%)</span>
                <span className="text-zinc-900">KES {tax.toLocaleString()}</span>
              </div>
              <Separator className="my-4 bg-zinc-100" />
              <div className="flex justify-between items-end">
                <span className="text-[11px] font-black uppercase tracking-[0.2em] text-zinc-900">Total</span>
                <span className="text-2xl font-black text-primary font-headline tracking-tighter leading-none">KES {total.toLocaleString()}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
               <Button 
                variant="outline"
                onClick={() => { router.push('/client/cart'); }}
                className="h-14 rounded-xl border-zinc-200 font-black uppercase text-[10px] tracking-widest"
               >
                 View Cart
               </Button>
               <Button 
                onClick={() => { router.push('/client/payment'); }}
                className="h-14 rounded-xl bg-zinc-900 text-white font-black uppercase text-[10px] tracking-widest shadow-xl group"
               >
                 Checkout <ArrowRight className="w-3.5 h-3.5 ml-2 group-hover:translate-x-1 transition-transform" />
               </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}