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
  Car,
  FileText
} from 'lucide-react';
import { Order } from '@/lib/types';
import { MAKE_LOGOS } from '@/lib/vehicle-data';
import { cn } from '@/lib/utils';
import { useFirestore } from '@/firebase';
import { doc, updateDoc, writeBatch, collection, setDoc } from 'firebase/firestore';
import { toast } from '@/hooks/use-toast';
import { HardwareService } from '@/lib/hardware-service';
import { generateReceiptTxt } from '@/lib/receipt-utils';

const CANCEL_REASONS = [
  'Customer Walked Away',
  'Duplicate / Test Service',
  'Customer Changed Mind',
  'Service Unavailable',
  'Other / Pricing Issue'
];

const COLOR_NAMES: Record<string, string> = {
  '#FFFFFF': 'White',
  '#000000': 'Black',
  '#C0C0C0': 'Silver',
  '#E60000': 'Red',
  '#0000FF': 'Blue',
};

function formatColorLabel(color?: string) {
  if (!color) return null;
  const upper = color.toUpperCase();
  return COLOR_NAMES[upper] || color;
}

/** Vehicle Logo with fallback initial and color dot indicator */
function VehicleCardBadge({ make, color }: { make?: string; color?: string }) {
  const [hasError, setHasError] = useState(false);
  const cleanMake = make ? make.toUpperCase().trim() : '';
  const src = cleanMake && !hasError ? MAKE_LOGOS[cleanMake] : undefined;

  return (
    <div className="relative w-14 h-14 rounded-2xl bg-zinc-50 border border-zinc-200/80 flex items-center justify-center p-2.5 shrink-0 group-hover:bg-primary/5 transition-all">
      {src ? (
        <img
          src={src}
          alt={cleanMake}
          className="w-9 h-9 object-contain"
          onError={() => setHasError(true)}
          loading="lazy"
        />
      ) : (
        <div className="w-8 h-8 rounded-lg bg-zinc-100 flex items-center justify-center text-[11px] font-black text-zinc-500 uppercase">
          {cleanMake ? cleanMake[0] : <Car className="w-5 h-5 text-zinc-400" />}
        </div>
      )}
      {color && (
        <span
          className="w-4 h-4 rounded-full border-2 border-white shadow-sm absolute -bottom-1 -right-1 shrink-0"
          style={{ backgroundColor: color }}
          title={`Vehicle color: ${formatColorLabel(color)}`}
        />
      )}
    </div>
  );
}

interface RecallCarwashDialogProps {
  isOpen: boolean;
  onClose: () => void;
  orders: Order[];
  onLoadOrder: (order: Order) => void;
  activeCashierId?: string;
  activeCashierName?: string;
}

