'use client';
import { useManagementRead } from '@/hooks/use-management-read';

import { useStaffInventory } from '@/hooks/use-staff-inventory';
import { usePosReads } from '@/hooks/use-pos-reads';
import { PosReadNotice } from '@/components/pos/read-notice';

import React, { useMemo, useState, useEffect } from 'react';
import { 
  TrendingUp,
  ShoppingBag,
  Coffee,
  Car,
  Trophy,
  Clock,
  BarChart3,
  Activity,
  ShieldAlert,
  Boxes,
  Users,
  ArrowUpRight,
  Fingerprint,
  Terminal,
  Layers,
  FileText,
  ExternalLink,
  RefreshCcw,
  FileDown,
  ShieldCheck,
  Bot,
  User,
  CalendarDays,
  Filter,
  DollarSign,
  Percent,
  Printer,
  Receipt,
  ChevronRight,
  CheckCircle2,
  Download,
  AlertCircle,
  Network,
  CreditCard
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer,
  CartesianGrid,
  BarChart,
  Bar,
  Cell
} from 'recharts';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, limit, where } from 'firebase/firestore';
import { Order, Product, POSTerminal } from '@/lib/types';
import { useProfile } from '@/hooks/use-profile';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from '@/hooks/use-toast';
import { AIBriefing } from '@/components/intelligence/ai-briefing';
import { ShiftReportDialog } from '@/components/pos/shift-report-dialog';
import { generateShiftReportTxt, downloadTxtFile } from '@/lib/shift-report-utils';

const COLOR_MAP: Record<string, string> = {
  'WHITE': '#ffffff',
  'SILVER': '#cbd5e1',
  'GRAY': '#64748b',
  'GREY': '#64748b',
  'BLACK': '#18181b',
  'BLUE': '#2563eb',
  'RED': '#dc2626',
  'BURGUNDY': '#881337',
  'NAVY': '#1e3a8a',
  'GREEN': '#16a34a',
  'GOLD': '#eab308',
  'BEIGE': '#d4d4d8',
  'BROWN': '#78350f',
  'YELLOW': '#facc15',
  'ORANGE': '#ea580c',
  'OTHER': '#a1a1aa'
};

type DatePreset = 'TODAY' | 'YESTERDAY' | 'LAST_7_DAYS' | 'LAST_30_DAYS' | 'ALL_TIME';

