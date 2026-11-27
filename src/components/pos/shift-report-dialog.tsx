'use client';

import React, { useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  FileText, 
  FileDown, 
  Printer, 
  CheckCircle2, 
  AlertCircle,
  Download,
  Receipt
} from 'lucide-react';
import { Order } from '@/lib/types';
import { 
  generateShiftReportTxt, 
  downloadTxtFile, 
  printReportDirect 
} from '@/lib/shift-report-utils';
import { HardwareService } from '@/lib/hardware-service';
import { toast } from '@/hooks/use-toast';

interface ShiftReportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  initialType?: 'X' | 'Z';
  cashierName: string;
  cashierId: string;
  periodLabel: string;
  orders: Order[];
  heldBills?: Order[];
  stats?: {
    loungeSales?: number;
    storeSales?: number;
    carwashSales?: number;
    totalSales?: number;
  };
}

export function ShiftReportDialog({
  isOpen,
  onClose,
  initialType = 'X',
  cashierName,
  cashierId,
  periodLabel,
  orders,
  heldBills = [],
  stats
}: ShiftReportDialogProps) {
  const [reportType, setReportType] = React.useState<'X' | 'Z'>(initialType);

  React.useEffect(() => {
    if (initialType) setReportType(initialType);
  }, [initialType]);

  const reportText = useMemo(() => {
    return generateShiftReportTxt({
      type: reportType,
      cashierName,
      cashierId,
      periodLabel,
      orders,
      heldBills,
      stats
    });
  }, [reportType, cashierName, cashierId, periodLabel, orders, heldBills, stats]);

  const paidOrders = useMemo(() => orders.filter(o => o.status === 'PAID'), [orders]);
  const totalVolume = useMemo(() => paidOrders.reduce((s, o) => s + (o.total || 0), 0), [paidOrders]);

  const handleDownloadTxt = () => {
    downloadTxtFile(reportText, 'download.txt');
    toast({
      title: `${reportType}-Report Downloaded`,
      description: "File saved as download.txt"
    });
  };

  const handlePrint = async () => {
    try {
      // Attempt hardware thermal printer if available
      const hwResult = await HardwareService.printReceipt({
        reportType: reportType === 'X' ? 'X-REPORT' : 'Z-REPORT',
        type: 'SYSTEM-REPORT',
        cashierName,
        total: totalVolume,
        timestamp: Date.now(),
        items: paidOrders.map(o => ({
          name: `#${o.id?.slice(0, 8).toUpperCase() || 'SALE'} ${o.type}`,
          quantity: o.items?.length || 1,
          price: o.total || 0
        }))
      });

      if (!hwResult.success) {
        // Fallback to direct iframe receipt print
        printReportDirect(reportText);
      }

      toast({
        title: "Print Dispatched",
        description: `Sending Shift ${reportType}-Report to printer`
      });
    } catch {
      printReportDirect(reportText);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[92vh] flex flex-col p-0 overflow-hidden bg-white border border-zinc-200 shadow-2xl rounded-3xl">
        <DialogHeader className="p-6 pb-4 border-b border-zinc-100 flex flex-row items-center justify-between shrink-0 bg-white">
          <div>
            <div className="flex items-center gap-2">
              <DialogTitle className="text-sm font-black uppercase tracking-[0.2em] text-zinc-900">
                Shift Audit Report
              </DialogTitle>
              <Badge variant="outline" className="text-[8px] font-black uppercase border-zinc-200 text-zinc-700 bg-zinc-50">
                {reportType === 'X' ? 'Mid-Shift Interim' : 'End of Shift Closure'}
              </Badge>
            </div>
            <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest mt-1">
              Cashier: {cashierName} • {periodLabel}
            </p>
          </div>

          <Tabs value={reportType} onValueChange={(v) => setReportType(v as 'X' | 'Z')} className="w-auto">
            <TabsList className="bg-zinc-100 p-1 rounded-xl h-9">
              <TabsTrigger 
                value="X" 
                className="text-[9px] font-black uppercase tracking-widest rounded-lg px-3 data-[state=active]:bg-white data-[state=active]:text-zinc-900 data-[state=active]:shadow-sm"
              >
                X-Report
              </TabsTrigger>
              <TabsTrigger 
                value="Z" 
                className="text-[9px] font-black uppercase tracking-widest rounded-lg px-3 data-[state=active]:bg-white data-[state=active]:text-zinc-900 data-[state=active]:shadow-sm"
              >
                Z-Report
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </DialogHeader>

        {/* Metric summary pills */}
        <div className="px-6 py-3 bg-zinc-50/80 border-b border-zinc-100 flex items-center justify-between gap-2 overflow-x-auto text-[9px] font-bold uppercase tracking-wider shrink-0">
          <div className="flex items-center gap-1.5 text-zinc-700">
            <Receipt className="w-3.5 h-3.5 text-zinc-400" />
            <span>Sales: <strong className="font-black text-zinc-900">KES {totalVolume.toLocaleString()}</strong></span>
          </div>
          <span className="text-zinc-300">•</span>
          <div className="flex items-center gap-1.5 text-zinc-700">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
            <span>Paid: <strong className="font-black text-zinc-900">{paidOrders.length} txns</strong></span>
          </div>
          <span className="text-zinc-300">•</span>
          <div className="flex items-center gap-1.5 text-zinc-700">
            <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
            <span>Held: <strong className="font-black text-zinc-900">{heldBills.length} open</strong></span>
          </div>
        </div>

        {/* Monospace receipt preview area */}
        <div className="flex-1 min-h-0 overflow-y-auto p-6 bg-zinc-50/40">
          <div className="bg-white p-5 rounded-2xl border border-zinc-200/80 shadow-xs max-w-lg mx-auto">
            <pre className="font-mono text-[10px] sm:text-[11px] leading-relaxed text-zinc-800 whitespace-pre font-bold select-all overflow-x-auto">
              {reportText}
            </pre>
          </div>
        </div>

        {/* Actions Footer */}
        <div className="p-4 sm:p-6 bg-white border-t border-zinc-100 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="text-[8px] font-bold text-zinc-400 uppercase tracking-widest text-center sm:text-left">
            Referencing {paidOrders.length} receipt{paidOrders.length === 1 ? '' : 's'} • Output file: download.txt
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Button
              onClick={handlePrint}
              variant="outline"
              size="sm"
              className="flex-1 sm:flex-none h-9 px-4 border-zinc-200 text-zinc-800 hover:bg-zinc-50 text-[9px] font-black uppercase tracking-wider rounded-xl"
            >
              <Printer className="w-3.5 h-3.5 mr-1.5" />
              Print Thermal
            </Button>

            <Button
              onClick={handleDownloadTxt}
              size="sm"
              className="flex-1 sm:flex-none h-9 px-5 bg-zinc-900 hover:bg-zinc-800 text-white text-[9px] font-black uppercase tracking-wider rounded-xl shadow-sm"
            >
              <Download className="w-3.5 h-3.5 mr-1.5" />
              Download download.txt
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
