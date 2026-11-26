'use client';

import React, { useState, useMemo } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Search, 
  Clock, 
  Smartphone, 
  Hash, 
  Check, 
  RefreshCcw,
  Trash2,
  AlertTriangle,
  Printer,
  ShoppingBag,
  FileText
} from 'lucide-react';
import { Order } from '@/lib/types';
import { cn } from '@/lib/utils';
import { useFirestore } from '@/firebase';
import { doc, updateDoc, writeBatch, collection, increment } from 'firebase/firestore';
import { toast } from '@/hooks/use-toast';
import { HardwareService } from '@/lib/hardware-service';
import { generateReceiptTxt } from '@/lib/receipt-utils';

const CANCEL_REASONS = [
  'Customer Walked Away',
  'Duplicate / Test Bill',
  'Customer Changed Mind',
  'Item Out of Stock',
  'Other / Pricing Issue'
];

interface RecallStoreDialogProps {
  isOpen: boolean;
  onClose: () => void;
  orders: Order[];
  onLoadOrder: (order: Order) => void;
  activeCashierId?: string;
  activeCashierName?: string;
}

export function RecallStoreDialog({ 
  isOpen, 
  onClose, 
  orders, 
  onLoadOrder,
  activeCashierId,
  activeCashierName 
}: RecallStoreDialogProps) {
  const firestore = useFirestore();
  const [searchTerm, setSearchTerm] = useState('');
  const [showReconcileForId, setShowReconcileForId] = useState<string | null>(null);
  const [showCancelForId, setShowCancelForId] = useState<string | null>(null);
  const [reconcileCodes, setReconcileCodes] = useState<Record<string, string>>({});
  const [cancelReasons, setCancelReasons] = useState<Record<string, string>>({});
  const [customReasons, setCustomReasons] = useState<Record<string, string>>({});
  const [isProcessing, setIsProcessing] = useState(false);
  const [isMassPrinting, setIsMassPrinting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const filteredOrders = useMemo(() => {
    const safeOrders = orders || [];
    if (!searchTerm) return safeOrders;
    return safeOrders.filter(o => 
      (o.id || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (o.cashierName || '').toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [orders, searchTerm]);

  const handlePrintAllUnpaid = async () => {
    if (filteredOrders.length === 0) return;
    setIsMassPrinting(true);
    toast({ title: "Mass Print Active", description: `Dispatching ${filteredOrders.length} retail quotes...` });
    
    try {
      for (const order of filteredOrders) {
        await HardwareService.printReceipt({ 
          ...order, 
          displayId: order.id, 
          cashierName: activeCashierName || order.cashierName,
          timestamp: Date.now() 
        });
        await new Promise(r => setTimeout(r, 800));
      }
      toast({ title: "Dispatch Complete" });
    } catch (err) {
      toast({ variant: "destructive", title: "Print Queue Error" });
    } finally {
      setIsMassPrinting(false);
    }
  };

  const handleDownloadAllTxt = () => {
    if (filteredOrders.length === 0) return;
    setIsExporting(true);
    
    let combinedContent = "";
    const tripleLine = "#".repeat(42) + "\n";
    
    filteredOrders.forEach((order, index) => {
      combinedContent += generateReceiptTxt({
        ...order,
        displayId: order.id,
        cashierName: activeCashierName || order.cashierName,
        timestamp: order.timestamp || Date.now()
      });
      
      if (index < filteredOrders.length - 1) {
        combinedContent += "\n" + tripleLine + "\n";
      }
    });

    const blob = new Blob([combinedContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Retail_Unpaid_Backlog_${new Date().toISOString().split('T')[0]}.txt`;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    
    setTimeout(() => {
      if (link.parentNode) {
        document.body.removeChild(link);
      }
      URL.revokeObjectURL(url);
    }, 100);
    
    toast({ title: "Batch Export Success", description: `${filteredOrders.length} bills compiled.` });
    setIsExporting(false);
  };

  const handleQuickReconcile = async (order: Order, code: string) => {
    if (!firestore || !activeCashierId || !code) return;
    setIsProcessing(true);
    
    try {
      const items = (order.items || []).map(i => ({ ...i, status: 'COMMITTED' as const }));
      const batch = writeBatch(firestore);
      const orderRef = doc(firestore, 'orders', order.id!);
      
      batch.set(orderRef, {
        ...order,
        status: 'PAID',
        paymentMethod: 'MOBILE',
        paymentRef: code.toUpperCase().trim(),
        cashierId: activeCashierId,
        cashierName: activeCashierName,
        timestamp: Date.now(),
        items
      }, { merge: true });

      for (const item of items) {
        if (item.productId) {
          const productRef = doc(firestore, 'inventory', item.productId);
          batch.update(productRef, { stockLevel: increment(-item.quantity) });
        }
      }

      const heldRef = doc(firestore, 'users', activeCashierId, 'held_bills', order.id!);
      batch.delete(heldRef);

      const auditRef = doc(collection(firestore, 'audit_logs'));
      batch.set(auditRef, {
        action: 'MANUAL_RECONCILE_STORE',
        userId: activeCashierId,
        details: `Manual M-Pesa reconciliation for Held Bill ${order.id}. Code: ${code}.`,
        timestamp: Date.now(),
        severity: 'WARNING'
      });

      await batch.commit();
      
      toast({ title: "Bill Reconciled", description: "Payment recorded successfully." });
      setShowReconcileForId(null);
      setReconcileCodes(prev => ({ ...prev, [order.id!]: '' }));
      onClose();
    } catch (err) {
      toast({ variant: "destructive", title: "Sync Failed" });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCancelBill = async (order: Order) => {
    if (!firestore || !activeCashierId) return;
    const selectedReason = cancelReasons[order.id!] || CANCEL_REASONS[0];
    const finalReason = selectedReason === 'Other / Pricing Issue' ? 
      (customReasons[order.id!] || 'Other').trim() : 
      selectedReason;

    setIsProcessing(true);
    try {
      const batch = writeBatch(firestore);
      const heldRef = doc(firestore, 'users', activeCashierId, 'held_bills', order.id!);
      batch.delete(heldRef);

      const masterOrderRef = doc(firestore, 'orders', order.id!);
      batch.set(masterOrderRef, {
        ...order,
        status: 'CANCELLED',
        voidReason: finalReason,
        cancelledAt: Date.now(),
        cashierId: activeCashierId,
        cashierName: activeCashierName || order.cashierName
      }, { merge: true });

      let restockedCount = 0;
      if (order.items && order.items.length > 0) {
        for (const item of order.items) {
          if (item.productId) {
            const productRef = doc(firestore, 'inventory', item.productId);
            batch.update(productRef, { stockLevel: increment(item.quantity) });
            restockedCount += item.quantity;
          }
        }
      }

      const auditRef = doc(collection(firestore, 'audit_logs'));
      batch.set(auditRef, {
        action: 'CANCEL_HELD_BILL_STORE',
        userId: activeCashierId,
        details: `Cancelled Store held bill ${order.id}. Restocked ${restockedCount} item(s) to inventory. Reason: ${finalReason}. Total: KES ${order.total}`,
        timestamp: Date.now(),
        severity: 'WARNING'
      });

      await batch.commit();
      toast({ title: "Held Bill Cancelled", description: `Restocked ${restockedCount} item(s). Reason: ${finalReason}` });
      setShowCancelForId(null);
    } catch (err) {
      toast({ variant: "destructive", title: "Cancel Failed" });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(o) => { if(!o) onClose(); }}>
      <DialogContent className="sm:max-w-[700px] rounded-[3rem] border-none shadow-2xl p-0 overflow-hidden bg-white max-h-[85vh] flex flex-col">
        <div className="p-8 border-b border-zinc-50 bg-white flex flex-col md:flex-row md:items-center justify-between gap-6 shrink-0">
           <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-zinc-900 flex items-center justify-center text-primary shadow-inner">
                 <ShoppingBag className="w-6 h-6" />
              </div>
              <div>
                <DialogTitle className="font-headline uppercase tracking-widest text-xl text-zinc-900 leading-none">Retail Backlog</DialogTitle>
                <DialogDescription className="text-[10px] font-black uppercase text-zinc-400 tracking-widest mt-1.5">Manage held store transactions</DialogDescription>
              </div>
           </div>

           <div className="flex items-center gap-3">
              <div className="relative w-40">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-300" />
                <Input 
                  placeholder="FILTER ID..." 
                  value={searchTerm} 
                  onChange={e => setSearchTerm(e.target.value)}
                  className="h-10 pl-9 text-[10px] uppercase font-bold border-zinc-100 rounded-xl bg-zinc-50/50"
                />
              </div>
              <div className="flex gap-1.5">
                <Button 
                  onClick={handleDownloadAllTxt}
                  disabled={isExporting || filteredOrders.length === 0}
                  variant="outline"
                  className="h-10 px-4 rounded-xl font-black uppercase text-[9px] tracking-widest gap-2 border-zinc-100 shadow-sm"
                >
                  <FileText className="w-3.5 h-3.5 text-primary" /> Download
                </Button>
                <Button 
                  onClick={handlePrintAllUnpaid}
                  disabled={isMassPrinting || filteredOrders.length === 0}
                  className="h-10 px-5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-black uppercase text-[9px] tracking-widest gap-2 shadow-lg shadow-amber-100 transition-all"
                >
                  {isMassPrinting ? <RefreshCcw className="w-3.5 h-3.5 animate-spin" /> : <Printer className="w-3.5 h-3.5" />}
                  Print All
                </Button>
              </div>
           </div>
        </div>

        <div className="flex-1 overflow-y-auto p-8 space-y-4 no-scrollbar bg-zinc-50/30">
           {filteredOrders.map((order) => (
             <div key={order.id} className="flex flex-col gap-3 p-6 bg-white border border-zinc-100 rounded-[2rem] group transition-all hover:border-primary/20 shadow-sm hover:shadow-xl">
                <div className="flex items-center justify-between">
                   <div className="flex items-center gap-6">
                      <div className="w-14 h-14 rounded-2xl bg-zinc-50 border border-zinc-100 flex items-center justify-center text-zinc-400 group-hover:bg-primary/5 group-hover:text-primary transition-all">
                         <ShoppingBag className="w-6 h-6" />
                      </div>
                      <div>
                         <p className="text-xs font-black uppercase text-zinc-900 mb-1">Ref #{order.id?.slice(-8).toUpperCase()}</p>
                         <h4 className="text-xl font-black text-zinc-900 tracking-tighter leading-none">KES {order.total.toLocaleString()}</h4>
                         <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest mt-2">{order.items?.length} Items • Saved {new Date(order.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                      </div>
                   </div>
                   <div className="flex gap-2 items-center">
                      <Button 
                        variant="outline"
                        onClick={() => {
                          setShowReconcileForId(showReconcileForId === order.id ? null : order.id!);
                          setShowCancelForId(null);
                        }}
                        className={cn(
                          "h-11 px-5 rounded-xl text-[10px] font-black uppercase tracking-widest gap-2 transition-all border-zinc-100 shadow-sm",
                          showReconcileForId === order.id ? "bg-primary text-white border-primary" : "bg-white text-zinc-400 hover:text-primary"
                        )}
                      >
                         <Smartphone className="w-4 h-4" /> Reconcile
                      </Button>
                      <Button 
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setShowCancelForId(showCancelForId === order.id ? null : order.id!);
                          setShowReconcileForId(null);
                        }}
                        className={cn(
                          "h-11 w-11 rounded-xl transition-all",
                          showCancelForId === order.id ? "bg-red-50 text-red-500" : "text-zinc-200 hover:text-red-500 hover:bg-red-50"
                        )}
                        title="Cancel Held Bill"
                      >
                        <Trash2 className="w-5 h-5" />
                      </Button>
                      <Button onClick={() => onLoadOrder(order)} className="h-11 px-8 bg-zinc-900 hover:bg-zinc-800 text-white rounded-xl font-black uppercase text-[10px] tracking-widest shadow-xl active:scale-95 transition-all">Recall Bill</Button>
                   </div>
                </div>

                {showReconcileForId === order.id && (
                  <div className="bg-zinc-50 p-5 rounded-2xl border border-zinc-100 animate-in slide-in-from-top-2 duration-300 shadow-inner">
                     <div className="flex items-center gap-3">
                        <div className="relative flex-1">
                           <Hash className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-300" />
                           <Input 
                             placeholder="M-PESA TRANSACTION CODE..."
                             value={reconcileCodes[order.id!] || ''}
                             onChange={e => setReconcileCodes(prev => ({ ...prev, [order.id!]: e.target.value.toUpperCase() }))}
                             className="h-14 bg-white border-none rounded-xl pl-12 text-lg font-black tracking-widest shadow-sm"
                           />
                        </div>
                        <Button 
                          onClick={() => handleQuickReconcile(order, reconcileCodes[order.id!] || '')}
                          disabled={isProcessing || !reconcileCodes[order.id!]}
                          className="h-14 px-8 bg-green-500 hover:bg-green-600 text-white font-black uppercase text-[11px] tracking-widest rounded-xl shadow-xl gap-2"
                        >
                           {isProcessing ? <RefreshCcw className="w-4 h-4 animate-spin" /> : <Check className="w-5 h-5" />}
                           Sync Payment
                        </Button>
                     </div>
                  </div>
                )}

                {showCancelForId === order.id && (
                  <div className="bg-red-50/60 p-5 rounded-2xl border border-red-100 animate-in slide-in-from-top-2 duration-300 space-y-4">
                     <div className="flex items-center gap-3 text-red-600">
                        <AlertTriangle className="w-5 h-5 shrink-0" />
                        <span className="text-[10px] font-black uppercase tracking-widest">Cancel Transaction & Restock (Mandatory Reason)</span>
                     </div>
                     <Select 
                       value={cancelReasons[order.id!] || CANCEL_REASONS[0]} 
                       onValueChange={r => setCancelReasons(prev => ({ ...prev, [order.id!]: r }))}
                     >
                        <SelectTrigger className="h-12 bg-white border-red-100 rounded-xl font-bold text-xs">
                           <SelectValue placeholder="Select Reason" />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl border-none shadow-2xl">
                           {CANCEL_REASONS.map(r => (
                             <SelectItem key={r} value={r} className="text-xs font-bold uppercase">{r}</SelectItem>
                           ))}
                        </SelectContent>
                     </Select>

                     {(cancelReasons[order.id!] === 'Other / Pricing Issue') && (
                       <Input 
                         placeholder="Specific reason required..."
                         value={customReasons[order.id!] || ''}
                         onChange={e => setCustomReasons(prev => ({ ...prev, [order.id!]: e.target.value }))}
                         className="h-12 bg-white border-red-100 rounded-xl text-xs font-bold"
                       />
                     )}

                     <div className="flex justify-end gap-3 pt-2">
                        <Button 
                          variant="ghost" 
                          onClick={() => setShowCancelForId(null)}
                          className="h-11 px-6 text-[10px] font-black uppercase tracking-widest text-zinc-400"
                        >
                           Abort
                        </Button>
                        <Button 
                          onClick={() => handleCancelBill(order)}
                          disabled={isProcessing}
                          className="h-11 px-6 bg-red-500 hover:bg-red-600 text-white font-black uppercase text-[10px] tracking-widest rounded-xl shadow-xl gap-2 active:scale-95"
                        >
                           {isProcessing ? <RefreshCcw className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                           Confirm Cancel & Restock
                        </Button>
                     </div>
                  </div>
                )}
             </div>
           ))}
           {filteredOrders.length === 0 && (
             <div className="py-32 text-center opacity-30">
                <Clock className="w-16 h-16 mx-auto mb-4" />
                <p className="text-[11px] font-black uppercase tracking-[0.4em]">No held bills found</p>
             </div>
           )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
