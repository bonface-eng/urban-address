'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { getAuth } from '@/lib/db';
import {
  Car,
  Search,
  Clock,
  CreditCard,
  Printer,
  Maximize2,
  Smartphone,
  ArrowLeft,
  CheckCircle2,
  PlusCircle,
  Trash2,
  Plus,
  ShoppingCart,
  AlertCircle,
} from 'lucide-react';
import { CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Product, CarwashJob, UserProfile, Order, OrderItem } from '@/lib/types';
import { toast } from '@/hooks/use-toast';
import { useDb, useUser, useCollection, useMemoSupabase, errorEmitter, FirestorePermissionError } from '@/lib/data';
import { collection, query, where, doc, updateDoc, orderBy, limit, getDoc, increment, writeBatch } from '@/lib/db';
import { HardwareService } from '@/lib/hardware-service';
import { POSProductCard } from '@/components/pos/pos-product-card';
import { POSCartItem } from '@/components/pos/pos-cart-item';
import { PaymentView } from '@/components/pos/payment-view';
import { VoidDialog } from '@/components/pos/void-dialog';
import { MobileCartButton } from '@/components/pos/mobile-cart-button';
import { ReceiptPreview } from '@/components/pos/receipt-preview';
import { CarWashServicePickerDialog } from '@/components/pos/carwash-service-picker-dialog';
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
  SelectValue,
} from '@/components/ui/select';
import {
  CAR_WASH_CATEGORIES,
  CAR_WASH_SERVICES,
  CarWashCategory,
  CarWashService,
  CarWashServiceTier,
  VehicleSize,
  formatKes,
  formatServicePrice,
  resolveServicePriceForVehicleSize,
} from '@/data/carWashServices';

function VehicleMakeLogo({ make, size = 'sm' }: { make?: string; size?: 'sm' | 'lg' }) {
  const [hasError, setHasError] = useState(false);
  const cleanMake = make ? make.toUpperCase().trim() : '';
  const src = cleanMake && !hasError ? MAKE_LOGOS[cleanMake] : undefined;
  const dim = size === 'lg' ? 'w-8 h-8' : 'w-5 h-5';
  if (!src) {
    return (
      <div className={`${dim} rounded bg-zinc-100 flex items-center justify-center text-[9px] font-black text-zinc-400 shrink-0 uppercase`}>
        {cleanMake ? cleanMake[0] : '?'}
      </div>
    );
  }
  return <img src={src} alt={cleanMake} className={`${dim} object-contain shrink-0`} onError={() => setHasError(true)} loading="lazy" />;
}

const QUICK_COLORS = [
  { name: 'White', hex: '#FFFFFF', border: 'border-zinc-300' },
  { name: 'Black', hex: '#000000', border: 'border-zinc-800' },
  { name: 'Silver', hex: '#C0C0C0', border: 'border-zinc-300' },
  { name: 'Red', hex: '#E60000', border: 'border-red-600' },
  { name: 'Blue', hex: '#0000FF', border: 'border-blue-600' },
];

type CartLineItem = OrderItem & { lineKey?: string };

function getLineKey(item: CartLineItem): string {
  return item.lineKey || `${item.productId}::${item.notes || ''}::${item.price}`;
}

