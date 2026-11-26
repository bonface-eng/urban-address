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
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Receipt, FileStack, Printer } from 'lucide-react';
import { Order } from '@/lib/types';
import { cn } from '@/lib/utils';

interface ConsolidateDialogProps {
  isOpen: boolean;
  onClose: () => void;
  orders: Order[];
  onConsolidate: (selectedOrders: Order[]) => void;
}

export function ConsolidateDialog({ isOpen, onClose, orders, onConsolidate }: ConsolidateDialogProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const toggleOrder = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedIds(newSet);
  };

  const toggleAll = () => {
    if (selectedIds.size === orders.length && orders.length > 0) setSelectedIds(new Set());
    else setSelectedIds(new Set(orders.map(o => o.id!)));
  };

  const handleConsolidate = () => {
    const selected = orders.filter(o => selectedIds.has(o.id!));
    onConsolidate(selected);
    setSelectedIds(new Set());
  };

  return (
    <Dialog open={isOpen} onOpenChange={(o) => { if(!o) setSelectedIds(new Set()); onClose(); }}>
      <DialogContent className="sm:max-w-xl rounded-[2.5rem] border-none shadow-2xl p-0 overflow-hidden bg-white">
        <div className="bg-primary/5 p-8 border-b border-primary/10 flex items-center justify-between">
           <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-white shadow-sm flex items-center justify-center text-primary">
                 <FileStack className="w-6 h-6" />
              </div>
              <div>
                 <DialogTitle className="font-headline uppercase tracking-widest text-lg text-zinc-900">Consolidate Bills</DialogTitle>
                 <DialogDescription className="text-[10px] font-bold uppercase text-zinc-400">Combine multiple transactions into one master receipt.</DialogDescription>
              </div>
           </div>
           <Button variant="ghost" onClick={toggleAll} className="text-[10px] font-black uppercase text-primary hover:bg-primary/5">
             {selectedIds.size === orders.length && orders.length > 0 ? 'Deselect All' : 'Select All'}
           </Button>
        </div>

        <div className="p-6">
           <ScrollArea className="h-[350px] pr-4">
              <div className="space-y-3">
                 {orders.map((order) => (
                   <div 
                     key={order.id} 
                     onClick={() => toggleOrder(order.id!)}
                     className={cn(
                       "p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between group",
                       selectedIds.has(order.id!) ? "border-primary bg-primary/5 shadow-md" : "border-zinc-100 hover:bg-zinc-50"
                     )}
                   >
                      <div className="flex items-center gap-4">
                         <Checkbox checked={selectedIds.has(order.id!)} className="rounded-md border-zinc-200 pointer-events-none" />
                         <div>
                            <p className="text-xs font-black uppercase text-zinc-900">Ref #{order.id?.slice(-8).toUpperCase()}</p>
                            <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                               {new Date(order.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {order.items?.length} Items
                            </p>
                         </div>
                      </div>
                      <div className="text-right">
                         <p className="text-sm font-black text-zinc-900">KES {order.total.toLocaleString()}</p>
                         <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest">{order.paymentMethod || 'PAID'}</p>
                      </div>
                   </div>
                 ))}
                 {orders.length === 0 && (
                   <div className="py-20 text-center opacity-30">
                      <Receipt className="w-12 h-12 mx-auto mb-4" />
                      <p className="text-[10px] font-black uppercase tracking-widest">No successful bills found for this shift</p>
                   </div>
                 )}
              </div>
           </ScrollArea>
        </div>

        <DialogFooter className="p-8 pt-0">
           <Button 
            disabled={selectedIds.size === 0}
            onClick={handleConsolidate}
            className="w-full h-16 bg-zinc-900 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl active:scale-95 transition-all gap-3"
           >
              <Printer className="w-4 h-4 text-primary" />
              Consolidate Selected ({selectedIds.size})
           </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}