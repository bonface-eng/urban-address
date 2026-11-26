'use client';

import { PageHeader } from '@/components/shared/page-layout';

import { useBusinessClock } from '@/hooks/use-business-clock';

import React, { useState, useEffect, useMemo } from 'react';
import { 
  Search, 
  Filter, 
  Download, 
  ShoppingBag,
  Coffee,
  CheckCircle2,
  XCircle,
  Clock,
  Receipt,
  Undo2,
  RefreshCcw,
  Banknote,
  Smartphone,
  Car,
  ShieldCheck,
  Trash2,
  ShieldAlert,
  Hash,
  Check,
  LayoutGrid,
  TrendingUp,
  ArrowUpRight,
  History,
  FileText,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  User,
  DollarSign,
  Percent,
  CreditCard,
  FileDown,
  AlertCircle,
  Package,
  Calculator,
  Terminal
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { cn } from '@/lib/utils';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, limit, doc, addDoc, writeBatch, increment, where, deleteDoc } from 'firebase/firestore';
import { Order, BusinessUnit } from '@/lib/types';
import { useProfile } from '@/hooks/use-profile';
import { useTerminal } from '@/hooks/use-terminal';
import { toast } from '@/hooks/use-toast';
import { ReceiptPreview } from '@/components/pos/receipt-preview';

type DatePreset = 'TODAY' | 'YESTERDAY' | 'THIS_WEEK' | 'THIS_MONTH' | 'ALL_TIME' | 'CUSTOM';

