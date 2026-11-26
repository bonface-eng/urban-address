'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { CheckCircle2, Home, Receipt, Share2, ArrowRight, Calendar, MapPin, CreditCard, ClipboardCheck, FileDown, FileText, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from '@/hooks/use-toast';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ReceiptPreview } from '@/components/pos/receipt-preview';
import { useUser, useFirestore } from '@/firebase';
import { doc, getDoc } from 'firebase/firestore';

export default function ClientSuccessPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [orderData, setOrderData] = useState<any>(null);
  const [orderLoading, setOrderLoading] = useState(true);
  const { user, loading: authLoading } = useUser();
  const firestore = useFirestore();
  const orderId = searchParams.get('orderId');

  useEffect(() => {
    let cancelled = false;
    async function loadOrder() {
      if (authLoading) return;
      if (!user || !firestore || !orderId) {
        if (!cancelled) { setOrderData(null); setOrderLoading(false); }
        return;
      }
      setOrderLoading(true);
      try {
        const snapshot = await getDoc(doc(firestore, 'orders', orderId));
        if (!snapshot.exists() || snapshot.data().customerId !== user.uid) {
          if (!cancelled) setOrderData(null);
          return;
        }
        if (!cancelled) setOrderData({ id: snapshot.id, ...snapshot.data() });
      } catch (error) {
        console.error('[CLIENT_ORDER_LOOKUP_FAILED]', error);
        if (!cancelled) setOrderData(null);
      } finally {
        if (!cancelled) setOrderLoading(false);
      }
    }
    loadOrder();
    return () => { cancelled = true; };
  }, [authLoading, user?.uid, firestore, orderId]);

  const handleShare = async () => {
    const reference = orderData?.id ? `UAX-${String(orderData.id).slice(-8).toUpperCase()}` : null;
    if (!reference) {
      toast({ variant: "destructive", title: "Order Reference Missing", description: "Open this page from a saved booking to share its reference." });
      return;
    }
    const shareText = `Urban Auto Express order ${reference}. Status: awaiting verification. This is not a payment confirmation.`;
    try {
      if (navigator.share) {
        await navigator.share({ title: "Urban Auto Express order", text: shareText });
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareText);
        toast({ title: "Order Reference Copied" });
      } else {
        toast({ variant: "destructive", title: "Sharing Unavailable", description: "Your browser does not support sharing or clipboard access." });
      }
    } catch (error: any) {
      if (error?.name !== 'AbortError') {
        toast({ variant: "destructive", title: "Unable to Share", description: "Please try again." });
      }
    }
  };

  const orderIdLabel = orderData?.id ? `UAX-${orderData.id.slice(-8).toUpperCase()}` : 'UA-REF-PENDING';

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 md:p-24 bg-white text-center">
      <div className="max-w-3xl w-full space-y-2 animate-in fade-in slide-in-from-bottom-8 duration-1000 no-print">
        
        {/* Success Icon - Clean & Floating */}
        <div className="text-green-500 flex justify-center py-0">
          <CheckCircle2 className="w-14 h-14 md:w-16 md:h-16" strokeWidth={2.5} />
        </div>

        {/* Header Section */}
        <div className="space-y-0.5">
           <h1 className="text-4xl md:text-5xl lg:text-6xl font-black font-headline text-zinc-900 uppercase tracking-tighter leading-[0.8]">
             Order <span className="text-primary">Status.</span>
           </h1>
           <p className="text-[9px] md:text-[10px] text-zinc-400 font-bold uppercase tracking-[0.3em] leading-relaxed max-w-md mx-auto mt-4">
             {orderLoading ? 'Loading your saved order…' : orderData ? 'This page does not confirm payment. Your order must be verified by our server before it is considered confirmed.' : 'No accessible order was found. Open this page from your booking confirmation link.'}
           </p>
        </div>

        {/* Detailed Booking Summary Card */}
        <Card className="border-none shadow-mobile rounded-xl bg-zinc-50 overflow-hidden text-left border border-zinc-100 mt-6">
          <CardContent className="p-8 md:p-10 space-y-8">
            <div className="flex items-center justify-between border-b border-zinc-200 pb-6">
               <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center text-primary shadow-sm">
                     <ClipboardCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase text-zinc-400 tracking-widest">Booking Identity</p>
                    <p className="text-sm font-black text-zinc-900 uppercase">Ref #{orderIdLabel}</p>
                  </div>
               </div>
               <Badge className="bg-zinc-900 text-white font-black uppercase text-[8px] tracking-widest px-4 py-1">Awaiting Verification</Badge>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
               <SummaryDetail 
                 icon={Calendar} 
                 label="Scheduled Slot" 
                 value={orderData?.scheduledTime ? `${orderData.scheduledDate}, ${orderData.scheduledTime}` : "Fulfillment Active"} 
               />
               <SummaryDetail 
                 icon={MapPin} 
                 label="Service Node" 
                 value="Nakuru Flagship Branch" 
               />
               <SummaryDetail 
                 icon={CreditCard} 
                 label="Order Total" 
                 value={orderData?.total != null ? `KES ${Number(orderData.total).toLocaleString()}` : "Not available"} 
                 accent 
               />
               <SummaryDetail 
                 icon={Share2} 
                 label="Payment Method" 
                 value={orderData?.paymentMethod || "Not verified"} 
               />
            </div>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full pt-4">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="outline" 
                className="h-16 border-zinc-200 rounded-2xl font-black uppercase text-[10px] tracking-[0.2em] gap-4 hover:bg-zinc-50 shadow-sm group"
              >
                <FileDown className="w-4 h-4 text-primary group-hover:scale-110 transition-transform" /> 
                Download Receipt <ChevronDown className="w-3 h-3 opacity-30" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-[300px] rounded-2xl border-none shadow-2xl p-4 space-y-6">
                <ReceiptPreview data={orderData} className="w-full" />
            </DropdownMenuContent>
          </DropdownMenu>

          <Button 
            onClick={() => router.push('/')}
            className="h-16 bg-zinc-900 text-white font-black uppercase text-[10px] tracking-[0.2em] rounded-2xl shadow-xl shadow-zinc-200 gap-4 group"
          >
            <Home className="w-4 h-4 text-primary" /> Back to Home <ArrowRight className="w-4 h-4 text-primary group-hover:translate-x-1 transition-transform" />
          </Button>
        </div>

        <div className="pt-8 flex items-center justify-center gap-8">
           <button onClick={handleShare} type="button" className="text-[9px] font-black uppercase tracking-[0.4em] text-zinc-300 hover:text-primary transition-colors flex items-center gap-2">
              <Share2 className="w-3 h-3" /> Share Order
           </button>
           <div className="w-1.5 h-1.5 rounded-full bg-zinc-200" />
           <p className="text-[9px] font-black text-zinc-300 uppercase tracking-[0.4em]">Driven by Precision</p>
        </div>
      </div>
    </div>
  );
}

function SummaryDetail({ icon: Icon, label, value, accent }: { icon: any, label: string, value: string, accent?: boolean }) {
  return (
    <div className="flex items-start gap-4">
       <Icon className="w-4 h-4 text-zinc-300 mt-1 shrink-0" />
       <div className="space-y-1">
          <p className="text-[9px] font-black uppercase text-zinc-400 tracking-widest">{label}</p>
          <p className={`text-xs font-bold uppercase leading-tight ${accent ? 'text-primary' : 'text-zinc-900'}`}>{value}</p>
       </div>
    </div>
  );
}