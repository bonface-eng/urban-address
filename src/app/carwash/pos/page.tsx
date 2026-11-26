
'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { getAuth } from 'firebase/auth';
import { 
  Car, 
  Search, 
  Clock,
  CreditCard,
  Printer,
  RefreshCcw,
  Maximize2,
  Smartphone,
  ShoppingBag,
  History,
  BarChart3,
  ChevronRight,
  ArrowLeft,
  CheckCircle2,
  PlusCircle,
  Hash,
  Trash2,
  AlertTriangle,
  Check
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Product, CarwashJob, UserProfile, Order, OrderItem } from '@/lib/types';
import { toast } from '@/hooks/use-toast';
import { useFirestore, useUser, useCollection, useMemoFirebase, errorEmitter, FirestorePermissionError } from '@/firebase';
import { collection, query, where, addDoc, doc, updateDoc, orderBy, limit, getDoc, increment, writeBatch, setDoc } from 'firebase/firestore';
import { HardwareService } from '@/lib/hardware-service';
import { POSProductCard } from '@/components/pos/pos-product-card';
import { POSCartItem } from '@/components/pos/pos-cart-item';
import { PaymentView } from '@/components/pos/payment-view';
import { VoidDialog } from '@/components/pos/void-dialog';
import { MobileCartButton } from '@/components/pos/mobile-cart-button';
import { ReceiptPreview } from '@/components/pos/receipt-preview';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { VEHICLE_MAKES, VEHICLE_MODELS, MAKE_LOGOS } from '@/lib/vehicle-data';
import { useTerminal } from '@/hooks/use-terminal';
import { notifyCommittedSale } from '@/lib/telegram/client-notifications';
import { notifyTelegramClientEvent } from '@/lib/telegram/client-events';
import { useBarcodeScanner } from '@/hooks/use-barcode-scanner';
import { CustomerLookup } from '@/components/pos/customer-lookup';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';

function VehicleMakeLogo({ make, size = 'sm' }: { make?: string; size?: 'sm' | 'lg' }) {
  const [hasError, setHasError] = useState(false);
  const cleanMake = make ? make.toUpperCase().trim() : '';
  const src = cleanMake && !hasError ? MAKE_LOGOS[cleanMake] : undefined;
  const dim = size === 'lg' ? 'w-8 h-8' : 'w-5 h-5';
  if (!src) return <div className={`${dim} rounded bg-zinc-100 flex items-center justify-center text-[9px] font-black text-zinc-400 shrink-0 uppercase`}>{cleanMake ? cleanMake[0] : '?'}</div>;
  return <img src={src} alt={cleanMake} className={`${dim} object-contain shrink-0`} onError={() => setHasError(true)} loading="lazy" />;
}

const QUICK_COLORS = [
  { name: 'White', hex: '#FFFFFF', border: 'border-zinc-200' },
  { name: 'Black', hex: '#000000', border: 'border-zinc-800' },
  { name: 'Silver', hex: '#C0C0C0', border: 'border-zinc-300' },
  { name: 'Red', hex: '#E60000', border: 'border-red-600' },
  { name: 'Blue', hex: '#0000FF', border: 'border-blue-600' },
];

