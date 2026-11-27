'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { 
  Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useDb, useUser } from '@/lib/data';
import { doc, writeBatch, increment, getDoc } from '@/lib/db';
import { Product } from '@/lib/types';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import Link from 'next/link';

const formatDateStr = (d?: Date, mode: 'ISO' | 'PPP' | 'MMM' = 'ISO') => {
  if (!d) return '';
  if (mode === 'PPP') {
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }
  if (mode === 'MMM') {
    return d.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
  }
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const LocationPicker = dynamic(() => import('@/components/shared/location-picker'), {
  ssr: false,
  loading: () => (
    <div className="h-[300px] bg-zinc-50 rounded-2xl flex items-center justify-center border border-dashed border-zinc-200">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="w-8 h-8 text-zinc-200 animate-spin" />
        <p className="text-[10px] font-black uppercase tracking-widest text-zinc-300">Synchronizing Map Interface...</p>
      </div>
    </div>
  )
});

const VALET_OPTIONS = [
  { id: 'NONE', label: 'WALK IN', sub: 'I will bring the car', price: 0 },
  { id: 'PICKUP', label: 'PICKUP SERVICE', sub: 'Complimentary collection', price: 0 }
];

const TIME_SLOTS = [
  '08:00 AM', '09:00 AM', '10:00 AM', '11:00 AM', '12:00 PM', 
  '01:00 PM', '02:00 PM', '03:00 PM', '04:00 PM', '05:00 PM', '06:00 PM'
];

const QUICK_COLORS = [
  { name: 'White', hex: '#FFFFFF', border: 'border-zinc-200' },
  { name: 'Black', hex: '#000000', border: 'border-zinc-800' },
  { name: 'Silver', hex: '#C0C0C0', border: 'border-zinc-300' },
  { name: 'Red', hex: '#E60000', border: 'border-red-600' },
  { name: 'Blue', hex: '#0000FF', border: 'border-blue-600' },
];

export default function CarwashBookingPage() {
  const router = useRouter();
  const { user } = useUser();
  const firestore = useDb();
  
  const [selectedServiceId, setSelectedServiceId] = useState<string>('');
  const [valetType, setValetType] = useState('NONE');
  const [plateNumber, setPlateNumber] = useState('');
  const [vehicleColor, setVehicleColor] = useState('#FFFFFF');
  const [address, setAddress] = useState('');
  const [coordinates, setCoordinates] = useState<{ lat: number, lng: number } | null>(null);
  const [bookingDate, setBookingDate] = useState<Date | undefined>(new Date());
  const [bookingTime, setBookingTime] = useState<string>('10:00 AM');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [services, setServices] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [servicesError, setServicesError] = useState('');

  // Public service discovery uses the same cached, server-authorized catalogue
  // as the other public product pages. Booking writes still use the signed-in
  // customer's Supabase session and existing transaction workflow.
  useEffect(() => {
    const controller = new AbortController();

    async function loadServices() {
      setLoading(true);
      setServicesError('');
      try {
        const params = new URLSearchParams({
          unit: 'CARWASH',
          page: '1',
          pageSize: '96',
          sort: 'name',
        });
        const response = await fetch(`/api/public/catalogue?${params.toString()}`, {
          signal: controller.signal,
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(payload.error || 'Carwash services could not be loaded.');
        }
        if (!controller.signal.aborted) {
          setServices(Array.isArray(payload.products) ? payload.products as Product[] : []);
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          console.error('[PUBLIC_CARWASH_SERVICES_LOAD_FAILED]', error);
          setServices([]);
          setServicesError(error instanceof Error
            ? error.message
            : 'Carwash services are temporarily unavailable. Please try again shortly.');
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    loadServices();
    return () => controller.abort();
  }, []);

  // Never offer archived or malformed service records to customers.
  const activeServices = useMemo(() => (
    (services || []).filter(service =>
      service.archived !== true &&
      typeof service.id === 'string' &&
      service.id.length > 0 &&
      Number.isFinite(Number(service.price)) &&
      Number(service.price) >= 0
    )
  ), [services]);

  const activeServiceData = useMemo(() => {
    return activeServices.find(service => service.id === selectedServiceId);
  }, [activeServices, selectedServiceId]);

  const valetPrice = VALET_OPTIONS.find(o => o.id === valetType)?.price || 0;
  const total = (activeServiceData?.price || 0) + valetPrice;

  const handleLocationPicked = (lat: number, lng: number, addr: string) => {
    setCoordinates({ lat, lng });
    setAddress(addr);
  };

  const handleBooking = async () => {
    if (!user) {
      toast({ title: "Sign In Required", description: "Please log in to schedule a service." });
      router.push('/login');
      return;
    }

    if (!firestore || !activeServiceData || activeServiceData.archived || !Number.isFinite(activeServiceData.price) || activeServiceData.price < 0 || !selectedServiceId || !plateNumber.trim() || !bookingDate || !bookingTime) {
      toast({ variant: "destructive", title: "Missing Detail", description: "Please complete all fields." });
      return;
    }

    setIsSubmitting(true);
    try {
      // Reuse one request key after ambiguous network failures to prevent duplicates.
      const requestKey = localStorage.getItem('urban_carwash_booking_key')
        || (typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : String(Date.now()) + '_' + Math.random().toString(36).slice(2));
      localStorage.setItem('urban_carwash_booking_key', requestKey);
      const normalizedPlate = plateNumber.toUpperCase().trim();
      const orderRef = doc(firestore, 'orders', user.uid + '_' + requestKey);
      const jobRef = doc(firestore, 'carwash_jobs', user.uid + '_' + requestKey);
      const existingOrder = await getDoc(orderRef);
      if (existingOrder.exists()) {
        localStorage.removeItem('urban_carwash_booking_key');
        router.push('/client/success?orderId=' + orderRef.id);
        return;
      }
      const orderData = {
        type: 'CARWASH' as const,
        status: 'PENDING' as const,
        total,
        plateNumber: normalizedPlate,
        customerId: user.uid,
        timestamp: Date.now(),
        scheduledDate: formatDateStr(bookingDate, 'ISO'),
        scheduledTime: bookingTime,
        items: [{ productId: activeServiceData!.id!, name: activeServiceData!.name, price: activeServiceData!.price, quantity: 1 }]
      };

      const fleetRef = doc(firestore!, 'users', user.uid, 'fleet', normalizedPlate);
      const batch = writeBatch(firestore!);
      batch.set(orderRef, orderData);
      batch.set(jobRef, {
        orderId: orderRef.id,
        plateNumber: normalizedPlate,
        vehicleColor: vehicleColor,
        service: activeServiceData!.name,
        price: total,
        commission: activeServiceData!.price * 0.3,
        status: 'QUEUED' as const,
        attendantId: 'Unassigned',
        timestamp: Date.now(),
        valetService: valetType,
        address: address || 'At Branch',
        coordinates: coordinates || null,
        isValet: valetType !== 'NONE',
        bookingDate: formatDateStr(bookingDate, 'ISO'),
        bookingTime: bookingTime,
        customerId: user.uid
      });
      batch.set(fleetRef, {
        plateNumber: normalizedPlate,
        vehicleColor: vehicleColor,
        lastService: Date.now(),
        lastServiceType: activeServiceData!.name,
        totalServices: increment(1)
      }, { merge: true });

      await batch.commit();
      localStorage.removeItem('urban_carwash_booking_key');
      toast({ title: "Booking Submitted", description: "Your booking is awaiting confirmation." });
      router.push(`/client/success?orderId=${orderRef.id}`);
    } catch (err) {
      console.error('[CARWASH_BOOKING_FAILED]', err);
      toast({ variant: "destructive", title: "Booking Not Saved", description: "No booking was confirmed. Please check your connection and try again." });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-white">
      {/* ── BOLD HEADER ── */}
      <section className="bg-zinc-50 border-b border-zinc-100 py-16">
        <div className="max-w-7xl mx-auto px-6 w-full">
           <div className="flex items-center gap-4 text-[10px] font-black uppercase tracking-[0.4em] text-zinc-300 mb-6">
              <Link href="/" className="hover:text-primary transition-colors">HOME</Link> 
              <span className="w-1 h-1 rounded-full bg-zinc-200" />
              <span className="text-primary">DETAILING SERVICE</span>
           </div>
           <h1 className="text-6xl md:text-8xl font-black font-headline uppercase text-zinc-900 tracking-tighter leading-none">
              Book a <br/> <span className="text-primary">Service.</span>
           </h1>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-6 w-full py-20">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-20">
          <div className="lg:col-span-8 space-y-24">
            
            {/* Step 1: Package Selection (Polished Dropdown) */}
            <div className="space-y-10">
              <div className="flex items-center gap-6">
                 <div className="text-4xl font-black font-headline text-zinc-100 leading-none">01</div>
                 <h3 className="text-sm font-black uppercase tracking-[0.3em] text-zinc-900">Select Detailing Package</h3>
              </div>

              <div className="max-w-md">
                {loading ? (
                   <div className="py-4 text-center text-[10px] font-black uppercase text-zinc-300 tracking-widest animate-pulse">
                      Synchronizing protocols...
                   </div>
                ) : (
                  <Select value={selectedServiceId} onValueChange={setSelectedServiceId}>
                    <SelectTrigger className="h-16 bg-white border-zinc-100 rounded-2xl px-8 font-black uppercase tracking-widest shadow-sm">
                      <SelectValue placeholder="CHOOSE PACKAGE" />
                    </SelectTrigger>
                    <SelectContent className="rounded-2xl border-none shadow-2xl">
                      {activeServices.map(service => (
                        <SelectItem key={service.id} value={service.id!} className="font-black text-[10px] uppercase py-4">
                          <div className="flex items-center justify-between gap-12 w-full min-w-[280px]">
                            <span className="truncate">{service.name}</span>
                            <span className="text-primary ml-auto whitespace-nowrap">KES {service.price.toLocaleString()}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                {!loading && servicesError && (
                  <p className="mt-3 text-xs font-semibold text-red-600" role="alert">
                    {servicesError}
                  </p>
                )}
                {!loading && !servicesError && activeServices.length === 0 && (
                  <p className="mt-3 text-xs font-semibold text-zinc-400" role="status">
                    No detailing packages are currently available. Please check back shortly.
                  </p>
                )}
              </div>
            </div>

            {/* Step 2: Time Selection */}
            <div className="space-y-10">
              <div className="flex items-center gap-6">
                 <div className="text-4xl font-black font-headline text-zinc-100 leading-none">02</div>
                 <h3 className="text-sm font-black uppercase tracking-[0.3em] text-zinc-900">Choose Arrival Time</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-3">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 px-1">Select Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant={"outline"}
                        className={cn(
                          "w-full h-16 justify-start text-left font-black uppercase tracking-widest border-zinc-100 rounded-2xl px-8 shadow-sm",
                          !bookingDate && "text-muted-foreground"
                        )}
                      >
                        {bookingDate ? formatDateStr(bookingDate, "PPP") : <span>Pick a date</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 border-none shadow-2xl rounded-2xl" align="start">
                      <Calendar
                        mode="single"
                        selected={bookingDate}
                        onSelect={setBookingDate}
                        disabled={(date) => date < new Date() || date.getDay() === 0}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-3">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 px-1">Select Slot</Label>
                  <Select value={bookingTime} onValueChange={setBookingTime}>
                    <SelectTrigger className="h-16 bg-white border-zinc-100 rounded-2xl px-8 font-black uppercase tracking-widest shadow-sm">
                      <SelectValue placeholder="Select Slot" />
                    </SelectTrigger>
                    <SelectContent className="rounded-2xl border-none shadow-2xl">
                      {TIME_SLOTS.map(t => (
                        <SelectItem key={t} value={t} className="font-black text-[10px] uppercase">{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Step 3: Logistics & Valet */}
            <div className="space-y-10">
              <div className="flex items-center gap-6">
                 <div className="text-4xl font-black font-headline text-zinc-100 leading-none">03</div>
                 <h3 className="text-sm font-black uppercase tracking-[0.3em] text-zinc-900">Logistics & Valet</h3>
              </div>

              <RadioGroup value={valetType} onValueChange={setValetType} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {VALET_OPTIONS.map(opt => (
                  <Label 
                    key={opt.id}
                    htmlFor={opt.id} 
                    className={cn(
                      "p-8 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between h-full",
                      valetType === opt.id ? "border-primary bg-primary/5 shadow-lg" : "border-zinc-100 bg-white hover:bg-zinc-50"
                    )}
                  >
                    <div>
                      <p className="text-sm font-black text-zinc-900 uppercase mb-2 tracking-tight">{opt.label}</p>
                      <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest leading-relaxed">{opt.sub}</p>
                    </div>
                    <div className="mt-8 flex items-center justify-between border-t border-zinc-100 pt-4">
                      <p className="text-[10px] font-black text-green-600 uppercase">INCLUDED</p>
                      <RadioGroupItem value={opt.id} id={opt.id} className="sr-only" />
                    </div>
                  </Label>
                ))}
              </RadioGroup>

              {valetType !== 'NONE' && (
                <div className="space-y-8 pt-6 animate-in slide-in-from-top-4 duration-700">
                  <div className="space-y-4">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 px-1">Pickup Coordinate Mapping</Label>
                    <LocationPicker onLocationSelect={handleLocationPicked} />
                  </div>
                  
                  {address && (
                    <div className="p-8 bg-zinc-900 text-white rounded-xl flex flex-col gap-2 shadow-2xl">
                       <p className="text-[8px] font-black uppercase tracking-[0.4em] text-primary">AUTHORIZED ADDRESS</p>
                       <p className="text-sm font-bold uppercase leading-relaxed tracking-tight">{address}</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Step 4: Vehicle Entry */}
            <div className="space-y-10">
              <div className="flex items-center gap-6">
                 <div className="text-4xl font-black font-headline text-zinc-100 leading-none">04</div>
                 <h3 className="text-sm font-black uppercase tracking-[0.3em] text-zinc-900">Vehicle Identification</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                 <div className="space-y-4">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 px-1">Plate Number</Label>
                    <Input 
                      placeholder="KDA 123X" 
                      value={plateNumber}
                      onChange={e => setPlateNumber(e.target.value.toUpperCase())}
                      className="h-20 bg-zinc-50 border-none rounded-[1.5rem] px-8 text-3xl font-black font-mono tracking-widest text-zinc-900 shadow-inner"
                    />
                 </div>

                 <div className="space-y-4">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 px-1">Color Specification</Label>
                    <div className="h-20 flex items-center gap-4 p-5 bg-zinc-50 rounded-[1.5rem] border border-zinc-100">
                       <div className="flex -space-x-2">
                          {QUICK_COLORS.map(color => (
                            <button
                              key={color.hex}
                              type="button"
                              onClick={() => setVehicleColor(color.hex)}
                              className={cn(
                                "w-10 h-10 rounded-full border-4 transition-all relative z-10",
                                vehicleColor === color.hex ? "border-primary scale-110 z-20 shadow-xl" : "border-white hover:scale-105",
                              )}
                              style={{ background: color.hex }}
                            />
                          ))}
                       </div>
                       <div className="h-8 w-px bg-zinc-200 mx-2" />
                       <div className="flex-1 flex flex-col items-end">
                          <span className="text-[11px] font-black text-zinc-900 uppercase tracking-tight">{vehicleColor}</span>
                          <span className="text-[8px] font-bold text-zinc-400 uppercase tracking-widest">HEX PROTOCOL</span>
                       </div>
                    </div>
                 </div>
              </div>
            </div>

          </div>

          {/* Service Quote Sidebar */}
          <aside className="lg:col-span-4">
             <div className="bg-white rounded-[3rem] p-10 shadow-2xl border border-zinc-100 space-y-12 sticky top-32">
                <div className="text-center space-y-2 py-6 bg-white rounded-xl relative overflow-hidden">
                  <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.5em]">Service Total</p>
                  <h2 className="text-3xl md:text-4xl font-black font-headline text-zinc-900 tracking-tighter leading-none">
                    KES {total.toLocaleString()}
                  </h2>
                </div>

                <div className="space-y-6">
                  <SummaryRow label="Package" value={activeServiceData?.name || '---'} />
                  <SummaryRow label="Schedule" value={bookingDate ? formatDateStr(bookingDate, 'MMM') : '---'} />
                  <SummaryRow label="Slot" value={bookingTime || '---'} />
                  <div className="pt-4 border-t border-zinc-100">
                     <SummaryRow label="Estimated Pts" value={`+${Math.floor(total * 0.1)}`} highlight />
                  </div>
                </div>

                <div className="space-y-4">
                  <Button 
                    onClick={handleBooking}
                    disabled={isSubmitting || !selectedServiceId || !plateNumber}
                    className="w-full h-20 bg-primary text-white font-black uppercase text-[12px] tracking-[0.3em] rounded-2xl shadow-xl shadow-primary/20 transition-all active:scale-95"
                  >
                    {isSubmitting ? 'Processing...' : 'Confirm Booking'}
                  </Button>
                  <p className="text-center text-[8px] font-black text-zinc-300 uppercase tracking-[0.4em] pt-2 leading-relaxed">
                    By booking, you agree to our <br/> standard terms of service.
                  </p>
                </div>
             </div>
          </aside>
        </div>
      </section>

      {/* Footer Disclaimer */}
      <section className="py-24 bg-zinc-50 border-t border-zinc-100">
         <div className="max-w-4xl mx-auto px-6 text-center space-y-6">
            <h4 className="text-[11px] font-black uppercase tracking-[0.4em] text-zinc-400">Notice to Owners</h4>
            <p className="text-sm font-medium text-zinc-400 leading-relaxed uppercase tracking-tight">
               Urban Express does not provide valet insurance. All vehicles must be fully insured by the owner. 
               Pre-existing damage will be logged by staff during the arrival inspection.
            </p>
         </div>
      </section>
    </div>
  );
}

function SummaryRow({ label, value, highlight }: { label: string, value: string, highlight?: boolean }) {
  return (
    <div className="flex justify-between items-end">
       <span className="text-[10px] font-black uppercase text-zinc-300 tracking-widest">{label}</span>
       <span className={cn(
         "text-xs font-black uppercase tracking-tight",
         highlight ? "text-primary" : "text-zinc-900"
       )}>{value}</span>
    </div>
  );
}