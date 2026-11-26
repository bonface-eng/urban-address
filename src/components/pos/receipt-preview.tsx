'use client';

import React, { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import {
  Printer, FileText, RefreshCcw, Edit2, Maximize2, X,
  Minus, Plus, RotateCcw, Ruler, ZoomIn, ZoomOut
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { HardwareService } from '@/lib/hardware-service';
import { toast } from '@/hooks/use-toast';
import { generateReceiptTxt } from '@/lib/receipt-utils';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useReceiptSettings } from '@/hooks/use-receipt-settings';
import { useRouter } from 'next/navigation';

interface ReceiptPreviewProps {
  data: any;
  onClose?: () => void;
  className?: string;
  onPrint?: () => void;
}

type PaperWidth = 58 | 80;

export function ReceiptPreview({ data, onClose, className, onPrint }: ReceiptPreviewProps) {
  const [isPrinting, setIsPrinting] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [paperWidth, setPaperWidth] = useState<PaperWidth>(80);
  const [zoom, setZoom] = useState(100);
  const { settings } = useReceiptSettings();
  const router = useRouter();

  const isUnpaid = data?.status === 'PENDING' || !data?.status || data?.status === 'DRAFT';
  const orderId = data?.displayId || data?.id || 'UAX-RECEIPT';
  const dateObj = useMemo(() => new Date(data?.timestamp || Date.now()), [data?.timestamp]);

  if (!data) return null;

  const handlePrintRequest = async () => {
    setIsPrinting(true);
    try {
      const result = await HardwareService.printReceipt({ ...data, displayId: orderId }, settings);
      if (result.success) {
        toast({ title: 'Print request sent', description: 'The receipt was sent to the configured printer.' });
        onPrint?.();
      } else {
        toast({ variant: 'destructive', title: 'Print failed', description: result.error || 'The printer could not complete the request.' });
      }
    } catch (error) {
      toast({ variant: 'destructive', title: 'Print failed', description: 'Could not connect to the configured printer.' });
    } finally {
      setIsPrinting(false);
    }
  };

  const handleDownloadTxt = () => {
    const content = generateReceiptTxt(data, settings);
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${orderId}.txt`;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast({ title: 'Receipt downloaded', description: 'A text copy of this receipt has been saved.' });
  };

  const handleEditOrder = () => {
    const targetUnit = data.type?.toLowerCase();
    const routeMap: Record<string, string> = {
      lounge: '/lounge',
      store: '/store',
      carwash: '/carwash/pos',
    };
    router.push(routeMap[targetUnit] || '/dashboard');
    toast({ title: 'Opening station', description: `Loading the ${data.type || 'sales'} workspace.` });
  };

  let brandHeader = settings.storeHeader || 'URBAN ACCESSORIES';
  if (data.type === 'LOUNGE') brandHeader = settings.loungeHeader || 'URBAN ADDRESS';
  else if (data.type === 'CARWASH') brandHeader = settings.carwashHeader || 'URBAN AUTO EXPRESS';

  const money = (value: number) => (Number(value) || 0).toLocaleString('en-KE');
  const receiptWidth = paperWidth === 58 ? '220px' : '300px';
  const isCarwash = data.type === 'CARWASH';
  const isLounge = data.type === 'LOUNGE';
  const receiptKind = isCarwash ? (data.jobType === 'CARPET' ? 'CARPET SERVICE RECEIPT' : 'VEHICLE SERVICE RECEIPT') : isLounge ? 'LOUNGE ORDER RECEIPT' : 'RETAIL SALES RECEIPT';

  const ReceiptContent = () => (
    <div className="space-y-4 py-3 font-mono text-[10px] leading-[1.45] text-zinc-950">
      <div className="border-b border-dashed border-zinc-300 pb-3 text-center">
        <span className={cn(
          'inline-flex rounded-sm border px-2 py-1 text-[9px] font-black tracking-[0.16em]',
          isUnpaid ? 'border-amber-300 bg-amber-50 text-amber-800' : 'border-emerald-300 bg-emerald-50 text-emerald-800'
        )}>
          {isUnpaid ? 'PAYMENT PENDING' : 'PAYMENT RECEIVED'}
        </span>
        <h4 className="mt-3 text-[14px] font-black uppercase leading-tight tracking-tight">{brandHeader}</h4>
        <p className="mt-1 text-[8px] font-black tracking-[0.16em] text-zinc-500">{receiptKind}</p>
        <p className="mt-1 text-[8px] font-bold uppercase tracking-[0.16em] text-zinc-500">{settings.branchName || 'NAKA CENTER BRANCH'}</p>
        <p className="text-[8px] uppercase tracking-wider text-zinc-500">{settings.location || 'NAKURU, KENYA'}</p>
        {settings.phone && <p className="mt-1 text-[8px] text-zinc-600">TEL: {settings.phone}</p>}
        {settings.vatNumber && <p className="text-[8px] text-zinc-600">PIN: {settings.vatNumber}</p>}
      </div>

      <div className="space-y-1.5 border-b border-dashed border-zinc-300 pb-3 text-[9px]">
        <div className="flex justify-between gap-3"><span className="text-zinc-500">RECEIPT NO.</span><strong className="text-right">{orderId}</strong></div>
        <div className="flex justify-between gap-3"><span className="text-zinc-500">DATE</span><strong>{dateObj.toLocaleDateString('en-KE')}</strong></div>
        <div className="flex justify-between gap-3"><span className="text-zinc-500">TIME</span><strong>{dateObj.toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' })}</strong></div>
        {data.cashierName && <div className="flex justify-between gap-3"><span className="text-zinc-500">CASHIER</span><strong className="max-w-[60%] text-right">{data.cashierName}</strong></div>}
        {isCarwash && <div className="flex justify-between gap-3"><span className="text-zinc-500">ATTENDANT</span><strong className="max-w-[60%] text-right">{data.attendantName || 'Unassigned'}</strong></div>}
        {isLounge && data.tableNumber && <div className="flex justify-between gap-3"><span className="text-zinc-500">TABLE</span><strong>{data.tableNumber}</strong></div>}
        {data.customerName && <div className="flex justify-between gap-3"><span className="text-zinc-500">CUSTOMER</span><strong className="max-w-[60%] text-right">{data.customerName}</strong></div>}
        {data.customerPhone && <div className="flex justify-between gap-3"><span className="text-zinc-500">PHONE</span><strong>{data.customerPhone}</strong></div>}
        {isCarwash && data.jobType === 'VEHICLE' && data.plateNumber && <div className="flex justify-between gap-3"><span className="text-zinc-500">REGISTRATION</span><strong>{data.plateNumber}</strong></div>}
        {isCarwash && data.vehicleMake && <div className="flex justify-between gap-3"><span className="text-zinc-500">VEHICLE</span><strong>{[data.vehicleMake, data.vehicleModel].filter(Boolean).join(' ')}</strong></div>}
        {isCarwash && data.vehicleColor && <div className="flex justify-between gap-3"><span className="text-zinc-500">COLOUR</span><strong>{data.vehicleColor}</strong></div>}
        {isCarwash && data.jobType === 'CARPET' && data.carpetDimensions && <div className="flex justify-between gap-3"><span className="text-zinc-500">CARPET SIZE</span><strong>{data.carpetDimensions}</strong></div>}
      </div>

      {(settings.receiptSections || []).filter(section => section.enabled && (section.title || section.content)).sort((a, b) => a.order - b.order).map(section => (
        <div key={section.id} className="border-b border-dashed border-zinc-200 pb-2">
          {section.title && <p className="mb-1 text-[8px] font-black uppercase tracking-wider">{section.title}</p>}
          {section.content && <p className="whitespace-pre-wrap break-words text-[8px] text-zinc-600">{section.content}</p>}
        </div>
      ))}

      <div className="space-y-2">
        <div className="grid grid-cols-[1fr_auto] gap-2 border-b border-zinc-200 pb-1 text-[8px] font-black tracking-wider">
          <span>DESCRIPTION</span><span>AMOUNT (KES)</span>
        </div>
        {(Array.isArray(data.items) ? data.items : []).map((item: any, index: number) => (
          <div key={item.id || item.productId || index} className="grid grid-cols-[1fr_auto] items-start gap-2">
            <div className="min-w-0">
              <p className="break-words font-bold uppercase">{item.name || 'Item'}</p>
              {item.category && <p className="text-[7px] uppercase text-zinc-400">{item.category}</p>}
              {item.notes && <p className="text-[8px] text-zinc-500">{item.notes}</p>}
              <p className="text-[8px] text-zinc-500">{Number(item.quantity) || 1} × {money(item.price)} each</p>
            </div>
            <span className="text-right font-bold">{money((Number(item.price) || 0) * (Number(item.quantity) || 1))}</span>
          </div>
        ))}
        {(!data.items || data.items.length === 0) && (
          <p className="py-2 text-center text-[9px] text-zinc-500">No line items supplied</p>
        )}
      </div>

      <div className="space-y-2 border-y-2 border-zinc-900 py-3">
        {data.subtotal !== undefined && <div className="flex justify-between text-[8px]"><span>SUBTOTAL</span><span>KES {money(data.subtotal)}</span></div>}
        {Number(data.discount) > 0 && <div className="flex justify-between text-[8px]"><span>DISCOUNT</span><span>- KES {money(data.discount)}</span></div>}
        {Number(data.tax) > 0 && <div className="flex justify-between text-[8px]"><span>TAX</span><span>KES {money(data.tax)}</span></div>}
        {Number(data.tip) > 0 && <div className="flex justify-between text-[8px]"><span>TIP</span><span>KES {money(data.tip)}</span></div>}
        <div className="flex items-end justify-between gap-3 border-t border-dashed border-zinc-300 pt-2">
          <span className="text-[9px] font-black tracking-wider">{isUnpaid ? 'TOTAL DUE' : 'AMOUNT PAID'}</span>
          <strong className="text-[15px] font-black">KES {money(data.total)}</strong>
        </div>
        {!isUnpaid && <>
          <div className="flex justify-between gap-2 text-[8px] font-bold text-zinc-600"><span>PAYMENT METHOD</span><span className="text-right text-zinc-900">{data.paymentMethod || 'CASH'}</span></div>
          {data.paymentRef && <div className="flex justify-between gap-2 text-[8px]"><span>PAYMENT REF.</span><strong>{data.paymentRef}</strong></div>}
        </>}
      </div>

      <div className="space-y-1 pt-1 text-center">
        <p className="text-[9px] font-bold uppercase">{settings.footerNote || 'Thank you for your patronage'}</p>
        <p className="text-[7px] font-bold uppercase tracking-[0.18em] text-zinc-400">{settings.footerTagline || 'Urban Express Business OS'}</p>
        <p className="pt-2 text-[7px] text-zinc-400">*** CUSTOMER COPY ***</p>
      </div>
    </div>
  );

  const Canvas = ({ expanded = false }: { expanded?: boolean }) => (
    <div className={cn(
      'receipt-canvas relative flex min-h-[440px] w-full items-start justify-center overflow-auto rounded-xl border border-zinc-200 p-4 sm:min-h-[540px] sm:p-8',
      expanded ? 'bg-zinc-100' : 'bg-[#f4f5f7]'
    )}>
      <div className="pointer-events-none absolute inset-0 opacity-[0.35]" style={{ backgroundImage: 'radial-gradient(#a1a1aa 0.7px, transparent 0.7px)', backgroundSize: '12px 12px' }} />
      <div className="relative flex min-h-full w-full justify-center">
        <div
          className="h-fit shrink-0 border border-zinc-200 bg-white px-4 shadow-[0_12px_40px_rgba(15,23,42,0.12)] sm:px-5"
          style={{ width: receiptWidth, transform: `scale(${zoom / 100})`, transformOrigin: 'top center' }}
        >
          <ReceiptContent />
          <div className="border-t border-dashed border-zinc-300 pb-3 pt-2 text-center text-[7px] font-bold tracking-[0.2em] text-zinc-300">END OF RECEIPT</div>
        </div>
      </div>
      <div className="absolute bottom-3 left-3 rounded-md border border-zinc-200 bg-white/90 px-2 py-1 text-[9px] font-semibold text-zinc-500 shadow-sm">
        {paperWidth} mm · {zoom}% zoom
      </div>
    </div>
  );

  return (
    <div className={cn('flex w-full min-w-0 flex-col gap-3', className)}>
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-zinc-200 bg-white p-3 shadow-sm">
        <div className="flex min-w-0 items-center gap-2">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-zinc-900 text-white"><Ruler className="h-4 w-4" /></div>
          <div className="min-w-0">
            <p className="truncate text-xs font-bold text-zinc-900">Receipt design canvas</p>
            <p className="text-[10px] text-zinc-500">Live thermal paper preview</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => setIsExpanded(true)} className="h-9 gap-2 rounded-lg px-3 text-xs">
          <Maximize2 className="h-3.5 w-3.5" /> Expand canvas
        </Button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-white p-3">
        <div className="flex items-center gap-2">
          <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-400">Paper</span>
          <div className="inline-flex rounded-lg bg-zinc-100 p-1">
            {[58, 80].map((width) => (
              <button key={width} type="button" onClick={() => setPaperWidth(width as PaperWidth)}
                className={cn('h-8 rounded-md px-3 text-[10px] font-bold transition-colors', paperWidth === width ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-900')}>
                {width} mm
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <span className="mr-1 text-[9px] font-bold uppercase tracking-wider text-zinc-400">Zoom</span>
          <Button type="button" variant="ghost" size="icon" aria-label="Zoom out" onClick={() => setZoom(value => Math.max(60, value - 10))} className="h-8 w-8"><ZoomOut className="h-4 w-4" /></Button>
          <span className="w-10 text-center text-xs font-bold tabular-nums">{zoom}%</span>
          <Button type="button" variant="ghost" size="icon" aria-label="Zoom in" onClick={() => setZoom(value => Math.min(130, value + 10))} className="h-8 w-8"><ZoomIn className="h-4 w-4" /></Button>
          <Button type="button" variant="ghost" size="icon" aria-label="Reset zoom" onClick={() => setZoom(100)} className="h-8 w-8"><RotateCcw className="h-3.5 w-3.5" /></Button>
        </div>
      </div>

      <Canvas />

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Button onClick={handlePrintRequest} disabled={isPrinting} className={cn('h-12 rounded-lg text-xs font-bold', isUnpaid ? 'bg-amber-600 text-white hover:bg-amber-700' : 'bg-zinc-900 text-white hover:bg-zinc-800')}>
          {isPrinting ? <RefreshCcw className="mr-2 h-4 w-4 animate-spin" /> : <Printer className="mr-2 h-4 w-4" />}
          {isUnpaid ? 'Print bill quote' : 'Print receipt'}
        </Button>
        <Button onClick={handleDownloadTxt} variant="outline" className="h-12 rounded-lg text-xs font-semibold">
          <FileText className="mr-2 h-4 w-4" /> Export TXT
        </Button>
        <Button onClick={handleEditOrder} variant="outline" className="h-11 rounded-lg text-xs font-semibold sm:col-span-2">
          <Edit2 className="mr-2 h-4 w-4" /> Open station to edit order
        </Button>
      </div>
      {onClose && <Button onClick={onClose} variant="ghost" className="h-10 text-xs text-zinc-500">Close preview</Button>}

      <Dialog open={isExpanded} onOpenChange={setIsExpanded}>
        <DialogContent className="flex max-h-[94dvh] w-[calc(100vw-1rem)] max-w-5xl flex-col gap-3 overflow-y-auto rounded-xl border border-zinc-200 bg-white p-3 sm:p-5">
          <div className="flex items-center justify-between pr-8">
            <div>
              <DialogTitle className="text-base font-bold">Receipt design canvas</DialogTitle>
              <DialogDescription className="text-xs">Adjust paper width and zoom to inspect the thermal layout.</DialogDescription>
            </div>
            <Button variant="outline" size="icon" onClick={() => setIsExpanded(false)} aria-label="Close expanded canvas"><X className="h-4 w-4" /></Button>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-zinc-50 p-2">
            <div className="flex items-center gap-1">
              {[58, 80].map((width) => <Button key={width} type="button" size="sm" variant={paperWidth === width ? 'default' : 'outline'} onClick={() => setPaperWidth(width as PaperWidth)}>{width} mm</Button>)}
            </div>
            <div className="flex items-center gap-1">
              <Button type="button" variant="outline" size="icon" aria-label="Zoom out" onClick={() => setZoom(value => Math.max(60, value - 10))}><Minus className="h-4 w-4" /></Button>
              <span className="w-12 text-center text-xs font-bold">{zoom}%</span>
              <Button type="button" variant="outline" size="icon" aria-label="Zoom in" onClick={() => setZoom(value => Math.min(130, value + 10))}><Plus className="h-4 w-4" /></Button>
              <Button type="button" variant="ghost" size="icon" aria-label="Reset zoom" onClick={() => setZoom(100)}><RotateCcw className="h-4 w-4" /></Button>
            </div>
          </div>
          <Canvas expanded />
          <div className="flex flex-wrap gap-2">
            <Button onClick={handlePrintRequest} disabled={isPrinting} className="flex-1"><Printer className="mr-2 h-4 w-4" />{isPrinting ? 'Sending…' : 'Print'}</Button>
            <Button onClick={handleDownloadTxt} variant="outline" className="flex-1"><FileText className="mr-2 h-4 w-4" />Save TXT</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