export default function SalesHistoryPage() {
  const firestore = useFirestore();
  const { profile, isSuperAdmin, role } = useProfile();
  const { clientIp } = useTerminal();
  const [mounted, setMounted] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  const isAdmin = isSuperAdmin || role === 'ADMIN' || role === 'MANAGER' || role === 'SUPERVISOR';

  // Persistent Navigation State
  const [activeTab, setActiveTab] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('uax_sales_active_tab') || 'audit';
    }
    return 'audit';
  });

  const [filterUnit, setFilterUnit] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('uax_sales_filter_unit') || 'ALL';
    }
    return 'ALL';
  });

  const [datePreset, setDatePreset] = useState<DatePreset>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('uax_sales_date_preset') as DatePreset) || 'TODAY';
    }
    return 'TODAY';
  });

  const [dateFrom, setDateFrom] = useState(() => typeof window !== 'undefined' ? localStorage.getItem('uax_sales_date_from') || '' : '');
  const [dateTo, setDateTo] = useState(() => typeof window !== 'undefined' ? localStorage.getItem('uax_sales_date_to') || '' : '');

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const { startOfToday, startOfMonth, dayOfWeek } = useBusinessClock();
  const itemsPerPage = 12;

  // Preview State
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted) {
      localStorage.setItem('uax_sales_active_tab', activeTab);
      localStorage.setItem('uax_sales_filter_unit', filterUnit);
      localStorage.setItem('uax_sales_date_preset', datePreset);
      localStorage.setItem('uax_sales_date_from', dateFrom);
      localStorage.setItem('uax_sales_date_to', dateTo);
    }
  }, [activeTab, filterUnit, datePreset, dateFrom, dateTo, mounted]);

  const ordersQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'orders'), orderBy('timestamp', 'desc'));
  }, [firestore]);

  const { data: orders, loading } = useCollection<Order>(ordersQuery);

  const filteredOrders = useMemo(() => {
    if (!orders) return [];
    
    let baseList = orders;
    
    // Privacy Logic: Non-admins should only see their assigned units for PAID orders
    if (!isSuperAdmin && (role === 'CASHIER' || role === 'STOREKEEPER' || role === 'ATTENDANT')) {
      const units = profile?.assignedUnits || [];
      if (units.length > 0) {
        baseList = baseList.filter(o => units.includes(o.type));
      }
    }

    return baseList.filter(o => {
      // BACKLOG PRIVACY: Lounge and Store held bills should only appear in individual tabs not global.
      // If we are in the 'clearance' (Backlog) tab:
      if (activeTab === 'clearance') {
        if (o.status !== 'PENDING') return false;
        
        // Carwash backlog is global (Queue), but Lounge/Store are individual.
        if (o.type === 'LOUNGE' || o.type === 'STORE') {
          // If not Admin, you can ONLY see your own pending bills.
          if (!isAdmin && o.cashierId !== profile?.uid) return false;
        }
      } else {
        // Audit tab shows finalized orders
        if (o.status === 'PENDING') return false;
      }

      const matchesUnit = filterUnit === 'ALL' || o.type === filterUnit;
      if (!matchesUnit) return false;

      const matchesSearch = !searchTerm || 
        o.id?.toLowerCase().includes(searchTerm.toLowerCase()) || 
        o.plateNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        o.cashierName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        o.items?.some(item => item.name.toLowerCase().includes(searchTerm.toLowerCase()));
      
      if (!matchesSearch) return false;

      if (datePreset === 'CUSTOM') {
        // Date inputs represent local calendar days; include the full end date.
        if (dateFrom) {
          const from = new Date(`${dateFrom}T00:00:00`).getTime();
          if (o.timestamp < from) return false;
        }
        if (dateTo) {
          const to = new Date(`${dateTo}T23:59:59.999`).getTime();
          if (o.timestamp > to) return false;
        }
        return true;
      }
      if (datePreset === 'TODAY') return o.timestamp >= startOfToday;
      if (datePreset === 'YESTERDAY') {
        const startOfYest = startOfToday - (24 * 60 * 60 * 1000);
        return o.timestamp >= startOfYest && o.timestamp < startOfToday;
      }
      if (datePreset === 'THIS_WEEK') {
        const startOfWeek = startOfToday - (dayOfWeek * 24 * 60 * 60 * 1000);
        return o.timestamp >= startOfWeek && o.timestamp < startOfToday + (24 * 60 * 60 * 1000);
      }
      if (datePreset === 'THIS_MONTH') return o.timestamp >= startOfMonth;

      return true;
    });
  }, [orders, searchTerm, filterUnit, datePreset, dateFrom, dateTo, isSuperAdmin, role, profile, activeTab, isAdmin, startOfToday, startOfMonth, dayOfWeek]);

  const selectableFilteredOrders = filteredOrders.filter(order => order.status === 'PENDING' && Boolean(order.id));
  const allFilteredSelected = selectableFilteredOrders.length > 0 && selectableFilteredOrders.every(order => selectedOrderIds.includes(order.id!));

  useEffect(() => {
    setSelectedOrderIds([]);
  }, [activeTab, filterUnit, searchTerm, datePreset, dateFrom, dateTo]);

  // Pagination Logic
  const totalPages = Math.ceil(filteredOrders.length / itemsPerPage);
  const paginatedOrders = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredOrders.slice(start, start + itemsPerPage);
  }, [filteredOrders, currentPage]);

  // KPI totals follow the same selected unit, date and search filters as the
  // transaction list, regardless of whether the Audit or Backlog tab is open.
  const metricOrders = useMemo(() => {
    if (!orders) return [];

    let baseList = orders;

    // Match the visibility rules used by the transaction list.
    if (!isSuperAdmin && (role === 'CASHIER' || role === 'STOREKEEPER' || role === 'ATTENDANT')) {
      const units = profile?.assignedUnits || [];
      if (units.length > 0) {
        baseList = baseList.filter(order => units.includes(order.type));
      }
    }

    return baseList.filter(order => {
      if (order.status === 'PENDING' && (order.type === 'LOUNGE' || order.type === 'STORE')) {
        if (!isAdmin && order.cashierId !== profile?.uid) return false;
      }

      if (filterUnit !== 'ALL' && order.type !== filterUnit) return false;

      const normalizedSearch = searchTerm.trim().toLowerCase();
      const matchesSearch = !normalizedSearch ||
        order.id?.toLowerCase().includes(normalizedSearch) ||
        order.plateNumber?.toLowerCase().includes(normalizedSearch) ||
        order.cashierName?.toLowerCase().includes(normalizedSearch) ||
        order.items?.some(item => item.name.toLowerCase().includes(normalizedSearch));

      if (!matchesSearch) return false;

      if (datePreset === 'CUSTOM') {
        if (dateFrom) {
          const from = new Date(`${dateFrom}T00:00:00`).getTime();
          if (order.timestamp < from) return false;
        }
        if (dateTo) {
          const to = new Date(`${dateTo}T23:59:59.999`).getTime();
          if (order.timestamp > to) return false;
        }
        return true;
      }

      if (datePreset === 'TODAY') return order.timestamp >= startOfToday;
      if (datePreset === 'YESTERDAY') {
        const startOfYesterday = startOfToday - (24 * 60 * 60 * 1000);
        return order.timestamp >= startOfYesterday && order.timestamp < startOfToday;
      }
      if (datePreset === 'THIS_WEEK') {
        const startOfWeek = startOfToday - (dayOfWeek * 24 * 60 * 60 * 1000);
        return order.timestamp >= startOfWeek && order.timestamp < startOfToday + (24 * 60 * 60 * 1000);
      }
      if (datePreset === 'THIS_MONTH') return order.timestamp >= startOfMonth;

      return true;
    });
  }, [orders, isSuperAdmin, role, profile, isAdmin, filterUnit, searchTerm, datePreset, dateFrom, dateTo, startOfToday, startOfMonth, dayOfWeek]);

  const stats = useMemo(() => {
    const paid = metricOrders.filter(order => order.status === 'PAID');
    const pending = metricOrders.filter(order => order.status === 'PENDING');
    return {
      volume: paid.reduce((sum, order) => sum + (Number(order.total) || 0), 0),
      paidCount: paid.length,
      pendingVolume: pending.reduce((sum, order) => sum + (Number(order.total) || 0), 0),
      pendingCount: pending.length,
    };
  }, [metricOrders]);

  const handleClearOrder = async (order: Order) => {
    if (!firestore || !profile || !isAdmin) return;
    if (!confirm(`Permanently delete held bill UAX-${order.id?.slice(-8).toUpperCase()}?`)) return;

    setIsProcessing(true);
    try {
      const batch = writeBatch(firestore);
      batch.delete(doc(firestore, 'orders', order.id!));
      if (order.cashierId) {
        batch.delete(doc(firestore, 'users', order.cashierId, 'held_bills', order.id!));
      }
      const auditRef = doc(collection(firestore, 'audit_logs'));
      batch.set(auditRef, {
        action: 'ADMIN_CLEAR_BILL',
        userId: profile.uid,
        details: `Admin purged held bill ${order.id} from station backlog.`,
        timestamp: Date.now(),
        severity: 'WARNING'
      });
      await batch.commit();
      toast({ title: "Bill Cleared" });
    } catch (err) {
      toast({ variant: "destructive", title: "Action Failed" });
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePurgeSelected = async () => {
    if (!firestore || !profile || !isAdmin || selectedOrderIds.length === 0) return;
    const selectedOrders = selectableFilteredOrders.filter(order => selectedOrderIds.includes(order.id!));
    if (selectedOrders.length === 0) return;
    if (!confirm(`Permanently purge ${selectedOrders.length} selected pending records? Paid sales and transaction history will not be touched.`)) return;

    setIsProcessing(true);
    let purgedCount = 0;
    try {
      // Firestore allows at most 500 writes per batch. Two deletes plus one
      // audit record per chunk keeps each batch safely below that limit.
      for (let offset = 0; offset < selectedOrders.length; offset += 200) {
        const chunk = selectedOrders.slice(offset, offset + 200);
        const batch = writeBatch(firestore);
        chunk.forEach(order => {
          batch.delete(doc(firestore, 'orders', order.id!));
          if (order.cashierId) {
            batch.delete(doc(firestore, 'users', order.cashierId, 'held_bills', order.id!));
          }
        });
        const auditRef = doc(collection(firestore, 'audit_logs'));
        batch.set(auditRef, {
          action: 'ADMIN_BULK_PURGE_BACKLOG',
          userId: profile.uid,
          details: `Admin purged ${chunk.length} selected pending backlog records: ${chunk.map(order => order.id).join(', ')}.`,
          timestamp: Date.now(),
          severity: 'CRITICAL'
        });
        await batch.commit();
        purgedCount += chunk.length;
      }
      setSelectedOrderIds([]);
      setCurrentPage(1);
      toast({ title: "Selected records purged", description: `${purgedCount} pending records removed.` });
    } catch (err) {
      toast({ variant: "destructive", title: "Purge incomplete", description: `${purgedCount} records were purged before an error. Refresh and review the remaining backlog.` });
    } finally {
      setIsProcessing(false);
    }
  };

  if (!mounted) return null;

  return (
    <div className="space-y-6 pb-20 max-w-[1600px] mx-auto pt-4 px-2 ua-compact-page">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <PageHeader title="Sales History" breadcrumb={["Finance", "Sales History"]} className="mb-0" />
          <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mt-1">Authorized transaction logs and clearance</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 ua-metric-strip">
        <KPIBox title="SALES VOLUME" value={`KES ${stats.volume.toLocaleString()}`} sub={`${stats.paidCount} PAID ORDERS`} icon={TrendingUp} />
        <KPIBox title="PENDING BACKLOG" value={`KES ${stats.pendingVolume.toLocaleString()}`} sub={`${stats.pendingCount} BILLS HELD`} icon={Clock} color="text-primary" />
        <KPIBox title="NODE STATUS" value="ONLINE" sub="STATION SYNC ACTIVE" icon={ShieldCheck} color="text-green-600" />
        <KPIBox title="TERMINAL ID" value={clientIp ? clientIp.slice(0, 12) : '0.0.0.0'} sub="NETWORK FOOTPRINT" icon={Terminal} />
      </div>

      <div className="flex flex-col lg:flex-row items-center justify-between gap-4">
         <div className="flex gap-2 p-1.5 bg-white rounded-2xl border border-zinc-100 shadow-sm overflow-x-auto no-scrollbar w-full lg:w-auto">
            <UnitPill label="ALL" active={filterUnit === 'ALL'} onClick={() => { setFilterUnit('ALL'); setCurrentPage(1); }} icon={LayoutGrid} />
            <UnitPill label="LOUNGE" active={filterUnit === 'LOUNGE'} onClick={() => { setFilterUnit('LOUNGE'); setCurrentPage(1); }} icon={Coffee} />
            <UnitPill label="STORE" active={filterUnit === 'STORE'} onClick={() => { setFilterUnit('STORE'); setCurrentPage(1); }} icon={ShoppingBag} />
            <UnitPill label="CARWASH" active={filterUnit === 'CARWASH'} onClick={() => { setFilterUnit('CARWASH'); setCurrentPage(1); }} icon={Car} />
         </div>
         <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2 w-full lg:w-auto">
            <div className="flex gap-1.5 p-1.5 bg-white rounded-xl border border-zinc-100 shadow-sm overflow-x-auto no-scrollbar">
              {(['TODAY', 'YESTERDAY', 'THIS_WEEK', 'THIS_MONTH', 'ALL_TIME'] as DatePreset[]).map(p => (
                <DatePill key={p} label={p.replace('_', ' ')} active={datePreset === p} onClick={() => { setDatePreset(p); setDateFrom(''); setDateTo(''); setCurrentPage(1); }} />
              ))}
            </div>
            <div className="flex items-center gap-2 p-2 bg-white rounded-xl border border-zinc-100 shadow-sm">
              <div className="min-w-0 flex-1">
                <Label htmlFor="sales-date-from" className="block text-[8px] font-bold uppercase tracking-wider text-zinc-400 mb-1">From</Label>
                <Input id="sales-date-from" type="date" value={dateFrom} max={dateTo || undefined} onChange={e => { setDateFrom(e.target.value); setDatePreset('CUSTOM'); setCurrentPage(1); }} className="h-9 min-w-0 border-zinc-100 bg-zinc-50 text-xs" />
              </div>
              <div className="min-w-0 flex-1">
                <Label htmlFor="sales-date-to" className="block text-[8px] font-bold uppercase tracking-wider text-zinc-400 mb-1">To</Label>
                <Input id="sales-date-to" type="date" value={dateTo} min={dateFrom || undefined} onChange={e => { setDateTo(e.target.value); setDatePreset('CUSTOM'); setCurrentPage(1); }} className="h-9 min-w-0 border-zinc-100 bg-zinc-50 text-xs" />
              </div>
              {(dateFrom || dateTo) && <Button type="button" variant="ghost" onClick={() => { setDateFrom(''); setDateTo(''); setDatePreset('ALL_TIME'); setCurrentPage(1); }} className="mt-4 h-9 px-2 text-[9px] font-bold uppercase text-zinc-500">Clear</Button>}
            </div>
         </div>
      </div>

      <Card className="border-none shadow-mobile rounded-[2.5rem] overflow-hidden bg-white border border-zinc-100">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-8 border-b border-zinc-50">
           <div className="flex gap-8">
              <button onClick={() => { setActiveTab('audit'); setCurrentPage(1); }} className={cn("py-6 text-[10px] font-black uppercase tracking-widest border-b-4 transition-all", activeTab === 'audit' ? "text-zinc-900 border-zinc-900" : "text-zinc-300 border-transparent")}>Transaction History</button>
              <button onClick={() => { setActiveTab('clearance'); setCurrentPage(1); }} className={cn("py-6 text-[10px] font-black uppercase tracking-widest border-b-4 transition-all", activeTab === 'clearance' ? "text-zinc-900 border-zinc-900" : "text-zinc-300 border-transparent")}>Active Backlog</button>
           </div>
           
           <div className="flex items-center gap-4 py-4 sm:py-0">
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-300" />
                <Input 
                  placeholder="Filter records..." 
                  value={searchTerm} 
                  onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                  className="h-10 pl-10 bg-zinc-50 border-none rounded-xl text-[10px] font-bold"
                />
              </div>
              {activeTab === 'clearance' && isAdmin && (
                <div className="flex items-center gap-2">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-400 whitespace-nowrap">{selectedOrderIds.length} selected</span>
                  <Button
                    onClick={handlePurgeSelected}
                    disabled={isProcessing || selectedOrderIds.length === 0}
                    className="h-10 px-4 bg-red-600 hover:bg-red-700 text-white font-black uppercase text-[9px] tracking-widest rounded-xl gap-2 transition-all active:scale-95"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Purge selected
                  </Button>
                </div>
              )}
           </div>
        </div>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-zinc-50/50">
              <TableRow className="border-zinc-100">
                {activeTab === 'clearance' && isAdmin && (
                  <TableHead className="pl-5 h-16">
                    <input
                      type="checkbox"
                      aria-label="Select all filtered pending records"
                      checked={allFilteredSelected}
                      onChange={(event) => setSelectedOrderIds(event.target.checked ? selectableFilteredOrders.map(order => order.id!) : [])}
                      className="h-4 w-4 accent-red-600"
                    />
                  </TableHead>
                )}
                <TableHead className="pl-4 h-16 text-[10px] uppercase font-black text-zinc-400">Order Context</TableHead>
                <TableHead className="h-16 text-[10px] uppercase font-black text-zinc-400 text-center">Unit</TableHead>
                <TableHead className="h-16 text-[10px] uppercase font-black text-zinc-400 text-right">Revenue</TableHead>
                <TableHead className="h-16 text-[10px] uppercase font-black text-zinc-400 text-center">Status</TableHead>
                <TableHead className="pr-8 h-16 text-[10px] uppercase font-black text-zinc-400 text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedOrders.map((order) => (
                <TableRow key={order.id} className="border-zinc-50 hover:bg-zinc-50/50 transition-colors">
                  {activeTab === 'clearance' && isAdmin && (
                    <TableCell className="pl-5 py-5">
                      <input
                        type="checkbox"
                        aria-label={`Select pending order ${order.id}`}
                        checked={selectedOrderIds.includes(order.id!)}
                        onChange={(event) => setSelectedOrderIds(current => event.target.checked ? [...current, order.id!] : current.filter(id => id !== order.id))}
                        className="h-4 w-4 accent-red-600"
                      />
                    </TableCell>
                  )}
                  <TableCell className="pl-4 py-5">
                    <div>
                      <p className="text-xs font-black uppercase text-zinc-900">UAX-{order.id?.slice(-8).toUpperCase()}</p>
                      <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest mt-1">By {order.cashierName || 'Staff'} • {new Date(order.timestamp).toLocaleString()}</p>
                    </div>
                  </TableCell>
                  <TableCell className="text-center"><Badge variant="outline" className="text-[7px] font-black uppercase border-zinc-100">{order.type}</Badge></TableCell>
                  <TableCell className="text-right font-black">KES {order.total.toLocaleString()}</TableCell>
                  <TableCell className="text-center">
                    <Badge className={cn("text-[8px] font-black uppercase px-3 h-5 border-none", order.status === 'PAID' ? "bg-green-50 text-green-600" : "bg-amber-50 text-amber-600")}>{order.status}</Badge>
                  </TableCell>
                  <TableCell className="pr-8 text-right">
                    <div className="flex items-center justify-end gap-2">
                       <Button onClick={() => { setSelectedOrder(order); setIsPreviewOpen(true); }} variant="ghost" size="sm" className="h-9 px-4 rounded-xl text-[9px] font-black uppercase border border-zinc-100 bg-white">View</Button>
                       {activeTab === 'clearance' && isAdmin && (
                         <Button 
                           onClick={() => handleClearOrder(order)} 
                           disabled={isProcessing}
                           variant="ghost" 
                           size="icon" 
                           className="h-9 w-9 rounded-xl text-zinc-200 hover:text-red-500 hover:bg-red-50 transition-all"
                         >
                           <Trash2 className="w-4 h-4" />
                         </Button>
                       )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filteredOrders.length === 0 && (
                <TableRow><TableCell colSpan={activeTab === 'clearance' && isAdmin ? 6 : 5} className="py-20 text-center opacity-30 text-[10px] font-black uppercase">No records matching filters</TableCell></TableRow>
              )}
            </TableBody>
          </Table>

          {totalPages > 1 && (
            <div className="flex items-center justify-between px-8 py-4 bg-white border-t border-zinc-50">
               <p className="text-[10px] font-black uppercase text-zinc-400">Page {currentPage} of {totalPages}</p>
               <div className="flex gap-2">
                 <Button variant="outline" size="sm" disabled={currentPage === 1} onClick={() => setCurrentPage(p => Math.max(1, p - 1))} className="h-9 rounded-xl"><ChevronLeft className="w-4 h-4 mr-1" /> Prev</Button>
                 <Button variant="outline" size="sm" disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} className="h-9 rounded-xl">Next <ChevronRight className="w-4 h-4 ml-1" /></Button>
               </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="sm:max-w-md p-0 border-none bg-transparent shadow-none">
          <ReceiptPreview data={selectedOrder} onClose={() => setIsPreviewOpen(false)} className="w-full" />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function KPIBox({ title, value, sub, icon: Icon, color = "text-zinc-900" }: any) {
  return (
    <Card className="border-none shadow-sm rounded-[2rem] bg-white p-8 border border-zinc-100">
       <div className="flex items-center gap-3 mb-3">
          <Icon className={cn("w-5 h-5", color)} />
          <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">{title}</p>
       </div>
       <h3 className={cn("text-3xl font-black font-headline leading-none", color)}>{value}</h3>
       <p className="text-[8px] font-bold text-zinc-300 uppercase tracking-widest mt-2">{sub}</p>
    </Card>
  );
}

function UnitPill({ label, active, onClick, icon: Icon }: any) {
  return (
    <button onClick={onClick} className={cn("h-11 px-6 rounded-xl flex items-center gap-2.5 transition-all text-[9px] font-black uppercase tracking-widest", active ? "bg-zinc-900 text-white" : "bg-transparent text-zinc-400 hover:text-zinc-900")}>
       <Icon className={cn("w-3.5 h-3.5", active ? "text-primary" : "text-zinc-200")} />
       {label}
    </button>
  );
}

function DatePill({ label, active, onClick }: any) {
  return (
    <button onClick={onClick} className={cn("h-11 px-6 rounded-xl transition-all text-[9px] font-black uppercase tracking-widest", active ? "bg-zinc-900 text-white" : "bg-transparent text-zinc-400 hover:text-zinc-900")}>
       {label}
    </button>
  );
}
