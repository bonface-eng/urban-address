'use client';

import React, { useMemo, useEffect, useRef } from 'react';
import { 
  Bell, 
  X, 
  ShieldAlert, 
  Package, 
  CheckCircle2, 
  Clock,
  ChevronRight,
  Info,
  CheckCheck
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { 
  Sheet, 
  SheetContent, 
  SheetHeader, 
  SheetTitle, 
  SheetTrigger
} from '@/components/ui/sheet';
import { useUser, useDb, useCollection } from '@/lib/data';
import { collection, query, where, orderBy, limit, doc, updateDoc, writeBatch } from '@/lib/db';
import { cn } from '@/lib/utils';
import { useProfile } from '@/hooks/use-profile';
import { toast } from '@/hooks/use-toast';

export function Notifications() {
  const { user } = useUser();
  const firestore = useDb();
  const [isOpen, setIsOpen] = React.useState(false);

  const prevNotifIds = useRef<Set<string>>(new Set());

  const notificationsQuery = useMemo(() => {
    if (!firestore || !user) return null;
    return query(
      collection(firestore, 'notifications'),
      where('userId', '==', user.uid),
      orderBy('timestamp', 'desc'),
      limit(20)
    );
  }, [firestore, user?.uid]);

  const { data: notifications, loading } = useCollection<any>(notificationsQuery);
  const unreadCount = notifications?.filter(n => !n.read).length || 0;

  useEffect(() => {
    if (!notifications || loading) return;
    const currentIds = new Set(notifications.map((n: any) => n.id));
    const newArrivals = notifications.filter((n: any) => !prevNotifIds.current.has(n.id) && !n.read);

    if (newArrivals.length > 0) {
      newArrivals.forEach((n: any) => {
        toast({
          title: n.title,
          description: n.message,
          variant: n.type === 'SECURITY' ? 'destructive' : 'default'
        });
      });
    }
    prevNotifIds.current = currentIds;
  }, [notifications, loading]);

  const markAsRead = async (id: string) => {
    if (!firestore) return;
    await updateDoc(doc(firestore, 'notifications', id), { read: true });
  };

  const clearAll = async () => {
    if (!firestore || !notifications) return;
    const batch = writeBatch(firestore);
    notifications.forEach(n => {
      if (!n.read) batch.update(doc(firestore, 'notifications', n.id), { read: true });
    });
    await batch.commit();
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'SECURITY': return <ShieldAlert className="w-4 h-4 text-red-500" />;
      case 'INVENTORY': return <Package className="w-4 h-4 text-amber-500" />;
      case 'PAYMENT': return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case 'QUEUE': return <Clock className="w-4 h-4 text-blue-500" />;
      default: return <Info className="w-4 h-4 text-zinc-400" />;
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="text-zinc-400 relative rounded-full h-10 w-10">
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && <span className="absolute -top-1.5 -right-1.5 h-6 min-w-[24px] px-1 bg-red-600 text-white text-[10px] font-black rounded-full flex items-center justify-center border-2 border-white">{unreadCount}</span>}
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-md border-none p-0 bg-white flex flex-col shadow-2xl">
        <SheetHeader className="p-6 border-b border-zinc-50 flex-row items-center justify-between space-y-0 h-20">
          <SheetTitle className="text-sm font-black uppercase tracking-[0.2em] text-zinc-900">Notifications</SheetTitle>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto no-scrollbar">
          {unreadCount > 0 && (
            <div className="px-6 py-4 bg-zinc-50/50 border-b border-zinc-50 flex items-center justify-between">
              <span className="text-[10px] font-black uppercase text-zinc-400 tracking-widest">{unreadCount} unread updates</span>
              <button onClick={clearAll} className="text-[10px] font-black uppercase text-primary hover:text-red-700 flex items-center gap-1.5 transition-colors"><CheckCheck className="w-3.5 h-3.5" /> Clear all</button>
            </div>
          )}
          {!notifications || notifications.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-12 opacity-30">
              <Bell className="w-10 h-10 mb-4" />
              <p className="text-[10px] font-black uppercase tracking-[0.4em]">Inbox Clear</p>
            </div>
          ) : (
            <div className="divide-y divide-zinc-50">
              {notifications.map((notif) => (
                <div key={notif.id} className={cn("p-6 transition-all hover:bg-zinc-50/50 cursor-pointer relative", !notif.read ? "bg-white" : "bg-white/40")} onClick={() => markAsRead(notif.id)}>
                  {!notif.read && <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary" />}
                  <div className="flex items-start gap-5">
                    <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-sm border border-zinc-50", !notif.read ? "bg-white" : "bg-zinc-50 opacity-50")}>{getNotificationIcon(notif.type)}</div>
                    <div className="flex-1 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <p className={cn("text-[10px] font-black uppercase tracking-widest", !notif.read ? "text-zinc-900" : "text-zinc-400")}>{notif.title}</p>
                        <span className="text-[9px] font-bold text-zinc-300 uppercase">{new Date(notif.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      <p className={cn("text-[11px] leading-relaxed uppercase tracking-tight", !notif.read ? "text-zinc-600 font-bold" : "text-zinc-400 font-medium")}>{notif.message}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-zinc-100 mt-4 shrink-0" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}