
'use client';

import { PageHeader } from '@/components/shared/page-layout';

import React, { useState, useMemo } from 'react';
import { 
  FileText, 
  Printer, 
  Search, 
  LayoutList, 
  Coffee, 
  ShoppingBag, 
  Car, 
  BarChart3, 
  ChevronRight,
  AlertTriangle,
  History,
  RefreshCcw,
  FileDown,
  FileSpreadsheet,
  Settings2
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useDb, useCollection, useMemoSupabase } from '@/lib/data';
import { collection, query, orderBy } from '@/lib/db';
import { Product, BusinessUnit } from '@/lib/types';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { ReceiptPreview } from '@/components/pos/receipt-preview';
import { exportInventoryAuditExcel } from '@/lib/excel-export';
import { exportInventoryAuditPDF } from '@/lib/pdf-export';
import { ReceiptSettingsDialog } from '@/components/admin/receipt-settings-dialog';

const TEMPLATE_PREVIEWS = [
  { id: 'LOUNGE_BILL', label: 'Lounge Active Tab', icon: Coffee, unit: 'LOUNGE', status: 'PENDING' },
  { id: 'STORE_RECEIPT', label: 'Store Sales Receipt', icon: ShoppingBag, unit: 'STORE', status: 'PAID' },
  { id: 'CARWASH_QUOTE', label: 'Carwash Service Quote', icon: Car, unit: 'CARWASH', status: 'PENDING' },
  { id: 'Z_REPORT', label: 'Z-Report (Daily Close)', icon: BarChart3, type: 'SYSTEM-REPORT', reportType: 'Z-REPORT' },
  { id: 'LOW_STOCK', label: 'Procurement List', icon: AlertTriangle, type: 'SYSTEM-REPORT', reportType: 'LOW-STOCK-REPORT' },
];

