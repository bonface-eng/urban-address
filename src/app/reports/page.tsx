'use client';

import { PageHeader } from '@/components/shared/page-layout';

import { useBusinessClock } from '@/hooks/use-business-clock';

import React, { useMemo, useState } from 'react';
import { 
  BarChart3, 
  Download, 
  Calendar, 
  TrendingUp, 
  Target, 
  FileText, 
  Clock, 
  Printer, 
  RefreshCcw, 
  ShieldCheck, 
  LayoutList, 
  History, 
  CheckCircle2, 
  AlertCircle,
  CalendarDays,
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  DollarSign
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { cn } from '@/lib/utils';
import { useDb, useCollection, useMemoSupabase, useUser } from '@/lib/data';
import { collection, query, where, orderBy, limit } from '@/lib/db';
import { Order } from '@/lib/types';
import { toast } from '@/hooks/use-toast';
import { ReceiptPreview } from '@/components/pos/receipt-preview';

type DatePreset = 'TODAY' | 'YESTERDAY' | 'LAST_7_DAYS' | 'LAST_30_DAYS' | 'ALL_TIME' | 'CUSTOM';

export default function BusinessReports() {
  const firestore = useDb();
  const { user } = useUser();
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [pendingReport, setPendingReport] = useState<any>(null);
  
  // Filter States
  const [datePreset, setDatePreset] = useState<DatePreset>('TODAY');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const { startOfToday } = useBusinessClock();

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 12;

  const ordersQuery = useMemoSupabase(() => {
    if (!firestore) return null;
    return query(
      collection(firestore, 'orders'), 
      orderBy('timestamp', 'desc')
    );
  }, [firestore]);

  const { data: allOrders, loading } = useCollection<Order>(ordersQuery);

  const filteredOrders = useMemo(() => {
    if (!allOrders) return [];
    return allOrders.filter(o => {
      if (o.status !== 'PAID') return false;

      // Search match
      const matchesSearch = !searchTerm || 
        o.id?.toLowerCase().includes(searchTerm.toLowerCase()) || 
        o.items?.some(i => i.name.toLowerCase().includes(searchTerm.toLowerCase()));
      
      if (!matchesSearch) return false;

      // Date Logic
      if (datePreset === 'TODAY') return o.timestamp >= startOfToday;
      
      if (datePreset === 'YESTERDAY') {
        const startOfYest = startOfToday - (24 * 60 * 60 * 1000);
        return o.timestamp >= startOfYest && o.timestamp < startOfToday;
      }
      
      if (datePreset === 'LAST_7_DAYS') {
        const startOfPeriod = startOfToday - (7 * 24 * 60 * 60 * 1000);
        return o.timestamp >= startOfPeriod;
      }
      
      if (datePreset === 'LAST_30_DAYS') {
        const startOfPeriod = startOfToday - (30 * 24 * 60 * 60 * 1000);
        return o.timestamp >= startOfPeriod;
      }

      if (datePreset === 'CUSTOM') {
        const start = startDate ? new Date(startDate).setHours(0, 0, 0, 0) : 0;
        const end = endDate ? new Date(endDate).setHours(23, 59, 59, 999) : Infinity;
        return o.timestamp >= start && o.timestamp <= end;
      }

      return true; // ALL_TIME
    });
  }, [allOrders, datePreset, startDate, endDate, searchTerm, startOfToday]);

  const stats = useMemo(() => {
    const periodPaid = filteredOrders;
    const totalRevenue = periodPaid.reduce((sum, o) => sum + o.total, 0);
    const orderCount = periodPaid.length;

    const units = [
      { name: 'Lounge', value: periodPaid.filter(o => o.type === 'LOUNGE').reduce((sum, o) => sum + o.total, 0), color: 'hsl(25, 100%, 50%)' },
      { name: 'Retail', value: periodPaid.filter(o => o.type === 'STORE').reduce((sum, o) => sum + o.total, 0), color: 'hsl(240, 5.9%, 10%)' },
      { name: 'Carwash', value: periodPaid.filter(o => o.type === 'CARWASH').reduce((sum, o) => sum + o.total, 0), color: 'hsl(240, 5.9%, 40%)' },
    ];

    const salesMap = new Map<string, { name: string, qty: number, total: number, unit: string }>();
    periodPaid.forEach(o => {
      o.items?.forEach(item => {
        const existing = salesMap.get(item.productId);
        if (existing) {
          existing.qty += item.quantity;
          existing.total += (item.price * item.quantity);
        } else {
          salesMap.set(item.productId, {
            name: item.name,
            qty: item.quantity,
            total: (item.price * item.quantity),
            unit: o.type
          });
        }
      });
    });

    const itemSales = Array.from(salesMap.values()).sort((a, b) => b.qty - a.qty);

    return { total: totalRevenue, count: orderCount, units, itemSales };
  }, [filteredOrders]);

  const paginatedItemSales = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return stats.itemSales.slice(start, start + itemsPerPage);
  }, [stats.itemSales, currentPage]);

  const totalPages = Math.ceil(stats.itemSales.length / itemsPerPage);

  const generateReportPreview = async (type: 'X' | 'Z' | 'MOVEMENT') => {
    if (!user || !firestore) return;
    setIsGenerating(true);
    
    try {
      let reportData: any;
      const periodLabel = datePreset === 'CUSTOM' ? `${startDate} to ${endDate}` : datePreset.replace(/_/g, ' ');

      if (type === 'MOVEMENT') {
        reportData = {
          type: 'SYSTEM-REPORT',
          reportType: 'INVENTORY-REPORT',
          displayTitle: `MOVEMENT: ${periodLabel}`,
          total: stats.itemSales.reduce((sum, i) => sum + i.total, 0),
          timestamp: Date.now(),
          items: stats.itemSales.map(i => ({ name: i.name, quantity: i.qty, price: i.total / i.qty }))
        };
      } else {
        reportData = {
          type: 'SYSTEM-REPORT',
          reportType: `${type}-REPORT`,
          displayTitle: `${type} Report: ${periodLabel}`,
          total: stats.total,
          timestamp: Date.now(),
          items: [
            { name: "Gross Sales", quantity: 1, price: stats.total },
            { name: "Transactions", quantity: 1, price: stats.count },
            ...stats.units.map(u => ({ name: `${u.name} Sales`, quantity: 1, price: u.value }))
          ]
        };
      }
      setPendingReport(reportData);
      setIsPreviewOpen(true);
    } catch (error) {
      toast({ variant: "destructive", title: "Error" });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-6 pb-20 max-w-[1600px] mx-auto px-2 pt-2 ua-compact-page">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <PageHeader title="Intelligence Reports" breadcrumb={["Finance", "Intelligence Reports"]} className="mb-0" />
          <p className="text-zinc-500 mt-1 uppercase text-[10px] font-bold tracking-widest">Shift performance and high-density turnover analytics</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => generateReportPreview('X')} className="h-11 px-6 text-[10px] font-black uppercase tracking-widest rounded-xl bg-white border-zinc-200">Generate X-Report</Button>
          <Button onClick={() => generateReportPreview('Z')} className="h-11 px-8 bg-zinc-900 text-white font-black uppercase text-[10px] tracking-widest rounded-xl shadow-xl">Generate Z-Report</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Departmental Distribution - The HQ Node */}
        <Card className="lg:col-span-4 border-none shadow-mobile rounded-[2.5rem] bg-zinc-900 text-white overflow-hidden border border-zinc-800">
           <CardHeader className="p-8 border-b border-white/5">
              <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em]">Revenue Distribution</CardTitle>
           </CardHeader>
           <CardContent className="p-8 space-y-6">
              {stats.units.map((unit) => (
                <div key={unit.name} className="space-y-2">
                   <div className="flex justify-between items-end">
                      <div>
                         <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">{unit.name}</p>
                         <p className="text-xl font-black tracking-tight">KES {unit.value.toLocaleString()}</p>
                      </div>
                      <span className="text-[10px] font-bold text-zinc-600 uppercase">
                        {stats.total > 0 ? Math.round((unit.value / stats.total) * 100) : 0}%
                      </span>
                   </div>
                   <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                      <div 
                        className={cn("h-full transition-all duration-1000", unit.name === 'Lounge' ? 'bg-amber-500' : unit.name === 'Retail' ? 'bg-white' : 'bg-primary')} 
                        style={{ width: `${stats.total > 0 ? (unit.value / stats.total) * 100 : 0}%` }} 
                      />
                   </div>
                </div>
              ))}
           </CardContent>
        </Card>

        {/* Metric Cards */}
        <div className="lg:col-span-8 grid grid-cols-1 sm:grid-cols-2 gap-4 ua-metric-strip">
          <MetricCard title="Revenue Total" value={`KES ${stats.total.toLocaleString()}`} sub={`Net volume for period`} icon={Target} color="text-primary" />
          <MetricCard title="Transaction Count" value={stats.count.toString()} sub={`Authorized orders`} icon={TrendingUp} />
          <MetricCard title="Departmental Split" value={stats.units.length.toString()} sub={`Active units`} icon={LayoutList} />
          <MetricCard title="System Node" value="HQ NOMINAL" sub={`Real-time sync active`} icon={ShieldCheck} color="text-green-600" />
        </div>
      </div>

      <div className="space-y-4">
         <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex gap-2 bg-white p-1.5 rounded-2xl border border-zinc-100 shadow-sm overflow-x-auto no-scrollbar w-full lg:w-auto">
               {[
                 { id: 'TODAY', label: 'Today' },
                 { id: 'YESTERDAY', label: 'Yesterday' },
                 { id: 'LAST_7_DAYS', label: '7 Days' },
                 { id: 'LAST_30_DAYS', label: '30 Days' },
                 { id: 'ALL_TIME', label: 'All Time' },
                 { id: 'CUSTOM', label: 'Custom Range' },
               ].map((preset) => (
                 <Button
                   key={preset.id}
                   onClick={() => { setDatePreset(preset.id as DatePreset); setCurrentPage(1); }}
                   className={cn(
                     "h-11 px-6 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all",
                     datePreset === preset.id ? "bg-zinc-900 text-white shadow-lg" : "bg-transparent text-zinc-400 hover:text-zinc-900"
                   )}
                 >
                   {preset.label}
                 </Button>
               ))}
            </div>

            {datePreset === 'CUSTOM' && (
              <div className="flex items-center gap-2 bg-white p-1.5 rounded-2xl border border-zinc-100 shadow-sm animate-in slide-in-from-right-4">
                 <div className="flex items-center gap-2 px-3">
                   <CalendarDays className="w-3.5 h-3.5 text-primary" />
                   <Input 
                     type="date" 
                     value={startDate} 
                     onChange={e => setStartDate(e.target.value)}
                     className="h-9 w-36 border-none bg-zinc-50 rounded-xl text-[10px] font-black"
                   />
                   <span className="text-[9px] font-black text-zinc-300">TO</span>
                   <Input 
                     type="date" 
                     value={endDate} 
                     onChange={e => setEndDate(e.target.value)}
                     className="h-9 w-36 border-none bg-zinc-50 rounded-xl text-[10px] font-black"
                   />
                 </div>
              </div>
            )}
         </div>

         <div className="flex flex-col md:flex-row items-center gap-4 bg-white p-4 rounded-[2rem] shadow-sm border border-zinc-100">
            <div className="relative flex-1 w-full">
               <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
               <Input 
                 placeholder="Search sold items or order IDs..." 
                 value={searchTerm}
                 onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                 className="pl-12 h-14 bg-zinc-50 border-none rounded-2xl font-bold" 
               />
            </div>
         </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <Card className="lg:col-span-12 border-none shadow-mobile rounded-[2.5rem] bg-white border border-zinc-100 overflow-hidden flex flex-col">
            <CardHeader className="p-8 border-b border-zinc-50 flex flex-row items-center justify-between shrink-0">
               <div>
                  <CardTitle className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Inventory Turnover Audit</CardTitle>
                  <p className="text-[8px] font-bold text-zinc-300 uppercase tracking-widest mt-1">Ranking by sales volume</p>
               </div>
               <Button onClick={() => generateReportPreview('MOVEMENT')} variant="outline" className="h-10 px-5 rounded-xl border-zinc-100 text-[9px] font-black uppercase tracking-widest gap-2 bg-white">
                 <LayoutList className="w-3.5 h-3.5" /> Full Audit
               </Button>
            </CardHeader>
            <CardContent className="p-0 flex-1 overflow-y-auto no-scrollbar">
               <Table>
                  <TableHeader className="bg-zinc-50/50 sticky top-0 z-10">
                     <TableRow className="border-zinc-50">
                        <TableHead className="pl-8 h-12 text-[9px] uppercase font-black tracking-widest">Product Details</TableHead>
                        <TableHead className="h-12 text-[9px] uppercase font-black tracking-widest text-center">Unit</TableHead>
                        <TableHead className="h-12 text-[9px] uppercase font-black tracking-widest text-right">Qty Sold</TableHead>
                        <TableHead className="pr-8 h-12 text-[9px] uppercase font-black tracking-widest text-right">Total Revenue</TableHead>
                     </TableRow>
                  </TableHeader>
                  <TableBody>
                     {paginatedItemSales.map((item, idx) => (
                       <TableRow key={idx} className="border-zinc-50 hover:bg-zinc-50/50 group transition-colors">
                          <TableCell className="pl-8 py-4">
                             <span className="text-xs font-black text-zinc-900 uppercase group-hover:text-primary transition-colors">{item.name}</span>
                          </TableCell>
                          <TableCell className="text-center">
                             <Badge variant="outline" className="text-[7px] font-black uppercase border-zinc-100">{item.unit}</Badge>
                          </TableCell>
                          <TableCell className="text-right">
                             <span className="text-sm font-black text-zinc-900">{item.qty}</span>
                          </TableCell>
                          <TableCell className="text-right pr-8 font-bold text-zinc-600">
                             KES {item.total.toLocaleString()}
                          </TableCell>
                       </TableRow>
                     ))}
                     {stats.itemSales.length === 0 && (
                       <TableRow>
                          <TableCell colSpan={4} className="py-20 text-center opacity-30">
                             <RefreshCcw className="w-10 h-10 mx-auto mb-4 text-zinc-200" />
                             <p className="text-[10px] font-black uppercase tracking-widest">No movement recorded for this period</p>
                          </TableCell>
                       </TableRow>
                     )}
                  </TableBody>
               </Table>

               {totalPages > 1 && (
                  <div className="flex items-center justify-between px-8 py-4 bg-white border-t border-zinc-50">
                     <p className="text-[10px] font-black uppercase text-zinc-400 tracking-widest">Showing {currentPage} of {totalPages} pages</p>
                     <div className="flex gap-2">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          disabled={currentPage === 1}
                          onClick={() => setCurrentPage(p => p - 1)}
                          className="h-9 px-4 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all"
                        >
                          <ChevronLeft className="w-4 h-4 mr-1" /> Prev
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          disabled={currentPage === totalPages}
                          onClick={() => setCurrentPage(p => p + 1)}
                          className="h-9 px-4 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all"
                        >
                          Next <ChevronRight className="w-4 h-4 ml-1" />
                        </Button>
                     </div>
                  </div>
               )}
            </CardContent>
        </Card>
      </div>

      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
         <DialogContent className="sm:max-w-md p-0 border-none bg-transparent shadow-none">
            <div className="sr-only">
               <DialogTitle>Business Report Preview</DialogTitle>
               <DialogDescription>Summary of sales performance and item turnover.</DialogDescription>
            </div>
            <ReceiptPreview data={pendingReport} onClose={() => setIsPreviewOpen(false)} />
         </DialogContent>
      </Dialog>
    </div>
  );
}

function MetricCard({ title, value, sub, icon: Icon, color = "text-zinc-900" }: any) {
  return (
    <Card className="border-none shadow-sm rounded-[2rem] bg-white p-8 border border-zinc-100 group hover:bg-zinc-50 transition-colors">
        <div className="w-12 h-12 rounded-2xl bg-zinc-50 flex items-center justify-center mb-6 shadow-inner group-hover:scale-110 transition-transform">
           <Icon className={cn("w-6 h-6", color)} />
        </div>
        <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1">{title}</p>
        <h3 className={cn("text-2xl md:text-3xl font-black font-headline tracking-tighter", color)}>{value}</h3>
        <p className="text-[8px] font-bold text-zinc-300 uppercase tracking-widest mt-2">{sub}</p>
    </Card>
  );
}
