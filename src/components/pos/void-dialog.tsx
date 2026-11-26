
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ShieldAlert, Lock, Trash2, CheckCircle2, RefreshCcw } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

const VOID_REASONS = [
  "Incorrect Selection",
  "Price Too High",
  "Duplicate Item",
  "Out of Stock",
  "Customer Changed Mind",
  "System Error",
  "Test Transaction"
];

interface VoidDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason: string, supervisorPin: string) => Promise<void>;
  title?: string;
  description?: string;
}

export function VoidDialog({ isOpen, onClose, onConfirm, title, description }: VoidDialogProps) {
  const [pin, setPin] = useState('');
  const [reason, setReason] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pin || !reason) {
      toast({ variant: "destructive", title: "Missing Data", description: "Reason and PIN are mandatory." });
      return;
    }

    setIsProcessing(true);
    try {
      await onConfirm(reason, pin);
      setPin('');
      setReason('');
      onClose();
    } catch (err) {
      toast({ variant: "destructive", title: "Auth Failed", description: "Invalid Supervisor PIN." });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && !isProcessing && onClose()}>
      <DialogContent className="sm:max-w-[400px] rounded-[2.5rem] border-none shadow-2xl p-0 overflow-hidden bg-white">
        <div className="bg-amber-50 p-8 border-b border-amber-100">
           <div className="w-14 h-14 rounded-2xl bg-white shadow-sm flex items-center justify-center text-amber-500 mb-6 mx-auto">
              <ShieldAlert className="w-7 h-7" />
           </div>
           <DialogHeader className="text-center">
             <DialogTitle className="font-headline uppercase tracking-widest text-lg text-amber-900">{title || 'Authorization Required'}</DialogTitle>
             <DialogDescription className="text-[10px] uppercase font-bold text-amber-700/60 leading-relaxed">
               {description || 'Cart modifications require a verified supervisor reason code and PIN for audit logging.'}
             </DialogDescription>
           </DialogHeader>
        </div>

        <form onSubmit={handleConfirm} className="p-8 space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 px-1">Void Reason</Label>
              <Select value={reason} onValueChange={setReason} required>
                <SelectTrigger className="h-14 bg-zinc-50 border-none rounded-2xl px-5 text-sm font-bold">
                  <SelectValue placeholder="Select Reason" />
                </SelectTrigger>
                <SelectContent className="rounded-2xl">
                  {VOID_REASONS.map(r => (
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
                  maxLength={4}
                  className="h-14 bg-zinc-50 border-none rounded-2xl pl-12 text-2xl font-black tracking-[0.5em]" 
                  required 
                />
              </div>
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button 
              type="submit" 
              disabled={isProcessing || !pin || !reason}
              className="w-full h-14 bg-zinc-900 text-white font-bold uppercase text-[10px] tracking-widest rounded-2xl shadow-xl transition-all active:scale-95 gap-2"
            >
              {isProcessing ? <RefreshCcw className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              Confirm Void
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