export default function DashboardPage() {
  const { role, profile, isSuperAdmin, isEmployee, loading: profileLoading } = useProfile();
  const router = useRouter();
  const firestore = useFirestore();
  const [mounted, setMounted] = useState(false);
  const [isShiftReportOpen, setIsShiftReportOpen] = useState(false);
  const [shiftReportType, setShiftReportType] = useState<'X' | 'Z'>('X');
  
  const isAdmin = isSuperAdmin || role === 'ADMIN' || role === 'MANAGER' || role === 'SUPERVISOR';

  // Persistent Date Filter
  const [dateFilter, setDateFilter] = useState<DatePreset>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('uax_dashboard_filter') as DatePreset) || 'TODAY';
    }
    return 'TODAY';
  });

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted) {
      localStorage.setItem('uax_dashboard_filter', dateFilter);
    }
  }, [dateFilter, mounted]);

  const timeThreshold = useMemo(() => {
    const startOfToday = new Date().setHours(0, 0, 0, 0);
    
    switch (dateFilter) {
      case 'TODAY': return startOfToday;
      case 'YESTERDAY': return startOfToday - (24 * 60 * 60 * 1000);
      case 'LAST_7_DAYS': return startOfToday - (7 * 24 * 60 * 60 * 1000);
      case 'LAST_30_DAYS': return startOfToday - (30 * 24 * 60 * 60 * 1000);
      default: return 0;
    }
  }, [dateFilter]);

  // Security Gate: Only initiate global queries once the role is resolved as staff/admin

  // Held Bills Query: Private scratchpad for individual cashier pending bills

  const allOrdersRead = useManagementRead<Order>(isAdmin ? 'history' : 'own-orders');
  const { data: allOrders } = allOrdersRead;
  const inventoryRead = useStaffInventory(0);
  const inventory = inventoryRead.data;
  const terminalsRead = useManagementRead<POSTerminal>('terminals');
  const { data: terminals } = terminalsRead;
  const tabRead = usePosReads<Order>('own-tabs', '', mounted && !profileLoading && !!profile?.uid && !isAdmin);
  const rawHeldBills = tabRead.data;

  const myHeldBills = useMemo(() => {
    if (!rawHeldBills) return [];
    return [...rawHeldBills].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
  }, [rawHeldBills]);

  const pendingTotal = useMemo(() => {
    return myHeldBills.reduce((sum, b) => sum + (b.total || 0), 0);
  }, [myHeldBills]);

  // Global backlog volume for Admin
  const globalBacklog = useMemo(() => {
    if (!allOrders || !isAdmin) return { count: 0, volume: 0, items: [] };
    const pending = allOrders.filter(o => o.status === 'PENDING').slice(0, 10);
    const volume = allOrders.filter(o => o.status === 'PENDING').reduce((s, o) => s + (o.total || 0), 0);
    return { count: allOrders.filter(o => o.status === 'PENDING').length, volume, items: pending };
  }, [allOrders, isAdmin]);

  const stats = useMemo(() => {
    const canSeeAll = isSuperAdmin || role === 'ADMIN' || role === 'MANAGER';
    const startOfToday = new Date().setHours(0, 0, 0, 0);
    
    const baseOrders = allOrders?.filter(o => {
      const isInRange = o.timestamp >= timeThreshold;
      const isPaid = o.status === 'PAID';
      
      if (dateFilter === 'YESTERDAY' && o.timestamp >= startOfToday) return false;
      if (!isInRange || !isPaid) return false;
      if (canSeeAll) return true;
      
      return o.cashierId === profile?.uid;
    }) || [];
    
    const loungeSales = baseOrders.filter(o => o.type === 'LOUNGE').reduce((sum, o) => sum + o.total, 0);
    const storeSales = baseOrders.filter(o => o.type === 'STORE').reduce((sum, o) => sum + o.total, 0);
    const carwashSales = baseOrders.filter(o => o.type === 'CARWASH').reduce((sum, o) => sum + o.total, 0);
    const totalSales = loungeSales + storeSales + carwashSales;

    const departmentalData = [
      { name: 'Lounge', value: loungeSales, color: 'hsl(35, 91%, 50%)' },
      { name: 'Store', value: storeSales, color: 'hsl(240, 5%, 10%)' },
      { name: 'Carwash', value: carwashSales, color: 'hsl(25, 100%, 50%)' },
    ];

    let velocityData = [];
    if (dateFilter === 'TODAY' || dateFilter === 'YESTERDAY') {
      const hours = ['08:00', '10:00', '12:00', '14:00', '16:00', '18:00', '20:00'];
      velocityData = hours.map(h => ({ name: h, total: 0 }));
      baseOrders.forEach(o => {
        const hour = new Date(o.timestamp).getHours();
        const timeSlot = velocityData.find(d => parseInt(d.name) <= hour && parseInt(d.name) + 2 > hour);
        if (timeSlot) timeSlot.total += o.total;
      });
    } else {
      const days: Record<string, number> = {};
      baseOrders.forEach(o => {
        const dayStr = new Date(o.timestamp).toLocaleDateString('en-KE', { day: '2-digit', month: 'short' });
        days[dayStr] = (days[dayStr] || 0) + o.total;
      });
      velocityData = Object.entries(days).map(([name, total]) => ({ name, total })).reverse();
    }

    const lowStockItems = inventory?.filter(i => i.unit !== 'CARWASH' && (i.stockLevel || 0) <= (i.minStock || 0)) || [];
    const activeNodes = terminals?.filter(t => t.status === 'OPEN').length || 0;

    const productCounts: Record<string, { name: string, count: number }> = {};
    baseOrders.forEach(o => {
      o.items?.forEach(item => {
        if (!productCounts[item.productId]) productCounts[item.productId] = { name: item.name, count: 0 };
        productCounts[item.productId].count += item.quantity;
      });
    });
    const topProducts = Object.values(productCounts)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const cashierLeaderboard: Record<string, { name: string, volume: number }> = {};
    baseOrders.forEach(o => {
      const cid = o.cashierId || 'System';
      if (!cashierLeaderboard[cid]) cashierLeaderboard[cid] = { name: o.cashierName || 'Staff', volume: 0 };
      cashierLeaderboard[cid].volume += o.total;
    });
    
    const topCashier = Object.values(cashierLeaderboard)
      .sort((a, b) => b.volume - a.volume)[0];

    // Services vs Products comparison metrics
    let serviceVolume = 0;
    let serviceCount = 0;
    let productVolume = 0;
    let productCount = 0;

    baseOrders.forEach(o => {
      const itemsCount = o.items?.reduce((s, it) => s + (it.quantity || 1), 0) || 1;
      if (o.type === 'CARWASH') {
        serviceVolume += (o.total || 0);
        serviceCount += itemsCount;
      } else {
        productVolume += (o.total || 0);
        productCount += itemsCount;
      }
    });

    const servicesVsProducts = [
      { name: 'Services (Carwash)', value: serviceVolume, count: serviceCount, color: 'hsl(25, 100%, 50%)' },
      { name: 'Products (Store & F&B)', value: productVolume, count: productCount, color: 'hsl(240, 5%, 26%)' }
    ];

    const departmentalComparison = [
      { name: 'Carwash Services', value: carwashSales, count: baseOrders.filter(o => o.type === 'CARWASH').length, color: 'hsl(25, 100%, 50%)' },
      { name: 'Retail Store', value: storeSales, count: baseOrders.filter(o => o.type === 'STORE').length, color: 'hsl(240, 5%, 15%)' },
      { name: 'Lounge & Bar', value: loungeSales, count: baseOrders.filter(o => o.type === 'LOUNGE').length, color: 'hsl(38, 92%, 50%)' }
    ];

    const itemSalesMap: Record<string, { name: string; value: number; count: number; isService: boolean }> = {};
    baseOrders.forEach(o => {
      const isService = o.type === 'CARWASH';
      o.items?.forEach(it => {
        const key = it.name.trim();
        if (!itemSalesMap[key]) {
          itemSalesMap[key] = { name: key, value: 0, count: 0, isService };
        }
        itemSalesMap[key].value += (it.price || 0) * (it.quantity || 1);
        itemSalesMap[key].count += (it.quantity || 1);
      });
    });

    const PIE_COLORS = [
      'hsl(25, 100%, 50%)',
      'hsl(217, 91%, 60%)',
      'hsl(38, 92%, 50%)',
      'hsl(142, 71%, 45%)',
      'hsl(262, 83%, 58%)',
      'hsl(240, 5%, 35%)'
    ];

    const topSoldComparison = Object.values(itemSalesMap)
      .sort((a, b) => b.value - a.value)
      .slice(0, 5)
      .map((it, idx) => ({
        name: it.name,
        value: it.value,
        count: it.count,
        color: PIE_COLORS[idx % PIE_COLORS.length]
      }));

    return {
      loungeSales,
      storeSales,
      carwashSales,
      totalSales,
      velocityData,
      departmentalData,
      topProducts,
      topCashier,
      lowStockItems,
      activeNodes,
      orderCount: baseOrders.length,
      isPersonalView: !canSeeAll,
      baseOrders,
      servicesVsProducts,
      departmentalComparison,
      topSoldComparison
    };
  }, [allOrders, timeThreshold, inventory, terminals, role, profile, isSuperAdmin, dateFilter]);

  const handleOpenShiftReport = (type: 'X' | 'Z') => {
    setShiftReportType(type);
    setIsShiftReportOpen(true);
  };

  const handleQuickDownload = (type: 'X' | 'Z') => {
    const reportText = generateShiftReportTxt({
      type,
      cashierName: profile?.displayName || 'Cashier',
      cashierId: profile?.uid || 'STAFF',
      periodLabel: dateFilter.replace(/_/g, ' '),
      orders: stats.baseOrders || [],
      heldBills: myHeldBills,
      stats: {
        loungeSales: stats.loungeSales,
        storeSales: stats.storeSales,
        carwashSales: stats.carwashSales,
        totalSales: stats.totalSales
      }
    });

    downloadTxtFile(reportText, 'download.txt');
    toast({
      title: `Shift ${type}-Report Downloaded`,
      description: `Saved as download.txt (${(stats.baseOrders || []).length} receipts itemized)`
    });
  };

  const handleResumeBill = (bill: Order) => {
    if (bill.type === 'CARWASH') {
      router.push('/carwash/pos');
    } else if (bill.type === 'LOUNGE') {
      router.push('/lounge');
    } else if (bill.type === 'STORE') {
      router.push('/store');
    } else {
      router.push('/pos');
    }
    toast({
      title: "Opening POS Module",
      description: `Resuming ticket #${bill.id?.slice(0, 8).toUpperCase() || ''}`
    });
  };

  if (!mounted) return null;

  return (
    <div className="space-y-6 pb-12 max-w-[1600px] mx-auto px-1">
      <PosReadNotice label="Held tabs" error={tabRead.error} onRetry={tabRead.refresh} />
      <PosReadNotice label="allOrders" error={allOrdersRead.error} onRetry={allOrdersRead.refresh} />
      <PosReadNotice label="terminals" error={terminalsRead.error} onRetry={terminalsRead.refresh} />
      <PosReadNotice label="Inventory" error={inventoryRead.error?.code || null} onRetry={() => window.location.reload()} />
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 px-1 pt-2">
        <div>
          <h1 className="text-2xl md:text-4xl font-black font-headline text-zinc-900 uppercase tracking-tighter leading-none">
            My Node
          </h1>
          <p className="text-[10px] md:text-xs text-zinc-500 font-black uppercase tracking-widest mt-2">
            {stats.isPersonalView ? 'Personal Shift Summary' : 'Global Network Overview'} • {profile?.displayName}
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-center gap-3">
           <div className="flex gap-1.5 bg-white p-1.5 rounded-xl border border-zinc-100 shadow-sm overflow-x-auto no-scrollbar w-full sm:w-auto">
              {[
                { id: 'TODAY', label: 'Today' },
                { id: 'YESTERDAY', label: 'Yesterday' },
                { id: 'LAST_7_DAYS', label: '7 Days' },
                { id: 'LAST_30_DAYS', label: '30 Days' },
                { id: 'ALL_TIME', label: 'All' },
              ].map((p) => (
                <Button 
                  key={p.id}
                  onClick={() => setDateFilter(p.id as DatePreset)}
                  className={cn(
                    "h-9 px-4 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all",
                    dateFilter === p.id ? "bg-zinc-900 text-white shadow-lg" : "bg-transparent text-zinc-400 hover:text-zinc-900"
                  )}
                >
                  {p.label}
                </Button>
              ))}
           </div>
           <Badge variant="outline" className="h-10 px-4 gap-2 font-black uppercase text-[9px] tracking-widest shadow-sm rounded-xl bg-white border-zinc-100">
             <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
             {stats.activeNodes} Active Stations
           </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
         <AIBriefing 
           sales={stats.totalSales} 
           lowStock={stats.lowStockItems.length} 
           orderCount={stats.orderCount}
           userName={profile?.displayName}
           comparisonData={{
             byType: stats.servicesVsProducts,
             byDepartment: stats.departmentalComparison,
             topItems: stats.topSoldComparison
           }}
           className="lg:col-span-4"
         />

         <Card className="lg:col-span-8 border-none shadow-mobile rounded-[2.5rem] bg-white overflow-hidden border border-zinc-100">
            <CardHeader className="p-8 border-b border-zinc-50 flex flex-row items-center justify-between">
               <div>
                  <CardTitle className="text-[11px] font-black uppercase tracking-[0.2em] text-zinc-900">
                    {stats.isPersonalView ? 'My Shift Yield' : 'Revenue Distribution'}
                  </CardTitle>
                  <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest mt-1">
                    Volume for {dateFilter.replace(/_/g, ' ')}
                  </p>
               </div>
               {stats.isPersonalView && (
                  <div className="flex items-center gap-2">
                     <Badge variant="outline" className={cn(
                       "font-black uppercase text-[8px] tracking-widest px-3 py-1 rounded-xl border",
                       myHeldBills.length > 0 ? "border-amber-300 text-amber-800 bg-amber-50" : "border-emerald-200 text-emerald-700 bg-emerald-50"
                     )}>
                       {myHeldBills.length} Pending {myHeldBills.length === 1 ? 'Bill' : 'Bills'}
                     </Badge>
                  </div>
               )}
            </CardHeader>
            <CardContent className="p-0">
               {!stats.isPersonalView ? (
                  <div className="flex flex-col">
                     <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-zinc-50 border-b border-zinc-50">
                        <KPIInternalCell title="Lounge & Bar" value={`KES ${stats.loungeSales.toLocaleString()}`} color="text-amber-600" />
                        <KPIInternalCell title="Retail Store" value={`KES ${stats.storeSales.toLocaleString()}`} color="text-zinc-900" />
                        <KPIInternalCell title="Carwash" value={`KES ${stats.carwashSales.toLocaleString()}`} color="text-primary" />
                        <KPIInternalCell 
                          title="Period Top Staff" 
                          value={stats.topCashier?.name || '---'} 
                          color="text-blue-600" 
                          sub={`KES ${stats.topCashier?.volume.toLocaleString() || '0'}`}
                        />
                     </div>

                     <div className="p-8 space-y-6 bg-zinc-50/20">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                           <div>
                              <div className="flex items-center gap-2">
                                 <h4 className="text-[11px] font-black uppercase tracking-[0.2em] text-zinc-900">
                                    Global Network Registry
                                 </h4>
                                 <Badge className="bg-emerald-50 text-emerald-700 border-none text-[8px] font-black uppercase h-5">Live Sales</Badge>
                              </div>
                              <p className="text-[8px] font-bold text-zinc-400 uppercase tracking-widest mt-0.5">
                                 Latest itemized transactions synchronized across all operational nodes.
                              </p>
                           </div>

                           <div className="flex items-center gap-4">
                              <div className="text-right">
                                 <p className="text-[8px] font-black text-zinc-400 uppercase tracking-widest">Global Backlog</p>
                                 <p className="text-xs font-black text-primary">KES {globalBacklog.volume.toLocaleString()}</p>
                              </div>
                              <div className="w-10 h-10 rounded-xl bg-zinc-900 text-white flex items-center justify-center shadow-lg">
                                 <Network className="w-5 h-5 text-primary" />
                              </div>
                           </div>
                        </div>

                        <div className="rounded-[1.5rem] border border-zinc-100 bg-white overflow-hidden shadow-xs">
                           <Table>
                              <TableHeader className="bg-zinc-50/50">
                                 <TableRow className="hover:bg-transparent border-zinc-100">
                                    <TableHead className="pl-6 h-12 text-[9px] uppercase font-black tracking-widest text-zinc-400">Order Ref</TableHead>
                                    <TableHead className="h-12 text-[9px] uppercase font-black tracking-widest text-zinc-400">Station</TableHead>
                                    <TableHead className="h-12 text-[9px] uppercase font-black tracking-widest text-zinc-400">Operator</TableHead>
                                    <TableHead className="h-12 text-[9px] uppercase font-black tracking-widest text-zinc-400 text-right">Revenue</TableHead>
                                    <TableHead className="pr-6 h-12 text-[9px] uppercase font-black tracking-widest text-zinc-400 text-right">Sync</TableHead>
                                 </TableRow>
                              </TableHeader>
                              <TableBody>
                                 {stats.baseOrders.slice(0, 5).map((order) => (
                                    <TableRow key={order.id} className="border-zinc-50 hover:bg-zinc-50/50 transition-colors">
                                       <TableCell className="pl-6 py-3.5">
                                          <div className="flex items-center gap-3">
                                             <div className={cn(
                                               "w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border border-zinc-100",
                                               order.type === 'LOUNGE' ? "bg-amber-50 text-amber-600" :
                                               order.type === 'CARWASH' ? "bg-orange-50 text-orange-600" :
                                               "bg-zinc-100 text-zinc-600"
                                             )}>
                                                {order.type === 'LOUNGE' ? <Coffee className="w-3.5 h-3.5" /> :
                                                 order.type === 'CARWASH' ? <Car className="w-3.5 h-3.5" /> :
                                                 <ShoppingBag className="w-3.5 h-3.5" />}
                                             </div>
                                             <span className="text-xs font-black text-zinc-900 font-mono tracking-tight uppercase">#{order.id?.slice(-6)}</span>
                                          </div>
                                       </TableCell>
                                       <TableCell><Badge variant="outline" className="text-[7px] font-black uppercase border-zinc-100 bg-white">{order.type}</Badge></TableCell>
                                       <TableCell className="text-[10px] font-bold text-zinc-500 uppercase">{order.cashierName?.split(' ')[0]}</TableCell>
                                       <TableCell className="text-right font-black text-zinc-900 text-xs">KES {order.total.toLocaleString()}</TableCell>
                                       <TableCell className="pr-6 text-right">
                                          <div className="flex items-center justify-end gap-1.5">
                                             <span className="text-[8px] font-bold text-zinc-300 uppercase">{new Date(order.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                             <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                                          </div>
                                       </TableCell>
                                    </TableRow>
                                 ))}
                                 {stats.baseOrders.length === 0 && (
                                    <TableRow>
                                       <TableCell colSpan={5} className="py-12 text-center opacity-30">
                                          <p className="text-[10px] font-black uppercase tracking-widest">Waiting for incoming sales node...</p>
                                       </TableCell>
                                    </TableRow>
                                 )}
                              </TableBody>
                           </Table>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                           <div className="p-6 bg-white border border-zinc-100 rounded-3xl flex items-center justify-between group hover:border-primary/20 transition-all shadow-xs">
                              <div className="flex items-center gap-4">
                                 <div className="w-10 h-10 rounded-xl bg-primary/5 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                                    <Clock className="w-5 h-5" />
                                 </div>
                                 <div>
                                    <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">Station Backlog</p>
                                    <h5 className="text-lg font-black text-zinc-900 tracking-tighter">{globalBacklog.count} Active Bills</h5>
                                 </div>
                              </div>
                              <Button asChild variant="ghost" className="h-10 px-4 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-zinc-50">
                                 <Link href="/sales-history">Review Ledger <ChevronRight className="w-3 h-3 ml-1.5" /></Link>
                              </Button>
                           </div>

                           <div className="p-6 bg-white border border-zinc-100 rounded-3xl flex items-center justify-between group hover:border-blue-200 transition-all shadow-xs">
                              <div className="flex items-center gap-4">
                                 <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 group-hover:scale-110 transition-transform">
                                    <CreditCard className="w-5 h-5" />
                                 </div>
                                 <div>
                                    <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">Unsettled Volume</p>
                                    <h5 className="text-lg font-black text-zinc-900 tracking-tighter">KES {globalBacklog.volume.toLocaleString()}</h5>
                                 </div>
                              </div>
                              <Badge className="bg-blue-600 text-white border-none text-[8px] font-black uppercase px-3 h-5">Audit Ready</Badge>
                           </div>
                        </div>
                     </div>
                  </div>
               ) : (
                  <div className="grid grid-cols-1 lg:grid-cols-4 divide-y lg:divide-y-0 lg:divide-x divide-zinc-50">
                     <div className="lg:col-span-2 flex flex-col justify-between divide-y divide-zinc-50">
                        <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-zinc-50">
                           <KPIInternalCell title="Lounge & Bar" value={`KES ${stats.loungeSales.toLocaleString()}`} color="text-amber-600" />
                           <KPIInternalCell title="Retail Store" value={`KES ${stats.storeSales.toLocaleString()}`} color="text-zinc-900" />
                        </div>

                        <div className="p-4 sm:p-5 bg-zinc-50/70 flex flex-col sm:flex-row items-center justify-between gap-3">
                           <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-xl bg-zinc-900 text-white flex items-center justify-center shrink-0">
                                 <Printer className="w-4 h-4" />
                              </div>
                              <div>
                                 <span className="text-[9px] font-black uppercase tracking-widest text-zinc-900 block leading-tight">
                                    Print My Shift Report
                                 </span>
                                 <span className="text-[8px] font-bold uppercase tracking-wider text-zinc-400 block mt-0.5">
                                    Total Sales Audit • download.txt
                                 </span>
                              </div>
                           </div>

                           <div className="flex items-center gap-1.5 w-full sm:w-auto">
                              <Button
                                 onClick={() => handleOpenShiftReport('X')}
                                 size="sm"
                                 className="flex-1 sm:flex-none h-8 px-3.5 bg-zinc-900 hover:bg-zinc-800 text-white text-[9px] font-black uppercase tracking-widest rounded-xl shadow-xs"
                                 title="Mid-shift interim sales report"
                              >
                                 <FileText className="w-3 h-3 mr-1.5" />
                                 X-Report
                              </Button>
                              <Button
                                 onClick={() => handleOpenShiftReport('Z')}
                                 size="sm"
                                 variant="outline"
                                 className="flex-1 sm:flex-none h-8 px-3.5 bg-white border-zinc-200 text-zinc-900 hover:bg-zinc-100 text-[9px] font-black uppercase tracking-widest rounded-xl"
                                 title="End-of-shift closing audit"
                              >
                                 <FileDown className="w-3 h-3 mr-1.5" />
                                 Z-Report
                              </Button>
                              <Button
                                 onClick={() => handleQuickDownload('X')}
                                 size="sm"
                                 variant="ghost"
                                 className="h-8 px-2.5 text-zinc-600 hover:text-zinc-900 text-[8px] font-black uppercase tracking-wider"
                                 title="Download download.txt directly"
                              >
                                 <Download className="w-3 h-3 mr-1" />
                                 .txt
                              </Button>
                           </div>
                        </div>
                     </div>

                     <div className="flex flex-col justify-between">
                        <KPIInternalCell title="Carwash" value={`KES ${stats.carwashSales.toLocaleString()}`} color="text-primary" />
                     </div>

                     <div className="p-8 flex flex-col justify-between group hover:bg-zinc-50/50 transition-colors">
                        <div>
                           <div className="flex items-center justify-between mb-4">
                              <p className="text-[9px] font-black uppercase tracking-widest text-zinc-400">
                                 Session Identity
                              </p>
                              <Badge variant="outline" className="text-[7px] font-black uppercase border-green-200 text-green-700 bg-green-50 px-2 py-0.5">
                                 Active Shift
                              </Badge>
                           </div>

                           <h3 className="text-2xl font-black font-headline text-zinc-900 tracking-tighter leading-none mt-1 truncate">
                              {profile?.displayName || stats.topCashier?.name || 'Active Cashier'}
                           </h3>
                           <p className="text-[8px] font-bold uppercase tracking-widest mt-2 text-blue-600">
                              {profile?.role || 'Staff'} • KES {stats.totalSales.toLocaleString()}
                           </p>
                        </div>
                     </div>
                  </div>
               )}

                {/* Cashier Individual Pending Bills Container */}
                {stats.isPersonalView && (
                  <div className="border-t border-zinc-100 p-6 sm:p-8 bg-zinc-50/40">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-black uppercase tracking-[0.2em] text-zinc-900">
                            My Active Pending Bills
                          </h4>
                          <Badge variant="outline" className={cn(
                            "text-[8px] font-black uppercase px-2 py-0.5 rounded-lg border",
                            myHeldBills.length > 0 ? "border-amber-300 text-amber-800 bg-amber-50" : "border-zinc-200 text-zinc-500 bg-white"
                          )}>
                            {myHeldBills.length} {myHeldBills.length === 1 ? 'Bill' : 'Bills'} Held
                          </Badge>
                        </div>
                        <p className="text-[8px] font-bold text-zinc-400 uppercase tracking-widest mt-0.5">
                          {myHeldBills.length > 0 
                            ? `Total Unsettled Volume: KES ${pendingTotal.toLocaleString()} • Awaiting customer payment`
                            : 'All assigned customer orders and tickets are currently settled'}
                        </p>
                      </div>

                      {myHeldBills.length > 0 && (
                        <div className="flex items-center gap-2">
                          <span className="text-[8px] font-black uppercase text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-xl">
                            KES {pendingTotal.toLocaleString()} Pending
                          </span>
                        </div>
                      )}
                    </div>

                    {myHeldBills.length === 0 ? (
                      <div className="py-8 px-4 bg-white rounded-2xl border border-dashed border-zinc-200 text-center">
                        <CheckCircle2 className="w-5 h-5 text-emerald-500 mx-auto mb-1.5" />
                        <p className="text-[10px] font-black uppercase tracking-wider text-zinc-800">No Pending Bills</p>
                        <p className="text-[8px] font-bold text-zinc-400 uppercase tracking-widest mt-0.5">
                          You have no open tickets in your active session. All sales are complete.
                        </p>
                      </div>
                    ) : (
                      <div className="max-h-72 overflow-y-auto space-y-2.5 pr-1 no-scrollbar">
                        {myHeldBills.map((bill) => {
                          const colorHex = bill.vehicleColor ? (COLOR_MAP[bill.vehicleColor.toUpperCase()] || '#94a3b8') : null;
                          return (
                            <div
                              key={bill.id}
                              className="p-3.5 bg-white rounded-2xl border border-zinc-100 hover:border-zinc-200 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs"
                            >
                              <div className="flex items-start gap-3 min-w-0">
                                <div className={cn(
                                  "w-9 h-9 rounded-xl flex items-center justify-center shrink-0 font-black text-[10px] uppercase",
                                  bill.type === 'LOUNGE' ? "bg-amber-50 text-amber-700 border border-amber-200" :
                                  bill.type === 'CARWASH' ? "bg-orange-50 text-orange-700 border border-orange-200" :
                                  "bg-zinc-100 text-zinc-800 border border-zinc-200"
                                )}>
                                  {bill.type === 'LOUNGE' ? <Coffee className="w-4 h-4" /> :
                                   bill.type === 'CARWASH' ? <Car className="w-4 h-4" /> :
                                   <ShoppingBag className="w-4 h-4" />}
                                </div>

                                <div className="min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-xs font-black text-zinc-900 uppercase">
                                      #{bill.id?.slice(0, 8).toUpperCase() || 'BILL'}
                                    </span>
                                    <Badge variant="outline" className="text-[7px] font-black uppercase border-zinc-200">
                                      {bill.type}
                                    </Badge>
                                    {bill.tableNumber && (
                                      <Badge variant="outline" className="text-[7px] font-black uppercase border-amber-200 text-amber-700 bg-amber-50/50">
                                        Table {bill.tableNumber}
                                      </Badge>
                                    )}
                                    {bill.plateNumber && (
                                      <span className="text-[9px] font-black uppercase text-zinc-800 bg-zinc-100 px-1.5 py-0.5 rounded font-mono">
                                        {bill.plateNumber}
                                      </span>
                                    )}
                                    {bill.vehicleMake && (
                                      <span className="text-[8px] font-bold uppercase text-zinc-500">
                                        {bill.vehicleMake} {bill.vehicleModel || ''}
                                      </span>
                                    )}
                                    {bill.vehicleColor && (
                                      <span className="inline-flex items-center gap-1 text-[8px] font-bold uppercase text-zinc-500 bg-zinc-50 border border-zinc-200 px-1.5 py-0.5 rounded">
                                        {colorHex && (
                                          <span
                                            className="w-2 h-2 rounded-full border border-zinc-300"
                                            style={{ backgroundColor: colorHex }}
                                          />
                                        )}
                                        {bill.vehicleColor}
                                      </span>
                                    )}
                                  </div>

                                  <p className="text-[8px] font-bold text-zinc-400 uppercase tracking-widest mt-1 truncate">
                                    {bill.items?.length || 0} item{(bill.items?.length || 0) === 1 ? '' : 's'}: {bill.items?.map(it => `${it.quantity}x ${it.name}`).join(', ') || 'No item details'}
                                  </p>

                                  <p className="text-[7px] font-bold text-zinc-300 uppercase tracking-widest mt-0.5">
                                    Held {bill.timestamp ? new Date(bill.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Recently'}
                                  </p>
                                </div>
                              </div>

                              <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-zinc-50">
                                <div className="text-right">
                                  <p className="text-[7px] font-bold text-zinc-400 uppercase tracking-widest">Pending Amount</p>
                                  <p className="text-sm font-black text-zinc-900 tracking-tight">
                                    KES {(bill.total || 0).toLocaleString()}
                                  </p>
                                </div>

                                <Button
                                  onClick={() => handleResumeBill(bill)}
                                  size="sm"
                                  className="h-8 px-3 bg-zinc-900 hover:bg-zinc-800 text-white text-[8px] font-black uppercase tracking-wider rounded-xl shadow-xs"
                                >
                                  Resume in POS
                                  <ChevronRight className="w-3 h-3 ml-1" />
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
             </CardContent>
         </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <Card className="lg:col-span-7 border-none shadow-mobile rounded-[2.5rem] bg-white overflow-hidden border border-zinc-100">
          <CardHeader className="p-8 border-b border-zinc-50 flex flex-row items-center justify-between">
             <div>
                <CardTitle className="text-[11px] font-black uppercase tracking-[0.2em] text-zinc-900">Revenue Velocity</CardTitle>
                <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest mt-1">Volume trend during selected period</p>
             </div>
          </CardHeader>
          <CardContent className="p-8">
            <div className="h-[300px] w-full">
               <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={stats.velocityData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f1f1" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#888', fontWeight: 'bold' }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#888', fontWeight: 'bold' }} />
                    <Tooltip contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', fontSize: '11px', fontWeight: 'bold' }} />
                    <Area type="monotone" dataKey="total" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.05} strokeWidth={3} />
                  </AreaChart>
               </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-5 border-none shadow-mobile rounded-[2.5rem] bg-white overflow-hidden border border-zinc-100">
          <CardHeader className="p-8 border-b border-zinc-50">
             <CardTitle className="text-[11px] font-black uppercase tracking-[0.2em] text-zinc-900">Daily Comparisons</CardTitle>
             <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest mt-1">Departmental performance split</p>
          </CardHeader>
          <CardContent className="p-8">
             <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                   <BarChart data={stats.departmentalData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f1f1" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#888', fontWeight: 'bold' }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#888', fontWeight: 'bold' }} />
                      <Tooltip cursor={{fill: '#f9f9f9'}} contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', fontSize: '11px', fontWeight: 'bold' }} />
                      <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                         {stats.departmentalData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                      </Bar>
                   </BarChart>
                </ResponsiveContainer>
             </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
         <Card className="lg:col-span-12 border-none shadow-mobile rounded-[2.5rem] bg-white overflow-hidden border border-zinc-100">
            <CardHeader className="p-8 border-b border-zinc-50">
               <CardTitle className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Popular Inventory Items</CardTitle>
               <p className="text-[8px] font-bold text-zinc-300 uppercase tracking-widest mt-1">Movement for {dateFilter.replace(/_/g, ' ')}</p>
            </CardHeader>
            <CardContent className="p-0">
               <Table>
                  <TableHeader className="bg-zinc-50/50">
                     <TableRow>
                        <TableHead className="pl-8 h-12 text-[9px] uppercase font-black">Item Description</TableHead>
                        <TableHead className="h-12 text-[9px] uppercase font-black text-center">Protocol</TableHead>
                        <TableHead className="h-12 text-[9px] uppercase font-black text-right">Sold Qty</TableHead>
                        <TableHead className="pr-8 h-12 text-[9px] uppercase font-black text-right">Status</TableHead>
                     </TableRow>
                  </TableHeader>
                  <TableBody>
                     {stats.topProducts.map((item, idx) => (
                       <TableRow key={idx} className="border-zinc-50 hover:bg-zinc-50/50 transition-colors">
                          <TableCell className="pl-8 py-4"><span className="text-xs font-black text-zinc-900 uppercase">{item.name}</span></TableCell>
                          <TableCell className="text-center"><Badge variant="outline" className="text-[7px] font-black uppercase border-zinc-100">STATION</Badge></TableCell>
                          <TableCell className="text-right"><span className="text-sm font-black text-zinc-900">{item.count}</span></TableCell>
                          <TableCell className="text-right pr-8"><span className="text-[10px] font-bold text-green-500 uppercase">Synchronized</span></TableCell>
                       </TableRow>
                     ))}
                  </TableBody>
               </Table>
            </CardContent>
         </Card>
      </div>

      {stats.isPersonalView && (
        <ShiftReportDialog
          isOpen={isShiftReportOpen}
          onClose={() => setIsShiftReportOpen(false)}
          initialType={shiftReportType}
          cashierName={profile?.displayName || 'Cashier'}
          cashierId={profile?.uid || 'STAFF'}
          periodLabel={dateFilter.replace(/_/g, ' ')}
          orders={stats.baseOrders || []}
          heldBills={myHeldBills}
          stats={{
            loungeSales: stats.loungeSales,
            storeSales: stats.storeSales,
            carwashSales: stats.carwashSales,
            totalSales: stats.totalSales
          }}
        />
      )}
    </div>
  );
}

function KPIInternalCell({ title, value, color = "text-zinc-900", sub }: any) {
  return (
    <div className="p-8 group hover:bg-zinc-50/50 transition-colors">
      <p className="text-[9px] font-black uppercase tracking-widest mb-4">{title}</p>
      <h3 className="text-2xl font-black font-headline text-zinc-900 tracking-tighter leading-none">{value}</h3>
      {sub && <p className={cn("text-[8px] font-bold uppercase tracking-widest mt-2", color)}>{sub}</p>}
    </div>
  );
}