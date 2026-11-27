
'use client';

import { useStaffInventory } from '@/hooks/use-staff-inventory';
import { usePosReads } from '@/hooks/use-pos-reads';
import { PosReadNotice } from '@/components/pos/read-notice';

import React, { useState, useMemo, useEffect } from 'react';
import { 
  Coffee, 
  ShoppingCart, 
  Search, 
  ShoppingBag,
  Clock,
  RefreshCcw,
  Table as TableIcon,
  CreditCard,
  BarChart3,
  ChevronRight,
  ArrowLeft,
  CheckCircle2,
  PlusCircle,
  Hash,
  Check,
  Trash2,
  AlertTriangle,
  Printer,
  Smartphone
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Product, Order, OrderItem, UserProfile } from '@/lib/types';
import { toast } from '@/hooks/use-toast';
import { useFirestore, useCollection, useMemoFirebase, errorEmitter, FirestorePermissionError } from '@/firebase';
import { collection, query, where, addDoc, doc, updateDoc, onSnapshot, orderBy, limit, writeBatch, increment } from 'firebase/firestore';
import { HardwareService } from '@/lib/hardware-service';
import { useProfile } from '@/hooks/use-profile';
import { POSProductCard } from '@/components/pos/pos-product-card';
import { POSCartItem } from '@/components/pos/pos-cart-item';
import { PaymentView } from '@/components/pos/payment-view';
import { VoidDialog } from '@/components/pos/void-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { CustomerLookup } from '@/components/pos/customer-lookup';
import { ReceiptPreview } from '@/components/pos/receipt-preview';
import { useBarcodeScanner } from '@/hooks/use-barcode-scanner';
import { useTerminal } from '@/hooks/use-terminal';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const CATEGORIES = ['Popular', 'Drinks', 'Food', 'Liquor', 'Tobacco', 'Other'];

