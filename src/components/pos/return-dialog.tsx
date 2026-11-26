
'use client';

import React, { useState } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from '@/components/ui/badge';
import { RefreshCcw, Undo2, Lock, ShieldCheck, AlertCircle } from 'lucide-react';
import { Order } from '@/lib/types';
import { toast } from '@/hooks/use-toast';

const REFUND_REASONS = [
  "Damaged Product",
  "Incorrect Item Delivered",
  "Customer Not Satisfied",
  "Expired Goods",
  "Order Cancellation",
  "System Double-Charge"
];

interface ReturnDialogProps {
  isOpen: boolean;
  onClose: () => void;
  order: Order | null;
  onConfirm: (refundData: { amount: number, reason: string, supervisorPin: string }) => Promise<void>;
}

export function ReturnDialog({ isOpen, onClose, order, onConfirm }: ReturnDialogProps) {
  const [pin, setPin] = useState('');
  const [reason, setReason] = useState('');
  const [refundAmount, setRefundAmount] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);

  React.useEffect(() => {
    if (order) setRefundAmount(order.total.toString());
  }, [order]);

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pin || !reason || !refundAmount) return;

    if (parseFloat(refundAmount) > (order?.total || 0)) {
      toast({ variant: "destructive", title: "Limit Exceeded", description: "Refund cannot exceed original total." });
      return;
    }

    setIsProcessing(true);
    try {
      await onConfirm({
        amount: parseFloat(refundAmount),
        reason,
        supervisorPin: pin
      });
      setPin('');
      setReason('');
      onClose();
    } catch (err) {
      toast({ variant: "destructive", title: "Error", description: "Authorization failed." });
    } finally {
      setIsProcessing(false);
    }
  };

  if (!order) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && !isProcessing && onClose()}>
      <DialogContent className="sm:max-w-[450px] rounded-[2.5rem] border-none shadow-2xl p-0 overflow-hidden bg-white">
        <div className="p-8 bg-zinc-50 border-b border-zinc-100">
           <div className="w-14 h-14 rounded-2xl bg-white shadow-sm flex items-center justify-center text-primary mb-6 mx-auto">
              <Undo2 className="w-7 h-7" />
           </div>
           <DialogHeader className="text-center">
             <DialogTitle className="font-headline uppercase tracking-widest text-lg text-zinc-900">Process Product Return</DialogTitle>
             <DialogDescription className="text-[10px] uppercase font-bold text-zinc-400">
               Reversing transaction for Order #{order.id?.slice(-8).toUpperCase()}
             </DialogDescription>
           </DialogHeader>
        </div>

        <form onSubmit={handleConfirm} className="p-8 space-y-6">
          <div className="p-4 bg-primary/5 rounded-2xl border border-primary/10 flex items-center justify-between">
             <div>
                <p className="text-[9px] font-black text-primary uppercase tracking-widest">Original Value</p>
                <p className="text-lg font-black text-zinc-900 tracking-tighter">KES {order.total.toLocaleString()}</p>
             </div>
             <Badge className="bg-white text-primary border-none shadow-sm uppercase font-black text-[8px] px-3">{order.type}</Badge>
          </div>

          <div className="space-y-4">
             <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 px-1">Refund Amount (KES)</Label>
                <Input 
                  type="number" 
                  value={refundAmount} 
                  onChange={e => setRefundAmount(e.target.value)} 
                  className="h-14 bg-zinc-50 border-none rounded-2xl px-5 text-xl font-black"
                  required 
                />
             </div>

             <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 px-1">Return Reason</Label>
                <Select value={reason} onValueChange={setReason} required>
                  <SelectTrigger className="h-14 bg-zinc-50 border-none rounded-2xl px-5 text-sm font-bold">
                    <SelectValue placeholder="Select Category" />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl">
                    {REFUND_REASONS.map(r => (
                      <SelectItem key={r} value={r} className="text-xs font-bold uppercase">{r}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
             </div>

             <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 px-1">Supervisor PIN</Label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-300" />
                  <Input 
                    type="password" 
                    value={pin} 
                    onChange={e => setPin(e.target.value)} 
                    placeholder="••••" 
                    className="h-14 bg-zinc-50 border-none rounded-2xl pl-12 text-2xl font-black" 
                    required 
                  />
                </div>
             </div>
          </div>

          <DialogFooter>
            <Button 
              type="submit" 
              disabled={isProcessing}
              className="w-full h-16 bg-zinc-900 text-white font-black uppercase text-[10px] tracking-[0.2em] rounded-2xl shadow-xl gap-2"
            >
              {isProcessing ? <RefreshCcw className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4 text-primary" />}
              Confirm Reversal
            </Button>
          </DialogFooter>
          
          <div className="flex items-center justify-center gap-2 text-zinc-300">
             <AlertCircle className="w-3 h-3" />
             <p className="text-[8px] font-bold uppercase tracking-widest">Action will generate forensic audit log</p>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