export default function DocumentsPage() {
  const firestore = useDb();
  const [searchTerm, setSearchTerm] = useState('');
  const [activeUnit, setActiveUnit] = useState<BusinessUnit>('STORE');
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);
  const [isExportingExcel, setIsExportingExcel] = useState(false);
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const [isReceiptSettingsOpen, setIsReceiptSettingsOpen] = useState(false);

  const inventoryQuery = useMemoSupabase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'inventory'), orderBy('name', 'asc'));
  }, [firestore]);

  const { data: inventory } = useCollection<Product>(inventoryQuery);

  const filteredInventory = useMemo(() => {
    if (!inventory) return [];
    return inventory.filter(item => {
      const matchesUnit = item.unit === activeUnit;
      const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          item.category.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesUnit && matchesSearch;
    });
  }, [inventory, searchTerm, activeUnit]);

  const handleDownloadExcel = async () => {
    if (filteredInventory.length === 0) {
      toast({ variant: "destructive", title: "No Items", description: "There are no inventory items to export." });
      return;
    }

    setIsExportingExcel(true);
    toast({ title: "Generating Excel", description: "Creating branded Excel audit sheet..." });

    try {
      await exportInventoryAuditExcel({ inventory: filteredInventory, unit: activeUnit });
      toast({ title: "Excel Download Complete", description: "Your branded spreadsheet has been saved." });
    } catch (err) {
      console.error('[EXCEL_GEN_ERROR]', err);
      toast({ variant: "destructive", title: "Export Failed", description: "Could not generate Excel file." });
    } finally {
      setIsExportingExcel(false);
    }
  };

  const handleDownloadPDF = async () => {
    if (filteredInventory.length === 0) {
      toast({ variant: "destructive", title: "No Items", description: "There are no inventory items to export." });
      return;
    }

    setIsExportingPDF(true);
    toast({ title: "Generating Document", description: "Preparing clean vector audit PDF..." });

    try {
      exportInventoryAuditPDF({ inventory: filteredInventory, unit: activeUnit });
      toast({ title: "PDF Download Complete", description: "Your high-resolution PDF has been generated." });
    } catch (err) {
      console.error('[PDF_GEN_ERROR]', err);
      toast({ variant: "destructive", title: "Export Failed", description: "An error occurred during PDF generation." });
    } finally {
      setIsExportingPDF(false);
    }
  };

  const loadTemplatePreview = (template: any) => {
    const mockOrder = {
      type: template.unit || 'STORE',
      status: template.status || 'PAID',
      reportType: template.reportType,
      id: `UAX-TMPL-${Math.random().toString(36).substring(7).toUpperCase()}`,
      total: 4500,
      timestamp: Date.now(),
      cashierName: 'Admin Auditor',
      customerName: 'Sample Customer',
      customerPhone: '+254 700 000 000',
      attendantName: template.unit === 'CARWASH' ? 'James Mwangi' : undefined,
      attendantId: template.unit === 'CARWASH' ? 'sample-attendant' : undefined,
      tableNumber: template.unit === 'LOUNGE' ? 'T12' : null,
      plateNumber: template.unit === 'CARWASH' ? 'KDA 123X' : null,
      vehicleMake: template.unit === 'CARWASH' ? 'Toyota' : undefined,
      vehicleModel: template.unit === 'CARWASH' ? 'Axio' : undefined,
      vehicleColor: template.unit === 'CARWASH' ? 'Silver' : undefined,
      jobType: 'VEHICLE',
      subtotal: 4500,
      discount: 250,
      tax: 0,
      items: [
        { name: 'Sample Item 01', quantity: 2, price: 1500, productId: '1' },
        { name: 'Sample Item 02', quantity: 1, price: 1500, productId: '2' },
      ]
    };
    setSelectedTemplate(mockOrder);
  };

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-5 overflow-x-hidden px-1 pb-24 pt-2 ua-compact-page sm:space-y-8 sm:px-2 sm:pt-4">
      <div className="no-print flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between sm:gap-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <FileText className="w-3.5 h-3.5 text-primary" />
            <span className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-400">Documentation Center</span>
          </div>
          <PageHeader title="OS Documents" breadcrumb={["Admin", "OS Documents"]} className="mb-0" />
          <p className="text-zinc-500 mt-2 uppercase text-[10px] font-bold tracking-widest max-w-2xl">
            Inventory audit forms and high-fidelity thermal receipt templates.
          </p>
        </div>
        <div className="grid w-full grid-cols-1 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:gap-3">
          <Button 
            onClick={handleDownloadExcel}
            disabled={isExportingExcel || filteredInventory.length === 0}
            className="h-11 w-full justify-center rounded-lg bg-emerald-600 px-3 text-[10px] font-bold uppercase tracking-wide text-white shadow-sm transition-all active:scale-95 hover:bg-emerald-700 sm:h-12 sm:w-auto sm:rounded-xl sm:px-6 sm:font-black sm:tracking-widest"
          >
            {isExportingExcel ? (
              <><RefreshCcw className="w-4 h-4 animate-spin mr-1" /> Generating Excel...</>
            ) : (
              <><FileSpreadsheet className="w-4 h-4" /> Export Excel (.xlsx)</>
            )}
          </Button>
          <Button 
            onClick={handleDownloadPDF}
            disabled={isExportingPDF || filteredInventory.length === 0}
            className="h-11 w-full justify-center rounded-lg bg-zinc-900 px-3 text-[10px] font-bold uppercase tracking-wide text-white shadow-sm transition-all active:scale-95 hover:bg-zinc-800 sm:h-12 sm:w-auto sm:rounded-xl sm:px-6 sm:font-black sm:tracking-widest"
          >
            {isExportingPDF ? (
              <><RefreshCcw className="w-4 h-4 animate-spin mr-1" /> Generating PDF...</>
            ) : (
              <><FileDown className="w-4 h-4 text-primary" /> Export PDF (.pdf)</>
            )}
          </Button>
          <Button 
            onClick={() => setIsReceiptSettingsOpen(true)}
            className="h-11 w-full justify-center rounded-lg bg-primary px-3 text-[10px] font-bold uppercase tracking-wide text-white shadow-sm transition-all active:scale-95 hover:bg-orange-600 sm:h-12 sm:w-auto sm:rounded-xl sm:px-6 sm:font-black sm:tracking-widest"
          >
            <Settings2 className="w-4 h-4" /> Edit Receipt Data
          </Button>
        </div>
      </div>

      <Tabs defaultValue="stock-sheet" className="w-full no-print">
         <TabsList className="mb-4 grid h-auto w-full grid-cols-2 gap-1 rounded-xl border border-zinc-100 bg-white p-1 shadow-sm sm:mb-8 sm:inline-flex sm:w-auto sm:grid-cols-none sm:rounded-2xl sm:p-1.5">
            <TabsTrigger value="stock-sheet" className="h-10 rounded-lg px-2 text-[9px] font-bold uppercase tracking-wide transition-all data-[state=active]:bg-zinc-900 data-[state=active]:text-white sm:h-full sm:rounded-xl sm:px-8 sm:text-[10px] sm:font-black sm:tracking-widest">Audit Forms</TabsTrigger>
            <TabsTrigger value="receipts" className="rounded-xl h-full px-8 text-[10px] font-black uppercase tracking-widest data-[state=active]:bg-zinc-900 data-[state=active]:text-white transition-all">Receipt Previews</TabsTrigger>
         </TabsList>

         <TabsContent value="stock-sheet" className="m-0 space-y-6">
            <div className="flex flex-col gap-3 rounded-xl border border-zinc-100 bg-white p-3 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:rounded-2xl sm:p-4">
               <div className="grid w-full grid-cols-3 gap-1 rounded-lg bg-zinc-100/60 p-1 sm:flex sm:w-auto sm:gap-2 sm:rounded-xl sm:p-1.5">
                  {['STORE', 'LOUNGE', 'CARWASH'].map((u) => (
                    <Button
                      key={u}
                      onClick={() => setActiveUnit(u as BusinessUnit)}
                      className={cn(
                        "h-9 min-w-0 rounded-md px-2 text-[9px] font-bold uppercase tracking-wide transition-all sm:h-10 sm:rounded-lg sm:px-6 sm:font-black sm:tracking-widest",
                        activeUnit === u ? "bg-white text-primary shadow-sm" : "bg-transparent text-zinc-400 hover:text-zinc-900"
                      )}
                    >
                      {u}
                    </Button>
                  ))}
               </div>
               <div className="relative w-full min-w-0 flex-1 sm:w-auto">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                  <Input 
                    placeholder="Search inventory..." 
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="pl-12 h-12 bg-zinc-50 border-none rounded-xl font-bold"
                  />
               </div>
            </div>

            <div className="grid grid-cols-1 gap-2 sm:hidden">
  {filteredInventory.map((item) => (
    <Card key={item.id} className="rounded-xl border border-zinc-200 bg-white p-3 shadow-sm">
      <div className="flex min-w-0 items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-zinc-100 bg-zinc-50 text-zinc-500"><LayoutList className="h-5 w-5" /></div>
        <div className="min-w-0 flex-1"><p className="break-words text-sm font-semibold text-zinc-900">{item.name}</p><p className="mt-1 truncate text-xs text-zinc-500">{item.category} · {item.barcode || "No barcode"}</p></div>
        <Badge variant="outline" className="shrink-0 text-[10px]">{item.stockLevel} in stock</Badge>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3 border-t border-zinc-100 pt-3">
        <div><p className="text-[10px] text-zinc-400">Physical count</p><div className="mt-1 h-9 rounded-md border border-dashed border-primary/30 bg-primary/5" /></div>
        <div><p className="text-[10px] text-zinc-400">Last checked</p><p className="mt-2 text-xs font-medium text-zinc-700">{item.lastCountedAt ? new Date(item.lastCountedAt).toLocaleDateString() : "No history"}</p></div>
      </div>
    </Card>
  ))}
  {filteredInventory.length === 0 && <div className="rounded-xl border border-dashed border-zinc-200 bg-white px-4 py-10 text-center text-sm text-zinc-500">No inventory items found for this department.</div>}
