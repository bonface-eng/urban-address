'use client';

import React, { useState, useMemo } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { 
  Banknote, 
  Calculator, 
  CheckCircle2, 
  RefreshCcw, 
  Smartphone, 
  Hash, 
  ShieldCheck, 
  Zap, 
  MapPin 
} from 'lucide-react';
import { PaystackPayment } from './paystack-payment';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { verifyPaystackTransaction } from '@/lib/actions';
import { useTerminal } from '@/hooks/use-terminal';

interface PaymentViewProps {
  total: number;
  onComplete: (method: 'CASH' | 'MOBILE', metadata?: any) => Promise<void>;
  isProcessing: boolean;
  previewData?: any;
}

export function PaymentView({ total, onComplete, isProcessing, previewData }: PaymentViewProps) {
  const { locationName, clientIp } = useTerminal();
  const [cashReceived, setCashReceived] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'CASH' | 'MOBILE_AUTO' | 'MOBILE_MANUAL'>('CASH');
  const [paymentStatus, setPaymentStatus] = useState<'IDLE' | 'FAILED' | 'CANCELLED' | 'VERIFYING'>('IDLE');
  const [manualCode, setManualCode] = useState('');

  const change = useMemo(() => {
    const received = Number(cashReceived);
    const billTotal = Number(total);
    if (!received || isNaN(received) || received < billTotal) return 0;
    return Math.max(0, received - billTotal);
  }, [cashReceived, total]);

  const canFinalizeCash = useMemo(() => {
    const received = parseFloat(cashReceived);
    return !isNaN(received) && received >= total && !isProcessing;
  }, [cashReceived, total, isProcessing]);

  const handleCashFinalize = async () => {
    if (!canFinalizeCash) return;
    const metadata = { cashReceived: parseFloat(cashReceived), change, ipAddress: clientIp };
    await onComplete('CASH', metadata);
  };

  const handleMobileSuccess = async (ref: string) => {
    setPaymentStatus('VERIFYING');
    const verification = await verifyPaystackTransaction(ref);
    
    if (verification.success) {
      await onComplete('MOBILE', { reference: ref, ipAddress: clientIp });
      setPaymentStatus('IDLE');
    } else {
      setPaymentStatus('FAILED');
      toast({ variant: "destructive", title: "Authorization Failed", description: verification.message });
    }
  };

  const handleManualReconcile = async () => {
    if (!manualCode || manualCode.length < 5) {
      toast({ variant: "destructive", title: "Invalid Code" });
      return;
    }
    await onComplete('MOBILE', { reference: manualCode.toUpperCase().trim(), isManual: true, ipAddress: clientIp });
    setManualCode('');
  };

  if (paymentStatus === 'VERIFYING') {
    return (
      <div className="h-full flex flex-col items-center justify-center space-y-4 animate-in fade-in duration-500">
         <RefreshCcw className="w-10 h-10 text-primary animate-spin" />
         <p className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-400">Verifying Node...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-zinc-50 p-6 rounded-[2rem] border border-zinc-100 text-center space-y-1">
         <p className="text-[9px] font-black uppercase tracking-[0.4em] text-primary">Due Total</p>
         <h2 className="text-3xl font-black font-headline tracking-tighter">KES {total.toLocaleString()}</h2>
         <div className="flex items-center justify-center gap-2 mt-2">
            <MapPin className="w-3 h-3 text-zinc-300" />
            <span className="text-[8px] font-black uppercase text-zinc-400 tracking-widest">{locationName}</span>
         </div>
      </div>

      <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)} className="w-full">
        <TabsList className="grid grid-cols-3 h-12 bg-zinc-50 p-1 rounded-xl mb-6">
          <TabsTrigger value="CASH" className="rounded-lg text-[8px] font-black uppercase tracking-widest gap-1.5 transition-all">
            <Banknote className="w-3 h-3" /> Cash
          </TabsTrigger>
          <TabsTrigger value="MOBILE_AUTO" className="rounded-lg text-[8px] font-black uppercase tracking-widest gap-1.5 transition-all">
            <Zap className="w-3 h-3" /> Auto
          </TabsTrigger>
          <TabsTrigger value="MOBILE_MANUAL" className="rounded-lg text-[8px] font-black uppercase tracking-widest gap-1.5 transition-all">
            <Hash className="w-3 h-3" /> Code
          </TabsTrigger>
        </TabsList>

        <TabsContent value="CASH" className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-[9px] font-black uppercase text-zinc-400 px-1">Tendered</Label>
              <Input 
                type="number" 
                value={cashReceived} 
                onChange={e => setCashReceived(e.target.value)} 
                placeholder={total.toString()}
                className="h-16 bg-zinc-50 border-none rounded-2xl text-2xl font-black text-center" 
              />
            </div>

            <div className={cn(
              "p-6 rounded-2xl border flex items-center justify-between transition-all",
              canFinalizeCash ? "bg-white border-zinc-100 shadow-sm" : "bg-zinc-50/50 opacity-60"
            )}>
               <div>
                  <p className="text-[8px] font-black uppercase text-zinc-400">Change</p>
                  <h3 className="text-2xl font-black tracking-tighter">KES {change.toLocaleString()}</h3>
               </div>
               <CheckCircle2 className={cn("w-6 h-6", canFinalizeCash ? "text-green-500" : "text-zinc-200")} />
            </div>
          </div>

          <Button 
            onClick={handleCashFinalize}
            disabled={!canFinalizeCash || isProcessing}
            className="w-full h-16 bg-primary hover:bg-orange-600 text-white font-black uppercase text-[10px] tracking-widest rounded-2xl shadow-xl transition-all active:scale-95"
          >
            {isProcessing ? <RefreshCcw className="w-4 h-4 animate-spin" /> : 'Finalize Sale'}
          </Button>
        </TabsContent>

        <TabsContent value="MOBILE_AUTO" className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <PaystackPayment 
            amount={total} 
            onSuccess={handleMobileSuccess} 
            onClose={() => setPaymentStatus('CANCELLED')}
          />
        </TabsContent>

        <TabsContent value="MOBILE_MANUAL" className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
           <div className="space-y-2">
              <Label className="text-[9px] font-black uppercase text-zinc-400 px-1">M-Pesa Confirmation Code</Label>
              <Input 
                value={manualCode}
                onChange={e => setManualCode(e.target.value.toUpperCase())}
                placeholder="e.g. SAB123XYZ"
                className="h-14 bg-zinc-50 border-none rounded-2xl text-center text-lg font-black tracking-widest"
              />
           </div>
           <Button 
             onClick={handleManualReconcile}
             disabled={manualCode.length < 5 || isProcessing}
             className="w-full h-16 bg-zinc-900 text-white font-black uppercase text-[10px] tracking-widest rounded-2xl shadow-xl active:scale-95"
           >
             {isProcessing ? <RefreshCcw className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4 text-primary" />}
             Authorize Code
           </Button>
        </TabsContent>
      </Tabs>
    </div>
  );
}