export default function CarwashPOS() {
  const firestore = useDb();
  const { user } = useUser();
  const { activeTerminal, activeCashier, activeRegisterSession } = useTerminal();

  const [isHydrated, setIsHydrated] = useState(false);
  const [cart, setCart] = useState<CartLineItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<CarWashCategory | 'All'>('All');
  const [vehicleSize, setVehicleSize] = useState<VehicleSize>('STANDARD');
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
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [receiptData, setReceiptData] = useState<any>(null);
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  const [showPlateSuggestions, setShowPlateSuggestions] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<UserProfile | null>(null);
  const [pickerService, setPickerService] = useState<CarWashService | null>(null);

  const [isVoidOpen, setIsVoidOpen] = useState(false);
  const [pendingVoidAction, setPendingVoidAction] = useState<{ type: 'SINGLE' | 'CLEAR' | 'DELETE_PENDING'; id?: string } | null>(null);

  const [showReconcileForId, setShowReconcileForId] = useState<string | null>(null);
  const [showCancelForId, setShowCancelForId] = useState<string | null>(null);
  const [reconcileCodes, setReconcileCodes] = useState<Record<string, string>>({});

  // Car wash catalog (single source of truth)
  const [catalogServices, setCatalogServices] = useState<CarWashService[]>(() =>
    CAR_WASH_SERVICES.filter((s) => s.isActive)
  );
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState<string | null>(null);

  const loadCatalogServices = useCallback(async () => {
    setCatalogLoading(true);
    setCatalogError(null);
    try {
      const res = await fetch('/api/public/carwash-services');
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload.error || 'Could not load car wash services.');
      }
      if (Array.isArray(payload.services)) {
        setCatalogServices((payload.services as CarWashService[]).filter((s) => s.isActive !== false));
      }
    } catch (err) {
      setCatalogError(err instanceof Error ? err.message : 'Could not load car wash services.');
    } finally {
      setCatalogLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCatalogServices();
  }, [loadCatalogServices]);

  // Restore POS state
  useEffect(() => {
    const saved = sessionStorage.getItem('uax_carwash_pos_state');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.cart) setCart(parsed.cart);
        if (parsed.jobType) setJobType(parsed.jobType);
        if (parsed.vehicleSize) setVehicleSize(parsed.vehicleSize);
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
      } catch {
        // Ignore corrupted session state
      }
    }
    setIsHydrated(true);
  }, []);

  // Persist POS state
  useEffect(() => {
    if (!isHydrated) return;
    const state = {
      cart,
      jobType,
      vehicleSize,
      plateNumber,
      vehicleMake,
      vehicleModel,
      vehicleColor,
      attendantId,
      carpetDimensions,
      editingOrderId,
      checkoutStep,
      selectedCustomer,
      isCartOpen,
    };
    sessionStorage.setItem('uax_carwash_pos_state', JSON.stringify(state));
  }, [
    cart,
    jobType,
    vehicleSize,
    plateNumber,
    vehicleMake,
    vehicleModel,
    vehicleColor,
    attendantId,
    carpetDimensions,
    editingOrderId,
    checkoutStep,
    selectedCustomer,
    isCartOpen,
    isHydrated,
  ]);

  // Auto-fill vehicle details from plate lookup
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
      } catch {
        // Non-blocking lookup
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [firestore, plateNumber, jobType]);

  // Existing Carpet services in inventory remain untouched
  const inventoryServicesQuery = useMemoSupabase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'inventory'), where('unit', '==', 'CARWASH'));
  }, [firestore]);

  const attendantsQuery = useMemoSupabase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'users'), where('role', '==', 'ATTENDANT'));
  }, [firestore]);

  const recentJobsQuery = useMemoSupabase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'carwash_jobs'), orderBy('timestamp', 'desc'), limit(150));
  }, [firestore]);

  const ordersBaseQuery = useMemoSupabase(() => {
    if (!firestore || !activeCashier?.uid) return null;
    return query(
      collection(firestore, 'users', activeCashier.uid, 'held_bills'),
      where('type', '==', 'CARWASH'),
      limit(500)
    );
  }, [firestore, activeCashier?.uid]);

  const { data: inventoryServices, loading: carpetLoading, error: carpetError } = useCollection<Product>(inventoryServicesQuery);
  const { data: attendants } = useCollection<UserProfile>(attendantsQuery);
  const { data: recentJobs } = useCollection<CarwashJob>(recentJobsQuery);
  const { data: rawPendingOrders } = useCollection<Order>(ordersBaseQuery);

  const inventoryIdSet = useMemo(
    () => new Set((inventoryServices || []).map((s) => s.id).filter(Boolean) as string[]),
    [inventoryServices]
  );

  const pendingOrders = useMemo(() => {
    if (!rawPendingOrders) return [];
    const base = [...rawPendingOrders].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    if (!recallSearch) return base;
    return base.filter((o) => (o.plateNumber || '').includes(recallSearch.toUpperCase()));
  }, [rawPendingOrders, recallSearch]);

  const plateSuggestions = useMemo(() => {
    if (jobType !== 'VEHICLE' || !plateNumber || plateNumber.length < 2) return [];
    const normalizedInput = plateNumber.toUpperCase().trim();
    const suggestionsMap = new Map<string, { plate: string; make?: string; model?: string; color?: string }>();
    (recentJobs || []).forEach((job) => {
      const p = (job.plateNumber || '').toUpperCase().trim();
      if (p && p.includes(normalizedInput) && !suggestionsMap.has(p)) {
        suggestionsMap.set(p, { plate: p, make: job.vehicleMake, model: job.vehicleModel, color: job.vehicleColor });
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

  const filteredVehicleServices = useMemo(() => {
    const queryLower = searchTerm.trim().toLowerCase();
    return [...catalogServices]
      .filter((s) => s.isActive !== false)
      .filter((s) => selectedCategory === 'All' || s.category === selectedCategory)
      .filter((s) => !queryLower || s.name.toLowerCase().includes(queryLower) || s.category.toLowerCase().includes(queryLower))
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name));
  }, [catalogServices, selectedCategory, searchTerm]);

  const filteredCarpetServices = useMemo(() => {
    if (!inventoryServices) return [];
    const queryLower = searchTerm.trim().toLowerCase();
    return inventoryServices.filter(
      (s) =>
        s.archived !== true &&
        s.category === 'Carpets and Rugs' &&
        (!queryLower || s.name.toLowerCase().includes(queryLower))
    );
  }, [inventoryServices, searchTerm]);

  const addLineItemToCart = (item: CartLineItem) => {
    const key = getLineKey(item);
    setCart((prev) => {
      const existingIndex = prev.findIndex((i) => getLineKey(i) === key);
      if (existingIndex >= 0) {
        return prev.map((entry, idx) =>
          idx === existingIndex ? { ...entry, quantity: entry.quantity + 1 } : entry
        );
      }
      return [...prev, { ...item, lineKey: key }];
    });
    setCheckoutStep('CART');
    setSaveError(null);
  };

  const handleSelectVehicleService = (service: CarWashService) => {
    if (service.pricingType === 'range' || service.pricingType === 'tiers') {
      setPickerService(service);
      return;
    }

    const resolvedPrice = resolveServicePriceForVehicleSize(service, vehicleSize);
    if (!resolvedPrice || resolvedPrice <= 0) {
      toast({
        variant: 'destructive',
        title: 'Price Required',
        description: `Please set a price for ${service.name} in Car Wash Services.`,
      });
      return;
    }

    const sizeTag =
      service.vehicleSizePricing && vehicleSize === 'SUV' && !service.name.includes('(SUV)')
        ? 'SUV'
        : service.vehicleSizePricing && vehicleSize === 'STANDARD'
          ? 'Standard'
          : undefined;

    addLineItemToCart({
      productId: service.id,
      name: sizeTag ? `${service.name} (${sizeTag})` : service.name,
      price: resolvedPrice,
      quantity: 1,
      category: service.category,
      status: 'DRAFT',
      commission: service.commission ?? 30,
      ...(sizeTag ? { notes: `Vehicle size: ${sizeTag}` } : {}),
    });
  };

  const handleConfirmRangeService = (service: CarWashService, chosenPrice: number) => {
    addLineItemToCart({
      productId: service.id,
      name: service.name,
      price: chosenPrice,
      quantity: 1,
      category: service.category,
      status: 'DRAFT',
      commission: service.commission ?? 30,
      notes: `Custom range price (${formatKes(chosenPrice)})`,
    });
  };

  const handleConfirmTierService = (service: CarWashService, tier: CarWashServiceTier) => {
    addLineItemToCart({
      productId: service.id,
      name: `${service.name} — ${tier.label}`,
      price: tier.price,
      quantity: 1,
      category: service.category,
      status: 'DRAFT',
      commission: service.commission ?? 30,
      notes: `Tier: ${tier.label}`,
    });
  };

  const addCarpetProductToCart = (product: Product) => {
    if (product.price === null || product.price === undefined || product.price <= 0) {
      toast({
        variant: 'destructive',
        title: 'Price Required',
        description: `Please set a price for ${product.name} in Inventory before servicing.`,
      });
      return;
    }
    addLineItemToCart({
      productId: product.id!,
      name: product.name,
      price: product.price,
      quantity: 1,
      category: product.category,
      status: 'DRAFT',
      commission: product.commission || 30,
    });
  };

  useBarcodeScanner((barcode) => {
    const product = inventoryServices?.find((s) => s.barcode === barcode);
    if (product) {
      addCarpetProductToCart(product);
      toast({ title: 'Item Added', description: product.name });
    }
  });

  const updateQuantity = (lineKeyOrId: string, delta: number) => {
    setCart((prev) =>
      prev.flatMap((item) => {
        if (getLineKey(item) !== lineKeyOrId && item.productId !== lineKeyOrId) return [item];
        const quantity = item.quantity + delta;
        return quantity > 0 ? [{ ...item, quantity }] : [];
      })
    );
  };

  const removeCartItem = (lineKeyOrId: string) => {
    setCart((prev) =>
      prev.filter((item) => getLineKey(item) !== lineKeyOrId && item.productId !== lineKeyOrId)
    );
  };

  const executeVoid = async (_reason: string, pin: string) => {
    if (pin !== '1234' && pin !== '0000') throw new Error('Unauthorized');
    if (!pendingVoidAction) return;
    if (pendingVoidAction.type === 'CLEAR') {
      setCart([]);
      setEditingOrderId(null);
      setPlateNumber('');
      setCheckoutStep('CART');
    } else if (pendingVoidAction.id) {
      removeCartItem(pendingVoidAction.id);
    }
    setPendingVoidAction(null);
    setIsVoidOpen(false);
  };

  const sanitizeItemsForSave = (items: CartLineItem[]): OrderItem[] =>
    items.map(({ lineKey: _omit, ...rest }) => ({
      ...rest,
      status: 'COMMITTED' as const,
    }));

  const handleHoldOrder = () => {
    if (!firestore || !activeCashier || cart.length === 0) return;
    if (jobType === 'VEHICLE' && !plateNumber.trim()) {
      toast({ variant: 'destructive', title: 'Plate Required' });
      return;
    }

    setIsProcessing(true);
    setSaveError(null);
    const totalValue = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const attendantName = attendants?.find((a) => a.uid === attendantId)?.displayName || 'Unassigned';

    const orderData: any = {
      type: 'CARWASH' as const,
      jobType,
      status: 'PENDING' as const,
      total: totalValue,
      cashierId: activeCashier.uid,
      cashierName: activeCashier.displayName,
      timestamp: Date.now(),
      items: sanitizeItemsForSave(cart),
      plateNumber: plateNumber.toUpperCase().trim(),
      vehicleMake: jobType === 'VEHICLE' ? vehicleMake : 'CARPET',
      vehicleModel: jobType === 'VEHICLE' ? vehicleModel : 'SERVICE',
      vehicleColor,
      carpetDimensions: jobType === 'CARPET' ? carpetDimensions : null,
      attendantId: attendantId || 'Unassigned',
      attendantName,
      customerId: selectedCustomer?.uid || null,
    };

    const heldRef = editingOrderId
      ? doc(firestore, 'users', activeCashier.uid, 'held_bills', editingOrderId)
      : doc(collection(firestore, 'users', activeCashier.uid, 'held_bills'));
    const masterOrderRef = doc(firestore, 'orders', heldRef.id);
    const batch = writeBatch(firestore);
    batch.set(heldRef, orderData, { merge: true });
    batch.set(masterOrderRef, orderData, { merge: true });
    if (jobType === 'VEHICLE' && orderData.plateNumber) {
      batch.set(
        doc(firestore, 'vehicles', orderData.plateNumber),
        {
          plateNumber: orderData.plateNumber,
          make: orderData.vehicleMake,
          model: orderData.vehicleModel,
          color: orderData.vehicleColor,
          lastSeen: Date.now(),
        },
        { merge: true }
      );
    }

    batch
      .commit()
      .then(() => {
        setReceiptData({ ...orderData, id: heldRef.id });
        setCheckoutStep('SUCCESS');
        toast({ title: 'Bill Held', description: 'Saved to Recall Bill without losing line items.' });
        setCart([]);
        setPlateNumber('');
        setVehicleMake('');
        setVehicleModel('');
        setAttendantId('');
        setCarpetDimensions('');
        setSelectedCustomer(null);
        setEditingOrderId(null);
        setIsProcessing(false);
      })
      .catch(() => {
        setIsProcessing(false);
        setSaveError('Could not hold this bill. Your cart has been preserved.');
        toast({
          variant: 'destructive',
          title: 'Hold Failed',
          description: 'Could not save the held bill. Your cart items are still intact.',
        });
        errorEmitter.emit(
          'permission-error',
          new FirestorePermissionError({ path: masterOrderRef.path, operation: 'write', requestResourceData: orderData })
        );
      });
  };

  const handleFinalizeSale = async (method: 'CASH' | 'MOBILE', metadata?: any) => {
    if (!firestore || !activeCashier || cart.length === 0) return;
    setIsProcessing(true);
    setSaveError(null);
    const totalValue = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const totalCommission = cart.reduce((sum, item) => sum + (item.price * item.quantity * (item.commission || 30)) / 100, 0);
    const attendantName = attendants?.find((a) => a.uid === attendantId)?.displayName || 'Unassigned';

    const orderData: any = {
      type: 'CARWASH' as const,
      jobType,
      status: 'PAID' as const,
      total: totalValue,
      paymentMethod: method,
      paymentRef: metadata?.reference || null,
      cashierId: activeCashier.uid,
      cashierName: activeCashier.displayName,
      terminalId: activeTerminal?.id || 'UAX-NODE',
      terminalName: activeTerminal?.name || 'Unassigned POS',
      registerSessionId: activeRegisterSession?.id || null,
      branchId: activeCashier.activeBranchId || activeCashier.branchIds?.[0] || null,
      timestamp: Date.now(),
      paidAt: Date.now(),
      cashTendered: method === 'CASH' ? metadata?.cashReceived ?? totalValue : null,
      changeDue: method === 'CASH' ? metadata?.change ?? 0 : null,
      inventorySynced: true,
      items: sanitizeItemsForSave(cart),
      plateNumber: plateNumber.toUpperCase().trim(),
      vehicleMake: jobType === 'VEHICLE' ? vehicleMake : 'CARPET',
      vehicleModel: jobType === 'VEHICLE' ? vehicleModel : 'SERVICE',
      vehicleColor,
      carpetDimensions: jobType === 'CARPET' ? carpetDimensions : null,
      attendantId: attendantId || 'Unassigned',
      attendantName,
      customerId: selectedCustomer?.uid || null,
    };

    const batch = writeBatch(firestore);
    const orderRef = editingOrderId ? doc(firestore, 'orders', editingOrderId) : doc(collection(firestore, 'orders'));
    batch.set(orderRef, orderData, { merge: true });

    // Only deduct stock for physical inventory records (e.g. carpet products), not carwash_services catalog entries
    for (const item of cart) {
      if (item.productId && inventoryIdSet.has(item.productId)) {
        const productRef = doc(firestore, 'inventory', item.productId);
        batch.update(productRef, {
          stockLevel: increment(-item.quantity),
          updatedAt: Date.now(),
        });
      }
    }

    batch.set(doc(collection(firestore, 'carwash_jobs')), {
      orderId: orderRef.id,
      jobType,
      plateNumber: orderData.plateNumber,
      vehicleMake: orderData.vehicleMake,
      vehicleModel: orderData.vehicleModel,
      vehicleColor: orderData.vehicleColor,
      carpetDimensions: orderData.carpetDimensions,
      service: cart.length === 1 ? cart[0].name : `${cart.length} Services`,
      price: totalValue,
      commission: totalCommission,
      status: 'QUEUED',
      attendantId: attendantId || 'Unassigned',
      attendantName,
      timestamp: Date.now(),
    });

    if (jobType === 'VEHICLE' && orderData.plateNumber) {
      batch.set(
        doc(firestore, 'vehicles', orderData.plateNumber),
        {
          plateNumber: orderData.plateNumber,
          make: orderData.vehicleMake,
          model: orderData.vehicleModel,
          color: orderData.vehicleColor,
          lastSeen: Date.now(),
        },
        { merge: true }
      );
    }

    if (editingOrderId) {
      batch.delete(doc(firestore, 'users', activeCashier.uid, 'held_bills', editingOrderId));
    }

    batch
      .commit()
      .then(async () => {
        const finalReceipt = { ...orderData, id: orderRef.id };
        await notifyCommittedSale(user, orderRef.id);
        await notifyTelegramClientEvent(getAuth().currentUser, {
          type: 'CARWASH_NEW',
          jobId: orderRef.id,
          plate: orderData.plateNumber,
          service: cart.map((i) => i.name).join(', '),
          attendant: attendantName,
          amount: totalValue,
        });
        await HardwareService.printReceipt(finalReceipt);
        setReceiptData(finalReceipt);
        setCheckoutStep('SUCCESS');
        setIsProcessing(false);
        toast({ title: 'Transaction Authorized' });
      })
      .catch(() => {
        setIsProcessing(false);
        setSaveError('Sale could not be saved. Your cart and customer details are still intact.');
        toast({
          variant: 'destructive',
          title: 'Checkout Failed',
          description: 'Sale could not be saved. Please try again; your cart was not cleared.',
        });
        errorEmitter.emit(
          'permission-error',
          new FirestorePermissionError({ path: orderRef.path, operation: 'create', requestResourceData: orderData })
        );
      });
  };

  const handleMpesaInitiate = async (phone: string): Promise<string> => {
    if (!firestore || !activeCashier || cart.length === 0 || !user) throw new Error('The cashier session is not ready.');
    setIsProcessing(true);
    setSaveError(null);
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
        items: sanitizeItemsForSave(cart),
        inventorySynced: false,
        jobType,
        plateNumber: plateNumber.toUpperCase().trim(),
        vehicleMake: jobType === 'VEHICLE' ? vehicleMake : 'CARPET',
        vehicleModel: jobType === 'VEHICLE' ? vehicleModel : 'SERVICE',
        vehicleColor,
        carpetDimensions: jobType === 'CARPET' ? carpetDimensions : null,
        attendantId: attendantId || 'Unassigned',
        attendantName: attendants?.find((a) => a.uid === attendantId)?.displayName || 'Unassigned',
        commission: cart.reduce((sum, item) => sum + (item.price * item.quantity * (item.commission || 30)) / 100, 0),
        customerId: selectedCustomer?.uid || null,
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
        await updateDoc(orderRef, {
          paymentStatus: 'FAILED',
          paymentFailureReason: String(result.message || 'Unable to start M-Pesa payment.'),
          paymentFailedAt: Date.now(),
        });
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
    setPlateNumber('');
    setVehicleMake('');
    setVehicleModel('');
    setAttendantId('');
    setCarpetDimensions('');
    setSelectedCustomer(null);
    setIsProcessing(false);
    toast({ title: 'M-Pesa payment confirmed', description: 'Safaricom verified the payment and the sale is complete.' });
  };

  const handleNewTransaction = () => {
    setCart([]);
    setPlateNumber('');
    setVehicleMake('');
    setVehicleModel('');
    setAttendantId('');
    setCarpetDimensions('');
    setEditingOrderId(null);
    setReceiptData(null);
    setCheckoutStep('CART');
    setSelectedCustomer(null);
    setSaveError(null);
  };

  const loadPendingOrder = (order: Order) => {
    setCart((order.items || []).map((i) => ({ ...i, status: 'COMMITTED' as const })));
    if (order.jobType) setJobType(order.jobType);
    setPlateNumber(order.plateNumber || '');
    setVehicleMake(order.vehicleMake || '');
    setVehicleModel(order.vehicleModel || '');
    setVehicleColor(order.vehicleColor || '#FFFFFF');
    setAttendantId(order.attendantId || '');
    setCarpetDimensions(order.carpetDimensions || '');
    setEditingOrderId(order.id!);
    setCheckoutStep('CART');
    setIsCartOpen(true);
    setSaveError(null);
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
        inventorySynced: true,
      });

      if (order.items) {
        for (const item of order.items) {
          if (item.productId && inventoryIdSet.has(item.productId)) {
            batch.update(doc(firestore, 'inventory', item.productId), {
              stockLevel: increment(-item.quantity),
            });
          }
        }
      }

      batch.delete(doc(firestore, 'users', activeCashier.uid, 'held_bills', order.id!));
      await batch.commit();
      toast({ title: 'Booking Finalized' });
      setShowReconcileForId(null);
    } catch {
      toast({ variant: 'destructive', title: 'Error', description: 'Could not reconcile bill.' });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCancelBill = async (order: Order) => {
    if (!firestore || !activeCashier) return;
    setIsProcessing(true);
    try {
      const batch = writeBatch(firestore);
      batch.delete(doc(firestore, 'users', activeCashier.uid, 'held_bills', order.id!));
      batch.update(doc(firestore, 'orders', order.id!), { status: 'CANCELLED', cancelledAt: Date.now() });
      await batch.commit();
      toast({ title: 'Order Removed' });
      setShowCancelForId(null);
    } catch {
      toast({ variant: 'destructive', title: 'Action Failed' });
    } finally {
      setIsProcessing(false);
    }
  };

  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const cartItemCount = cart.reduce((count, item) => count + item.quantity, 0);

  if (!isHydrated) {
    return (
      <div role="status" aria-live="polite" className="flex min-h-[calc(100dvh-5.5rem)] flex-col items-center justify-center gap-3 bg-white text-zinc-400">
        <span className="h-7 w-7 animate-spin rounded-full border-2 border-zinc-200 border-t-primary" />
        <span className="text-[10px] font-bold uppercase tracking-widest">Restoring terminal and connecting to services…</span>
      </div>
    );
  }

  return (
    <div className="ua-staff-pos ua-pos-workspace min-h-[calc(100dvh-5.5rem)] xl:h-[calc(100dvh-5.5rem)] xl:max-h-[calc(100dvh-5.5rem)] flex flex-col xl:flex-row gap-4 xl:gap-6 xl:overflow-hidden relative">
      {/* Left Workspace: Carwash Entry + Service Catalog */}
      <div className="flex-1 min-w-0 flex flex-col gap-4 xl:overflow-hidden">
        <header className="space-y-4 bg-white p-3.5 sm:p-5 rounded-xl border border-zinc-100 shadow-sm shrink-0">
          {/* Top Bar: Title + Actions (wraps cleanly at 360px, 768px, 1024px) */}
          <div className="flex flex-wrap items-center justify-between gap-3 min-w-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
                <Car className="w-5 h-5" aria-hidden="true" />
              </div>
              <h1 className="text-base sm:text-lg font-black text-zinc-900 tracking-tight truncate">
                Carwash POS Entry
              </h1>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setCheckoutStep('RECALL');
                  setIsCartOpen(true);
                }}
                className="min-h-[44px] px-3.5 border border-zinc-200 text-xs font-bold uppercase tracking-wide gap-1.5 bg-white shadow-sm relative rounded-xl flex items-center hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <Clock className="w-4 h-4 text-zinc-600" aria-hidden="true" />
                <span>Recall Bill</span>
                {pendingOrders && pendingOrders.length > 0 && (
                  <span className="ml-1 px-1.5 py-0.5 bg-primary text-white rounded-md text-[10px] font-black">
                    {pendingOrders.length}
                  </span>
                )}
              </button>

              <div role="tablist" aria-label="Service mode" className="flex gap-1 bg-zinc-100 p-1 rounded-xl">
                <Button
                  type="button"
                  role="tab"
                  aria-selected={jobType === 'VEHICLE'}
                  variant={jobType === 'VEHICLE' ? 'default' : 'ghost'}
                  onClick={() => setJobType('VEHICLE')}
                  className={cn(
                    'min-h-[40px] px-4 rounded-lg font-bold uppercase text-xs tracking-wide',
                    jobType === 'VEHICLE' ? 'bg-zinc-900 text-white shadow-sm' : 'text-zinc-600'
                  )}
                >
                  Vehicle
                </Button>
                <Button
                  type="button"
                  role="tab"
                  aria-selected={jobType === 'CARPET'}
                  variant={jobType === 'CARPET' ? 'default' : 'ghost'}
                  onClick={() => setJobType('CARPET')}
                  className={cn(
                    'min-h-[40px] px-4 rounded-lg font-bold uppercase text-xs tracking-wide',
                    jobType === 'CARPET' ? 'bg-zinc-900 text-white shadow-sm' : 'text-zinc-600'
                  )}
                >
                  Carpet
                </Button>
              </div>

              {/* Cart toggle for < xl screens */}
              <Button
                type="button"
                onClick={() => {
                  setCheckoutStep('CART');
                  setIsCartOpen(true);
                }}
                className="xl:hidden min-h-[44px] px-3.5 bg-zinc-900 text-white rounded-xl font-bold text-xs gap-2"
              >
                <ShoppingCart className="w-4 h-4 text-primary" aria-hidden="true" />
                <span>{cartItemCount} · {formatKes(total)}</span>
              </Button>
            </div>
          </div>

          {/* Entry Fields Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="min-w-0 space-y-1.5 relative">
              <Label htmlFor="pos-plate-input" className="text-[11px] font-bold text-zinc-600 uppercase tracking-wider px-0.5 block">
                {jobType === 'VEHICLE' ? 'Plate Number' : 'Reference / Name'}
              </Label>
              <Input
                id="pos-plate-input"
                placeholder={jobType === 'VEHICLE' ? 'KDA 123X' : 'e.g. John Doe'}
                value={plateNumber}
                onFocus={() => setShowPlateSuggestions(true)}
                onChange={(e) => {
                  setPlateNumber(e.target.value.toUpperCase());
                  setShowPlateSuggestions(true);
                }}
                className="min-h-[44px] h-11 font-bold text-sm px-3 uppercase bg-zinc-50 border-zinc-200 rounded-xl tracking-wide"
              />
              {showPlateSuggestions && plateSuggestions.length > 0 && jobType === 'VEHICLE' && (
                <div className="absolute left-0 right-0 top-[calc(100%+6px)] bg-white border border-zinc-100 rounded-2xl shadow-2xl z-50 overflow-hidden divide-y divide-zinc-50">
                  {plateSuggestions.map((s) => (
                    <button
                      key={s.plate}
                      type="button"
                      onClick={() => handleSelectSuggestion(s)}
                      className="w-full min-h-[44px] px-4 py-2.5 text-left hover:bg-primary/5 transition-colors flex items-center justify-between group"
                    >
                      <div className="flex items-center gap-2.5">
                        <VehicleMakeLogo make={s.make} />
                        <div className="w-2.5 h-2.5 rounded-full border border-zinc-200" style={{ backgroundColor: s.color || '#FFFFFF' }} />
                        <span className="font-mono font-black text-sm uppercase text-zinc-900 group-hover:text-primary">{s.plate}</span>
                      </div>
                      {s.make && (
                        <span className="text-[10px] font-bold text-zinc-400 uppercase">
                          {s.make} {s.model || ''}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {jobType === 'VEHICLE' ? (
              <>
                <div className="min-w-0 space-y-1.5">
                  <Label htmlFor="pos-vehicle-make" className="text-[11px] font-bold text-zinc-600 uppercase tracking-wider px-0.5 block">
                    Vehicle Make
                  </Label>
                  <Select value={vehicleMake} onValueChange={setVehicleMake}>
                    <SelectTrigger id="pos-vehicle-make" className="min-h-[44px] h-11 bg-zinc-50 border-zinc-200 rounded-xl px-3 font-bold uppercase flex items-center gap-2">
                      <VehicleMakeLogo make={vehicleMake} />
                      <SelectValue placeholder="Brand" />
                    </SelectTrigger>
                    <SelectContent className="rounded-2xl border-none shadow-2xl max-h-72">
                      {VEHICLE_MAKES.map((m) => (
                        <SelectItem key={m} value={m} className="font-bold uppercase py-2">
                          <div className="flex items-center gap-3">
                            <VehicleMakeLogo make={m} />
                            <span>{m}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="min-w-0 space-y-1.5">
                  <Label htmlFor="pos-vehicle-model" className="text-[11px] font-bold text-zinc-600 uppercase tracking-wider px-0.5 block">
                    Vehicle Model
                  </Label>
                  <Select value={vehicleModel} onValueChange={setVehicleModel} disabled={!vehicleMake}>
                    <SelectTrigger id="pos-vehicle-model" className="min-h-[44px] h-11 bg-zinc-50 border-zinc-200 rounded-xl px-3 font-bold uppercase">
                      <SelectValue placeholder="Model" />
                    </SelectTrigger>
                    <SelectContent className="rounded-2xl border-none shadow-2xl">
                      {(VEHICLE_MODELS[vehicleMake] || ['OTHER']).map((m) => (
                        <SelectItem key={m} value={m} className="font-bold uppercase">
                          {m}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="min-w-0 space-y-1.5">
                  <Label className="text-[11px] font-bold text-zinc-600 uppercase tracking-wider px-0.5 block">
                    Vehicle Colour &amp; Size
                  </Label>
                  <div className="min-h-[44px] bg-zinc-50 border border-zinc-200 rounded-xl px-2.5 py-1.5 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      {QUICK_COLORS.map((c) => (
                        <button
                          key={c.hex}
                          type="button"
                          aria-label={`Vehicle colour ${c.name}`}
                          onClick={() => setVehicleColor(c.hex)}
                          className={cn(
                            'w-6 h-6 rounded-full border-2 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                            vehicleColor === c.hex ? 'ring-2 ring-primary ring-offset-1 scale-110' : 'opacity-60 hover:opacity-100',
                            c.border
                          )}
                          style={{ backgroundColor: c.hex }}
                        />
                      ))}
                    </div>
                    <div className="flex rounded-lg bg-white p-0.5 border border-zinc-200">
                      {(['STANDARD', 'SUV'] as const).map((sz) => (
                        <button
                          key={sz}
                          type="button"
                          onClick={() => setVehicleSize(sz)}
                          aria-pressed={vehicleSize === sz}
                          className={cn(
                            'px-2.5 py-1 text-[10px] font-black uppercase rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                            vehicleSize === sz ? 'bg-zinc-900 text-white' : 'text-zinc-500 hover:text-zinc-900'
                          )}
                        >
                          {sz === 'STANDARD' ? 'Std' : 'SUV'}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="min-w-0 sm:col-span-2 space-y-1.5">
                  <Label htmlFor="pos-carpet-dimensions" className="text-[11px] font-bold text-zinc-600 uppercase tracking-wider px-0.5 block">
                    Carpet Dimensions
                  </Label>
                  <div className="relative">
                    <Maximize2 className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" aria-hidden="true" />
                    <Input
                      id="pos-carpet-dimensions"
                      placeholder="e.g. 5m x 4m"
                      value={carpetDimensions}
                      onChange={(e) => setCarpetDimensions(e.target.value)}
                      className="min-h-[44px] h-11 bg-zinc-50 border-zinc-200 rounded-xl pl-10 font-bold"
                    />
                  </div>
                </div>

                <div className="min-w-0 space-y-1.5">
                  <Label className="text-[11px] font-bold text-zinc-600 uppercase tracking-wider px-0.5 block">
                    Tag Colour
                  </Label>
                  <div className="min-h-[44px] bg-zinc-50 border border-zinc-200 rounded-xl px-3 flex items-center gap-2">
                    {QUICK_COLORS.map((c) => (
                      <button
                        key={c.hex}
                        type="button"
                        aria-label={`Tag colour ${c.name}`}
                        onClick={() => setVehicleColor(c.hex)}
                        className={cn(
                          'w-7 h-7 rounded-full border-2 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                          vehicleColor === c.hex ? 'ring-2 ring-primary ring-offset-1 scale-110' : 'opacity-60 hover:opacity-100',
                          c.border
                        )}
                        style={{ backgroundColor: c.hex }}
                      />
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Attendant, Customer Lookup, Search */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <div className="min-w-0 space-y-1">
              <Label htmlFor="pos-attendant" className="text-[11px] font-bold text-zinc-600 uppercase tracking-wider px-0.5 block">
                Attendant
              </Label>
              <Select value={attendantId} onValueChange={setAttendantId}>
                <SelectTrigger id="pos-attendant" className="min-h-[44px] h-11 bg-zinc-50 border-zinc-200 rounded-xl px-3 font-semibold text-xs">
                  <SelectValue placeholder="Choose an attendant" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  {attendants?.map((a) => (
                    <SelectItem key={a.uid} value={a.uid} className="font-bold uppercase text-xs">
                      {a.displayName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="min-w-0 space-y-1">
              <Label className="text-[11px] font-bold text-zinc-600 uppercase tracking-wider px-0.5 block">
                Customer
              </Label>
              <CustomerLookup onSelect={setSelectedCustomer} selectedCustomer={selectedCustomer} />
            </div>

            <div className="min-w-0 sm:col-span-2 lg:col-span-1 space-y-1">
              <Label htmlFor="pos-service-search" className="text-[11px] font-bold text-zinc-600 uppercase tracking-wider px-0.5 block">
                Search Services
              </Label>
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" aria-hidden="true" />
                <Input
                  id="pos-service-search"
                  placeholder="Search available services"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 min-h-[44px] h-11 bg-zinc-50 border-zinc-200 rounded-xl text-xs font-semibold"
                />
              </div>
            </div>
          </div>

          {/* Category filter pills for Vehicle mode */}
          {jobType === 'VEHICLE' && (
            <div className="flex flex-wrap gap-1.5 pt-1" role="group" aria-label="Filter car wash services by category">
              <button
                type="button"
                onClick={() => setSelectedCategory('All')}
                aria-pressed={selectedCategory === 'All'}
                className={cn(
                  'min-h-[36px] rounded-full px-3.5 py-1.5 text-[11px] font-black uppercase tracking-wider transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                  selectedCategory === 'All' ? 'bg-zinc-900 text-white' : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
                )}
              >
                All ({catalogServices.length})
              </button>
              {CAR_WASH_CATEGORIES.map((category) => {
                const count = catalogServices.filter((s) => s.category === category).length;
                if (count === 0) return null;
                const active = selectedCategory === category;
                return (
                  <button
                    key={category}
                    type="button"
                    onClick={() => setSelectedCategory(category)}
                    aria-pressed={active}
                    className={cn(
                      'min-h-[36px] rounded-full px-3.5 py-1.5 text-[11px] font-black uppercase tracking-wider transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                      active ? 'bg-primary text-white' : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
                    )}
                  >
                    {category} ({count})
                  </button>
                );
              })}
            </div>
          )}
        </header>

        {/* Service List */}
        <div className="flex-1 min-h-0 xl:overflow-y-auto no-scrollbar pb-20 xl:pb-4">
          {jobType === 'VEHICLE' ? (
            catalogLoading ? (
              <div role="status" aria-live="polite" className="flex min-h-36 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-zinc-200 bg-white text-center">
                <span className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-200 border-t-primary" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Loading car wash services…</span>
              </div>
            ) : catalogError ? (
              <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-5 text-center space-y-2">
                <p className="text-xs font-semibold text-red-700">{catalogError}</p>
                <Button type="button" size="sm" variant="outline" onClick={loadCatalogServices}>
                  Retry
                </Button>
              </div>
            ) : filteredVehicleServices.length === 0 ? (
              <div className="py-12 rounded-xl border border-dashed border-zinc-200 bg-white text-center text-xs font-semibold text-zinc-400">
                No active car wash services match your filter.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {filteredVehicleServices.map((service) => {
                  const displayPrice =
                    service.pricingType === 'fixed'
                      ? formatKes(resolveServicePriceForVehicleSize(service, vehicleSize) ?? service.price ?? 0)
                      : formatServicePrice(service);

                  return (
                    <button
                      key={service.id}
                      type="button"
                      onClick={() => handleSelectVehicleService(service)}
                      className="flex min-h-[76px] min-w-0 items-center justify-between gap-3 rounded-xl border border-zinc-100 bg-white p-4 text-left shadow-sm transition-all hover:border-primary/40 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary active:scale-[0.99]"
                    >
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-black text-zinc-900 truncate">{service.name}</span>
                          {service.pricingType === 'range' && (
                            <Badge variant="secondary" className="text-[9px] font-bold uppercase">
                              Range
                            </Badge>
                          )}
                          {service.pricingType === 'tiers' && (
                            <Badge variant="secondary" className="text-[9px] font-bold uppercase">
                              Options
                            </Badge>
                          )}
                          {service.vehicleSizePricing && vehicleSize === 'SUV' && (
                            <Badge className="bg-primary/10 text-primary border-none text-[9px] font-black uppercase">
                              SUV Rate
                            </Badge>
                          )}
                        </div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                          {service.category}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        <span className="whitespace-nowrap font-headline text-sm font-black text-primary">
                          {displayPrice}
                        </span>
                        <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-zinc-100 bg-zinc-50 text-zinc-500">
                          <Plus className="h-5 w-5" aria-hidden="true" />
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )
          ) : carpetLoading || inventoryServices === null ? (
            <div role="status" aria-live="polite" className="flex min-h-36 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-zinc-200 bg-white text-center">
              <span className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-200 border-t-primary" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Loading carpet services…</span>
            </div>
          ) : carpetError ? (
            <div role="alert" className="rounded-xl border border-red-100 bg-red-50 p-4 text-center text-xs font-semibold text-red-700">
              Could not load carpet services. Check the connection and reload this page.
            </div>
          ) : filteredCarpetServices.length === 0 ? (
            <div className="py-12 rounded-xl border border-dashed border-zinc-200 bg-white text-center text-xs font-semibold text-zinc-400">
              No carpet services are configured in Inventory yet.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-2">
              {filteredCarpetServices.map((s) => (
                <POSProductCard key={s.id} product={s} onAdd={() => addCarpetProductToCart(s)} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Mobile / Tablet Floating Cart Button */}
      {!isCartOpen && (
        <div className="xl:hidden">
          <MobileCartButton
            itemCount={cartItemCount}
            onClick={() => {
              setCheckoutStep('CART');
              setIsCartOpen(true);
            }}
          />
        </div>
      )}

      {/* Right Cart / Checkout / Recall Panel */}
      <div
        className={cn(
          'ua-staff-cart fixed inset-0 z-[1200] xl:relative xl:inset-auto xl:z-0 xl:w-[400px] 2xl:w-[420px] xl:flex shrink-0 transition-transform duration-300 xl:translate-x-0 flex flex-col overflow-hidden bg-white border border-zinc-100 rounded-none xl:rounded-xl h-full',
          isCartOpen ? 'translate-x-0' : 'translate-x-full xl:translate-x-0'
        )}
      >
        <div className="absolute inset-0 bg-black/40 xl:hidden" onClick={() => setIsCartOpen(false)} />
        <div className="relative h-full flex flex-col bg-white overflow-hidden">
          <CardHeader className="border-b border-zinc-100 p-4 sm:p-6 pb-4 flex flex-row items-center justify-between shrink-0 min-h-[72px]">
            {checkoutStep === 'CART' && (
              <>
                <div className="flex min-w-0 items-center gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Back to services"
                    onClick={() => setIsCartOpen(false)}
                    className="h-11 w-11 shrink-0 rounded-lg bg-zinc-50 text-zinc-600 xl:hidden"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </Button>
                  <CardTitle className="text-sm font-black uppercase tracking-widest">Cart</CardTitle>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setPendingVoidAction({ type: 'CLEAR' });
                    setIsVoidOpen(true);
                  }}
                  disabled={cart.length === 0}
                  className="min-h-[40px] text-primary font-black uppercase text-xs"
                >
                  Clear
                </Button>
              </>
            )}
            {checkoutStep === 'RECALL' && (
              <>
                <div className="flex items-center gap-3">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Back to cart"
                    onClick={() => setCheckoutStep('CART')}
                    className="h-10 w-10 rounded-full bg-zinc-50 text-zinc-600"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </Button>
                  <CardTitle className="text-sm font-black uppercase tracking-widest text-zinc-900">Bookings</CardTitle>
                </div>
                <Badge className="bg-amber-100 text-amber-700 text-[10px] font-black px-2.5 py-0.5 border-none uppercase">
                  RECALL
                </Badge>
              </>
            )}
            {checkoutStep === 'PAYMENT' && (
              <>
                <div className="flex items-center gap-3">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Back to cart"
                    onClick={() => setCheckoutStep('CART')}
                    className="h-10 w-10 rounded-full bg-zinc-50"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </Button>
                  <CardTitle className="text-sm font-black uppercase">Payment</CardTitle>
                </div>
                <Badge variant="outline" className="bg-zinc-900 text-white text-[9px] font-black uppercase px-2.5 h-5 border-none">
                  Secure
                </Badge>
              </>
            )}
            {checkoutStep === 'SUCCESS' && (
              <>
                <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-500" /> Success
                </CardTitle>
                <Button
                  type="button"
                  onClick={handleNewTransaction}
                  className="min-h-[40px] px-4 bg-primary text-white rounded-xl text-xs font-black uppercase gap-2"
                >
                  <PlusCircle className="w-4 h-4" /> New Job
                </Button>
              </>
            )}
          </CardHeader>

          <CardContent className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3 no-scrollbar min-h-0 bg-white">
            {saveError && (
              <div role="alert" className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-700">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{saveError}</span>
              </div>
            )}

            {checkoutStep === 'RECALL' && (
              <div className="space-y-4">
                <div className="relative mb-4">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                  <Input
                    placeholder="Search Plate..."
                    value={recallSearch}
                    onChange={(e) => setRecallSearch(e.target.value)}
                    className="h-11 pl-9 bg-zinc-50 border-zinc-200 rounded-xl text-xs font-bold"
                  />
                </div>
                {pendingOrders.map((order) => (
                  <div
                    key={order.id}
                    className="ua-held-bill p-4 bg-white border border-zinc-100 rounded-xl space-y-3 hover:border-primary/20 transition-all"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-11 h-11 rounded-xl bg-zinc-50 border border-zinc-100 flex items-center justify-center text-zinc-400 shrink-0">
                          {order.vehicleMake ? <VehicleMakeLogo make={order.vehicleMake} /> : <Car className="w-5 h-5" />}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-black uppercase text-zinc-900 truncate">{order.plateNumber || 'WALK-IN'}</p>
                          <p className="text-xs font-black text-primary mt-0.5">{formatKes(order.total)}</p>
                          <p className="mt-0.5 text-[10px] text-zinc-500">
                            {order.items?.length || 0} items · {new Date(order.timestamp || Date.now()).toLocaleString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-1.5 shrink-0">
                        <Button
                          type="button"
                          onClick={() => HardwareService.printReceipt(order)}
                          variant="outline"
                          size="icon"
                          aria-label="Print held bill"
                          className="h-9 w-9 rounded-lg border-zinc-200 text-zinc-500 hover:text-primary"
                        >
                          <Printer className="w-4 h-4" />
                        </Button>
                        <Button
                          type="button"
                          onClick={() => loadPendingOrder(order)}
                          size="sm"
                          className="h-9 px-3 bg-zinc-900 text-white rounded-lg text-[10px] font-black uppercase"
                        >
                          Open
                        </Button>
                        <Button
                          type="button"
                          onClick={() => setShowReconcileForId(order.id!)}
                          variant="outline"
                          size="icon"
                          aria-label="Reconcile M-Pesa"
                          className="h-9 w-9 rounded-lg border-zinc-200 text-zinc-500 hover:text-primary"
                        >
                          <Smartphone className="w-4 h-4" />
                        </Button>
                        <Button
                          type="button"
                          onClick={() => setShowCancelForId(order.id!)}
                          variant="ghost"
                          size="icon"
                          aria-label="Cancel held bill"
                          className="h-9 w-9 rounded-lg text-zinc-400 hover:text-red-500"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>

                    {showReconcileForId === order.id && (
                      <div className="flex gap-2">
                        <Input
                          placeholder="M-PESA CODE"
                          value={reconcileCodes[order.id!] || ''}
                          onChange={(e) => setReconcileCodes((prev) => ({ ...prev, [order.id!]: e.target.value.toUpperCase() }))}
                          className="h-10 bg-zinc-50 border-zinc-200 text-xs font-black tracking-widest rounded-lg"
                        />
                        <Button
                          type="button"
                          onClick={() => handleQuickReconcile(order, reconcileCodes[order.id!] || '')}
                          disabled={isProcessing || !reconcileCodes[order.id!]}
                          className="h-10 px-4 bg-emerald-600 text-white rounded-lg text-xs font-black"
                        >
                          Sync
                        </Button>
                      </div>
                    )}

                    {showCancelForId === order.id && (
                      <div className="p-3 bg-red-50 rounded-xl border border-red-100 space-y-2 text-center">
                        <p className="text-[10px] font-bold text-red-600 uppercase">Confirm Cancellation?</p>
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            onClick={() => handleCancelBill(order)}
                            disabled={isProcessing}
                            className="flex-1 h-9 bg-red-500 text-white rounded-lg text-xs font-black uppercase"
                          >
                            Yes
                          </Button>
                          <Button
                            type="button"
                            onClick={() => setShowCancelForId(null)}
                            variant="outline"
                            className="flex-1 h-9 border-zinc-200 rounded-lg text-xs font-black"
                          >
                            No
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
                {pendingOrders.length === 0 && (
                  <div className="py-20 text-center opacity-40">
                    <Clock className="w-10 h-10 mx-auto mb-3" />
                    <p className="text-xs font-black uppercase tracking-widest">No active tickets</p>
                  </div>
                )}
              </div>
            )}

            {checkoutStep === 'CART' &&
              (cart.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-zinc-400 gap-3 py-12 text-center">
                  <ShoppingCart className="w-10 h-10 opacity-40" />
                  <p className="text-xs font-bold uppercase tracking-wider">Cart is empty</p>
                  <p className="text-xs text-zinc-400 max-w-[220px]">
                    Tap any service from the list on the left to add it to this bill.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {cart.map((item) => {
                    const key = getLineKey(item);
                    return (
                      <POSCartItem
                        key={key}
                        item={{ ...item, id: key }}
                        onUpdate={updateQuantity}
                        onRemove={removeCartItem}
                      />
                    );
                  })}
                </div>
              ))}

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
                <ReceiptPreview data={receiptData} className="w-full" />
              </div>
            )}
          </CardContent>

          {checkoutStep === 'CART' && (
            <div className="p-4 sm:p-6 bg-zinc-50 space-y-3 shrink-0 border-t border-zinc-100">
              <div className="flex justify-between items-center px-1">
                <span className="text-xs font-black uppercase text-zinc-500">Total</span>
                <span className="text-2xl font-black text-zinc-900">{formatKes(total)}</span>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <Button
                  type="button"
                  onClick={handleHoldOrder}
                  disabled={cart.length === 0 || isProcessing || !activeCashier}
                  variant="outline"
                  className="min-h-[48px] h-12 rounded-xl font-black uppercase text-xs tracking-wider border-zinc-200 bg-white gap-2"
                >
                  <Printer className="w-4 h-4 text-primary" /> Hold
                </Button>
                <Button
                  type="button"
                  onClick={() => setCheckoutStep('PAYMENT')}
                  disabled={cart.length === 0 || !plateNumber.trim() || isProcessing || !activeCashier}
                  className="min-h-[48px] h-12 bg-zinc-900 text-white rounded-xl font-black uppercase text-xs tracking-wider shadow-lg gap-2"
                >
                  <CreditCard className="w-4 h-4 text-primary" /> Checkout
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      <CarWashServicePickerDialog
        service={pickerService}
        onClose={() => setPickerService(null)}
        onConfirmRange={handleConfirmRangeService}
        onConfirmTier={handleConfirmTierService}
      />

      <VoidDialog isOpen={isVoidOpen} onClose={() => setIsVoidOpen(false)} onConfirm={executeVoid} />
    </div>
  );
}
