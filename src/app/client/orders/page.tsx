'use client';

import React from 'react';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy } from 'firebase/firestore';
import { Order } from '@/lib/types';
import { ChevronRight, Package, Calendar, ArrowRight, Receipt, Clock, CheckCircle2, XCircle } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { ClientLayout } from '../layout';

export default function ClientOrdersPage() {
  const { user, loading: authLoading } = useUser();
  const firestore = useFirestore();

  const ordersQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return query(
      collection(firestore, 'orders'),
      where('customerId', '==', user.uid),
      orderBy('timestamp', 'desc')
    );
  }, [firestore, user?.uid]);

  const { data: orders, loading: ordersLoading } = useCollection<Order>(ordersQuery);

  if (authLoading || (user && ordersLoading)) {
    return (
      <ClientLayout>
        <div className="min-h-[60vh] flex flex-col items-center justify-center space-y-6">
          <div className="animate-pulse">
            <img src="/assets/logo.png" className="h-12 w-auto" alt="Urban Express" />
          </div>
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Loading your history...</p>
        </div>
      </ClientLayout>
    );
  }

  if (!user) {
    return (
      <ClientLayout>
        <div className="min-h-[60vh] flex flex-col items-center justify-center p-8 text-center space-y-6">
          <div className="w-20 h-20 bg-zinc-50 rounded-[2rem] flex items-center justify-center text-zinc-200">
             <Package className="w-10 h-10" />
          </div>
          <div className="space-y-2">
            <h2 className="text-3xl font-black font-headline uppercase tracking-tighter">Sign In Required</h2>
            <p className="text-xs text-zinc-400 font-bold uppercase tracking-widest max-w-xs mx-auto">Please sign in to view your previous orders.</p>
          </div>
          <Button asChild className="h-14 px-12 bg-primary rounded-xl uppercase font-black text-[10px] tracking-[0.2em] shadow-xl shadow-primary/20">
            <Link href="/login">Go to Login</Link>
          </Button>
        </div>
      </ClientLayout>
    );
  }

  return (
    <ClientLayout>
      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.3em] text-zinc-400 mb-2">
          <Link href="/" className="hover:text-primary transition-colors">ACCOUNT</Link> 
          <ChevronRight className="w-2.5 h-2.5" /> 
          <span className="text-primary">MY ORDERS</span>
        </div>
        <h1 className="text-5xl font-black font-headline uppercase text-zinc-900 tracking-tighter mb-12">
          Your <span className="text-primary">Orders.</span>
        </h1>

        <div className="space-y-6">
          {!orders || orders.length === 0 ? (
            <Card className="border-2 border-dashed border-zinc-100 rounded-[2.5rem] bg-transparent">
              <CardContent className="p-20 text-center space-y-6">
                <div className="w-16 h-16 bg-zinc-50 rounded-full flex items-center justify-center mx-auto text-zinc-300">
                  <Receipt className="w-8 h-8" />
                </div>
                <p className="text-sm font-bold text-zinc-400 uppercase tracking-widest">You haven't placed any orders yet.</p>
                <Button asChild variant="outline" className="rounded-xl border-zinc-200 uppercase font-black text-[10px] tracking-widest">
                  <Link href="/">Start Shopping</Link>
                </Button>
              </CardContent>
            </Card>
          ) : (
            orders.map((order) => (
              <OrderHistoryCard key={order.id} order={order} />
            ))
          )}
        </div>
      </div>
    </ClientLayout>
  );
}

function OrderHistoryCard({ order }: { order: Order }) {
  const statusColor = order.status === 'PAID' ? 'text-green-500 bg-green-50' : 
                     order.status === 'VOIDED' ? 'text-red-500 bg-red-50' : 
                     'text-amber-500 bg-amber-50';
  
  const StatusIcon = order.status === 'PAID' ? CheckCircle2 : 
                    order.status === 'VOIDED' ? XCircle : Clock;

  return (
    <Card className="border-none shadow-sm rounded-[2rem] bg-white overflow-hidden group hover:shadow-xl transition-all border border-zinc-50">
      <CardContent className="p-0">
        <div className="p-8 flex flex-col md:flex-row md:items-center justify-between gap-8">
          <div className="flex items-center gap-6">
            <div className="w-16 h-16 rounded-2xl bg-zinc-50 flex items-center justify-center text-zinc-300 group-hover:bg-primary/5 transition-colors">
               <Package className="w-8 h-8" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-3">
                 <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Order #{order.id?.slice(-8).toUpperCase()}</span>
                 <Badge className={cn("border-none text-[8px] font-black uppercase px-2 gap-1", statusColor)}>
                    <StatusIcon className="w-2.5 h-2.5" /> {order.status}
                 </Badge>
              </div>
              <h3 className="text-xl font-black text-zinc-900 uppercase tracking-tighter">
                {order.items?.length || 0} Items <span className="text-zinc-300 mx-2">•</span> KES {order.total.toLocaleString()}
              </h3>
              <div className="flex items-center gap-2 text-zinc-400 text-[10px] font-bold uppercase tracking-widest">
                <Calendar className="w-3 h-3" />
                {new Date(order.timestamp).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
             <Button variant="outline" className="rounded-xl border-zinc-100 text-[10px] font-black uppercase tracking-widest h-12 px-6">
                <Receipt className="w-4 h-4 mr-2" /> Receipt
             </Button>
             <Button asChild className="rounded-xl bg-zinc-900 text-white text-[10px] font-black uppercase tracking-widest h-12 px-6 group/btn">
                <Link href={`/client/${order.type.toLowerCase()}`}>
                  Reorder <ArrowRight className="w-4 h-4 ml-2 transition-transform group-hover/btn:translate-x-1" />
                </Link>
             </Button>
          </div>
        </div>

        <div className="px-8 pb-8 flex gap-2 overflow-x-auto no-scrollbar">
           {order.items?.map((item, idx) => (
             <div key={idx} className="shrink-0 px-3 py-1.5 bg-zinc-50 rounded-lg text-[9px] font-bold text-zinc-500 uppercase border border-zinc-100/50">
               {item.quantity}x {item.name}
             </div>
           ))}
        </div>
      </CardContent>
    </Card>
  );
}