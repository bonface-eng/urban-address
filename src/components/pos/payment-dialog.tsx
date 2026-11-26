'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
} from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { 
  Banknote, 
  Receipt, 
  Calculator, 
  CheckCircle2, 
  RefreshCcw, 
  Printer, 
  Smartphone, 
  XCircle,
  Hash,
  Keyboard,
  ShieldCheck,
  Zap,
  MapPin,
  Lock,
  Navigation
} from 'lucide-react';
import { PaystackPayment } from './paystack-payment';
import { cn } from '@/lib/utils';
import { ReceiptPreview } from './receipt-preview';
import { toast } from '@/hooks/use-toast';
import { verifyPaystackTransaction } from '@/lib/actions';
import { useTerminal } from '@/hooks/use-terminal';

interface PaymentDialogProps {
  isOpen: boolean;
  onClose: () => void;
  total: number;
  onComplete: (method: 'CASH' | 'MOBILE', metadata?: any) => Promise<void>;
  isProcessing: boolean;
  isSuccess?: boolean;
  previewData?: any; 
}

export function PaymentDialog({ isOpen, onClose, total, onComplete, isProcessing, isSuccess, previewData }: PaymentDialogProps) {
  const { isLocationAuthorized, locationName, clientIp, refreshLocation } = useTerminal();
  const [cashReceived, setCashReceived] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'CASH' | 'MOBILE_AUTO' | 'MOBILE_MANUAL'>('CASH');
  const [finalOrderData, setFinalOrderData] = useState<any>(null);
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
    // Location lock disabled for clearing bills as requested
    return !isNaN(received) && received >= total && !isProcessing;
  }, [cashReceived, total, isProcessing]);

  const handleCashFinalize = async () => {
    if (!canFinalizeCash) return;
    const metadata = { cashReceived: parseFloat(cashReceived), change, ipAddress: clientIp };
    
    setFinalOrderData({
      ...previewData,
      status: 'PAID',
      total,
      paymentMethod: 'CASH',
      timestamp: Date.now(),
      cashReceived: metadata.cashReceived,
      change: metadata.change,
      ipAddress: clientIp
    });
    
    await onComplete('CASH', metadata);
  };

  const handleMobileSuccess = async (ref: string) => {
    setPaymentStatus('VERIFYING');
    
    const verification = await verifyPaystackTransaction(ref);
    
    if (verification.success) {
      const data = { 
        ...previewData, 
        status: 'PAID', 
        total, 
        paymentMethod: 'MOBILE', 
        paymentRef: ref, 
        timestamp: Date.now(),
        ipAddress: clientIp
      };
      setFinalOrderData(data);
      await onComplete('MOBILE', { reference: ref, ipAddress: clientIp });
      setPaymentStatus('IDLE');
    } else {
      setPaymentStatus('FAILED');
      toast({
        variant: "destructive",
        title: "Authorization Failed",
        description: verification.message
      });
    }
  };

  const handleManualReconcile = async () => {
    if (!manualCode || manualCode.length < 5) {
      toast({ variant: "destructive", title: "Invalid Code" });
      return;
    }

    const code = manualCode.toUpperCase().trim();
    const data = { 
      ...previewData, 
      status: 'PAID', 
      total, 
      paymentMethod: 'MOBILE', 
      paymentRef: code, 
      timestamp: Date.now(),
      ipAddress: clientIp
    };
    
    setFinalOrderData(data);
    await onComplete('MOBILE', { reference: code, isManual: true, ipAddress: clientIp });
    setPaymentStatus('IDLE');
    setManualCode('');
  };

  const handleMobileFailure = (reason: 'CANCELLED' | 'FAILED') => {
    setPaymentStatus(reason);
    toast({
      variant: "destructive",
      title: reason === 'CANCELLED' ? "Payment Abandoned" : "Authorization Failed",
    });
  };

  useEffect(() => {
    if (!isOpen) {
      setCashReceived('');
      setActiveTab('CASH');
      setFinalOrderData(null);
      setPaymentStatus('IDLE');
      setManualCode('');
    }
  }, [isOpen]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && !isProcessing && paymentStatus !== 'VERIFYING' && onClose()}>
      <DialogContent className={cn(
        "rounded-[2.5rem] border-none shadow-2xl p-0 overflow-hidden bg-white transition-all duration-500",
        isSuccess ? "sm:max-w-[420px]" : "sm:max-w-[500px]"
      )}>
        <div className="sr-only">
          <DialogTitle>Terminal Payment Lock</DialogTitle>
          <DialogDescription>Sale finalization portal.</DialogDescription>
        </div>
        
        {isSuccess ? (
          <div className="p-0 animate-in zoom-in-95 duration-500">
             <div className="p-8 border-b border-zinc-50 bg-white flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-black font-headline uppercase tracking-tighter text-zinc-900">Order Finalized</h3>
                  <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mt-1">Transaction Authorized</p>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-zinc-50 flex items-center justify-center text-zinc-300">
                   <CheckCircle2 className="w-6 h-6" />
                </div>
             </div>
             
             <div className="max-h-[60vh] overflow-y-auto p-10 bg-white flex flex-col items-center no-scrollbar">
                <ReceiptPreview 
                  data={finalOrderData || { ...previewData, status: 'PAID', total, timestamp: Date.now(), paymentMethod: 'MOBILE' }} 
                  onClose={onClose}
                  className="w-full"
                />
             </div>
          </div>
        ) : (
          <>
            <div className="p-10 border-b border-zinc-50 bg-white relative">
              <div className="flex flex-col items-center text-center">
                <p className="text-[10px] font-black uppercase tracking-[0.4em] text-primary mb-2">Grand Total</p>
                <h2 className="text-5xl font-black font-headline tracking-tighter text-zinc-900">KES {total.toLocaleString()}</h2>
                <div className="flex items-center gap-2 mt-4">
                  <Badge variant="outline" className={cn(
                    "border-zinc-100 text-[8px] font-black uppercase px-4 py-1 rounded-full gap-2",
                    isLocationAuthorized ? "text-green-600" : "text-amber-500"
                  )}>
                    <MapPin className="w-2.5 h-2.5" /> {locationName}
                  </Badge>
                </div>
              </div>
            </div>

            <div className="p-8 space-y-8">
              {paymentStatus === 'VERIFYING' ? (
                <div className="py-12 flex flex-col items-center justify-center space-y-4 animate-in fade-in duration-500">
                   <RefreshCcw className="w-10 h-10 text-primary animate-spin" />
                   <p className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-400">Verifying with Gateway...</p>
                </div>
              ) : (
                <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)} className="w-full">
                  <TabsList className="grid grid-cols-3 h-14 bg-zinc-50 p-1.5 rounded-2xl mb-10">
                    <TabsTrigger value="CASH" disabled={isProcessing} className="rounded-xl data-[state=active]:bg-white data-[state=active]:shadow-md data-[state=active]:text-primary uppercase font-black text-[8px] tracking-widest gap-2 transition-all">
                      <Banknote className="w-3 h-3" /> Cash
                    </TabsTrigger>
                    <TabsTrigger value="MOBILE_AUTO" disabled={isProcessing} className="rounded-xl data-[state=active]:bg-white data-[state=active]:shadow-md data-[state=active]:text-primary uppercase font-black text-[8px] tracking-widest gap-2 transition-all">
                      <Zap className="w-3 h-3" /> M-Pesa Prompt
                    </TabsTrigger>
                    <TabsTrigger value="MOBILE_MANUAL" disabled={isProcessing} className="rounded-xl data-[state=active]:bg-white data-[state=active]:shadow-md data-[state=active]:text-primary uppercase font-black text-[8px] tracking-widest gap-2 transition-all">
                      <Hash className="w-3 h-3" /> M-Pesa Code
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="CASH" className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <div className="space-y-6">
                      <div className="space-y-3">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 px-1">Cash Tendered</Label>
                        <div className="relative">
                          <div className="absolute left-5 top-1/2 -translate-y-1/2 flex items-center justify-center w-8 h-8 rounded-lg bg-zinc-100 shadow-sm border border-zinc-50">
                            <Calculator className="w-4 h-4 text-zinc-400" />
                          </div>
                          <Input 
                            type="number" 
                            value={cashReceived} 
                            onChange={e => setCashReceived(e.target.value)} 
                            placeholder={total.toString()} 
                            disabled={isProcessing}
                            className="h-20 bg-zinc-50 border-none rounded-[1.5rem] pl-16 text-3xl font-black focus:ring-4 focus:ring-primary/5 text-zinc-900 placeholder:text-zinc-200 shadow-inner"
                          />
                        </div>
                      </div>

                      <div className={cn(
                        "p-8 rounded-[2.5rem] border flex items-center justify-between transition-all",
                        canFinalizeCash ? "bg-white border-zinc-100 shadow-xl ring-1 ring-zinc-50" : "bg-zinc-50/50 border-zinc-100 opacity-60"
                      )}>
                         <div>
                            <p className={cn("text-[10px] font-black uppercase tracking-widest mb-1", canFinalizeCash ? "text-green-600" : "text-zinc-400")}>Change to Return</p>
                            <h3 className={cn("text-4xl font-black tracking-tighter", canFinalizeCash ? "text-green-700" : "text-zinc-400")}>KES {change.toLocaleString()}</h3>
                         </div>
                         <div className={cn(
                           "w-14 h-14 rounded-2xl flex items-center justify-center transition-all",
                           canFinalizeCash ? "bg-green-500 text-white shadow-lg shadow-green-100" : "bg-zinc-100 text-zinc-300"
                         )}>
                            <CheckCircle2 className="w-7 h-7" />
                         </div>
                      </div>
                    </div>

                    <Button 
                      onClick={handleCashFinalize}
                      disabled={!canFinalizeCash}
                      className="w-full h-20 bg-primary hover:bg-orange-600 text-white font-black uppercase text-[12px] tracking-[0.2em] rounded-[1.5rem] shadow-2xl shadow-primary/20 transition-all active:scale-95 gap-3"
                    >
                      {isProcessing ? (
                        <>
                          <RefreshCcw className="w-5 h-5 animate-spin" />
                          Dispatching Thermal...
                        </>
                      ) : (
                        'Finalize & Print Receipt'
                      )}
                    </Button>
                  </TabsContent>

                  <TabsContent value="MOBILE_AUTO" className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <PaystackPayment 
                      amount={total} 
                      onSuccess={handleMobileSuccess} 
                      onClose={() => handleMobileFailure('CANCELLED')}
                    />
                  </TabsContent>

                  <TabsContent value="MOBILE_MANUAL" className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <div className="space-y-6 p-2">
                      <div className="space-y-2">
                         <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 px-1">M-Pesa Transaction Code</Label>
                         <div className="relative">
                            <Hash className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-300" />
                            <Input 
                              value={manualCode}
                              onChange={e => setManualCode(e.target.value.toUpperCase())}
                              placeholder="e.g. SAB123XYZ"
                              className="h-16 bg-zinc-50 border-none rounded-2xl pl-12 text-xl font-black tracking-widest"
                            />
                         </div>
                         <p className="text-[8px] font-bold text-zinc-400 uppercase tracking-widest px-1 leading-relaxed">
                           Enter the 10-character confirmation code received by the customer.
                         </p>
                      </div>

                      <Button 
                        onClick={handleManualReconcile}
                        disabled={manualCode.length < 5 || isProcessing}
                        className="w-full h-16 bg-zinc-900 text-white uppercase font-black text-[10px] tracking-widest shadow-xl gap-2 active:scale-95 transition-all"
                      >
                        {isProcessing ? <RefreshCcw className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4 text-primary" />}
                        Finalize Manual Reconciliation
                      </Button>
                    </div>
                  </TabsContent>
                </Tabs>
              )}

              <div className="flex flex-col items-center gap-2 pt-4 border-t border-zinc-50">
                 <div className="flex items-center gap-2 text-zinc-300">
                    <Printer className="w-3.5 h-3.5" />
                    <span className="text-[9px] font-black uppercase tracking-[0.3em]">IP Footprint: {clientIp}</span>
                 </div>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