export function RecallCarwashDialog({
  isOpen,
  onClose,
  orders,
  onLoadOrder,
  activeCashierId,
  activeCashierName
}: RecallCarwashDialogProps) {
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
    const term = searchTerm.toLowerCase();
    return safeOrders.filter(o => 
      (o.plateNumber || '').toLowerCase().includes(term) ||
      (o.vehicleMake || '').toLowerCase().includes(term) ||
      (o.vehicleModel || '').toLowerCase().includes(term) ||
      (o.id || '').toLowerCase().includes(term)
    );
  }, [orders, searchTerm]);

  const handlePrintAllUnpaid = async () => {
    if (filteredOrders.length === 0) return;
    setIsMassPrinting(true);
    toast({ title: "Mass Print Active", description: `Dispatching ${filteredOrders.length} service quotes...` });
    
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

    try {
      let aggregatedText = "========================================\n";
      aggregatedText += "       URBAN EXPRESS CARWASH REGISTRY   \n";
      aggregatedText += `       EXPORTED: ${new Date().toLocaleString()} \n`;
      aggregatedText += `       TOTAL OPEN TICKETS: ${filteredOrders.length} \n`;
      aggregatedText += "========================================\n\n";

      filteredOrders.forEach((o, i) => {
        aggregatedText += `[TICKET #${i + 1}] ID: ${o.id || 'N/A'}\n`;
        aggregatedText += `PLATE: ${o.plateNumber || 'WALK-IN'}\n`;
        if (o.vehicleMake) aggregatedText += `VEHICLE: ${o.vehicleMake} ${o.vehicleModel || ''}\n`;
        if (o.vehicleColor) aggregatedText += `COLOR: ${formatColorLabel(o.vehicleColor)}\n`;
        aggregatedText += `BOOKED AT: ${new Date(o.timestamp).toLocaleTimeString()}\n`;
        aggregatedText += `SERVICES:\n`;
        o.items?.forEach(item => {
          aggregatedText += ` - ${item.name} x${item.quantity || 1} @ KES ${item.price}\n`;
        });
        aggregatedText += `TOTAL: KES ${o.total.toLocaleString()}\n`;
        aggregatedText += "----------------------------------------\n\n";
      });

      const blob = new Blob([aggregatedText], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `carwash_held_bills_${new Date().toISOString().slice(0, 10)}.txt`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast({ title: "Export Downloaded", description: "All held bills saved as text report." });
    } catch (err) {
      toast({ variant: "destructive", title: "Export Failed" });
    } finally {
      setIsExporting(false);
    }
  };

  const handleQuickReconcile = async (order: Order, code: string) => {
    if (!firestore || !code || !activeCashierId) return;
    setIsProcessing(true);
    
    try {
      const batch = writeBatch(firestore);
      const masterOrderRef = doc(firestore, 'orders', order.id!);
      
      batch.set(masterOrderRef, {
        ...order,
        status: 'PAID',
        paymentMethod: 'MPESA',
        mpesaCode: code.toUpperCase().trim(),
        paymentDetails: { mpesaCode: code.toUpperCase().trim() },
        paidAt: Date.now(),
        cashierId: activeCashierId,
        cashierName: activeCashierName || order.cashierName
      }, { merge: true });

      const heldRef = doc(firestore, 'users', activeCashierId, 'held_bills', order.id!);
      batch.delete(heldRef);

      const auditRef = doc(collection(firestore, 'audit_logs'));
      batch.set(auditRef, {
        action: 'MANUAL_RECONCILE_CARWASH',
        userId: activeCashierId,
        details: `Manual M-Pesa reconciliation for Carwash Order ${order.id}. Code: ${code}.`,
        timestamp: Date.now(),
        severity: 'WARNING'
      });

      await batch.commit();
      
      toast({ title: "Tab Reconciled", description: "Payment recorded successfully." });
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

      const auditRef = doc(collection(firestore, 'audit_logs'));
      batch.set(auditRef, {
        action: 'CANCEL_HELD_BILL_CARWASH',
        userId: activeCashierId,
        details: `Cancelled Carwash held bill ${order.id}. Plate: ${order.plateNumber || 'WALK-IN'}. Reason: ${finalReason}. Total: KES ${order.total}`,
        timestamp: Date.now(),
        severity: 'WARNING'
      });

      await batch.commit();
      toast({ title: "Bill Cancelled", description: `Reason: ${finalReason}` });
      setShowCancelForId(null);
    } catch (err) {
      toast({ variant: "destructive", title: "Cancel Failed" });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent 
        hideCloseButton={true}
        overlayClassName="bg-zinc-700/30 backdrop-blur-sm"
        className="sm:max-w-[760px] w-[95vw] rounded-3xl border border-zinc-200 shadow-2xl p-0 overflow-hidden bg-white h-[85vh] max-h-[85vh] flex flex-col"
      >
        {/* Header matching Version Update modal aesthetic */}
        <div className="p-6 sm:p-8 border-b border-zinc-100 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-primary mb-1">
              Carwash Service Registry
            </p>
            <DialogHeader className="text-left p-0 space-y-0">
              <DialogTitle className="text-xl sm:text-2xl font-bold text-zinc-800 leading-tight">
                Open Booking Tickets
              </DialogTitle>
              <DialogDescription className="text-xs text-zinc-500 mt-1">
                Review, reconcile, or recall parked vehicle orders ({filteredOrders.length} active)
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
            <Button 
              onClick={handleDownloadAllTxt}
              disabled={isExporting || filteredOrders.length === 0}
              variant="outline"
              size="sm"
              className="h-9 px-3.5 rounded-xl text-xs font-medium gap-1.5 border-zinc-200 text-zinc-700 hover:text-zinc-900 bg-white"
            >
              <FileText className="w-3.5 h-3.5 text-primary" /> Download
            </Button>
            <Button 
              onClick={handlePrintAllUnpaid}
              disabled={isMassPrinting || filteredOrders.length === 0}
              size="sm"
              className="h-9 px-4 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-semibold gap-1.5 shadow-sm transition-all"
            >
              {isMassPrinting ? <RefreshCcw className="w-3.5 h-3.5 animate-spin" /> : <Printer className="w-3.5 h-3.5" />}
              Print all
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              className="bg-white border-zinc-200 text-zinc-600 hover:text-zinc-800 hover:bg-white text-xs font-medium h-9 px-4 rounded-xl"
            >
              Close
            </Button>
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div className="px-6 sm:px-8 py-3 bg-white border-b border-zinc-100 flex items-center justify-between gap-3 shrink-0">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <Input 
              placeholder="Filter by plate, brand, or model..." 
              value={searchTerm} 
              onChange={e => setSearchTerm(e.target.value)}
              className="h-10 pl-10 text-xs font-medium border-zinc-200 rounded-xl bg-white"
            />
          </div>
          <span className="text-xs font-medium text-zinc-400 shrink-0">
            {filteredOrders.length} {filteredOrders.length === 1 ? 'ticket' : 'tickets'}
          </span>
        </div>

        {/* Scrollable Vehicle Tickets Section */}
        <div className="flex-1 min-h-0 overflow-y-auto p-6 sm:p-8 pb-16 space-y-3.5 bg-white overscroll-contain">
          {filteredOrders.map((order) => (
              <div 
                key={order.id} 
                className="flex flex-col gap-3 p-5 bg-white border border-zinc-200 rounded-2xl group transition-all hover:border-primary/40 hover:shadow-md"
              >
                <div className="flex items-center justify-between gap-4 flex-wrap sm:flex-nowrap">
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <VehicleCardBadge make={order.vehicleMake} color={order.vehicleColor} />

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="font-mono font-black text-sm uppercase text-zinc-900 tracking-wider">
                          {order.plateNumber || 'WALK-IN'}
                        </span>
                        {order.vehicleColor && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-zinc-100 border border-zinc-200 text-[10px] font-bold text-zinc-700">
                            <span 
                              className="w-2.5 h-2.5 rounded-full border border-zinc-300 shadow-xs shrink-0" 
                              style={{ backgroundColor: order.vehicleColor }} 
                            />
                            <span>{formatColorLabel(order.vehicleColor)}</span>
                          </span>
                        )}
                      </div>

                      <h4 className="text-lg font-black text-zinc-800 tracking-tight leading-none mt-1">
                        KES {order.total.toLocaleString()}
                      </h4>

                      {order.vehicleMake && (
                        <p className="text-[10px] font-bold text-primary uppercase tracking-wider mt-1 truncate">
                          {order.vehicleMake}{order.vehicleModel ? ' · ' + order.vehicleModel : ''}
                        </p>
                      )}

                      <p className="text-[10px] text-zinc-500 mt-1 truncate">
                        {order.items?.[0]?.name || 'Carwash Service'} • Booked {new Date(order.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-2 items-center self-end sm:self-center shrink-0">
                    <Button 
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setShowReconcileForId(showReconcileForId === order.id ? null : order.id!);
                        setShowCancelForId(null);
                      }}
                      className={cn(
                        "h-10 px-4 rounded-xl text-xs font-semibold gap-1.5 transition-all border-zinc-200 bg-white shadow-xs",
                        showReconcileForId === order.id ? "bg-primary text-white border-primary" : "text-zinc-700 hover:text-primary hover:border-primary/40"
                      )}
                    >
                      <Smartphone className="w-3.5 h-3.5" /> Reconcile
                    </Button>
                    <Button 
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setShowCancelForId(showCancelForId === order.id ? null : order.id!);
                        setShowReconcileForId(null);
                      }}
                      className={cn(
                        "h-10 w-10 rounded-xl transition-all",
                        showCancelForId === order.id ? "bg-red-50 text-red-500" : "text-zinc-300 hover:text-red-500 hover:bg-red-50"
                      )}
                      title="Cancel Job"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                    <Button 
                      onClick={() => onLoadOrder(order)} 
                      className="h-10 px-6 bg-primary hover:bg-primary/90 text-white rounded-xl font-bold uppercase text-xs tracking-wider shadow-sm active:scale-95 transition-all"
                    >
                      Recall
                    </Button>
                  </div>
                </div>

                {/* Inline M-Pesa Reconciliation Box */}
                {showReconcileForId === order.id && (
                  <div className="bg-zinc-50/80 p-4 rounded-xl border border-zinc-200 animate-in slide-in-from-top-2 duration-300 mt-2">
                    <div className="flex items-center gap-3">
                      <div className="relative flex-1">
                        <Hash className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                        <Input 
                          placeholder="ENTER M-PESA CODE..."
                          value={reconcileCodes[order.id!] || ''}
                          onChange={e => setReconcileCodes(prev => ({ ...prev, [order.id!]: e.target.value.toUpperCase() }))}
                          className="h-11 bg-white border border-zinc-200 rounded-xl pl-10 text-sm font-bold tracking-wider"
                        />
                      </div>
                      <Button 
                        onClick={() => handleQuickReconcile(order, reconcileCodes[order.id!] || '')}
                        disabled={isProcessing || !reconcileCodes[order.id!]}
                        className="h-11 px-6 bg-emerald-600 hover:bg-emerald-700 text-white font-bold uppercase text-xs tracking-wider rounded-xl shadow-sm gap-1.5 active:scale-95 transition-all"
                      >
                        {isProcessing ? <RefreshCcw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-4 h-4" />}
                        Reconcile
                      </Button>
                    </div>
                  </div>
                )}

                {/* Inline Cancellation Reason Box */}
                {showCancelForId === order.id && (
                  <div className="bg-red-50/40 p-4 rounded-xl border border-red-100 animate-in slide-in-from-top-2 duration-300 space-y-3 mt-2">
                    <div className="flex items-center gap-2 text-red-600">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      <span className="text-[11px] font-bold uppercase tracking-wider">Cancel Service Record (Mandatory Reason)</span>
                    </div>
                    <Select 
                      value={cancelReasons[order.id!] || CANCEL_REASONS[0]} 
                      onValueChange={r => setCancelReasons(prev => ({ ...prev, [order.id!]: r }))}
                    >
                      <SelectTrigger className="h-10 bg-white border-red-100 rounded-xl font-medium text-xs">
                        <SelectValue placeholder="Select Reason" />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl border border-zinc-200 shadow-xl bg-white">
                        {CANCEL_REASONS.map(r => (
                          <SelectItem key={r} value={r} className="text-xs font-medium uppercase">{r}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {(cancelReasons[order.id!] === 'Other / Pricing Issue') && (
                      <Input 
                        placeholder="Specify reason..."
                        value={customReasons[order.id!] || ''}
                        onChange={e => setCustomReasons(prev => ({ ...prev, [order.id!]: e.target.value }))}
                        className="h-10 bg-white border-red-100 rounded-xl text-xs font-medium"
                      />
                    )}

                    <div className="flex justify-end gap-2 pt-1">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => setShowCancelForId(null)}
                        className="h-9 px-4 text-xs font-medium text-zinc-500 rounded-xl border-zinc-200 bg-white hover:bg-zinc-50"
                      >
                        Abort
                      </Button>
                      <Button 
                        size="sm"
                        onClick={() => handleCancelBill(order)}
                        disabled={isProcessing}
                        className="h-9 px-5 bg-red-600 hover:bg-red-700 text-white font-semibold uppercase text-xs tracking-wider rounded-xl shadow-sm gap-1.5 active:scale-95 transition-all"
                      >
                        {isProcessing ? <RefreshCcw className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                        Confirm cancel
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {filteredOrders.length === 0 && (
              <div className="py-24 text-center">
                <Clock className="w-12 h-12 mx-auto mb-3 text-zinc-300 stroke-1" />
                <p className="text-xs font-semibold text-zinc-600 uppercase tracking-widest">
                  No active held tickets
                </p>
                <p className="text-xs text-zinc-400 mt-1">
                  The service queue is completely clear.
                </p>
              </div>
            )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