</div>
<Card className="hidden overflow-x-auto rounded-2xl border border-zinc-100 bg-white shadow-sm sm:block">
               <CardContent className="p-0">
                  <Table className="min-w-[760px]">
                     <TableHeader className="bg-zinc-50/50">
                        <TableRow className="border-zinc-100">
                           <TableHead className="pl-8 h-16 text-[10px] uppercase font-black tracking-widest text-zinc-400">Product Name</TableHead>
                           <TableHead className="h-16 text-[10px] uppercase font-black tracking-widest text-zinc-400">Category</TableHead>
                           <TableHead className="h-16 text-[10px] uppercase font-black tracking-widest text-right text-zinc-400">System Stock</TableHead>
                           <TableHead className="h-16 text-[10px] uppercase font-black tracking-widest text-center text-primary bg-primary/5 w-[150px]">Physical Count</TableHead>
                           <TableHead className="pr-8 h-16 text-[10px] uppercase font-black tracking-widest text-right text-zinc-400">Last Checked</TableHead>
                        </TableRow>
                     </TableHeader>
                     <TableBody>
                        {filteredInventory.map((item) => (
                           <TableRow key={item.id} className="border-zinc-50 hover:bg-zinc-50/50 transition-colors">
                              <TableCell className="pl-8 py-5">
                                 <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-xl bg-zinc-50 flex items-center justify-center border border-zinc-100 text-zinc-300">
                                       <LayoutList className="w-5 h-5" />
                                    </div>
                                    <div>
                                       <p className="text-sm font-black text-zinc-900 uppercase leading-none mb-1">{item.name}</p>
                                       <p className="text-[8px] font-bold text-zinc-400 uppercase tracking-widest">{item.barcode || 'REF_MISSING'}</p>
                                    </div>
                                 </div>
                              </TableCell>
                              <TableCell><Badge variant="outline" className="text-[8px] font-black uppercase border-zinc-200">{item.category}</Badge></TableCell>
                              <TableCell className="text-right font-black text-zinc-900">{item.stockLevel}</TableCell>
                              <TableCell className="bg-primary/5">
                                 <div className="w-20 h-10 border-2 border-dashed border-primary/20 rounded-lg mx-auto bg-white/50" />
                              </TableCell>
                              <TableCell className="pr-8 text-right">
                                 <div className="flex items-center justify-end gap-2 text-[9px] font-bold text-zinc-300 uppercase">
                                    <History className="w-3 h-3" /> {item.lastCountedAt ? new Date(item.lastCountedAt).toLocaleDateString() : 'NO HISTORY'}
                                 </div>
                              </TableCell>
                           </TableRow>
                        ))}
                     </TableBody>
                  </Table>
               </CardContent>
            </Card>
         </TabsContent>

         <TabsContent value="receipts" className="m-0">
            <div className="mb-4 rounded-lg border border-zinc-200 bg-white p-3 text-xs text-zinc-600">
              Select a unit-specific receipt below. Lounge, Store and Carwash use separate receipt headings and transaction details; Carwash previews also show the assigned attendant.
            </div>
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-12 lg:gap-8">
               <div className="min-w-0 space-y-3 lg:col-span-4 lg:space-y-4">
                  <p className="text-[10px] font-black uppercase text-zinc-400 tracking-widest px-2">Select Design</p>
                  {TEMPLATE_PREVIEWS.map((tmpl) => (
                    <button
                      key={tmpl.id}
                      onClick={() => loadTemplatePreview(tmpl)}
                      className={cn(
                        "w-full p-6 rounded-[2rem] border-2 transition-all text-left group flex items-center justify-between active:scale-[0.98]",
                        selectedTemplate?.id === tmpl.id ? "border-primary bg-primary/5 shadow-lg" : "border-zinc-100 bg-white hover:border-zinc-200"
                      )}
                    >
                       <div className="flex items-center gap-5">
                          <div className={cn(
                            "w-12 h-12 rounded-2xl flex items-center justify-center transition-all",
                            selectedTemplate?.id === tmpl.id ? "bg-white text-primary shadow-sm" : "bg-zinc-50 text-zinc-300 group-hover:text-primary"
                          )}>
                             <tmpl.icon className="w-6 h-6" />
                          </div>
                          <div>
                             <p className="text-xs font-black uppercase text-zinc-900 tracking-tight">{tmpl.label}</p>
                             <p className="text-[8px] font-bold text-zinc-400 uppercase tracking-widest mt-1">Thermal Layout</p>
                          </div>
                       </div>
                       <ChevronRight className={cn("w-5 h-5 transition-all", selectedTemplate?.id === tmpl.id ? "text-primary translate-x-1" : "text-zinc-100")} />
                    </button>
                  ))}
               </div>

               <div className="lg:col-span-8">
                  {selectedTemplate ? (
                    <div className="flex min-w-0 flex-col items-center overflow-x-auto rounded-xl border border-dashed border-zinc-200 bg-zinc-50/50 p-3 sm:rounded-3xl sm:p-6 lg:p-10">
                       <ReceiptPreview data={selectedTemplate} className="w-full" />
                    </div>
                  ) : (
                    <div className="h-[600px] flex flex-col items-center justify-center text-center space-y-6 opacity-30">
                       <Printer className="w-20 h-20 text-zinc-200" />
                       <div>
                          <h3 className="text-2xl font-black uppercase font-headline">Thermal Preview</h3>
                          <p className="text-[10px] font-bold uppercase tracking-widest">Select a document type to view layout</p>
                       </div>
                    </div>
                  )}
               </div>
            </div>
         </TabsContent>
      </Tabs>

      <div id="print-target" className="hidden bg-white text-black p-0" style={{ width: '800px' }}>
         <div className="p-8 space-y-8">
            <div className="flex items-center justify-between border-b-2 border-black pb-6">
               <div className="flex items-center gap-8">
                  <img src="/assets/logo.png" alt="Logo" className="w-60 h-auto object-contain" />
                  <div>
                    <h1 className="text-2xl font-bold uppercase tracking-tighter leading-none">Inventory Audit Sheet</h1>
                    <p className="text-xs font-medium uppercase tracking-widest text-zinc-500 mt-1">{activeUnit} Department • Nakuru HQ</p>
                  </div>
               </div>
               <div className="text-right space-y-1">
                  <p className="text-xs font-bold">Date: ________________</p>
                  <p className="text-xs font-bold">Ref: UAX-AUD-{Date.now().toString().slice(-6)}</p>
               </div>
            </div>

            <table className="w-full border-collapse">
               <thead>
                  <tr className="border-b-2 border-black">
                     <th className="py-2 text-left text-[10px] font-bold uppercase tracking-widest">Product Details</th>
                     <th className="py-2 text-center text-[10px] font-bold uppercase tracking-widest w-24">Actual Count</th>
                     <th className="py-2 text-left text-[10px] font-bold uppercase tracking-widest pl-4">Comments</th>
                  </tr>
               </thead>
               <tbody>
                  {filteredInventory.map((item) => (
                    <tr key={item.id} className="border-b border-zinc-200">
                       <td className="py-2 pr-2">
                          <p className="font-bold uppercase text-[11px] leading-tight">{item.name}</p>
                          <p className="text-[8px] text-zinc-500 uppercase tracking-widest">{item.category} • {item.barcode || 'N/A'}</p>
                       </td>
                       <td className="py-2">
                          <div className="w-20 h-8 border border-black mx-auto" />
                       </td>
                       <td className="py-2 pl-4">
                          <div className="w-full h-8 border-b border-zinc-300" />
                       </td>
                    </tr>
                  ))}
               </tbody>
            </table>

            <div className="pt-12 grid grid-cols-2 gap-16">
               <div className="space-y-8">
                  <div className="border-t border-black pt-2">
                     <p className="text-[9px] font-bold uppercase">Staff Member Signature</p>
                  </div>
               </div>
               <div className="space-y-8">
                  <div className="border-t border-black pt-2">
                     <p className="text-[9px] font-bold uppercase">Supervisor Approval</p>
                  </div>
               </div>
            </div>
            
            <div className="pt-8 text-center">
               <p className="text-[8px] font-bold text-zinc-400 uppercase tracking-[0.4em]">Official Urban Express Internal Document • High-Density Protocol</p>
            </div>
         </div>
      </div>

      <ReceiptSettingsDialog open={isReceiptSettingsOpen} onOpenChange={setIsReceiptSettingsOpen} />
   </div>
  );
}
