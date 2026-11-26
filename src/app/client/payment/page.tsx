'use client';

import React, { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, Banknote, CheckCircle2, ChevronRight, CreditCard, MapPin, Package, RefreshCcw, ShieldCheck, Store, Truck } from 'lucide-react';
import { collection, addDoc, query, where } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { cn } from '@/lib/utils';
import { useCart } from '@/hooks/use-cart';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { useProfile } from '@/hooks/use-profile';
import { BusinessBranch } from '@/lib/types';
import { toast } from '@/hooks/use-toast';

const LocationPicker = dynamic(() => import('@/components/shared/location-picker'), { ssr: false });

type PaymentMethod = 'MPESA' | 'AIRTEL_MONEY' | 'VISA' | 'CASH_ON_DELIVERY';
type Fulfilment = 'DELIVERY' | 'PICKUP';

const PAYMENT_OPTIONS: { id: PaymentMethod; label: string; detail: string; logo?: string }[] = [
  { id: 'MPESA', label: 'M-Pesa', detail: 'Mobile money', logo: 'https://commons.wikimedia.org/wiki/Special:FilePath/M-PESA.png' },
  { id: 'AIRTEL_MONEY', label: 'Airtel Money', detail: 'Mobile money', logo: 'https://commons.wikimedia.org/wiki/Special:FilePath/Bharti_Airtel_logo.svg' },
  { id: 'VISA', label: 'Visa card', detail: 'Debit or credit card', logo: 'https://commons.wikimedia.org/wiki/Special:FilePath/Visa.svg' },
  { id: 'CASH_ON_DELIVERY', label: 'Cash on delivery', detail: 'Pay in cash when your order arrives' }
];

