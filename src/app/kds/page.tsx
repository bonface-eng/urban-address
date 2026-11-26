'use client';

import { PageHeader } from '@/components/shared/page-layout';

import React, { useMemo, useState, useEffect } from 'react';
import { 
  Coffee, 
  Clock, 
  CheckCircle2, 
  ChefHat, 
  Play, 
  Timer,
  AlertCircle,
  Bell,
  History,
  ChefHatIcon,
  Search,
  ArrowRight,
  Filter,
  MoreVertical,
  CheckCheck,
  UtensilsCrossed,
  LayoutList,
  Calendar
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy, doc, updateDoc, addDoc, limit } from 'firebase/firestore';
import { Order } from '@/lib/types';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { useProfile } from '@/hooks/use-profile';

export default function KitchenDisplaySystem() {
  const firestore = useFirestore();
  const { profile } = useProfile();
  const [activeTab, setActiveTab] = useState('live');
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(interval);
  }, []);

  // Removed 24-hour limit to ensure all active tickets stay on board until served.
  const ordersQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(
      collection(firestore, 'orders'),
      orderBy('timestamp', 'asc')
    );
  }, [firestore]);

  const { data: orders, loading } = useCollection<Order>(ordersQuery);

  const activeOrders = useMemo(() => {
    if (!orders) return [];
    return orders.filter(o => {
      // Rule 1: Exclude already served items
      if (o.prepStatus === 'SERVED') return false;
      
      // Rule 2: Exclude voided or refunded transactions
      if (o.status === 'VOIDED' || o.status === 'REFUNDED' || o.status === 'CANCELLED') return false;

      // Rule 3: STRICT FOOD FILTER - Only show orders that have at least one 'Food' item
      const containsFoodItems = o.items?.some(item => 
        item.category === 'Food'
      );
      
      // Show if it has food and is either explicitly PENDING (held) or already PAID
      return containsFoodItems && (o.status === 'PENDING' || o.status === 'PAID');
    });
  }, [orders]);

  const completedOrders = useMemo(() => {
    if (!orders) return [];
    return orders
      .filter(o => o.prepStatus === 'SERVED' && o.items?.some(i => i.category === 'Food'))
      .sort((a, b) => (b.servedAt || 0) - (a.servedAt || 0));
  }, [orders]);

  const updateStatus = async (orderId: string, status: Order['prepStatus']) => {
    if (!firestore || !profile) return;
    try {
      const updates: Partial<Order> = { prepStatus: status };
      if (status === 'SERVED') {
        updates.servedAt = Date.now();
      }

      await updateDoc(doc(firestore, 'orders', orderId), updates);
      
      if (status === 'READY') {
        toast({ title: "Order Ready", description: "Waitstaff notified." });
      } else if (status === 'SERVED') {
        toast({ title: "Order Finalized", description: "Moved to completion history." });
      }
    } catch (err) {
      toast({ variant: "destructive", title: "Sync Error", description: "Status update failed." });
    }
  };

  const getWaitTime = (timestamp: number) => {
    const diff = Math.floor((now - timestamp) / 60000);
    if (diff < 1) return 'Just now';
    return `${diff} min`;
  };

  return (
    <div className="space-y-6 h-[calc(100vh-8rem)] flex flex-col max-w-[1600px] mx-auto">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 px-2 pt-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
             <ChefHat className="w-3.5 h-3.5 text-primary" />
             <span className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-400">Preparation Node KDS-01</span>
          </div>
          <PageHeader title="Kitchen Board" breadcrumb={["Operations", "Kitchen Board"]} className="mb-0" />
        </div>
        <div className="flex items-center gap-3">
           <Badge className="bg-zinc-900 text-white font-black uppercase text-[9px] px-4 py-2 rounded-xl shadow-lg border-none">
             {activeOrders.length} Active Tickets
           </Badge>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full flex-1 flex flex-col px-2 overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-[2rem] shadow-sm border border-zinc-100 mb-6 shrink-0">
          <TabsList className="bg-zinc-100/50 p-1.5 rounded-2xl h-14">
             <TabsTrigger value="live" className="rounded-xl h-full px-8 text-[10px] font-black uppercase tracking-widest data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-md">Active Orders</TabsTrigger>
             <TabsTrigger value="history" className="rounded-xl h-full px-8 text-[10px] font-black uppercase tracking-widest data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-md">Preparation History</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="live" className="flex-1 overflow-y-auto no-scrollbar m-0 space-y-3 pb-24 md:pb-8">
           {activeOrders.length === 0 ? (
             <div className="h-full flex flex-col items-center justify-center space-y-6 opacity-30 bg-white/50 rounded-[3rem] border-2 border-dashed border-zinc-100">
                <ChefHatIcon className="w-16 h-16 text-zinc-200" />
                <p className="text-[11px] font-black uppercase tracking-[0.4em]">All tickets served</p>
             </div>
           ) : (
             <div className="grid grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3 gap-4">
                {activeOrders.map((order) => (
                  <KDSOrderRow key={order.id} order={order} onUpdate={updateStatus} waitTime={getWaitTime(order.timestamp)} />
                ))}
             </div>
           )}
        </TabsContent>

        <TabsContent value="history" className="flex-1 overflow-y-auto no-scrollbar m-0 space-y-3 pb-24 md:pb-8">
           {completedOrders.length === 0 ? (
             <div className="h-full flex flex-col items-center justify-center space-y-6 opacity-30 bg-white/50 rounded-[3rem] border-2 border-dashed border-zinc-100">
                <History className="w-16 h-16 text-zinc-200" />
                <p className="text-[11px] font-black uppercase tracking-[0.4em]">No completion history found</p>
             </div>
           ) : (
             <div className="grid gap-3">
                {completedOrders.map((order) => (
                  <KDSHistoryRow key={order.id} order={order} />
                ))}
             </div>
           )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function KDSOrderRow({ order, onUpdate, waitTime }: { order: Order, onUpdate: any, waitTime: string }) {
  const isPreparing = order.prepStatus === 'PREPARING';
  const isReady = order.prepStatus === 'READY';
  const isUnpaid = order.status === 'PENDING';
  const timeReceived = new Date(order.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  // Strictly only show Food items on the ticket
  const foodItems = order.items?.filter(item => item.category === 'Food') || [];

  return (
    <div className={cn(
      "group flex flex-col lg:flex-row lg:items-center justify-between p-6 bg-white rounded-[2rem] border border-zinc-100 shadow-sm transition-all hover:shadow-xl",
      isPreparing && "ring-2 ring-amber-500 bg-amber-50/20",
      isReady && "ring-2 ring-green-500 bg-green-50/20",
      isUnpaid && "opacity-90 grayscale-[0.2]"
    )}>
       <div className="flex items-center gap-6 flex-1 min-w-0">
          <div className={cn(
            "w-16 h-16 rounded-2xl flex flex-col items-center justify-center shrink-0 shadow-sm border",
            !order.prepStatus || order.prepStatus === 'NEW' ? "bg-zinc-50 border-zinc-100 text-zinc-400" :
            isPreparing ? "bg-amber-500 border-amber-400 text-white" :
            "bg-green-500 border-green-400 text-white"
          )}>
             <span className="text-[10px] font-black uppercase leading-none mb-0.5">Table</span>
             <span className="text-xl font-black leading-none">{order.tableNumber || 'W'}</span>
          </div>

          <div className="flex-1 min-w-0">
             <div className="flex items-center gap-3 mb-2">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Order #{order.id?.slice(-6).toUpperCase()}</h3>
                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-zinc-50 border border-zinc-100">
                   <Calendar className="w-2.5 h-2.5 text-zinc-300" />
                   <span className="text-[8px] font-black text-zinc-400 uppercase">Received: {timeReceived}</span>
                </div>
                {isUnpaid && (
                  <Badge variant="outline" className="bg-amber-100 text-amber-700 border-none text-[8px] font-black uppercase px-2 h-5">NOT PAID</Badge>
                )}
                <Badge variant="outline" className={cn(
                  "text-[8px] font-black uppercase px-2 h-5 border-none",
                  !order.prepStatus || order.prepStatus === 'NEW' ? "bg-zinc-100 text-zinc-500" :
                  isPreparing ? "bg-amber-500 text-white animate-pulse" :
                  "bg-green-50 text-white"
                )}>
                   {order.prepStatus || 'NEW TICKET'}
                </Badge>
             </div>
             
             <div className="flex flex-wrap gap-2">
                {foodItems.map((item, i) => (
                  <div key={i} className="inline-flex items-center gap-2 bg-zinc-50 px-3 py-1.5 rounded-xl border border-zinc-100/50">
                    <span className="text-sm font-black text-primary leading-none">{item.quantity}x</span>
                    <span className="text-[11px] font-bold text-zinc-900 uppercase tracking-tight">{item.name}</span>
                    {item.notes && <span className="text-[8px] font-black text-red-500 uppercase ml-1 italic">{item.notes}</span>}
                  </div>
                ))}
             </div>
          </div>
       </div>

       <div className="mt-4 lg:mt-0 flex items-center justify-between lg:justify-end gap-10 lg:pl-10 lg:border-l border-zinc-100">
          <div className="text-right space-y-1">
             <div className="flex items-center gap-2 justify-end">
                <Clock className="w-3.5 h-3.5 text-primary" />
                <span className="text-sm font-black text-zinc-900 uppercase font-mono">{waitTime}</span>
             </div>
             <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest">In Queue</p>
          </div>

          <div className="flex gap-2">
             {!order.prepStatus || order.prepStatus === 'NEW' ? (
                <Button 
                  onClick={() => onUpdate(order.id!, 'PREPARING')}
                  className="h-12 px-6 bg-amber-500 hover:bg-amber-600 text-white font-black uppercase text-[10px] tracking-widest rounded-xl shadow-lg transition-all active:scale-95 gap-2"
                >
                  <Play className="w-3.5 h-3.5 fill-current" /> Start Prep
                </Button>
             ) : isPreparing ? (
                <Button 
                  onClick={() => onUpdate(order.id!, 'READY')}
                  className="h-12 px-6 bg-green-500 hover:bg-green-600 text-white font-black uppercase text-[10px] tracking-widest rounded-xl shadow-lg transition-all active:scale-95 gap-2"
                >
                  <Bell className="w-4 h-4" /> Ready to Serve
                </Button>
             ) : (
                <Button 
                  onClick={() => onUpdate(order.id!, 'SERVED')}
                  className="h-12 px-6 bg-zinc-900 hover:bg-zinc-800 text-white font-black uppercase text-[10px] tracking-widest rounded-xl shadow-xl transition-all active:scale-95 gap-2"
                >
                  <CheckCheck className="w-4 h-4" /> Finish & Serve
                </Button>
             )}
          </div>
       </div>
    </div>
  );
}

function KDSHistoryRow({ order }: { order: Order }) {
  const timeReceived = new Date(order.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const timeServed = order.servedAt ? new Date(order.servedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--';
  const prepTime = order.servedAt ? Math.floor((order.servedAt - order.timestamp) / 60000) : 0;
  
  const foodItems = order.items?.filter(item => item.category === 'Food') || [];

  return (
    <div className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white border border-zinc-100 rounded-3xl group hover:shadow-md transition-all">
       <div className="flex items-center gap-6 flex-1 min-w-0">
          <div className="w-12 h-12 rounded-2xl bg-zinc-50 flex items-center justify-center text-zinc-300 group-hover:bg-primary/5 group-hover:text-primary transition-colors border border-zinc-100">
             <CheckCircle2 className="w-6 h-6" />
          </div>
          <div className="min-w-0 flex-1">
             <div className="flex items-center gap-3 mb-1.5">
                <h4 className="text-xs font-black text-zinc-900 uppercase tracking-tighter">UAX-{order.id?.slice(-6).toUpperCase()}</h4>
                <Badge variant="outline" className="text-[7px] font-black uppercase border-zinc-200 text-zinc-400 h-4 bg-zinc-50 px-2">Table {order.tableNumber || 'W'}</Badge>
             </div>
             <div className="flex gap-2 overflow-x-auto no-scrollbar">
                {foodItems.map((item, i) => (
                  <span key={i} className="text-[9px] font-bold text-zinc-500 uppercase whitespace-nowrap bg-zinc-50 px-2 py-0.5 rounded-lg border border-zinc-100">
                     {item.quantity}x {item.name}
                  </span>
                ))}
             </div>
          </div>
       </div>

       <div className="flex items-center gap-8 md:pl-8 md:border-l border-zinc-100">
          <div className="space-y-1">
             <p className="text-[8px] font-black text-zinc-400 uppercase tracking-widest">Received</p>
             <p className="text-[10px] font-black text-zinc-900 uppercase font-mono">{timeReceived}</p>
          </div>
          <div className="space-y-1">
             <p className="text-[8px] font-black text-zinc-400 uppercase tracking-widest">Served</p>
             <p className="text-[10px] font-black text-green-600 uppercase font-mono">{timeServed}</p>
          </div>
          <div className="text-right">
             <p className="text-[8px] font-black text-zinc-400 uppercase tracking-widest">Cycle Time</p>
             <p className="text-xs font-black text-zinc-900 uppercase">{prepTime}m</p>
          </div>
       </div>
    </div>
  );
}