export default function CarwashPOS() {
  const firestore = useFirestore();
  const { user } = useUser();
  const { activeTerminal, activeCashier, activeRegisterSession } = useTerminal();
  
  // Persistent State Logic
  const [isHydrated, setIsHydrated] = useState(false);
  const [cart, setCart] = useState<OrderItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [recallSearch, setRecallSearch] = useState('');
  const [jobType, setJobType] = useState<'VEHICLE' | 'CARPET'>('VEHICLE');
  const [checkoutStep, setCheckoutStep] = useState<'CART' | 'PAYMENT' | 'SUCCESS' | 'RECALL'>('CART');
  
  const [plateNumber, setPlateNumber] = useState(''); 
  const [vehicleColor, setVehicleColor] = useState('#FFFFFF');
  const [vehicleMake, setVehicleMake] = useState('');
  const [vehicleModel, setVehicleModel] = useState('');
  const [attendantId, setAttendantId] = useState('');
  const [carpetDimensions, setCarpetDimensions] = useState('');
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [receiptData, setReceiptData] = useState<any>(null);
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  const [showPlateSuggestions, setShowPlateSuggestions] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<UserProfile | null>(null);

  const [isVoidOpen, setIsVoidOpen] = useState(false);
  const [pendingVoidAction, setPendingVoidAction] = useState<{ type: 'SINGLE' | 'CLEAR' | 'DELETE_PENDING', id?: string } | null>(null);

  // Recall Node States
  const [showReconcileForId, setShowReconcileForId] = useState<string | null>(null);
  const [showCancelForId, setShowCancelForId] = useState<string | null>(null);
  const [reconcileCodes, setReconcileCodes] = useState<Record<string, string>>({});

  // Load state on mount
  useEffect(() => {
    const saved = sessionStorage.getItem('uax_carwash_pos_state');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.cart) setCart(parsed.cart);
        if (parsed.jobType) setJobType(parsed.jobType);
        if (parsed.plateNumber) setPlateNumber(parsed.plateNumber);
        if (parsed.vehicleMake) setVehicleMake(parsed.vehicleMake);
        if (parsed.vehicleModel) setVehicleModel(parsed.vehicleModel);
        if (parsed.vehicleColor) setVehicleColor(parsed.vehicleColor);
        if (parsed.attendantId) setAttendantId(parsed.attendantId);
        if (parsed.carpetDimensions) setCarpetDimensions(parsed.carpetDimensions);
        if (parsed.editingOrderId) setEditingOrderId(parsed.editingOrderId);
        if (parsed.checkoutStep) setCheckoutStep(parsed.checkoutStep);
        if (parsed.selectedCustomer) setSelectedCustomer(parsed.selectedCustomer);
        if (parsed.isCartOpen) setIsCartOpen(parsed.isCartOpen);
      } catch (e) {
        console.error('Failed to restore carwash pos state');
      }
    }
    setIsHydrated(true);
  }, []);

  // Save state on change
  useEffect(() => {
    if (!isHydrated) return;
    const state = {
      cart, jobType, plateNumber, vehicleMake, vehicleModel, vehicleColor,
      attendantId, carpetDimensions, editingOrderId, checkoutStep, 
      selectedCustomer, isCartOpen
    };
    sessionStorage.setItem('uax_carwash_pos_state', JSON.stringify(state));
  }, [cart, jobType, plateNumber, vehicleMake, vehicleModel, vehicleColor, attendantId, carpetDimensions, editingOrderId, checkoutStep, selectedCustomer, isCartOpen, isHydrated]);

  useEffect(() => {
    if (!firestore || !plateNumber || plateNumber.length < 3 || jobType === 'CARPET') return;
    const normalized = plateNumber.toUpperCase().trim();
    const timer = setTimeout(async () => {
      try {
        const vRef = doc(firestore, 'vehicles', normalized);
        const vSnap = await getDoc(vRef);
        if (vSnap.exists()) {
          const data = vSnap.data();
          if (data.make) setVehicleMake(data.make);
          if (data.model) setVehicleModel(data.model);
          if (data.color) setVehicleColor(data.color);
        }
      } catch (err) {}
    }, 500);
    return () => clearTimeout(timer);
  }, [firestore, plateNumber, jobType]);

  const servicesQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'inventory'), where('unit', '==', 'CARWASH'));
  }, [firestore]);

  const attendantsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'users'), where('role', '==', 'ATTENDANT'));
  }, [firestore]);

  const recentJobsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'carwash_jobs'), orderBy('timestamp', 'desc'), limit(150));
  }, [firestore]);

  const ordersBaseQuery = useMemoFirebase(() => {
    if (!firestore || !activeCashier?.uid) return null;
    return query(
      collection(firestore, 'users', activeCashier.uid, 'held_bills'),
      where('type', '==', 'CARWASH'),
      limit(500)
    );
  }, [firestore, activeCashier?.uid]);

  const { data: services, loading: servicesLoading, error: servicesError } = useCollection<Product>(servicesQuery);
  const { data: attendants } = useCollection<UserProfile>(attendantsQuery);
  const { data: recentJobs } = useCollection<CarwashJob>(recentJobsQuery);
  const { data: rawPendingOrders } = useCollection<Order>(ordersBaseQuery);

  const pendingOrders = useMemo(() => {
    if (!rawPendingOrders) return [];
    const base = [...rawPendingOrders].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    if (!recallSearch) return base;
    return base.filter(o => (o.plateNumber || '').includes(recallSearch.toUpperCase()));
  }, [rawPendingOrders, recallSearch]);

  const plateSuggestions = useMemo(() => {
    if (jobType !== 'VEHICLE' || !plateNumber || plateNumber.length < 2) return [];
    const normalizedInput = plateNumber.toUpperCase().trim();
    const suggestionsMap = new Map<string, { plate: string; make?: string; model?: string; color?: string }>();
    (recentJobs || []).forEach(job => {
      const p = (job.plateNumber || '').toUpperCase().trim();
      if (p && p.includes(normalizedInput)) {
        if (!suggestionsMap.has(p)) {
          suggestionsMap.set(p, { plate: p, make: job.vehicleMake, model: job.vehicleModel, color: job.vehicleColor });
        }
      }
    });
    return Array.from(suggestionsMap.values()).slice(0, 6);
  }, [recentJobs, plateNumber, jobType]);

  const handleSelectSuggestion = (s: { plate: string; make?: string; model?: string; color?: string }) => {
    setPlateNumber(s.plate);
    if (s.make) setVehicleMake(s.make);
    if (s.model) setVehicleModel(s.model);
    if (s.color) setVehicleColor(s.color);
    setShowPlateSuggestions(false);
  };

  const filteredServices = useMemo(() => {
    if (!services) return [];
    return services.filter(s => {
      const matchesSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase());
      const isCarpetService = s.category === 'Carpets and Rugs';
      if (jobType === 'CARPET') return matchesSearch && isCarpetService;
      return matchesSearch && !isCarpetService;
    });
  }, [services, searchTerm, jobType]);

  const addToCart = (product: Product) => {
    setCart(prev => {
      const exists = prev.find(i => i.productId === product.id);
      if (exists) return prev;
      return [...prev, { productId: product.id!, name: product.name, price: product.price, quantity: 1, category: product.category, status: 'DRAFT', commission: product.commission || 30 }];
    });
    setCheckoutStep('CART');
  };

  useBarcodeScanner((barcode) => {
    const product = services?.find(s => s.barcode === barcode);
    if (product) { addToCart(product); toast({ title: "Item Added", description: product.name }); }
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
    if (!pendingVoidAction) return;
    if (pendingVoidAction.type === 'CLEAR') {
      setCart([]); setEditingOrderId(null); setPlateNumber(''); setCheckoutStep('CART');
    } else if (pendingVoidAction.id) {
      setCart(prev => prev.filter(i => i.productId !== pendingVoidAction.id));
    }
    setPendingVoidAction(null);
    setIsVoidOpen(false);
  };

  const handleHoldOrder = () => {
    if (!firestore || !activeCashier || cart.length === 0) return;
    if (jobType === 'VEHICLE' && !plateNumber) { toast({ variant: "destructive", title: "Plate Required" }); return; }

    setIsProcessing(true);
    const totalValue = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const attendantName = attendants?.find(a => a.uid === attendantId)?.displayName || 'Unassigned';
    
    const orderData: any = {
      type: 'CARWASH' as const, jobType, status: 'PENDING' as const, total: totalValue, cashierId: activeCashier.uid,
      cashierName: activeCashier.displayName, timestamp: Date.now(), items: cart.map(i => ({ ...i, status: 'COMMITTED' as const })),
      plateNumber: plateNumber.toUpperCase().trim(), vehicleMake: jobType === 'VEHICLE' ? vehicleMake : 'CARPET',
      vehicleModel: jobType === 'VEHICLE' ? vehicleModel : 'SERVICE', vehicleColor, carpetDimensions: jobType === 'CARPET' ? carpetDimensions : null,
      attendantId: attendantId || 'Unassigned', attendantName, customerId: selectedCustomer?.uid || null
    };

    const heldRef = editingOrderId ? doc(firestore, 'users', activeCashier.uid, 'held_bills', editingOrderId) : doc(collection(firestore, 'users', activeCashier.uid, 'held_bills'));
    const masterOrderRef = doc(firestore, 'orders', heldRef.id);
    const batch = writeBatch(firestore);
    batch.set(heldRef, orderData, { merge: true });
    batch.set(masterOrderRef, orderData, { merge: true });
    if (jobType === 'VEHICLE' && orderData.plateNumber) {
      batch.set(doc(firestore, 'vehicles', orderData.plateNumber), { plateNumber: orderData.plateNumber, make: orderData.vehicleMake, model: orderData.vehicleModel, color: orderData.vehicleColor, lastSeen: Date.now() }, { merge: true });
    }

    batch.commit().then(async () => {
      setReceiptData({ ...orderData, id: heldRef.id });
      setCheckoutStep('SUCCESS');
      toast({ title: "Booking Saved" });
      setCart([]); setPlateNumber(''); setVehicleMake(''); setVehicleModel(''); setAttendantId(''); setCarpetDimensions(''); setSelectedCustomer(null); setEditingOrderId(null); setIsProcessing(false);
    }).catch(async (err) => {
      setIsProcessing(false);
      errorEmitter.emit('permission-error', new FirestorePermissionError({ path: masterOrderRef.path, operation: 'write', requestResourceData: orderData }));
    });
  };

  const handleFinalizeSale = async (method: 'CASH' | 'MOBILE', metadata?: any) => {
    if (!firestore || !activeCashier || cart.length === 0) return;
    setIsProcessing(true);
    const totalValue = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const totalCommission = cart.reduce((sum, item) => sum + ((item.price * item.quantity * (item.commission || 30)) / 100), 0);
    const attendantName = attendants?.find(a => a.uid === attendantId)?.displayName || 'Unassigned';

    const orderData: any = {
      type: 'CARWASH' as const, jobType, status: 'PAID' as const, total: totalValue, paymentMethod: method,
      paymentRef: metadata?.reference || null, cashierId: activeCashier.uid, cashierName: activeCashier.displayName,
      terminalId: activeTerminal?.id || 'UAX-NODE', terminalName: activeTerminal?.name || 'Unassigned POS',
      registerSessionId: activeRegisterSession?.id || null,
      branchId: activeCashier.activeBranchId || activeCashier.branchIds?.[0] || null,
      timestamp: Date.now(),
      paidAt: Date.now(),
      cashTendered: method === 'CASH' ? (metadata?.cashReceived ?? totalValue) : null,
      changeDue: method === 'CASH' ? (metadata?.change ?? 0) : null, inventorySynced: true, items: cart.map(i => ({ ...i, status: 'COMMITTED' as const })), plateNumber: plateNumber.toUpperCase().trim(),
      vehicleMake: jobType === 'VEHICLE' ? vehicleMake : 'CARPET', vehicleModel: jobType === 'VEHICLE' ? vehicleModel : 'SERVICE',
      vehicleColor, carpetDimensions: jobType === 'CARPET' ? carpetDimensions : null, attendantId: attendantId || 'Unassigned',
      attendantName, customerId: selectedCustomer?.uid || null
    };

    const batch = writeBatch(firestore);
    const orderRef = editingOrderId
      ? doc(firestore, 'orders', editingOrderId)
      : doc(collection(firestore, 'orders'));
    // Recalled held bills already have a PENDING master order. Finalize that
    // same record instead of creating a second order with a different ref.
    batch.set(orderRef, orderData, { merge: true });

    // Deduct stock for physical inventory attached to wash
    for (const item of cart) {
      if (item.productId) {
        const productRef = doc(firestore, 'inventory', item.productId);
        batch.update(productRef, {
          stockLevel: increment(-item.quantity),
          updatedAt: Date.now()
        });
      }
    }

    batch.set(doc(collection(firestore, 'carwash_jobs')), { orderId: orderRef.id, jobType, plateNumber: orderData.plateNumber, vehicleMake: orderData.vehicleMake, vehicleModel: orderData.vehicleModel, vehicleColor: orderData.vehicleColor, carpetDimensions: orderData.carpetDimensions, service: cart.length === 1 ? cart[0].name : `${cart.length} Services`, price: totalValue, commission: totalCommission, status: 'QUEUED', attendantId: attendantId || 'Unassigned', attendantName, timestamp: Date.now() });
    if (jobType === 'VEHICLE' && orderData.plateNumber) batch.set(doc(firestore, 'vehicles', orderData.plateNumber), { plateNumber: orderData.plateNumber, make: orderData.vehicleMake, model: orderData.vehicleModel, color: orderData.vehicleColor, lastSeen: Date.now() }, { merge: true });
    if (editingOrderId) batch.delete(doc(firestore, 'users', activeCashier.uid, 'held_bills', editingOrderId));

    batch.commit().then(async () => {
      const finalReceipt = { ...orderData, id: orderRef.id };
      await notifyCommittedSale(user, orderRef.id);
      await notifyTelegramClientEvent(getAuth().currentUser, { type: 'CARWASH_NEW', jobId: orderRef.id, plate: orderData.plateNumber, service: cart.map(i => i.name).join(', '), attendant: attendantName, amount: totalValue });
      await HardwareService.printReceipt(finalReceipt);
      setReceiptData(finalReceipt);
      setCheckoutStep('SUCCESS');
      setIsProcessing(false);
      toast({ title: "Transaction Authorized" });
    }).catch(async (err) => {
      setIsProcessing(false);
      errorEmitter.emit('permission-error', new FirestorePermissionError({ path: orderRef.path, operation: 'create', requestResourceData: orderData }));
    });
  };


  const handleMpesaInitiate = async (phone: string): Promise<string> => {
    if (!firestore || !activeCashier || cart.length === 0 || !user) throw new Error('The cashier session is not ready.');
    setIsProcessing(true);
    try {
      const totalValue = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
      const orderData: any = {
        type: 'CARWASH',
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
        
        jobType, plateNumber: plateNumber.toUpperCase().trim(), vehicleMake: jobType === 'VEHICLE' ? vehicleMake : 'CARPET', vehicleModel: jobType === 'VEHICLE' ? vehicleModel : 'SERVICE', vehicleColor, carpetDimensions: jobType === 'CARPET' ? carpetDimensions : null, attendantId: attendantId || 'Unassigned', attendantName: attendants?.find(a => a.uid === attendantId)?.displayName || 'Unassigned', commission: cart.reduce((sum, item) => sum + ((item.price * item.quantity * (item.commission || 30)) / 100), 0), customerId: selectedCustomer?.uid || null,
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
    await HardwareService.printReceipt(finalReceipt);
    setReceiptData(finalReceipt);
    setCheckoutStep('SUCCESS');
    setCart([]);
    setEditingOrderId(null);
    
    setPlateNumber(''); setVehicleMake(''); setVehicleModel(''); setAttendantId(''); setCarpetDimensions('');
    setSelectedCustomer(null);
    setIsProcessing(false);
    toast({ title: 'M-Pesa payment confirmed', description: 'Safaricom verified the payment and the sale is complete.' });
  };

  const handleNewTransaction = () => {
    setCart([]); setPlateNumber(''); setVehicleMake(''); setVehicleModel(''); setAttendantId(''); setCarpetDimensions(''); setEditingOrderId(null); setReceiptData(null); setCheckoutStep('CART'); setSelectedCustomer(null);
  };

  const loadPendingOrder = (order: Order) => {
    setCart((order.items || []).map(i => ({ ...i, status: 'COMMITTED' as const })));
    setPlateNumber(order.plateNumber || ''); setVehicleMake(order.vehicleMake || ''); setVehicleModel(order.vehicleModel || ''); setVehicleColor(order.vehicleColor || '#FFFFFF'); setAttendantId(order.attendantId || ''); setCarpetDimensions(order.carpetDimensions || ''); setEditingOrderId(order.id!); setCheckoutStep('CART'); setIsCartOpen(true);
  };

  const handleQuickReconcile = async (order: Order, code: string) => {
    if (!firestore || !activeCashier || !code) return;
    setIsProcessing(true);
    try {
      const batch = writeBatch(firestore);
      batch.update(doc(firestore, 'orders', order.id!), { 
        status: 'PAID', 
        paymentMethod: 'MOBILE', 
        paymentRef: code.toUpperCase(), 
        paidAt: Date.now(),
        inventorySynced: true
      });

      // Deduct stock for reconciled bill
      if (order.items) {
        for (const item of order.items) {
          if (item.productId) {
            batch.update(doc(firestore, 'inventory', item.productId), {
              stockLevel: increment(-item.quantity)
            });
          }
        }
      }

      batch.delete(doc(firestore, 'users', activeCashier.uid, 'held_bills', order.id!));
      await batch.commit();
      toast({ title: "Booking Finalized" });
      setShowReconcileForId(null);
    } catch (e) { toast({ variant: "destructive", title: "Error" }); }
    finally { setIsProcessing(false); }
  };

  const handleCancelBill = async (order: Order) => {
    if (!firestore || !activeCashier) return;
    setIsProcessing(true);
    try {
      const batch = writeBatch(firestore);
      batch.delete(doc(firestore, 'users', activeCashier.uid, 'held_bills', order.id!));
      batch.update(doc(firestore, 'orders', order.id!), { status: 'CANCELLED', cancelledAt: Date.now() });
      await batch.commit();
      toast({ title: "Order Removed" });
      setShowCancelForId(null);
    } catch (e) { toast({ variant: "destructive", title: "Action Failed" }); }
    finally { setIsProcessing(false); }
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
    <div className="ua-staff-pos ua-pos-workspace h-[calc(100dvh-5.5rem)] max-h-[calc(100dvh-5.5rem)] min-h-0 flex flex-col md:flex-row gap-2 md:gap-6 overflow-hidden overscroll-none relative">
      <div className="flex-1 flex flex-col gap-2 md:gap-6 overflow-hidden min-h-0">
        <header className="space-y-1.5 md:space-y-4 bg-white p-2 sm:p-3 md:p-6 rounded-xl md:rounded-[2rem] border border-zinc-100 shadow-sm shrink-0">
           <div className="flex flex-row items-center justify-between gap-2 min-w-0">
              <div className="flex items-center gap-2 min-w-0">
                 <div className="w-8 h-8 md:w-10 md:h-10 rounded-xl md:rounded-2xl bg-primary/10 flex items-center justify-center text-primary shrink-0"><Car className="w-4 h-4 md:w-6 md:h-6" /></div>
                 <h1 className="text-sm sm:text-base md:text-xl font-black text-zinc-900 tracking-tight">Carwash POS Entry</h1>
              </div>
              <div className="flex items-center justify-end gap-1.5 shrink-0">
                 <button onClick={() => { setCheckoutStep('RECALL'); setIsCartOpen(true); }} className="h-8 md:h-10 px-2.5 md:px-5 border border-zinc-100 text-[8px] md:text-[10px] font-bold uppercase tracking-wide gap-1.5 bg-white shadow-sm relative rounded-xl flex items-center group">
                    <Clock className="w-4 h-4" /> Recall Bill
                    {pendingOrders && pendingOrders.length > 0 && <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-primary text-white rounded-lg flex items-center justify-center text-[8px] border-2 border-white animate-blink font-black group-hover:scale-110 transition-all">{pendingOrders.length}</span>}
                 </button>
                 <div className="flex gap-1 bg-zinc-50 p-1 rounded-lg">
                   <Button variant={jobType === 'VEHICLE' ? 'default' : 'ghost'} size="sm" onClick={() => setJobType('VEHICLE')} className={cn("h-8 md:h-9 px-3 md:px-5 rounded-md md:rounded-lg font-bold uppercase text-[9px] tracking-wide", jobType === 'VEHICLE' ? "bg-zinc-900 text-white shadow-lg" : "text-zinc-400")}> Vehicle </Button>
                   <Button variant={jobType === 'CARPET' ? 'default' : 'ghost'} size="sm" onClick={() => setJobType('CARPET')} className={cn("h-8 md:h-9 px-3 md:px-5 rounded-md md:rounded-lg font-bold uppercase text-[9px] tracking-wide", jobType === 'CARPET' ? "bg-zinc-900 text-white shadow-lg" : "text-zinc-400")}> Carpet </Button>
                 </div>
              </div>
           </div>
           <div className="grid grid-cols-2 md:grid-cols-4 gap-x-2 gap-y-1.5 md:gap-4">
              <div className="col-span-1 md:col-span-1 space-y-0.5 md:space-y-1 relative">
                 <Label className="text-[9px] font-black text-zinc-400 uppercase tracking-widest px-1"> {jobType === 'VEHICLE' ? 'Plate Number' : 'Reference / Name'} </Label>
                 <Input placeholder={jobType === 'VEHICLE' ? "KDA 123X" : "e.g. John Doe"} value={plateNumber} onFocus={() => setShowPlateSuggestions(true)} onChange={e => { setPlateNumber(e.target.value.toUpperCase()); setShowPlateSuggestions(true); }} className="h-9 md:h-14 font-bold text-sm md:text-xl px-3 md:px-6 uppercase bg-zinc-50 border-none rounded-lg md:rounded-xl tracking-wide md:tracking-widest" />
                 {showPlateSuggestions && plateSuggestions.length > 0 && jobType === 'VEHICLE' && (
                   <div className="absolute left-0 right-0 top-[calc(100%+6px)] bg-white border border-zinc-100 rounded-2xl shadow-2xl z-50 overflow-hidden divide-y divide-zinc-50 animate-in fade-in slide-in-from-top-1">
                     {plateSuggestions.map(s => <button key={s.plate} type="button" onClick={() => handleSelectSuggestion(s)} className="w-full px-4 py-3 text-left hover:bg-primary/5 transition-colors flex items-center justify-between group"><div className="flex items-center gap-2.5"><VehicleMakeLogo make={s.make} /><div className="w-2.5 h-2.5 rounded-full border border-zinc-200" style={{ backgroundColor: s.color || '#FFFFFF' }} /><span className="font-mono font-black text-sm uppercase text-zinc-900 group-hover:text-primary">{s.plate}</span></div>{s.make && <span className="text-[9px] font-bold text-zinc-400 uppercase">{s.make} {s.model || ''}</span>}</button>)}
                   </div>
                 )}
              </div>
              {jobType === 'VEHICLE' ? (
                <><div className="col-span-1 md:col-span-1 space-y-1"><Label className="text-[9px] font-black text-zinc-400 uppercase tracking-widest px-1">Vehicle Make</Label><Select value={vehicleMake} onValueChange={setVehicleMake}><SelectTrigger className="h-9 md:h-14 bg-zinc-50 border-none rounded-lg md:rounded-xl px-2 md:px-4 font-bold uppercase flex items-center gap-2"><VehicleMakeLogo make={vehicleMake} /><SelectValue placeholder="Brand" /></SelectTrigger><SelectContent className="rounded-2xl border-none shadow-2xl max-h-72">{VEHICLE_MAKES.map(m => <SelectItem key={m} value={m} className="font-bold uppercase py-2"><div className="flex items-center gap-3"><VehicleMakeLogo make={m} /><span>{m}</span></div></SelectItem>)}</SelectContent></Select></div><div className="md:col-span-1 space-y-1.5"><Label className="text-[9px] font-black text-zinc-400 uppercase tracking-widest px-1">Vehicle Model</Label><Select value={vehicleModel} onValueChange={setVehicleModel} disabled={!vehicleMake}><SelectTrigger className="h-9 md:h-14 bg-zinc-50 border-none rounded-lg md:rounded-xl px-3 md:px-6 font-bold uppercase"><SelectValue placeholder="Model" /></SelectTrigger><SelectContent className="rounded-2xl border-none shadow-2xl"> {(VEHICLE_MODELS[vehicleMake] || ['OTHER']).map(m => <SelectItem key={m} value={m} className="font-bold uppercase">{m}</SelectItem>)} </SelectContent></Select></div></>
              ) : (
                <div className="col-span-2 md:col-span-2 space-y-1"><Label className="text-[9px] font-black text-zinc-400 uppercase tracking-widest px-1">Carpet Dimensions</Label><div className="relative"><Maximize2 className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-300" /><Input placeholder="e.g. 5m x 4m" value={carpetDimensions} onChange={e => setCarpetDimensions(e.target.value)} className="h-10 md:h-14 bg-zinc-50 border-none rounded-lg md:rounded-xl pl-10 font-bold" /></div></div>
              )}
              <div className="col-span-1 md:col-span-1 space-y-1"><Label className="text-[9px] font-bold uppercase text-zinc-500 px-1 tracking-wide">Vehicle colour</Label><div className="h-9 md:h-14 bg-zinc-50 rounded-lg md:rounded-xl px-2 md:px-3 flex items-center gap-3"><div className="flex -space-x-1"> {QUICK_COLORS.map(c => <button key={c.hex} onClick={() => setVehicleColor(c.hex)} className={cn("w-7 h-7 rounded-full border-2 transition-all hover:scale-110", vehicleColor === c.hex ? "ring-2 ring-primary ring-offset-1 z-10" : "opacity-40", c.border)} style={{ backgroundColor: c.hex }} />)} </div></div></div>
           </div>
           <div className="grid grid-cols-2 md:grid-cols-3 items-start pt-0 md:pt-2 gap-1.5 md:gap-3">
              <div className="contents">
                 <div className="relative w-full md:flex-1 md:max-w-[250px]"><Select value={attendantId} onValueChange={setAttendantId}><SelectTrigger className="h-9 md:h-11 bg-zinc-50 border-none rounded-lg md:rounded-xl px-2 md:px-4 font-semibold text-[10px]"><SelectValue placeholder="Choose an attendant" /></SelectTrigger><SelectContent className="rounded-xl"> {attendants?.map(a => <SelectItem key={a.uid} value={a.uid} className="font-bold uppercase text-[10px]">{a.displayName}</SelectItem>)} </SelectContent></Select></div>
                 <div className="w-full min-w-0"><CustomerLookup onSelect={setSelectedCustomer} selectedCustomer={selectedCustomer} /></div>
              </div>
              <div className="relative col-span-2 md:col-span-1 min-w-0"><Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" /><Input placeholder="Search available services" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-9 h-9 md:h-11 bg-zinc-50 border-none rounded-lg md:rounded-xl text-[10px] font-semibold" /></div>
           </div>
        </header>
        <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar pb-4"><div className="grid grid-cols-1 gap-2 px-1"> {servicesLoading || services === null ? (
              <div role="status" aria-live="polite" className="flex min-h-36 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-zinc-200 bg-white text-center">
                <span className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-200 border-t-primary" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Loading services from inventory…</span>
              </div>
            ) : servicesError ? (
              <div role="alert" className="rounded-xl border border-red-100 bg-red-50 p-4 text-center text-xs font-semibold text-red-700">
                Could not load services. Check the connection and reload this page.
              </div>
            ) : services.length === 0 ? (
              <div className="py-12 text-center text-xs font-semibold text-zinc-400">No services are configured for this station yet.</div>
            ) : filteredServices.map(s => <POSProductCard key={s.id} product={s} onAdd={() => addToCart(s)} />)} </div></div>
      </div>

      {!isCartOpen && <MobileCartButton itemCount={cart.reduce((count, item) => count + item.quantity, 0)} onClick={() => { setCheckoutStep('CART'); setIsCartOpen(true); }} />}
      <div className={cn("ua-staff-cart fixed inset-0 z-[1200] md:relative md:inset-auto md:z-0 md:w-[420px] md:flex shrink-0 transition-transform duration-300 md:translate-x-0 flex flex-col overflow-hidden bg-white border border-zinc-100 rounded-none md:rounded-xl h-full", isCartOpen ? "translate-x-0" : "translate-x-full md:translate-x-0")}>
         <div className="absolute inset-0 bg-black/40 md:hidden" onClick={() => setIsCartOpen(false)} />
         <div className="relative h-full flex flex-col bg-white overflow-hidden">
            <CardHeader className="border-b border-zinc-50 p-6 pb-4 flex flex-row items-center justify-between shrink-0 h-20">
                {checkoutStep === 'CART' && (
                  <>
                    <div className="flex min-w-0 items-center gap-2">
                      <Button type="button" variant="ghost" size="icon" aria-label="Back to services" onClick={() => setIsCartOpen(false)} className="h-11 w-11 shrink-0 rounded-lg bg-zinc-50 text-zinc-600 md:hidden"><ArrowLeft className="w-4 h-4" /></Button>
                      <CardTitle className="text-sm font-black uppercase tracking-widest">Cart</CardTitle>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => { setPendingVoidAction({ type: 'CLEAR' }); setIsVoidOpen(true); }} className="text-primary font-black uppercase text-[10px]">Clear</Button>
                  </>
                )}
                {checkoutStep === 'RECALL' && (
                  <>
                    <div className="flex items-center gap-3">
                      <Button variant="ghost" size="icon" onClick={() => setCheckoutStep('CART')} className="h-8 w-8 rounded-full bg-zinc-50 text-zinc-400"><ArrowLeft className="w-4 h-4" /></Button>
                      <CardTitle className="text-sm font-black uppercase tracking-widest text-zinc-900"> Bookings </CardTitle>
                    </div>
                    <Badge className="bg-amber-100 text-amber-700 text-[8px] font-black px-2 py-0.5 border-none uppercase">RECALL</Badge>
                  </>
                )}
                {checkoutStep === 'PAYMENT' && (
                  <>
                    <div className="flex items-center gap-3">
                      <Button variant="ghost" size="icon" onClick={() => setCheckoutStep('CART')} className="h-8 w-8 rounded-full bg-zinc-50"><ArrowLeft className="w-4 h-4" /></Button>
                      <CardTitle className="text-sm font-black uppercase">Payment</CardTitle>
                    </div>
                    <Badge variant="outline" className="bg-zinc-900 text-white text-[8px] font-black uppercase px-2 h-4 border-none">Secure</Badge>
                  </>
                )}
                {checkoutStep === 'SUCCESS' && (
                  <>
                    <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-green-500" /> Success</CardTitle>
                    <Button onClick={handleNewTransaction} className="h-8 px-4 bg-primary text-white rounded-xl text-[9px] font-black uppercase gap-2"><PlusCircle className="w-3.5 h-3.5" /> New Job</Button>
                  </>
                )}
             </CardHeader>
            <CardContent className="flex-1 overflow-y-auto p-6 space-y-3 no-scrollbar min-h-0 bg-white">
               {checkoutStep === 'RECALL' && (
                  <div className="space-y-4">
                     <div className="relative mb-4">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-300" />
                        <Input placeholder="Search Plate..." value={recallSearch} onChange={e => setRecallSearch(e.target.value)} className="h-10 pl-9 bg-zinc-50 border-none rounded-xl text-[10px] font-bold" />
                     </div>
                     {pendingOrders.map(order => (
                        <div key={order.id} className="ua-held-bill p-5 bg-white border border-zinc-100 rounded-xl shadow-none space-y-3 group hover:border-primary/20 transition-all">
                           <div className="flex items-center justify-between">
                              <div className="flex items-center gap-4">
                                 <div className="w-12 h-12 rounded-xl bg-zinc-50 border border-zinc-100 flex items-center justify-center text-zinc-400 group-hover:text-primary transition-all">
                                    {order.vehicleMake ? <VehicleMakeLogo make={order.vehicleMake} /> : <Car className="w-6 h-6" />}
                                 </div>
                                 <div>
                                    <p className="text-xs font-black uppercase text-zinc-900">{order.plateNumber || 'WALK-IN'}</p>
                                    <p className="text-[10px] font-black text-primary mt-0.5">KES {order.total.toLocaleString()}</p>
                                    <p className="mt-1 text-[10px] text-zinc-500">{order.items?.length || 0} items · {new Date(order.timestamp || Date.now()).toLocaleString()}</p>
                                 </div>
                              </div>
                              <div className="flex gap-2">
                                 <Button type="button" onClick={() => HardwareService.printReceipt(order)} variant="outline" size="icon" aria-label="Print held bill" className="h-8 w-8 rounded-lg border-zinc-100 text-zinc-500 hover:text-primary"><Printer className="w-4 h-4" /></Button>

                                 <Button onClick={() => loadPendingOrder(order)} size="sm" className="h-8 px-3 bg-zinc-900 text-white rounded-lg text-[9px] font-black uppercase">Open</Button>
                                 <Button onClick={() => setShowReconcileForId(order.id!)} variant="outline" size="icon" className="h-8 w-8 rounded-lg border-zinc-100 text-zinc-400 hover:text-primary"><Smartphone className="w-3.5 h-3.5" /></Button>
                                 <Button onClick={() => setShowCancelForId(order.id!)} variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-zinc-200 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></Button>
                              </div>
                           </div>
                           {showReconcileForId === order.id && (
                              <div className="flex gap-2 animate-in slide-in-from-top-2">
                                 <Input placeholder="M-PESA CODE" value={reconcileCodes[order.id!] || ''} onChange={e => setReconcileCodes(prev => ({...prev, [order.id!]: e.target.value.toUpperCase()}))} className="h-9 bg-zinc-50 border-none text-[9px] font-black tracking-widest rounded-lg" />
                                 <Button onClick={() => handleQuickReconcile(order, reconcileCodes[order.id!] || '')} disabled={isProcessing || !reconcileCodes[order.id!]} className="h-9 px-3 bg-green-50 text-white rounded-lg text-[9px] font-black">Sync</Button>
                              </div>
                           )}
                           {showCancelForId === order.id && (
                              <div className="p-3 bg-red-50 rounded-xl border border-red-100 space-y-2 animate-in slide-in-from-top-2 text-center">
                                 <p className="text-[8px] font-bold text-red-600 uppercase">Confirm Cancellation?</p>
                                 <div className="flex gap-2">
                                    <Button onClick={() => handleCancelBill(order)} disabled={isProcessing} className="flex-1 h-8 bg-red-500 text-white rounded-lg text-[9px] font-black uppercase">Yes</Button>
                                    <Button onClick={() => setShowCancelForId(null)} variant="outline" className="flex-1 h-8 border-zinc-200 rounded-lg text-[9px] font-black">No</Button>
                                 </div>
                              </div>
                           )}
                        </div>
                     ))}
                     {pendingOrders.length === 0 && (
                        <div className="py-20 text-center opacity-30"><Clock className="w-10 h-10 mx-auto mb-3" /><p className="text-[9px] font-black uppercase tracking-widest">No active tickets</p></div>
                     )}
                  </div>
               )}

               {checkoutStep === 'CART' && (
                 cart.length === 0 ? (
                   <div className="h-full flex flex-col items-center justify-center text-zinc-300 gap-4 opacity-50"><History className="w-12 h-12" /><p className="text-[10px] font-black uppercase tracking-widest">Awaiting Selection</p></div>
                 ) : (
                   <div className="space-y-3"> {cart.map((item, idx) => <POSCartItem key={idx} item={{...item, id: item.productId}} onUpdate={updateQuantity} onRemove={removeCartItem} />)} </div>
                 )
               )}
               {checkoutStep === 'PAYMENT' && <div className="animate-in slide-in-from-right-4 duration-300"><PaymentView total={total} onComplete={handleFinalizeSale} onMpesa={handleMpesaInitiate} onMpesaPaid={handleMpesaPaid} isProcessing={isProcessing} previewData={receiptData} /></div>}
               {checkoutStep === 'SUCCESS' && <div className="animate-in slide-in-from-bottom-4 duration-500 flex flex-col items-center py-4 no-scrollbar"><ReceiptPreview data={receiptData} className="w-full" /></div>}
            </CardContent>
            {checkoutStep === 'CART' && (
              <div className="p-8 bg-zinc-50 space-y-4 shrink-0 border-t border-zinc-100">
                 <div className="flex justify-between items-center px-1"><span className="text-[10px] font-black uppercase text-zinc-400">Total</span><span className="text-2xl font-black text-zinc-900">KES {total.toLocaleString()}</span></div>
                 <div className="grid grid-cols-2 gap-2">
                   <Button onClick={handleHoldOrder} disabled={cart.length === 0 || isProcessing || !activeCashier} variant="outline" className="h-14 rounded-xl font-black uppercase text-[10px] tracking-widest border-zinc-200 bg-white"><Printer className="w-4 h-4 text-primary" /> Hold</Button>
                   <Button onClick={() => setCheckoutStep('PAYMENT')} disabled={cart.length === 0 || !plateNumber || isProcessing || !activeCashier} className="h-14 bg-zinc-900 text-white rounded-xl font-black uppercase text-[10px] tracking-widest shadow-xl gap-2"><CreditCard className="w-4 h-4 text-primary" /> Checkout</Button>
                 </div>
              </div>
            )}
         </div>
      </div>

      <VoidDialog isOpen={isVoidOpen} onClose={() => setIsVoidOpen(false)} onConfirm={executeVoid} />
    </div>
  );
}
