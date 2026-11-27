'use client';

import { useBusinessClock } from '@/hooks/use-business-clock';

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
import { useDb, useUser, useCollection, useMemoSupabase, errorEmitter, FirestorePermissionError } from '@/lib/data';
import { collection, query, where, addDoc, doc, getDoc, updateDoc, onSnapshot, orderBy, limit, writeBatch, increment } from '@/lib/db';
import { HardwareService } from '@/lib/hardware-service';
import { useProfile } from '@/hooks/use-profile';
import { POSProductCard } from '@/components/pos/pos-product-card';
import { POSCartItem } from '@/components/pos/pos-cart-item';
import { PaymentView } from '@/components/pos/payment-view';
import { VoidDialog } from '@/components/pos/void-dialog';
import { MobileCartButton } from '@/components/pos/mobile-cart-button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { CustomerLookup } from '@/components/pos/customer-lookup';
import { ReceiptPreview } from '@/components/pos/receipt-preview';
import { useBarcodeScanner } from '@/hooks/use-barcode-scanner';
import { useTerminal } from '@/hooks/use-terminal';
import { notifyCommittedSale } from '@/lib/telegram/client-notifications';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const CATEGORIES = ['Popular', 'Drinks', 'Food', 'Liquor', 'Tobacco', 'Other'];

