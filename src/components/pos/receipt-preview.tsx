'use client';

import React, { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Printer, FileText, RefreshCcw, Edit2, Maximize2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { HardwareService } from '@/lib/hardware-service';
import { toast } from '@/hooks/use-toast';
import { generateReceiptTxt } from '@/lib/receipt-utils';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useReceiptSettings } from '@/hooks/use-receipt-settings';
import { useRouter } from 'next/navigation';
import { ReceiptPrinter, type ReceiptPrinterStage } from '@/components/ui/receipt-printer';

interface ReceiptPreviewProps {
  data: any;
  onClose?: () => void;
  className?: string;
  onPrint?: () => void;
}

export function ReceiptPreview({ data, onClose, className, onPrint }: ReceiptPreviewProps) {
  const [isPrinting, setIsPrinting] = useState(false);
  const [stage, setStage] = useState<ReceiptPrinterStage>("processing");
  const [isExpanded, setIsExpanded] = useState(false);
  const { settings } = useReceiptSettings();
  const router = useRouter();

  useEffect(() => {
    if (data) {
      setStage("processing");
      const processTimer = setTimeout(() => setStage("printing"), 800);
      const printTimer = setTimeout(() => setStage("complete"), 3200);
      return () => {
        clearTimeout(processTimer);
        clearTimeout(printTimer);
      };
    }
  }, [data]);

  if (!data) return null;

  const isUnpaid = data.status === 'PENDING' || !data.status || data.status === 'DRAFT';
  const orderId = data.displayId || data.id || `UAX-${Math.random().toString(36).substring(7).toUpperCase()}`;
  const dateObj = new Date(data.timestamp || Date.now());

  const handlePrintRequest = async () => {
    setIsPrinting(true);
    const result = await HardwareService.printReceipt({ ...data, displayId: orderId }, settings);
    setIsPrinting(false);

    if (result.success) {
      toast({ title: "Thermal Dispatched", description: "Document sent to terminal." });
      onPrint?.();
    } else {
      toast({ variant: "destructive", title: "Print Failed", description: result.error });
    }
  };

  const handleDownloadTxt = () => {
    const content = generateReceiptTxt(data, settings);
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${orderId}.txt`;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    
    if (link.parentNode) {
      document.body.removeChild(link);
    }
    URL.revokeObjectURL(url);
    
    toast({ title: "Document Downloaded", description: "Saved as character-aligned TXT." });
  };

  const handleEditOrder = () => {
    if (typeof window !== 'undefined') {
      const targetUnit = data.type?.toLowerCase();
      const routeMap: Record<string, string> = {
        'lounge': '/lounge',
        'store': '/store',
        'carwash': '/carwash/pos'
      };
      const targetRoute = routeMap[targetUnit] || '/dashboard';
      router.push(targetRoute);
      toast({ title: "Redirecting to Station", description: `Loading order context for ${data.type}...` });
    }
  };

  let brandHeader = settings.storeHeader || 'URBAN ACCESSORIES';
  if (data.type === 'LOUNGE') brandHeader = settings.loungeHeader || 'URBAN ADDRESS';
  else if (data.type === 'CARWASH') brandHeader = settings.carwashHeader || 'URBAN AUTO EXPRESS';

  const ReceiptContent = () => (
    <div className="font-mono text-[10px] leading-tight text-black space-y-4 py-2">
      <div className="text-center py-1 border-b border-zinc-200">
        <p className={cn("text-[11px] font-black uppercase tracking-tighter", isUnpaid ? "text-amber-600" : "text-primary")}>
          {isUnpaid ? "-NOT PAID RECEIPT-" : "-PAID RECEIPT-"}
        </p>
      </div>

      <div className="text-center space-y-0.5">
        <h4 className="font-black text-[12px] uppercase tracking-tight">{brandHeader}</h4>
        <p className="font-bold uppercase tracking-widest opacity-60 text-[8px]">{settings.branchName || 'NAKA CENTER BRANCH'}</p>
        <p className="font-bold uppercase tracking-widest opacity-60 text-[8px]">{settings.location || 'NAKURU, KENYA'}</p>
        <p className="font-bold uppercase tracking-widest opacity-60 text-[8px]">TEL: {settings.phone || '0785860753'}</p>
        {settings.vatNumber && (
          <p className="font-bold uppercase tracking-widest opacity-60 text-[8px]">PIN: {settings.vatNumber}</p>
        )}
      </div>

      <div className="space-y-1 py-1 border-y border-zinc-100 text-[9px]">
        <div className="flex justify-between uppercase">
          <span className="text-zinc-500">REF:</span>
          <span className="font-black">{orderId}</span>
        </div>
        <div className="flex justify-between uppercase">
          <span className="text-zinc-500">DATE:</span>
          <span className="font-black">{dateObj.toLocaleDateString('en-KE')}</span>
        </div>
        <div className="flex justify-between uppercase">
          <span className="text-zinc-500">TIME:</span>
          <span className="font-black">{dateObj.toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' })}</span>
        </div>
        {data.cashierName && (
          <div className="flex justify-between uppercase">
            <span className="text-zinc-500">CASHIER:</span>
            <span className="font-black">{data.cashierName}</span>
          </div>
        )}
        {data.tableNumber && (
          <div className="flex justify-between uppercase">
            <span className="text-zinc-500">TABLE:</span>
            <span className="font-black">{data.tableNumber}</span>
          </div>
        )}
        {data.plateNumber && (
          <div className="flex justify-between uppercase">
            <span className="text-zinc-500">PLATE:</span>
            <span className="font-black">{data.plateNumber}</span>
          </div>
        )}
      </div>

      <div className="space-y-2 pt-1">
        <div className="flex justify-between font-black uppercase text-[8px] text-zinc-900 border-b border-zinc-100 pb-1">
          <span className="w-[60%]">ITEM DESCRIPTION</span>
          <span className="w-[40%] text-right">TOTAL</span>
        </div>
        {data.items?.map((item: any, i: number) => (
          <div key={i} className="flex justify-between items-start gap-2">
            <span className="w-[65%] uppercase text-zinc-800 leading-tight">
              {item.quantity}X {item.name}
            </span>
            <span className="w-[35%] text-right font-black">
              {((item.price || 0) * (item.quantity || 1)).toLocaleString()}
            </span>
          </div>
        ))}
      </div>

      <div className="border-t-2 border-zinc-900 pt-3 space-y-1">
        <div className="flex justify-between items-center text-[11px] font-black">
          <span className="uppercase tracking-widest">TOTAL AMOUNT</span>
          <span>KES {data.total.toLocaleString()}</span>
        </div>
        {!isUnpaid && (
          <div className="flex justify-between items-center text-[9px] font-bold text-zinc-500 uppercase">
            <span>PAID VIA {data.paymentMethod || 'CASH'}</span>
            <span className="font-black text-zinc-900">*** PAID ***</span>
          </div>
        )}
      </div>

      <div className="text-center pt-4 space-y-1 border-t border-zinc-100">
        <p className="text-[8px] font-bold text-zinc-600 uppercase">
          {settings.footerNote || 'Thank you for your patronage'}
        </p>
        <p className="text-[7px] font-black text-zinc-300 uppercase tracking-widest">
          {settings.footerTagline || 'Urban Express Business OS'}
        </p>
      </div>
    </div>
  );

  return (
    <div className={cn("flex flex-col items-center gap-4 w-full h-full", className)}>
      <div className="flex-1 w-full overflow-hidden flex flex-col items-center justify-center">
        <ReceiptPrinter.Root stage={stage} feedMotion="stepped">
          <ReceiptPrinter.Machine className="shadow-2xl">
            <ReceiptPrinter.Header>
              <ReceiptPrinter.Status />
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => setIsExpanded(true)}
                className="h-8 w-8 rounded-lg text-zinc-300 hover:text-primary transition-all"
              >
                <Maximize2 className="w-3.5 h-3.5" />
              </Button>
            </ReceiptPrinter.Header>
            <ReceiptPrinter.Output>
              <ReceiptPrinter.Paper className="shadow-lg">
                 <ReceiptContent />
              </ReceiptPrinter.Paper>
            </ReceiptPrinter.Output>
          </ReceiptPrinter.Machine>
        </ReceiptPrinter.Root>
      </div>

      <div className={cn(
        "flex flex-col gap-2 w-full max-w-[320px] transition-all duration-500 mt-auto pb-4",
        stage === 'complete' ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none"
      )}>
        <Button 
          onClick={handlePrintRequest} 
          disabled={isPrinting}
          className={cn(
            "h-14 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest gap-3 shadow-xl",
            isUnpaid ? "bg-amber-600 hover:bg-amber-700" : "bg-zinc-900 hover:bg-zinc-800"
          )}
        >
          {isPrinting ? <RefreshCcw className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}
          {isUnpaid ? 'Print Bill Quote' : 'Print Receipt'}
        </Button>
        
        <div className="grid grid-cols-2 gap-2">
          <Button 
            onClick={handleDownloadTxt}
            variant="outline"
            className="h-12 border-zinc-100 rounded-xl font-black uppercase text-[9px] tracking-widest gap-2 bg-white"
          >
            <FileText className="w-4 h-4 text-primary" />
            TXT Export
          </Button>
          <Button 
            onClick={handleEditOrder}
            variant="outline"
            className="h-12 border-zinc-100 rounded-xl font-black uppercase text-[9px] tracking-widest gap-2 bg-white"
          >
            <Edit2 className="w-4 h-4 text-amber-500" />
            Edit Order
          </Button>
        </div>

        {onClose && (
           <button onClick={onClose} className="h-10 w-full text-zinc-400 font-bold uppercase text-[8px] tracking-widest hover:text-zinc-900 transition-colors">
              Return to Node Selection
           </button>
        )}
      </div>

      {/* Expanded View Dialog */}
      <Dialog open={isExpanded} onOpenChange={setIsExpanded}>
        <DialogContent className="sm:max-w-md p-0 border-none bg-transparent shadow-none">
          <div className="relative group">
            <button 
              onClick={() => setIsExpanded(false)}
              className="absolute -top-12 right-0 h-10 w-10 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center text-white hover:bg-white/30 transition-all z-[100]"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="bg-white rounded-3xl p-10 shadow-2xl max-h-[90vh] overflow-y-auto no-scrollbar ring-1 ring-zinc-200">
               <ReceiptContent />
               <div className="mt-10 flex gap-2">
                  <Button onClick={handlePrintRequest} className="flex-1 h-14 bg-zinc-900 rounded-xl uppercase font-black text-[10px]">Print Direct</Button>
                  <Button onClick={handleDownloadTxt} variant="outline" className="flex-1 h-14 border-zinc-100 rounded-xl uppercase font-black text-[10px]">Save TXT</Button>
               </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

