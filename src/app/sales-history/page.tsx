'use client';

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
  Terminal,
  AlertTriangle
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

type DatePreset = 'TODAY' | 'YESTERDAY' | 'THIS_WEEK' | 'THIS_MONTH' | 'ALL_TIME';

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

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 12;

  // Preview State
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted) {
      localStorage.setItem('uax_sales_active_tab', activeTab);
      localStorage.setItem('uax_sales_filter_unit', filterUnit);
      localStorage.setItem('uax_sales_date_preset', datePreset);
    }
  }, [activeTab, filterUnit, datePreset, mounted]);

  const ordersQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'orders'), orderBy('timestamp', 'desc'), limit(1000));
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

      const startOfToday = new Date().setHours(0, 0, 0, 0);
      if (datePreset === 'TODAY') return o.timestamp >= startOfToday;
      if (datePreset === 'YESTERDAY') {
        const startOfYest = startOfToday - (24 * 60 * 60 * 1000);
        return o.timestamp >= startOfYest && o.timestamp < startOfToday;
      }
      if (datePreset === 'THIS_WEEK') return o.timestamp >= (startOfToday - (new Date().getDay() * 24 * 60 * 60 * 1000));
      if (datePreset === 'THIS_MONTH') return o.timestamp >= new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime();

      return true;
    });
  }, [orders, searchTerm, filterUnit, datePreset, isSuperAdmin, role, profile, activeTab, isAdmin]);

  // Pagination Logic
  const totalPages = Math.ceil(filteredOrders.length / itemsPerPage);
  const paginatedOrders = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredOrders.slice(start, start + itemsPerPage);
  }, [filteredOrders, currentPage]);

  const stats = useMemo(() => {
    const paid = (orders || []).filter(o => o.status === 'PAID');
    const pending = (orders || []).filter(o => o.status === 'PENDING');
    const volume = paid.reduce((sum, o) => sum + o.total, 0);
    const pendingVolume = pending.reduce((sum, o) => sum + o.total, 0);
    return { volume, paidCount: paid.length, pendingVolume, pendingCount: pending.length };
  }, [orders]);

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

  const handleClearAllFiltered = async () => {
    if (!firestore || !profile || !isAdmin || filteredOrders.length === 0) return;
    if (!confirm(`CAUTION: Permanently delete ALL ${filteredOrders.length} currently filtered held bills? This action cannot be reversed.`)) return;

    setIsProcessing(true);
    try {
      const batch = writeBatch(firestore);
      filteredOrders.forEach(order => {
        batch.delete(doc(firestore, 'orders', order.id!));
        if (order.cashierId) {
          batch.delete(doc(firestore, 'users', order.cashierId, 'held_bills', order.id!));
        }
      });
      const auditRef = doc(collection(firestore, 'audit_logs'));
      batch.set(auditRef, {
        action: 'ADMIN_MASS_CLEAR_BACKLOG',
        userId: profile.uid,
        details: `Admin performed mass purge of ${filteredOrders.length} held bills from the backlog.`,
        timestamp: Date.now(),
        severity: 'CRITICAL'
      });
      await batch.commit();
      toast({ title: "Backlog Cleared", description: `${filteredOrders.length} records purged.` });
      setCurrentPage(1);
    } catch (err) {
      toast({ variant: "destructive", title: "Mass Clear Failed" });
    } finally {
      setIsProcessing(false);
    }
  };

  if (!mounted) return null;

  return (
    <div className="space-y-6 pb-20 max-w-[1600px] mx-auto pt-4 px-2">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black font-headline text-zinc-900 uppercase tracking-tighter leading-none">Sales History</h1>
          <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mt-1">Authorized transaction logs and clearance</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
         <div className="flex gap-2 p-1.5 bg-white rounded-2xl border border-zinc-100 shadow-sm overflow-x-auto no-scrollbar w-full lg:w-auto">
            {['TODAY', 'YESTERDAY', 'THIS_WEEK', 'ALL_TIME'].map(p => (
              <DatePill key={p} label={p.replace('_', ' ')} active={datePreset === p} onClick={() => { setDatePreset(p as any); setCurrentPage(1); }} />
            ))}
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
                <Button 
                  onClick={handleClearAllFiltered}
                  disabled={isProcessing || filteredOrders.length === 0}
                  className="h-10 px-4 bg-red-500 hover:bg-red-600 text-white font-black uppercase text-[9px] tracking-widest rounded-xl shadow-lg shadow-red-100 gap-2 transition-all active:scale-95"
                >
                  <AlertTriangle className="w-3.5 h-3.5" /> Purge All
                </Button>
              )}
           </div>
        </div>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-zinc-50/50">
              <TableRow className="border-zinc-100">
                <TableHead className="pl-8 h-16 text-[10px] uppercase font-black text-zinc-400">Order Context</TableHead>
                <TableHead className="h-16 text-[10px] uppercase font-black text-zinc-400 text-center">Unit</TableHead>
                <TableHead className="h-16 text-[10px] uppercase font-black text-zinc-400 text-right">Revenue</TableHead>
                <TableHead className="h-16 text-[10px] uppercase font-black text-zinc-400 text-center">Status</TableHead>
                <TableHead className="pr-8 h-16 text-[10px] uppercase font-black text-zinc-400 text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedOrders.map((order) => (
                <TableRow key={order.id} className="border-zinc-50 hover:bg-zinc-50/50 transition-colors">
                  <TableCell className="pl-8 py-5">
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
                <TableRow><TableCell colSpan={5} className="py-20 text-center opacity-30 text-[10px] font-black uppercase">No records matching filters</TableCell></TableRow>
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