export default function LoungePOS() {
  const firestore = useDb();
  const { user } = useUser();
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
  const [isTableSelectorOpen, setIsTableSelectorOpen] = useState(false);
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

  const loungeQuery = useMemoSupabase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'inventory'), where('unit', '==', 'LOUNGE'));
  }, [firestore]);

  const ordersBaseQuery = useMemoSupabase(() => {
    if (!firestore || !activeCashier?.uid) return null;
    return query(
      collection(firestore, 'users', activeCashier.uid, 'held_bills'),
      where('type', '==', 'LOUNGE')
    );
  }, [firestore, activeCashier?.uid]);

  const { startOfToday } = useBusinessClock();
  const todayOrdersQuery = useMemoSupabase(() => {
    if (!firestore) return null;
    return query(
      collection(firestore, 'orders'),
      where('type', '==', 'LOUNGE'),
      where('timestamp', '>=', startOfToday),
      where('status', '==', 'PAID')
    );
  }, [firestore, startOfToday]);

  const { data: products, loading: productsLoading, error: productsError } = useCollection<Product>(loungeQuery);
  const { data: rawPendingOrders } = useCollection<Order>(ordersBaseQuery);
  const { data: todayOrders } = useCollection<Order>(todayOrdersQuery);

  const pendingOrders = useMemo(() => {
    if (!rawPendingOrders) return [];
    const base = [...rawPendingOrders].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    if (!recallSearch) return base;
    return base.filter(o => (o.tableNumber || '').includes(recallSearch.toUpperCase()));
  }, [rawPendingOrders, recallSearch]);

  useEffect(() => {
    if (!firestore || !isAuthorized || !activeCashier?.uid) return;
    // READY orders enter this filtered result set when the kitchen changes their
    // preparation status, so the listener does not need to scan unrelated orders.
    const q = query(collection(firestore, 'orders'), where('type', '==', 'LOUNGE'));
    const observedPrepStates = new Map<string, string | undefined>();
    let initialSnapshot = true;
    const unsubscribe = onSnapshot(q, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type !== 'added' && change.type !== 'modified') return;
        const order = change.doc.data() as Order;
        const orderId = change.doc.id;
        const previousStatus = observedPrepStates.get(orderId);
        observedPrepStates.set(orderId, order.prepStatus);
        if (initialSnapshot || order.prepStatus !== 'READY' || previousStatus === 'READY') return;
        if (order.cashierId !== activeCashier.uid || notifiedReadyOrders.has(orderId)) return;
        notifiedReadyOrders.add(orderId);
        toast({
          title: "Kitchen Alert: Order Ready",
          description: `Table ${order.tableNumber || 'WALK-IN'} is ready.`,
        });
      });
      initialSnapshot = false;
    }, (error) => {
      console.error('[LOUNGE] Ready-order subscription failed:', error);
    });
    return () => unsubscribe();
  }, [firestore, isAuthorized, notifiedReadyOrders, activeCashier?.uid]);

  const filteredProducts = useMemo(() => {
    if (!products) return [];
    return products.filter(p => {
      const matchesCategory = activeCategory === 'Popular' || p.category === activeCategory;
      const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [products, activeCategory, searchTerm]);

  const addToCart = (product: Product) => {
    if (product.price === null || product.price === undefined || product.price <= 0) {
      toast({
        variant: "destructive",
        title: "Price Required",
        description: `Please set a price for ${product.name} in Inventory before selling.`
      });
      return;
    }
    const hasUntrackedStock = (product as any).track_stock === false || product.stockLevel === null || product.stockLevel === undefined;
    if (!hasUntrackedStock && (product.stockLevel ?? 0) <= 0) {
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
      return [...prev, { productId: product.id!, name: product.name, price: product.price!, quantity: 1, category: product.category, status: 'DRAFT' }];
    });
    setCheckoutStep('CART');
  };

  useBarcodeScanner((barcode) => {
    if (!isAuthorized) return;
    const product = products?.find(p => p.barcode === barcode);
    if (product) addToCart(product);
  });

  const updateQuantity = (id: string, delta: number) => {
    setCart(prev => prev.flatMap(item => {
      if (item.productId !== id) return [item];
      const quantity = item.quantity + delta;
      return quantity > 0 ? [{ ...item, quantity }] : [];
    }));
  };

  const removeCartItem = (id: string) => {
    setCart(prev => prev.filter(item => item.productId !== id));
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
      setIsTableSelectorOpen(true);
      toast({ title: "Select a table", description: "Choose a lounge table before holding this bill." });
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
      terminalId: activeTerminal?.id || 'UAX-NODE',
      terminalName: activeTerminal?.name || 'Unassigned POS',
      registerSessionId: activeRegisterSession?.id || null,
      branchId: activeCashier.activeBranchId || activeCashier.branchIds?.[0] || null,
      timestamp: Date.now(),
      paidAt: Date.now(),
      cashTendered: method === 'CASH' ? (metadata?.cashReceived ?? totalValue) : null,
      changeDue: method === 'CASH' ? (metadata?.change ?? 0) : null,
      inventorySynced: true,
      items: cart.map(item => ({ ...item, status: 'COMMITTED' as const }))
    };

    const batch = writeBatch(firestore);
    const orderRef = editingOrderId
      ? doc(firestore, 'orders', editingOrderId)
      : doc(collection(firestore, 'orders'));
    // Recalled held bills already have a PENDING master order. Finalize that
    // same record instead of creating a second order with a different ref.
    batch.set(orderRef, orderData, { merge: true });

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
        await notifyCommittedSale(user, orderRef.id);
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


  const handleMpesaInitiate = async (phone: string): Promise<string> => {
    if (!firestore || !activeCashier || cart.length === 0 || !user) throw new Error('The cashier session is not ready.');
    setIsProcessing(true);
    try {
      const totalValue = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
      const orderData: any = {
        type: 'LOUNGE',
        status: 'PENDING',
        total: totalValue,
        paymentMethod: 'MPESA',
        paymentStatus: 'AWAITING_PAYMENT',
        paymentAmount: totalValue,
        amountCurrency: 'KES',
        cashierId: activeCashier.uid,
        cashierName: activeCashier.displayName,
        terminalId: activeTerminal?.id || 'UAX-NODE',
        terminalName: activeTerminal?.name || 'Unassigned POS',
        registerSessionId: activeRegisterSession?.id || null,
        branchId: activeCashier.activeBranchId || activeCashier.branchIds?.[0] || null,
        timestamp: Date.now(),
        items: cart.map(item => ({ ...item, status: 'COMMITTED' })),
        inventorySynced: false,
        tableNumber: tableNumber || 'WALK-IN',
        
      };
      const orderRef = editingOrderId ? doc(firestore, 'orders', editingOrderId) : doc(collection(firestore, 'orders'));
      const batch = writeBatch(firestore);
      batch.set(orderRef, orderData, { merge: true });
      await batch.commit();
      const token = await user.getIdToken();
      const response = await fetch('/api/payments/mpesa/initiate', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: orderRef.id, phone }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        await updateDoc(orderRef, { paymentStatus: 'FAILED', paymentFailureReason: String(result.message || 'Unable to start M-Pesa payment.'), paymentFailedAt: Date.now() });
        throw new Error(result.message || 'Unable to start M-Pesa payment.');
      }
      toast({ title: 'M-Pesa prompt sent', description: result.message || 'Check the phone and enter the M-Pesa PIN.' });
      return orderRef.id;
    } catch (error) {
      setIsProcessing(false);
      throw error;
    } finally {
      setIsProcessing(false);
    }
  };

  const handleMpesaPaid = async (orderId: string) => {
    if (!firestore) return;
    const snapshot = await getDoc(doc(firestore, 'orders', orderId));
    if (!snapshot.exists()) return;
    const finalReceipt = { ...snapshot.data(), id: snapshot.id };
    // Dispatch only after the server-confirmed M-Pesa order is marked PAID.
    await notifyCommittedSale(user, orderId);
    await HardwareService.printReceipt(finalReceipt);
    setReceiptData(finalReceipt);
    setCheckoutStep('SUCCESS');
    setCart([]);
    setEditingOrderId(null);
    setTableNumber('');
    
    setSelectedCustomer(null);
    setIsProcessing(false);
    toast({ title: 'M-Pesa payment confirmed', description: 'Safaricom verified the payment and the sale is complete.' });
  };

  const handleNewTransaction = () => {
    setCart([]);
    setTableNumber('');
    setEditingOrderId(null);
    setReceiptData(null);
    setCheckoutStep('CART');
    setSelectedCustomer(null);
  };

  const handleCancelHeldBill = async (order: Order) => {
    if (!firestore || !activeCashier || !order.id) return;
    if (!window.confirm(`Cancel held bill #${order.id.slice(-6).toUpperCase()}?`)) return;
    setIsProcessing(true);
    try {
      const batch = writeBatch(firestore);
      batch.delete(doc(firestore, 'users', activeCashier.uid, 'held_bills', order.id));
      batch.set(doc(firestore, 'orders', order.id), { status: 'CANCELLED', cancelledAt: Date.now() }, { merge: true });
      await batch.commit();
      toast({ title: 'Held bill cancelled' });
    } catch (error) {
      console.error('[CANCEL_HELD_BILL_ERROR]', error);
      toast({ variant: 'destructive', title: 'Could not cancel held bill' });
    } finally {
      setIsProcessing(false);
    }
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

  if (!isHydrated) {
    return (
      <div role="status" aria-live="polite" className="flex min-h-[calc(100dvh-5.5rem)] flex-col items-center justify-center gap-3 bg-white text-zinc-400">
        <span className="h-7 w-7 animate-spin rounded-full border-2 border-zinc-200 border-t-primary" />
        <span className="text-[10px] font-bold uppercase tracking-widest">Restoring terminal and connecting to items…</span>
      </div>
    );
  }

  return (
    <div className="ua-pos-workspace h-[calc(100vh-9rem)] flex flex-col md:flex-row gap-6 overflow-hidden relative">
      <div className="flex-1 flex flex-col gap-6 overflow-hidden">
        <header className="space-y-4 px-1">
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
              <Button type="button" variant="outline" onClick={() => setIsTableSelectorOpen(true)} className="w-full h-14 justify-start gap-3 bg-white border-zinc-100 shadow-sm rounded-xl font-black uppercase">
                <TableIcon className="w-4 h-4 text-primary" />
                <span>{tableNumber ? `TABLE ${tableNumber}` : 'SELECT TABLE'}</span>
                <ChevronRight className="w-4 h-4 ml-auto text-zinc-400" />
              </Button>
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
          {productsLoading || products === null ? (
              <div role="status" aria-live="polite" className="flex min-h-36 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-zinc-200 bg-white text-center">
                <span className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-200 border-t-primary" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Loading items from inventory…</span>
              </div>
            ) : productsError ? (
              <div role="alert" className="rounded-xl border border-red-100 bg-red-50 p-4 text-center text-xs font-semibold text-red-700">
                Could not load items. Check the connection and reload this page.
              </div>
            ) : products.length === 0 ? (
              <div className="py-12 text-center text-xs font-semibold text-zinc-400">No items are configured for this station yet.</div>
            ) : filteredProducts.map((p) => (
            <POSProductCard key={p.id} product={p} onAdd={() => addToCart(p)} />
          ))}
        </div>
      </div>

      {!isCartOpen && <MobileCartButton itemCount={cart.reduce((count, item) => count + item.quantity, 0)} onClick={() => { setCheckoutStep('CART'); setIsCartOpen(true); }} />}
      <div className={cn("ua-staff-cart fixed inset-0 z-[1200] md:relative md:inset-auto md:z-0 md:w-[420px] md:flex shrink-0 transition-transform duration-300 md:translate-x-0", isCartOpen ? "translate-x-0" : "translate-x-full md:translate-x-0")}>
        <div className="absolute inset-0 bg-black/40 md:hidden" onClick={() => setIsCartOpen(false)} />
        <Card className="relative h-full flex flex-col shadow-2xl md:shadow-mobile border-none rounded-none md:rounded-xl overflow-hidden bg-white ml-auto w-full max-w-[420px] border border-zinc-100">
          
          <CardHeader className="border-b border-zinc-50 p-6 flex flex-row items-center justify-between shrink-0 h-20">
            {(checkoutStep === 'CART' || checkoutStep === 'RECALL') && (
              <>
                <div className="flex items-center gap-3">
                   {checkoutStep === 'RECALL' ? (
                     <Button type="button" variant="ghost" size="icon" aria-label="Back to cart" onClick={() => setCheckoutStep('CART')} className="h-11 w-11 shrink-0 rounded-lg bg-zinc-50"><ArrowLeft className="w-4 h-4" /></Button>
                   ) : (
                     <Button type="button" variant="ghost" size="icon" aria-label="Back to products" onClick={() => setIsCartOpen(false)} className="h-11 w-11 shrink-0 rounded-lg bg-zinc-50 text-zinc-600 md:hidden"><ArrowLeft className="w-4 h-4" /></Button>
                   )}
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
                    <div key={order.id} className="ua-held-bill p-5 bg-white border border-zinc-100 rounded-xl shadow-none space-y-3 group hover:border-primary/20 transition-all">
                       <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                             <div className="w-10 h-10 rounded-xl bg-zinc-50 border border-zinc-100 flex flex-col items-center justify-center text-zinc-400 group-hover:bg-primary/5 group-hover:text-primary group-hover:border-primary/10 transition-all">
                                <span className="text-[8px] font-black uppercase leading-none mb-0.5">TABLE</span>
                                <span className="text-lg font-black leading-none">{order.tableNumber || 'W'}</span>
                             </div>
                             <div>
                                <p className="text-[10px] font-black text-zinc-900">KES {order.total.toLocaleString()}</p>
                                <p className="text-[8px] font-bold text-zinc-400 uppercase tracking-widest mt-1">Ref #{order.id?.slice(-6).toUpperCase()}</p>
                                <p className="mt-1 text-[10px] text-zinc-500">{order.items?.length || 0} items · {new Date(order.timestamp || Date.now()).toLocaleString()}</p>
                             </div>
                          </div>
                          <div className="flex gap-2">
                             <Button type="button" onClick={() => HardwareService.printReceipt(order)} variant="outline" size="icon" aria-label="Print held bill" className="h-8 w-8 rounded-lg border-zinc-100 text-zinc-500 hover:text-primary"><Printer className="w-4 h-4" /></Button>

                             <Button onClick={() => loadPendingOrder(order)} size="sm" className="h-8 px-3 bg-zinc-900 text-white rounded-lg text-[9px] font-black uppercase">Open</Button>
                             <Button type="button" onClick={() => handleCancelHeldBill(order)} disabled={isProcessing} variant="ghost" size="icon" aria-label="Cancel held tab" className="h-10 w-10 rounded-lg text-zinc-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></Button>
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
                cart.map((item, idx) => <POSCartItem key={`${item.productId}-${idx}`} item={{...item, id: item.productId}} onUpdate={updateQuantity} onRemove={removeCartItem} />)
              )
            )}
            
            {checkoutStep === 'PAYMENT' && (
              <div className="animate-in slide-in-from-right-4 duration-300">
                <PaymentView 
                  total={total} 
                  onComplete={handleFinalizeSale}
                  onMpesa={handleMpesaInitiate}
                  onMpesaPaid={handleMpesaPaid}
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

      <Dialog open={isTableSelectorOpen} onOpenChange={setIsTableSelectorOpen}>
        <DialogContent className="w-[calc(100%-1rem)] max-w-2xl max-h-[90dvh] overflow-y-auto rounded-2xl p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-black uppercase tracking-wide">Select lounge table</DialogTitle>
            <DialogDescription>Choose one of the 18 customer tables. The pool table is not selectable.</DialogDescription>
          </DialogHeader>
          <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-2 sm:p-4">
            <p className="mb-3 text-center text-[9px] font-black tracking-[0.2em] text-zinc-400">LOUNGE FLOOR PLAN</p>
            <div className="grid grid-cols-6 grid-rows-5 gap-1.5 sm:gap-2">
              {[
                ...Array.from({ length: 6 }, (_, i) => ({ n: i + 1, row: 1, col: i + 1 })),
                ...[7, 8, 9].map((n, i) => ({ n, row: i + 2, col: 1 })),
                ...[10, 11, 12].map((n, i) => ({ n, row: i + 2, col: 6 })),
                ...Array.from({ length: 6 }, (_, i) => ({ n: i + 13, row: 5, col: i + 1 })),
              ].map(({ n, row, col }) => (
                <Button key={n} type="button" variant="outline" onClick={() => setTableNumber(String(n).padStart(2, '0'))} style={{ gridRow: row, gridColumn: col }} className={cn("h-10 min-w-0 rounded-lg border-zinc-200 bg-white px-1 text-xs font-black sm:h-12", tableNumber === String(n).padStart(2, '0') && "border-primary bg-primary text-white hover:bg-primary hover:text-white")}>{String(n).padStart(2, '0')}</Button>
              ))}
              <div style={{ gridColumn: '2 / span 4', gridRow: '2 / span 3' }} className="flex min-h-28 items-center justify-center rounded-lg border-2 border-blue-300 bg-blue-100 px-2 text-center text-xs font-black tracking-widest text-blue-900 sm:min-h-36">
                POOL TABLE<br />CENTRE
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-bold text-zinc-600">{tableNumber ? `Selected: Table ${tableNumber}` : 'No table selected'}</p>
            <Button type="button" onClick={() => setIsTableSelectorOpen(false)} disabled={!tableNumber} className="h-11 rounded-lg bg-primary px-5 text-xs font-black uppercase text-white">Use table</Button>
          </div>
        </DialogContent>
      </Dialog>

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
