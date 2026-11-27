'use client';

import React, { useMemo, useState } from 'react';
import { usePaystackPayment } from 'react-paystack';
import { Button } from '@/components/ui/button';
import { CreditCard, CreditCard as CardIcon, CheckCircle2, Loader2, Smartphone } from 'lucide-react';
import { useUser, useDb, useDoc } from '@/lib/data';
import { doc } from '@/lib/db';
import { useCardReader } from '@/hooks/use-card-reader';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface PaystackPaymentProps {
  amount: number;
  onSuccess: (reference: string) => void;
  onClose: () => void;
}

export function PaystackPayment({ amount, onSuccess, onClose }: PaystackPaymentProps) {
  const { user } = useUser();
  const firestore = useDb();
  const [swipedCard, setSwipedCard] = useState<any>(null);
  
  // Gated reference: system/config requires auth. Gate with user to avoid Permission Error for guests.
  const configRef = useMemo(() => {
    if (!firestore || !user) return null;
    return doc(firestore, 'system', 'config');
  }, [firestore, user]);

  const { data: systemConfig } = useDoc<any>(configRef);

  const config = useMemo(() => ({
    reference: `UAX-${Date.now()}-${Math.random().toString(36).substring(7).toUpperCase()}`,
    email: user?.email || "pos@urbanautoexpress.com",
    amount: Math.max(1, Math.round((amount || 0) * 100)), // KES in kobo
    // Priority: 1. Firestore Admin Overrides, 2. Environment Variable
    publicKey: systemConfig?.paystackPublicKeyLive || process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY || '',
    currency: 'KES',
    channels: ['card', 'mobile_money', 'bank', 'ussd'],
    metadata: {
      custom_fields: [
        { display_name: "Operator", variable_name: "operator_email", value: user?.email || 'N/A' },
        { display_name: "Terminal Type", variable_name: "terminal", value: "UAX_OS_NODE" }
      ],
      ...(swipedCard ? { card_details: swipedCard.maskedPan } : {})
    }
  }), [user?.email, amount, swipedCard, systemConfig?.paystackPublicKeyLive]);

  const initializePayment = usePaystackPayment(config);

  useCardReader((data) => {
    if (data.type === 'BANK_CARD') {
      setSwipedCard(data);
      toast({ 
        title: "Bank Card Detected", 
        description: `${data.vendor} - ${data.maskedPan}` 
      });
    }
  });

  const handlePayment = () => {
    if (amount <= 0) {
      toast({ variant: "destructive", title: "Invalid Amount", description: "Sale value must be greater than zero." });
      return;
    }

    if (!config.publicKey) {
      toast({ variant: "destructive", title: "Config Missing", description: "Paystack Public Key is not defined in system nodes." });
      return;
    }

    try {
      (initializePayment as any)(
        (response: any) => {
          if (response && response.reference) {
            onSuccess(response.reference);
          } else {
            console.error('[PAYSTACK] Missing reference in response', response);
            onClose();
          }
        },
        () => {
          onClose();
        }
      );
    } catch (err) {
      console.error('Paystack Initialization Error:', err);
      toast({ variant: "destructive", title: "Gateway Error", description: "Could not establish secure link with Paystack." });
      onClose();
    }
  };

  return (
    <div className="space-y-4">
      {swipedCard ? (
        <div className="p-6 bg-primary/5 rounded-3xl border border-primary/20 flex items-center justify-between animate-in zoom-in-95 duration-300">
           <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-white flex items-center justify-center text-primary shadow-sm">
                 <CardIcon className="w-6 h-6" />
              </div>
              <div>
                 <p className="text-[10px] font-black uppercase text-primary tracking-widest">Card Prepared</p>
                 <p className="text-sm font-black text-zinc-900">{swipedCard.vendor} {swipedCard.maskedPan}</p>
              </div>
           </div>
           <Button variant="ghost" size="sm" onClick={() => setSwipedCard(null)} className="text-[9px] font-black uppercase text-zinc-400">Clear</Button>
        </div>
      ) : (
        <div className="p-8 bg-zinc-50 rounded-[2rem] border border-dashed border-zinc-200 text-center space-y-3">
           <div className="flex flex-col items-center gap-3">
              <div className="w-14 h-14 rounded-2xl bg-white flex items-center justify-center text-zinc-200 shadow-inner">
                 <Smartphone className="w-8 h-8" />
              </div>
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-400">Ready for Mobile Entry</p>
           </div>
           <p className="text-[9px] font-bold text-zinc-400 uppercase leading-relaxed max-w-[200px] mx-auto">Click below to trigger the secure M-Pesa / Card authorization prompt.</p>
        </div>
      )}

      <Button 
        onClick={handlePayment}
        disabled={amount <= 0}
        className={cn(
          "w-full h-16 rounded-2xl font-black uppercase text-[11px] tracking-[0.3em] shadow-xl transition-all active:scale-95 gap-3",
          swipedCard ? "bg-primary text-white shadow-primary/20" : "bg-zinc-900 text-white shadow-zinc-100 hover:bg-zinc-800"
        )}
      >
        <CreditCard className="w-4 h-4 text-primary" /> 
        {swipedCard ? 'Pay with Swiped Card' : 'Authorize Secure Checkout'}
      </Button>
      
      <div className="flex items-center justify-center gap-6 pt-2">
         <div className="flex items-center gap-1.5 text-[8px] font-black text-zinc-300 uppercase tracking-widest">
            <CheckCircle2 className="w-3 h-3 text-green-500" /> PCI SECURE
         </div>
         <div className="w-1 h-1 rounded-full bg-zinc-200" />
         <div className="flex items-center gap-1.5 text-[8px] font-black text-zinc-300 uppercase tracking-widest">
            <CheckCircle2 className="w-3 h-3 text-green-500" /> MPESA READY
         </div>
      </div>
    </div>
  );
}