export default function ClientPaymentPage() {
  const router = useRouter();
  const { user } = useUser();
  const firestore = useFirestore();
  const { profile } = useProfile();
  const { items, subtotal, isLoaded, clearCart } = useCart();
  const [method, setMethod] = useState<PaymentMethod>('MPESA');
  const [fulfilment, setFulfilment] = useState<Fulfilment | ''>('');
  const [destination, setDestination] = useState('');
  const [coordinates, setCoordinates] = useState<{ latitude: number; longitude: number } | null>(null);
  const [selectedBranchId, setSelectedBranchId] = useState('');
  const [cashAmount, setCashAmount] = useState('');
  const [paymentPhone, setPaymentPhone] = useState(profile?.phoneNumber || '');
  useEffect(() => { if (!paymentPhone && profile?.phoneNumber) setPaymentPhone(profile.phoneNumber); }, [profile?.phoneNumber, paymentPhone]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const branchesQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'branches'), where('status', '==', 'ACTIVE'));
  }, [firestore]);
  const { data: branches, loading: branchesLoading } = useCollection<BusinessBranch>(branchesQuery);
  const selectedBranch = useMemo(() => branches?.find(branch => branch.id === selectedBranchId) || null, [branches, selectedBranchId]);
  const cashReceived = Number(cashAmount);
  const cashChange = Number.isFinite(cashReceived) ? Math.max(0, cashReceived - subtotal) : 0;
  const cashValid = method !== 'CASH_ON_DELIVERY' || (cashAmount.trim() !== '' && Number.isFinite(cashReceived) && cashReceived >= subtotal);
  const mobilePaymentValid = !['MPESA', 'AIRTEL_MONEY'].includes(method) || /^((\+?254)|0)?[17]\d{8}$/.test(paymentPhone.replace(/[\s-]/g, ''));
  const destinationValid = fulfilment === 'DELIVERY'
    ? !!destination.trim() && !!coordinates
    : fulfilment === 'PICKUP' && !!selectedBranchId && !!selectedBranch;
  const canSubmit = !!user && !!firestore && isLoaded && items.length > 0 && destinationValid && cashValid && mobilePaymentValid && !isSubmitting;

  const useSavedAddress = () => {
    const saved = (profile as any)?.deliveryLocation;
    if (!profile?.address || saved?.latitude == null || saved?.longitude == null) {
      toast({ variant: 'destructive', title: 'Saved address incomplete', description: 'Add an address and pin its location in your profile first.' });
      return;
    }
    setDestination(profile.address);
    setCoordinates({ latitude: saved.latitude, longitude: saved.longitude });
  };

  const handlePlaceOrder = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmit) {
      toast({ variant: 'destructive', title: 'Complete checkout details', description: 'Choose delivery or pickup, select a destination and enter a valid cash amount when applicable.' });
      return;
    }
    if (method === 'VISA') {
      toast({ variant: 'destructive', title: 'Card payments unavailable', description: 'Visa card processing is not connected yet. Please choose M-Pesa, Airtel Money or cash on delivery.' });
      return;
    }
    setIsSubmitting(true);
    try {
      const order = {
        type: 'STORE',
        status: 'PENDING',
        customerId: user!.uid,
        customerName: profile?.displayName || user!.displayName || user!.email || 'Customer',
        customerPhone: profile?.phoneNumber || null,
        items: items.map(item => ({
          productId: item.id,
          name: item.name,
          price: Number(item.price),
          quantity: Number(item.quantity),
          image: item.image || null,
          category: item.category || '',
          status: 'COMMITTED'
        })),
        total: subtotal,
        timestamp: Date.now(),
        fulfilment,
        deliveryAddress: fulfilment === 'DELIVERY' ? destination.trim() : null,
        deliveryLocation: fulfilment === 'DELIVERY' ? coordinates : null,
        branchId: fulfilment === 'PICKUP' ? selectedBranch?.id : null,
        branchName: fulfilment === 'PICKUP' ? selectedBranch?.name : null,
        branchAddress: fulfilment === 'PICKUP' ? selectedBranch?.location?.address : null,
        paymentMethod: method,
        paymentStatus: 'AWAITING_PAYMENT',
        cashTendered: method === 'CASH_ON_DELIVERY' ? cashReceived : null,
        changeDue: method === 'CASH_ON_DELIVERY' ? cashChange : null
      };
      const orderRef = await addDoc(collection(firestore!, 'orders'), order);
      if (method === 'MPESA' || method === 'AIRTEL_MONEY') {
        const idToken = await user!.getIdToken();
        const endpoint = method === 'MPESA' ? '/api/payments/mpesa/initiate' : '/api/payments/airtel/initiate';
        const paymentResponse = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + idToken },
          body: JSON.stringify({ orderId: orderRef.id, phone: paymentPhone.trim() })
        });
        const paymentResult = await paymentResponse.json();
        if (!paymentResponse.ok || !paymentResult.success) {
          throw new Error(paymentResult.message || 'Payment request could not be started. Your order is saved as awaiting payment.');
        }
        toast({ title: 'Payment request sent', description: paymentResult.message || 'Approve the payment request on your phone.' });
      } else {
        toast({ title: 'Order placed', description: 'Your cash-on-delivery order has been received.' });
      }
      clearCart();
      router.push('/client/orders');
    } catch (error) {
      console.error('[CLIENT CHECKOUT]', error);
      toast({ variant: 'destructive', title: 'Checkout needs attention', description: error instanceof Error ? error.message : 'Your cart is unchanged. Please try again.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isLoaded) return <div className="mx-auto max-w-5xl px-4 py-16 text-sm text-zinc-500">Loading checkout…</div>;
  if (!items.length) return (
    <div className="mx-auto flex min-h-[55vh] max-w-3xl flex-col items-center justify-center gap-4 px-5 text-center">
      <Package className="h-10 w-10 text-zinc-300" />
      <h1 className="text-2xl font-semibold text-zinc-900">Your cart is empty</h1>
      <Button asChild className="rounded-lg"><Link href="/client/cart">Return to cart</Link></Button>
    </div>
  );

  return (
    <div className="min-h-screen bg-zinc-50/60">
      <section className="border-b border-zinc-100 bg-white py-7 sm:py-9">
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6">
          <div className="mb-2 flex items-center gap-2 text-[9px] font-bold uppercase tracking-[0.22em] text-zinc-400">
            <Link href="/" className="hover:text-primary">Home</Link><ChevronRight className="h-3 w-3" /><Link href="/client/cart" className="hover:text-primary">Cart</Link><ChevronRight className="h-3 w-3" /><span className="text-primary">Checkout</span>
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-950 sm:text-4xl">Checkout</h1>
          <p className="mt-1 text-sm text-zinc-500">Confirm where your order should go and how you intend to pay.</p>
        </div>
      </section>

      <form onSubmit={handlePlaceOrder} className="mx-auto grid w-full max-w-7xl grid-cols-1 items-start gap-6 px-4 py-6 pb-28 sm:px-6 lg:grid-cols-12 lg:gap-8 lg:py-9">
        <div className="space-y-5 lg:col-span-8">
          <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-6">
            <SectionHeading icon={<Truck className="h-4 w-4" />} title="Delivery or pickup" subtitle="Choose a destination for every order." />
            <RadioGroup value={fulfilment} onValueChange={(value) => { setFulfilment(value as Fulfilment); setDestination(''); setCoordinates(null); setSelectedBranchId(''); }} className="mt-5 grid grid-cols-2 gap-3">
              <ChoiceCard value="DELIVERY" current={fulfilment} icon={<Truck className="h-5 w-5" />} title="Deliver to me" detail="Home or another address" />
              <ChoiceCard value="PICKUP" current={fulfilment} icon={<Store className="h-5 w-5" />} title="Pick up at branch" detail="Collect from a location" />
            </RadioGroup>

            {fulfilment === 'DELIVERY' && (
              <div className="mt-5 space-y-4 border-t border-zinc-100 pt-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div><h3 className="text-sm font-semibold text-zinc-900">Delivery destination</h3><p className="text-xs text-zinc-500">Search a place or area, then pin the exact point.</p></div>
                  {profile?.address && <Button type="button" variant="outline" onClick={useSavedAddress} className="h-9 rounded-lg text-xs">Use saved home address</Button>}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="delivery-destination">House, building, street or area</Label>
                  <Input id="delivery-destination" value={destination} onChange={e => setDestination(e.target.value)} placeholder="Search or enter your delivery address" className="h-11 rounded-lg" required />
                </div>
                <LocationPicker
                  initialLat={coordinates?.latitude ?? (profile as any)?.deliveryLocation?.latitude}
                  initialLng={coordinates?.longitude ?? (profile as any)?.deliveryLocation?.longitude}
                  onLocationSelect={(latitude, longitude, address) => {
                    setCoordinates({ latitude, longitude });
                    if (address && !address.startsWith('Pinned:') && !address.startsWith('Custom Point:')) setDestination(address);
                  }}
                />
                {coordinates && <p className="text-xs text-emerald-700"><CheckCircle2 className="mr-1 inline h-3.5 w-3.5" />Location pinned: {coordinates.latitude.toFixed(5)}, {coordinates.longitude.toFixed(5)}</p>}
                {!destinationValid && <p className="text-xs text-amber-700">Enter an address and select its location on the map to continue.</p>}
              </div>
            )}

            {fulfilment === 'PICKUP' && (
              <div className="mt-5 space-y-2 border-t border-zinc-100 pt-5">
                <Label htmlFor="pickup-branch">Select pickup branch</Label>
                <select id="pickup-branch" value={selectedBranchId} onChange={e => setSelectedBranchId(e.target.value)} className="h-12 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-primary/30">
                  <option value="">{branchesLoading ? 'Loading branches…' : 'Choose a branch'}</option>
                  {(branches || []).map(branch => <option key={branch.id} value={branch.id}>{branch.name} — {branch.location?.town || branch.location?.county || ''}</option>)}
                </select>
                {selectedBranch && <div className="rounded-xl bg-zinc-50 p-3 text-xs text-zinc-600"><p className="font-semibold text-zinc-900">{selectedBranch.name}</p><p>{selectedBranch.location?.address}, {selectedBranch.location?.town}, {selectedBranch.location?.county}</p>{selectedBranch.phone && <p className="mt-1">{selectedBranch.phone}</p>}</div>}
                {!branchesLoading && !branches?.length && <p className="text-xs text-amber-700">No active pickup branches are available. Please choose delivery or contact support.</p>}
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-6">
            <SectionHeading icon={<CreditCard className="h-4 w-4" />} title="Payment method" subtitle="Select how you want to settle this order." />
            <RadioGroup value={method} onValueChange={value => setMethod(value as PaymentMethod)} className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {PAYMENT_OPTIONS.map(option => (
                <Label key={option.id} htmlFor={option.id} className={cn("flex min-h-[76px] cursor-pointer items-center justify-between gap-3 rounded-xl border p-3 transition-colors", method === option.id ? "border-primary bg-orange-50/50 ring-1 ring-primary/20" : "border-zinc-200 hover:border-zinc-300")}>
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-12 w-[76px] shrink-0 items-center justify-center rounded-lg border border-zinc-100 bg-white p-2">
                      {option.logo ? <img src={option.logo} alt={option.label + ' logo'} className="max-h-8 max-w-full object-contain" /> : <Banknote className="h-7 w-7 text-emerald-700" />}
                    </div>
                    <div className="min-w-0"><p className="text-sm font-semibold text-zinc-900">{option.label}</p><p className="text-[11px] text-zinc-500">{option.detail}</p></div>
                  </div>
                  <RadioGroupItem id={option.id} value={option.id} />
                </Label>
              ))}
            </RadioGroup>
            <p className="mt-3 text-[10px] text-zinc-400">Payment brand marks: <a className="underline hover:text-zinc-700" href="https://commons.wikimedia.org/wiki/File:M-PESA.png" target="_blank" rel="noreferrer">M-Pesa</a>, <a className="underline hover:text-zinc-700" href="https://commons.wikimedia.org/wiki/File:Bharti_Airtel_logo.svg" target="_blank" rel="noreferrer">Airtel</a> and <a className="underline hover:text-zinc-700" href="https://commons.wikimedia.org/wiki/File:Visa.svg" target="_blank" rel="noreferrer">Visa</a> via Wikimedia Commons.</p>
            {(method === 'MPESA' || method === 'AIRTEL_MONEY') && (
              <div className="mt-5 rounded-xl border border-zinc-200 bg-zinc-50 p-4">
                <Label htmlFor="payment-phone">{method === 'MPESA' ? 'M-Pesa phone number' : 'Airtel Money phone number'}</Label>
                <Input id="payment-phone" type="tel" inputMode="tel" autoComplete="tel" value={paymentPhone} onChange={e => setPaymentPhone(e.target.value)} placeholder="07XX XXX XXX" className="mt-2 h-12 rounded-lg bg-white" required />
                <p className="mt-2 text-xs text-zinc-500">We will send a payment request to this number. Enter your PIN only on the official mobile-money prompt.</p>
              </div>
            )}
            {method === 'CASH_ON_DELIVERY' && (
              <div className="mt-5 rounded-xl border border-zinc-200 bg-zinc-50 p-4">
                <div className="space-y-1.5">
                  <Label htmlFor="cash-available">Cash amount you will have available (KES)</Label>
                  <Input id="cash-available" type="number" inputMode="decimal" min={subtotal} step="1" value={cashAmount} onChange={e => setCashAmount(e.target.value)} placeholder="Enter the exact cash you will carry" className="h-12 rounded-lg bg-white text-lg font-semibold" required />
                  <p className="text-xs text-zinc-500">Order total: KES {subtotal.toLocaleString()}</p>
                </div>
                {cashAmount && Number.isFinite(cashReceived) && cashReceived >= subtotal && <div className="mt-3 flex items-center justify-between border-t border-zinc-200 pt-3 text-sm"><span className="text-zinc-600">Change to prepare</span><strong className="text-zinc-900">KES {cashChange.toLocaleString()}</strong></div>}
                {cashAmount && cashReceived < subtotal && <p className="mt-2 text-xs font-medium text-red-600">The cash amount must cover the order total. You are short by KES {Math.max(0, subtotal - cashReceived).toLocaleString()}.</p>}
              </div>
            )}

          </section>
        </div>

        <aside className="lg:sticky lg:top-24 lg:col-span-4">
          <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-6">
            <h2 className="text-base font-semibold text-zinc-900">Order summary</h2>
            <div className="mt-4 space-y-3 border-b border-zinc-100 pb-4">
              {items.map(item => <div key={item.id} className="flex justify-between gap-3 text-sm"><span className="min-w-0 text-zinc-600">{item.name} <span className="text-zinc-400">× {item.quantity}</span></span><span className="shrink-0 font-medium text-zinc-900">KES {(item.price * item.quantity).toLocaleString()}</span></div>)}
            </div>
            <div className="flex items-center justify-between py-4"><span className="text-sm text-zinc-500">Subtotal</span><strong className="text-xl font-semibold text-zinc-950">KES {subtotal.toLocaleString()}</strong></div>
            <p className="mb-4 text-[11px] leading-5 text-zinc-500">Delivery charges, if applicable, will be confirmed before fulfilment.</p>
            <Button type="submit" disabled={!canSubmit} className="h-12 w-full rounded-lg bg-zinc-900 text-xs font-bold uppercase tracking-wider text-white hover:bg-zinc-800">
              {isSubmitting ? <RefreshCcw className="mr-2 h-4 w-4 animate-spin" /> : <>Place order <ArrowRight className="ml-2 h-4 w-4" /></>}
            </Button>
            <p className="mt-3 flex items-center justify-center gap-2 text-[10px] text-zinc-400"><ShieldCheck className="h-3.5 w-3.5" />Order details are securely submitted to your account</p>
            {!fulfilment && <p className="mt-3 text-center text-xs text-amber-700">Choose delivery or pickup to continue.</p>}
          </div>
        </aside>
      </form>
    </div>
  );
}

function SectionHeading({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle: string }) {
  return <div className="flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-900 text-white">{icon}</div><div><h2 className="text-sm font-semibold text-zinc-900">{title}</h2><p className="text-xs text-zinc-500">{subtitle}</p></div></div>;
}

function ChoiceCard({ value, current, icon, title, detail }: { value: string; current: string; icon: React.ReactNode; title: string; detail: string }) {
  return <Label htmlFor={value} className={cn("flex cursor-pointer flex-col gap-2 rounded-xl border p-3 sm:flex-row sm:items-center sm:gap-3", current === value ? "border-primary bg-orange-50/50" : "border-zinc-200")}>
    <span className={cn("flex h-9 w-9 items-center justify-center rounded-lg", current === value ? "bg-primary text-white" : "bg-zinc-100 text-zinc-600")}>{icon}</span>
    <span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-zinc-900">{title}</span><span className="block text-[11px] text-zinc-500">{detail}</span></span>
    <RadioGroupItem id={value} value={value} />
  </Label>;
}
