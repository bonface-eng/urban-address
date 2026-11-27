'use client';

import React, { useState } from 'react';
import { CreditCard, Banknote, ShieldCheck, ChevronRight, MapPin, Zap, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { useCart } from '@/hooks/use-cart';

const GooglePayIcon = () => (
  <svg width="45" height="18" viewBox="0 0 45 18" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M19.1273 7.37527V16.3268H16.8941V1.31689H22.6673C24.2393 1.31689 25.5241 1.82103 26.5217 2.82931C27.5193 3.83759 28.0181 5.10543 28.0181 6.63283C28.0181 8.16023 27.5193 9.42807 26.5217 10.4363C25.5241 11.4446 24.2393 11.9488 22.6673 11.9488H19.1273V7.37527ZM19.1273 3.51351V9.75213H22.6673C23.5837 9.75213 24.3289 9.45934 24.9029 8.87376C25.4769 8.28818 25.7639 7.54121 25.7639 6.63283C25.7639 5.72445 25.4769 4.97748 24.9029 4.3919C24.3289 3.80632 23.5837 3.51351 22.6673 3.51351H19.1273Z" fill="#3C4043"/>
    <path d="M35.102 6.63283C36.419 6.63283 37.5038 7.15939 38.3562 8.21251C39.2086 9.26563 39.6348 10.6416 39.6348 12.3404V16.3268H37.5192V14.7335H37.4225C36.5261 16.035 35.2953 16.6858 33.7301 16.6858C32.4131 16.6858 31.3183 16.2953 30.4457 15.5143C29.5731 14.7333 29.1368 13.7327 29.1368 12.5126C29.1368 11.2131 29.5954 10.188 30.5126 9.43731C31.4298 8.68662 32.703 8.31128 34.3321 8.31128C35.7292 8.31128 36.7919 8.57159 37.5192 9.09221V8.63608C37.5192 7.85508 37.2219 7.22867 36.6273 6.75685C36.0327 6.28503 35.3175 6.04912 34.4817 6.04912C33.2171 6.04912 32.2064 6.57074 31.4496 7.61398L29.6273 6.44425C30.6157 5.04505 32.2361 4.34546 34.4885 4.34546C35.7221 4.34546 36.7733 4.67086 37.6421 5.32166C38.5109 5.97246 38.9453 6.8402 38.9453 7.92487V14.509H35.0239C34.6226 14.509 34.2808 14.4073 33.9984 14.204C33.716 14.0007 33.5748 13.7159 33.5748 13.3496C33.5748 13.0079 33.7123 12.7231 33.9873 12.4952C34.2623 12.2673 34.6561 12.1534 35.1687 12.1534C35.7484 12.1534 36.2351 12.2673 36.6289 12.4952C37.0227 12.7231 37.3196 12.9183 37.5192 13.0809V10.6385C36.9172 10.1503 36.088 9.90619 35.0313 9.90619C33.8795 9.90619 32.9245 10.1706 32.1663 10.6995C31.4081 11.2284 31.029 11.9362 31.029 12.8229C31.029 13.8479 31.4378 14.6533 32.2555 15.2391C33.0732 15.8249 34.0839 16.1178 35.2877 16.1178C36.3281 16.1178 37.2348 15.8737 38.0078 15.3855L35.102 6.63283Z" fill="#3C4043"/>
    <path d="M12.4414 8.5C12.4414 7.91 12.3914 7.35 12.2914 6.81H6.34141V8.92H9.76141C9.61141 9.71 9.17141 10.38 8.50141 10.83V12.19H12.5414C11.7314 11.09 12.4414 9.45 12.4414 8.5Z" fill="#4285F4"/>
    <path d="M6.34141 14.72C8.03141 14.72 9.45141 14.16 10.5414 13.17L8.50141 11.59C7.93141 11.97 7.21141 12.19 6.34141 12.19C4.70141 12.19 3.32141 11.08 2.82141 9.59H0.721406V11.22C1.76141 13.29 3.88141 14.72 6.34141 14.72Z" fill="#34A853"/>
    <path d="M2.82141 9.59C2.69141 9.2 2.62141 8.78 2.62141 8.35C2.62141 7.92 2.69141 7.5 2.82141 7.11V5.48H0.721406C0.261406 6.34 0.00140625 7.32 0.00140625 8.35C0.00140625 9.38 0.261406 10.36 0.721406 11.22L2.82141 9.59Z" fill="#FBBC05"/>
    <path d="M6.34141 4.51C7.26141 4.51 8.08141 4.83 8.73141 5.45L10.5814 3.6C9.45141 2.54 8.03141 1.98 6.34141 1.98C3.88141 1.98 1.76141 3.41 0.721406 5.48L2.82141 7.11C3.32141 5.62 4.70141 4.51 6.34141 4.51Z" fill="#EA4335"/>
  </svg>
);

export default function ClientPaymentPage() {
  const [method, setMethod] = useState('paystack');
  const { items, subtotal, isLoaded } = useCart();

  return (
    <div className="flex flex-col min-h-screen">
      <section className="bg-zinc-50 border-b border-zinc-100 py-8">
        <div className="max-w-7xl mx-auto px-6 w-full">
          <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.3em] text-zinc-400 mb-2">
            <Link href="/" className="hover:text-primary transition-colors">HOME</Link> <ChevronRight className="w-2.5 h-2.5" /> <Link href="/client/cart" className="hover:text-primary transition-colors">CART</Link> <ChevronRight className="w-2.5 h-2.5" /> <span className="text-primary">PAYMENT</span>
          </div>
          <h1 className="text-5xl font-black font-headline uppercase text-zinc-900 tracking-tighter leading-none">
            Checkout <span className="text-primary">Portal.</span>
          </h1>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-6 w-full py-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-16">
          <div className="lg:col-span-8 space-y-12">
            <div className="space-y-6">
              <div className="flex items-center gap-3">
                 <div className="w-8 h-8 rounded-lg bg-zinc-900 flex items-center justify-center text-white">
                    <CreditCard className="w-4 h-4" />
                 </div>
                 <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-400">Choose Method</h3>
              </div>
              
              <RadioGroup value={method} onValueChange={setMethod} disabled className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <PaymentOption 
                  id="paystack" 
                  label="Pay Online" 
                  sub="NOT AVAILABLE YET"
                  icon={CreditCard} 
                  active={method === 'paystack'} 
                />
                <PaymentOption 
                  id="gpay" 
                  label="Google Pay" 
                  sub="NOT AVAILABLE YET"
                  customIcon={<GooglePayIcon />}
                  active={method === 'gpay'} 
                />
                <PaymentOption 
                  id="cod" 
                  label="Pay at Branch" 
                  sub="NOT AVAILABLE YET"
                  icon={Banknote} 
                  active={method === 'cod'} 
                />
              </RadioGroup>
            </div>

            <div className="space-y-8 p-10 bg-zinc-50 rounded-[2rem] border border-zinc-100">
               <div className="flex items-center gap-3">
                  <MapPin className="w-5 h-5 text-primary" />
                  <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-400">Collection Details</h3>
               </div>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-2">
                     <label className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-400 px-1">Pickup Branch</label>
                     <div className="h-14 bg-white rounded-xl flex items-center px-6 font-bold text-xs text-zinc-900 border border-zinc-100 shadow-inner">
                        Nakuru Flagship
                     </div>
                  </div>
                  <div className="space-y-2">
                     <label className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-400 px-1">Estimated Time</label>
                     <div className="h-14 bg-white rounded-xl flex items-center px-6 font-bold text-xs text-zinc-900 border border-zinc-100 shadow-inner">
                        Ready in 15-20 Minutes
                     </div>
                  </div>
               </div>
            </div>
          </div>

          <aside className="lg:col-span-4">
             <div className="bg-white rounded-[2.5rem] p-10 shadow-2xl ring-1 ring-zinc-100 space-y-10 sticky top-32 overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full translate-x-1/2 -translate-y-1/2 blur-2xl" />
                
                <div className="text-center space-y-4 py-8 bg-zinc-50/50 rounded-[2rem] relative overflow-hidden border border-zinc-100/50">
                  <p className="text-[9px] font-black text-zinc-400 uppercase tracking-[0.4em]">Total to Pay</p>
                  <h2 className="text-xl font-black font-headline text-zinc-900 tracking-tight leading-snug">KES {isLoaded ? subtotal.toLocaleString() : "—"}</h2>
                  <p className="text-[8px] font-bold uppercase tracking-widest text-zinc-500">{items.length} item types in your cart</p>
                  <p className="text-[8px] font-bold uppercase tracking-widest text-amber-700">Payment processing is not enabled yet</p>
                </div>

                <div className="space-y-4 relative z-10">
                  <Button
                    disabled
                    className="w-full h-16 bg-zinc-900 text-white font-black uppercase text-[10px] tracking-[0.2em] rounded-xl shadow-xl shadow-zinc-100 group transition-transform active:scale-95"
                  >
                    Checkout Temporarily Unavailable <ArrowRight className="w-4 h-4 ml-3 group-hover:translate-x-1 transition-transform" />
                  </Button>
                  <p className="text-center text-[8px] font-black text-zinc-300 uppercase tracking-[0.3em] flex items-center justify-center gap-2">
                    <ShieldCheck className="w-3.5 h-3.5" /> No payment is processed on this page
                  </p>
                </div>
                
                <div className="pt-6 border-t border-zinc-50 flex items-start gap-4 text-zinc-400 group relative z-10">
                   <Zap className="w-6 h-6 text-primary/40 shrink-0 group-hover:text-primary transition-colors mt-1" />
                   <p className="text-[8px] font-bold uppercase tracking-widest leading-relaxed">By confirming, you agree to our terms of service and collection guidelines.</p>
                </div>
             </div>
          </aside>
        </div>
      </section>
    </div>
  );
}

function PaymentOption({ id, label, sub, icon: Icon, customIcon, active }: any) {
  return (
    <Label 
      htmlFor={id} 
      className={cn(
        "flex items-center justify-between p-6 rounded-3xl border-2 transition-all cursor-pointer group h-full",
        active ? "border-primary bg-primary/5 shadow-lg scale-[1.02]" : "border-zinc-100 bg-white hover:bg-zinc-50 shadow-sm"
      )}
    >
      <div className="flex items-center gap-4">
        <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center transition-all", active ? "text-primary bg-white shadow-md" : "text-zinc-300 bg-zinc-50")}>
          {customIcon ? customIcon : Icon && <Icon className="w-6 h-6" />}
        </div>
        <div>
          <p className="text-sm font-black text-zinc-900 uppercase tracking-tight">{label}</p>
          <p className="text-[8px] font-bold text-zinc-400 uppercase tracking-[0.1em] mt-1">{sub}</p>
        </div>
      </div>
      <RadioGroupItem value={id} id={id} className={cn("border-zinc-200 w-5 h-5", active && "text-primary border-primary")} />
    </Label>
  );
}