export default function LoungePOS() {
  const firestore = useFirestore();
  const { role, isSuperAdmin } = useProfile();
  const { activeTerminal, activeCashier, activeRegisterSession } = useTerminal();
  
  // Persistent State Logic
  const [isHydrated, setIsHydrated] = useState(false);
  const [cart, setCart] = useState<OrderItem[]>([]);
  const [activeCategory, setActiveCategory] = useState('Popular');
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [checkoutStep, setCheckoutStep] = useState<'CART' | 'PAYMENT' | 'SUCCESS' | 'RECALL'>('CART');
  const [searchTerm, setSearchTerm] = useState('');
  const [recallSearch, setRecallSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<UserProfile | null>(null);
  const [tableNumber, setTableNumber] = useState('');
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);

  const [isReportOpen, setIsReportOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [receiptData, setReceiptData] = useState<any>(null);
  const [notifiedReadyOrders] = useState(new Set<string>());
  const [isVoidOpen, setIsVoidOpen] = useState(false);
  const [pendingVoidAction, setPendingVoidAction] = useState<{ type: 'SINGLE' | 'CLEAR' | 'DELETE_PENDING', id?: string } | null>(null);

  // Load state on mount
  useEffect(() => {
    const saved = sessionStorage.getItem('uax_lounge_state');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.cart) setCart(parsed.cart);
        if (parsed.activeCategory) setActiveCategory(parsed.activeCategory);
        if (parsed.searchTerm) setSearchTerm(parsed.searchTerm);
        if (parsed.tableNumber) setTableNumber(parsed.tableNumber);
        if (parsed.editingOrderId) setEditingOrderId(parsed.editingOrderId);
        if (parsed.checkoutStep) setCheckoutStep(parsed.checkoutStep);
        if (parsed.selectedCustomer) setSelectedCustomer(parsed.selectedCustomer);
        if (parsed.isCartOpen) setIsCartOpen(parsed.isCartOpen);
      } catch (e) {
        console.error('Failed to restore lounge state');
      }
    }
    setIsHydrated(true);
  }, []);

  // Save state on change
  useEffect(() => {
    if (!isHydrated) return;
    const state = {
      cart, activeCategory, searchTerm, tableNumber, 
      editingOrderId, checkoutStep, selectedCustomer, isCartOpen
    };
    sessionStorage.setItem('uax_lounge_state', JSON.stringify(state));
  }, [cart, activeCategory, searchTerm, tableNumber, editingOrderId, checkoutStep, selectedCustomer, isCartOpen, isHydrated]);

  const isAuthorized = isSuperAdmin || role === 'ADMIN' || role === 'MANAGER' || role === 'SUPERVISOR' || (role === 'CASHIER');

  const startOfToday = new Date().setHours(0, 0, 0, 0);
  const todayOrdersQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(
      collection(firestore, 'orders'),
      where('type', '==', 'LOUNGE'),
      where('timestamp', '>=', startOfToday),
      where('status', '==', 'PAID')
    );
  }, [firestore, startOfToday]);

  const inventoryRead = useStaffInventory(0);
  const products = useMemo(() => inventoryRead.data?.filter(item => item.unit === 'LOUNGE' && !item.archived) || null, [inventoryRead.data]);
  const tabRead = usePosReads<Order>('own-tabs', 'LOUNGE', !!activeCashier?.uid);
  const rawPendingOrders = tabRead.data;
  const { data: todayOrders } = useCollection<Order>(todayOrdersQuery);

  const pendingOrders = useMemo(() => {
    if (!rawPendingOrders) return [];
    const base = [...rawPendingOrders].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    if (!recallSearch) return base;
    return base.filter(o => (o.tableNumber || '').includes(recallSearch.toUpperCase()));
  }, [rawPendingOrders, recallSearch]);

  useEffect(() => {
    if (!firestore || !isAuthorized || !activeCashier) return;
    const q = query(collection(firestore, 'orders'), where('type', '==', 'LOUNGE'), limit(50));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === "added" || change.type === "modified") {
          const order = change.doc.data() as Order;
          const orderId = change.doc.id;
          if (order.prepStatus === 'READY' && order.cashierId === activeCashier.uid && !notifiedReadyOrders.has(orderId)) {
            notifiedReadyOrders.add(orderId);
            toast({
              title: "Kitchen Alert: Order Ready",
              description: `Table ${order.tableNumber || 'WALK-IN'} is ready.`,
            });
          }
        }
      });
    });
    return () => unsubscribe();
  }, [firestore, isAuthorized, notifiedReadyOrders, activeCashier]);

  const filteredProducts = useMemo(() => {
    if (!products) return [];
    return products.filter(p => {
      const matchesCategory = activeCategory === 'Popular' || p.category === activeCategory;
      const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [products, activeCategory, searchTerm]);

  const addToCart = (product: Product) => {
    if (product.stockLevel <= 0) {
      toast({ variant: "destructive", title: "Out of Stock" });
      return;
    }
    setCart(prev => {
      const existingIdx = prev.findIndex(item => item.productId === product.id && item.status === 'DRAFT');
      if (existingIdx > -1) {
        const newCart = [...prev];
        newCart[existingIdx] = { ...newCart[existingIdx], quantity: newCart[existingIdx].quantity + 1 };
        return newCart;
      }
      return [...prev, { productId: product.id!, name: product.name, price: product.price, quantity: 1, category: product.category, status: 'DRAFT' }];
    });
    setCheckoutStep('CART');
    if (!isCartOpen) setIsCartOpen(true);
  };

  useBarcodeScanner((barcode) => {
    if (!isAuthorized) return;
    const product = products?.find(p => p.barcode === barcode);
    if (product) addToCart(product);
  });

  const updateQuantity = (id: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.productId === id) return { ...item, quantity: Math.max(1, item.quantity + delta) };
      return item;
    }));
  };

  const executeVoid = async (reason: string, pin: string) => {
    if (pin !== '1234' && pin !== '0000') throw new Error('Unauthorized');
    if (!firestore || !activeCashier || !pendingVoidAction) return;

    if (pendingVoidAction.type === 'CLEAR') {
      setCart([]);
      setEditingOrderId(null);
      setTableNumber('');
      setCheckoutStep('CART');
    } else if (pendingVoidAction.id) {
      const idx = cart.findIndex(i => i.productId === pendingVoidAction.id);
      if (idx > -1) {
        const newCart = [...cart];
        newCart.splice(idx, 1);
        setCart(newCart);
      }
    }
    setPendingVoidAction(null);
    setIsVoidOpen(false);
  };

  const handleHoldOrder = (isTicket: boolean = false) => {
    if (!firestore || !activeCashier || cart.length === 0) return;
    if (!tableNumber) {
      toast({ variant: "destructive", title: "Table Required" });
      return;
    }

    setIsProcessing(true);
    
    const draftItems = cart.filter(i => i.status === 'DRAFT');
    const updatedItems = cart.map(i => ({ ...i, status: 'COMMITTED' as const }));
    const orderData: any = {
      type: 'LOUNGE' as const,
      status: 'PENDING' as const,
      total: updatedItems.reduce((sum, i) => sum + (i.price * i.quantity), 0),
      tableNumber: tableNumber.toUpperCase(),
      cashierId: activeCashier.uid,
      cashierName: activeCashier.displayName,
      terminalId: activeTerminal?.id || 'UAX-NODE',
      registerSessionId: activeRegisterSession?.id || 'UAX-SESSION',
      customerId: selectedCustomer?.uid || null,
      customerName: selectedCustomer?.displayName || null,
      timestamp: Date.now(),
      items: updatedItems
    };

    if (isTicket && draftItems.length > 0) orderData.prepStatus = 'NEW';

    const batch = writeBatch(firestore);
    const heldRef = editingOrderId ? 
      doc(firestore, 'users', activeCashier.uid, 'held_bills', editingOrderId) : 
      doc(collection(firestore, 'users', activeCashier.uid, 'held_bills'));
    
    const masterOrderRef = doc(firestore, 'orders', heldRef.id);
    
    batch.set(heldRef, orderData, { merge: true });
    batch.set(masterOrderRef, orderData, { merge: true });

    batch.commit()
      .then(async () => {
        const finalData = { ...orderData, id: heldRef.id };
        
        if (isTicket && draftItems.length > 0) {
          await HardwareService.printReceipt({ ...finalData, isTicket: true, items: draftItems });
          toast({ title: "Ticket Sent" });
        } else {
          setReceiptData(finalData);
          setCheckoutStep('SUCCESS');
          toast({ title: "Bill Saved" });
        }

        setCart([]);
        setTableNumber('');
        setSelectedCustomer(null);
        setEditingOrderId(null);
        setIsProcessing(false);
      })
      .catch((err) => {
        console.error('[HOLD_ORDER_ERROR]', err);
        setIsProcessing(false);
        toast({ variant: "destructive", title: "Sync Failed" });
      });
  };

  const handleFinalizeSale = async (method: 'CASH' | 'MOBILE', metadata?: any) => {
    if (!firestore || !activeCashier || cart.length === 0) return;
    setIsProcessing(true);
    const totalValue = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const orderData = {
      type: 'LOUNGE' as const,
      status: 'PAID' as const,
      total: totalValue,
      paymentMethod: method,
      paymentRef: metadata?.reference || null,
      tableNumber: tableNumber || 'WALK-IN',
      cashierId: activeCashier.uid,
      cashierName: activeCashier.displayName,
      timestamp: Date.now(),
      inventorySynced: true,
      items: cart.map(item => ({ ...item, status: 'COMMITTED' as const }))
    };

    const batch = writeBatch(firestore);
    const orderRef = doc(collection(firestore, 'orders'));
    batch.set(orderRef, orderData);

    // Deduct stock for physical inventory
    for (const item of cart) {
      if (item.productId) {
        const productRef = doc(firestore, 'inventory', item.productId);
        batch.update(productRef, {
          stockLevel: increment(-item.quantity),
          updatedAt: Date.now()
        });
      }
    }

    if (editingOrderId) {
      const heldRef = doc(firestore, 'users', activeCashier.uid, 'held_bills', editingOrderId);
      batch.delete(heldRef);
    }

    batch.commit()
      .then(async () => {
        const finalReceipt = { ...orderData, id: orderRef.id };
        await HardwareService.printReceipt(finalReceipt);
        setReceiptData(finalReceipt);
        setCheckoutStep('SUCCESS');
        setIsProcessing(false);
        toast({ title: "Transaction Authorized" });
      })
      .catch((err) => {
        console.error('[FINALIZE_SALE_ERROR]', err);
        setIsProcessing(false);
        toast({ variant: "destructive", title: "Sync Failed" });
      });
  };

  const handleNewTransaction = () => {
    setCart([]);
    setTableNumber('');
    setEditingOrderId(null);
    setReceiptData(null);
    setCheckoutStep('CART');
    setSelectedCustomer(null);
  };

  const loadPendingOrder = (order: Order) => {
    const items = (order.items || []).map(i => ({ ...i, status: 'COMMITTED' as const }));
    setCart(items);
    setTableNumber(order.tableNumber || '');
    setEditingOrderId(order.id!);
    setCheckoutStep('CART');
    setIsCartOpen(true);
  };

  const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  if (!isHydrated) return null;

  return (
    <div className="h-[calc(100vh-9rem)] flex flex-col md:flex-row gap-6 overflow-hidden relative">
      <div className="flex-1 flex flex-col gap-6 overflow-hidden">
        <header className="space-y-4 px-1">
          <PosReadNotice label="Inventory" error={inventoryRead.error?.code || null} onRetry={() => window.location.reload()} />
          <PosReadNotice label="Held tabs" error={tabRead.error} onRetry={tabRead.refresh} />

          <div className="flex items-center justify-between">
            <h1 className="text-xl font-black font-headline uppercase text-zinc-900">Lounge</h1>
            <div className="flex items-center gap-2">
              <button onClick={() => setIsReportOpen(true)} className="h-10 px-5 border border-zinc-100 text-[10px] font-black uppercase tracking-widest gap-2 bg-white shadow-sm hover:text-primary transition-all rounded-xl flex items-center">
                <BarChart3 className="w-4 h-4 text-primary" /> Reports
              </button>
              <button onClick={() => { setCheckoutStep('RECALL'); setIsCartOpen(true); }} className="h-10 px-5 border border-zinc-100 text-[10px] font-black uppercase tracking-widest gap-2 bg-white shadow-sm hover:text-primary transition-all rounded-xl relative flex items-center group">
                <Clock className="w-4 h-4" /> Recall Tab
                {pendingOrders && pendingOrders.length > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-primary text-white rounded-lg flex items-center justify-center text-[8px] border-2 border-white animate-blink group-hover:scale-110 transition-all font-black">{pendingOrders.length}</span>
                )}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
            <div className="md:col-span-4 relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
              <Input placeholder="Search..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-12 h-14 bg-white border-zinc-100 shadow-sm rounded-xl font-bold" />
            </div>
            <div className="md:col-span-2 relative">
              <TableIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-primary" />
              <Input placeholder="TABLE" value={tableNumber} onChange={(e) => setTableNumber(e.target.value.toUpperCase())} className="pl-12 h-14 bg-white border-zinc-100 shadow-sm rounded-xl font-black uppercase" />
            </div>
            <div className="md:col-span-6">
               <CustomerLookup onSelect={setSelectedCustomer} selectedCustomer={selectedCustomer} />
            </div>
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
            {CATEGORIES.map(cat => (
              <Button key={cat} variant={activeCategory === cat ? 'default' : 'ghost'} onClick={() => setActiveCategory(cat)} className={cn("h-8 rounded-full px-5 text-[10px] font-black uppercase tracking-widest shrink-0 shadow-sm", activeCategory === cat ? "bg-primary text-white" : "bg-white text-zinc-400 border border-zinc-50")}>
                {cat}
              </Button>
            ))}
          </div>
        </header>

        <div className="flex-1 flex flex-col gap-2 overflow-y-auto pr-1 no-scrollbar pb-8">
          {filteredProducts.map((p) => (
            <POSProductCard key={p.id} product={p} onAdd={() => addToCart(p)} />
          ))}
        </div>
      </div>

      <div className={cn("fixed inset-0 z-50 md:relative md:inset-auto md:z-0 md:w-[420px] md:flex shrink-0 transition-transform duration-300 md:translate-x-0", isCartOpen ? "translate-x-0" : "translate-x-full md:translate-x-0")}>
        <div className="absolute inset-0 bg-black/40 md:hidden" onClick={() => setIsCartOpen(false)} />
        <Card className="relative h-full flex flex-col shadow-2xl md:shadow-mobile border-none rounded-[3rem] overflow-hidden bg-white ml-auto w-full max-w-[420px] border border-zinc-100">
          
          <CardHeader className="border-b border-zinc-50 p-6 flex flex-row items-center justify-between shrink-0 h-20">
            {(checkoutStep === 'CART' || checkoutStep === 'RECALL') && (
              <>
                <div className="flex items-center gap-3">
                   {checkoutStep === 'RECALL' && <Button variant="ghost" size="icon" onClick={() => setCheckoutStep('CART')} className="h-8 w-8 rounded-full bg-zinc-50"><ArrowLeft className="w-4 h-4" /></Button>}
                   <CardTitle className="text-sm font-black uppercase tracking-widest text-zinc-900"> {checkoutStep === 'RECALL' ? 'Active Tabs' : 'Cart'} </CardTitle>
                </div>
                {checkoutStep === 'CART' ? (
                   <Button variant="ghost" size="sm" onClick={() => { setPendingVoidAction({ type: 'CLEAR' }); setIsVoidOpen(true); }} className="text-primary text-[10px] font-bold uppercase tracking-tighter">Clear</Button>
                ) : (
                   <Badge variant="outline" className="bg-amber-100 text-amber-700 text-[8px] font-black px-2 py-0.5 border-none">RECALL</Badge>
                )}
              </>
            )}
            {checkoutStep === 'PAYMENT' && (
              <>
                <div className="flex items-center gap-3">
                  <Button variant="ghost" size="icon" onClick={() => setCheckoutStep('CART')} className="h-8 w-8 rounded-full bg-zinc-50 text-zinc-400"><ArrowLeft className="w-4 h-4" /></Button>
                  <CardTitle className="text-sm font-black uppercase tracking-widest text-zinc-900"> Payment </CardTitle>
                </div>
                <Badge variant="outline" className="bg-zinc-900 text-white text-[8px] font-black px-2 py-0.5">SECURE</Badge>
              </>
            )}
            {checkoutStep === 'SUCCESS' && (
              <>
                <CardTitle className="text-sm font-black uppercase tracking-widest text-zinc-900 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-500" /> Finalized
                </CardTitle>
                <Button onClick={handleNewTransaction} className="h-8 px-4 bg-primary text-white rounded-xl text-[9px] font-black uppercase gap-2">
                  <PlusCircle className="w-3.5 h-3.5" /> New Sale
                </Button>
              </>
            )}
          </CardHeader>

          <CardContent className="flex-1 overflow-y-auto p-6 space-y-3 no-scrollbar min-h-0 bg-white">
            {checkoutStep === 'RECALL' && (
               <div className="space-y-4">
                  <div className="relative mb-6">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-300" />
                    <Input placeholder="Search table..." value={recallSearch} onChange={e => setRecallSearch(e.target.value)} className="h-10 pl-9 bg-zinc-50 border-none rounded-xl text-[10px] font-bold" />
                  </div>
                  {pendingOrders.map(order => (
                    <div key={order.id} className="p-5 bg-white border border-zinc-100 rounded-2xl shadow-sm space-y-4 group hover:border-primary/20 transition-all">
                       <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                             <div className="w-10 h-10 rounded-xl bg-zinc-50 border border-zinc-100 flex flex-col items-center justify-center text-zinc-400 group-hover:bg-primary/5 group-hover:text-primary group-hover:border-primary/10 transition-all">
                                <span className="text-[8px] font-black uppercase leading-none mb-0.5">TABLE</span>
                                <span className="text-lg font-black leading-none">{order.tableNumber || 'W'}</span>
                             </div>
                             <div>
                                <p className="text-[10px] font-black text-zinc-900">KES {order.total.toLocaleString()}</p>
                                <p className="text-[8px] font-bold text-zinc-400 uppercase tracking-widest mt-1">Ref #{order.id?.slice(-6).toUpperCase()}</p>
                             </div>
                          </div>
                          <div className="flex gap-2">
                             <Button onClick={() => loadPendingOrder(order)} size="sm" className="h-8 px-3 bg-zinc-900 text-white rounded-lg text-[9px] font-black uppercase">Open</Button>
                             <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-zinc-200 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></Button>
                          </div>
                       </div>
                    </div>
                  ))}
                  {pendingOrders.length === 0 && (
                    <div className="py-20 text-center opacity-30"><Clock className="w-10 h-10 mx-auto mb-3" /><p className="text-[9px] font-black uppercase tracking-widest">No active tabs</p></div>
                  )}
               </div>
            )}

            {checkoutStep === 'CART' && (
              cart.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-zinc-300 gap-4 opacity-50"><ShoppingBag className="w-10 h-10" /><p className="text-[10px] font-black uppercase tracking-widest">Cart Empty</p></div>
              ) : (
                cart.map((item, idx) => <POSCartItem key={`${item.productId}-${idx}`} item={{...item, id: item.productId}} onUpdate={updateQuantity} onRemove={(id) => { setPendingVoidAction({ type: 'SINGLE', id }); setIsVoidOpen(true); }} />)
              )
            )}
            
            {checkoutStep === 'PAYMENT' && (
              <div className="animate-in slide-in-from-right-4 duration-300">
                <PaymentView 
                  total={total} 
                  onComplete={handleFinalizeSale} 
                  isProcessing={isProcessing} 
                  previewData={receiptData} 
                />
              </div>
            )}

            {checkoutStep === 'SUCCESS' && (
              <div className="animate-in slide-in-from-bottom-4 duration-500 flex flex-col items-center py-4 no-scrollbar">
                <ReceiptPreview 
                  data={receiptData} 
                  className="w-full" 
                />
              </div>
            )}
          </CardContent>

          {checkoutStep === 'CART' && (
            <div className="p-6 bg-zinc-50/50 border-t border-zinc-100 space-y-4 shrink-0">
              <div className="flex justify-between items-center py-2">
                <span className="text-sm font-black uppercase tracking-widest text-zinc-400">Due Total</span>
                <span className="text-2xl font-black text-zinc-900 font-headline">KES {total.toLocaleString()}</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                 <Button onClick={() => handleHoldOrder(false)} disabled={cart.length === 0 || isProcessing || !activeCashier} variant="outline" className="h-14 rounded-xl border-zinc-200 bg-white text-zinc-600 font-black uppercase text-[10px] tracking-widest active:scale-[0.98]">
                   Hold
                 </Button>
                 <Button onClick={() => handleHoldOrder(true)} disabled={cart.length === 0 || isProcessing || !activeCashier} className="h-14 rounded-xl bg-zinc-900 text-white font-black uppercase text-[10px] tracking-widest active:scale-[0.98]">
                   Kitchen
                 </Button>
              </div>
              <Button 
                onClick={() => setCheckoutStep('PAYMENT')} 
                disabled={cart.length === 0 || isProcessing || !activeCashier} 
                className="w-full h-14 rounded-xl bg-primary hover:bg-orange-600 text-white font-black uppercase text-[10px] tracking-widest shadow-xl active:scale-[0.98] gap-2"
              >
                 <CreditCard className="w-4 h-4 text-white" /> Checkout
              </Button>
            </div>
          )}
        </Card>
      </div>

      <VoidDialog isOpen={isVoidOpen} onClose={() => setIsVoidOpen(false)} onConfirm={executeVoid} />

      <Dialog open={isReportOpen} onOpenChange={setIsReportOpen}>
         <DialogContent className="sm:max-w-[400px] rounded-[3rem] border-none shadow-2xl p-0 overflow-hidden bg-white">
            <div className="bg-zinc-900 p-10 border-b border-white/10 text-center">
               <BarChart3 className="w-12 h-12 text-primary mx-auto mb-4" />
               <DialogTitle className="font-headline uppercase tracking-widest text-lg text-white">Station Reports</DialogTitle>
               <DialogDescription className="text-[10px] uppercase font-bold text-zinc-400 mt-2">Generate mid-shift or closure summaries.</DialogDescription>
            </div>
            <div className="p-8 space-y-4">
               <button 
                onClick={() => { const periodPaid = todayOrders || []; const total = periodPaid.reduce((sum, o) => sum + o.total, 0); setReceiptData({ type: 'SYSTEM-REPORT', reportType: 'X-REPORT', total, timestamp: Date.now(), items: [{ name: "Gross Sales", quantity: 1, price: total }] }); setCheckoutStep('SUCCESS'); setIsReportOpen(false); setIsCartOpen(true); }}
                className="w-full p-6 bg-zinc-50 rounded-2xl border border-zinc-100 text-left hover:bg-zinc-100 transition-all group flex items-center justify-between"
               >
                  <div>
                     <p className="text-xs font-black uppercase text-zinc-900">X-Report</p>
                     <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest mt-1">Mid-shift summary (Active)</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-zinc-200 group-hover:text-primary transition-all" />
               </button>
               <button 
                onClick={() => { const periodPaid = todayOrders || []; const total = periodPaid.reduce((sum, o) => sum + o.total, 0); setReceiptData({ type: 'SYSTEM-REPORT', reportType: 'Z-REPORT', total, timestamp: Date.now(), items: [{ name: "Gross Sales", quantity: 1, price: total }] }); setCheckoutStep('SUCCESS'); setIsReportOpen(false); setIsCartOpen(true); }}
                className="w-full p-6 bg-zinc-50 rounded-2xl border border-zinc-100 text-left hover:bg-zinc-100 transition-all group flex items-center justify-between"
               >
                  <div>
                     <p className="text-xs font-black uppercase text-zinc-900">Z-Report</p>
                     <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest mt-1">Shift closure (Today)</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-zinc-200 group-hover:text-primary transition-all" />
               </button>
            </div>
         </DialogContent>
      </Dialog>
    </div>
  );
}
