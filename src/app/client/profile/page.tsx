'use client';

import React, { useMemo, useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { MapPin } from 'lucide-react';
import { 
  History, 
  ChevronRight, 
  Settings, 
  Car, 
  Package, 
  Award,
  Camera,
  User,
  RefreshCcw,
  Mail,
  LayoutDashboard,
  Shield
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { useUser, useFirestore, useCollection, useMemoFirebase, errorEmitter, FirestorePermissionError } from '@/firebase';
import { collection, query, where, orderBy, doc, updateDoc, addDoc } from 'firebase/firestore';
import { updateProfile } from 'firebase/auth';
import { Order } from '@/lib/types';
import Link from 'next/link';
import { useProfile } from '@/hooks/use-profile';
import { ImageUpload } from '@/components/shared/image-upload';
import { toast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { AccountSecurity } from '@/components/client/account-security';

const LocationPicker = dynamic(() => import('@/components/shared/location-picker'), { ssr: false });

export default function ClientProfilePage() {
  const { user, loading: authLoading } = useUser();
  const { profile, loading: profileHookLoading, isEmployee, isSuperAdmin, role } = useProfile();
  const firestore = useFirestore();
  const router = useRouter();
  
  const [isUpdatingPhoto, setIsUpdatingPhoto] = useState(false);
  const [isUpdatingInfo, setIsUpdatingInfo] = useState(false);
  const [phone, setPhone] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [homeAddress, setHomeAddress] = useState('');
  const [homeLocation, setHomeLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [isSavingAddress, setIsSavingAddress] = useState(false);
  const [marketingOptIn, setMarketingOptIn] = useState(false);
  const [isSavingMarketing, setIsSavingMarketing] = useState(false);

  // Redirect guests to login
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [authLoading, user, router]);

  // Sync local state with real profile data
  useEffect(() => {
    if (profile) {
      setPhone(profile.phoneNumber || '');
      setDisplayName(profile.displayName || '');
      setHomeAddress(profile.address || '');
      setMarketingOptIn((profile as any).marketingOptIn === true || (profile as any).marketingConsent === true);
      const savedLocation = (profile as any).deliveryLocation;
      setHomeLocation(savedLocation?.latitude != null && savedLocation?.longitude != null ? { latitude: savedLocation.latitude, longitude: savedLocation.longitude } : null);
    }
  }, [profile]);


  const handleMarketingPreferenceChange = async (nextValue: boolean) => {
    if (!user) return;
    setIsSavingMarketing(true);
    try {
      const token = await user.getIdToken();
      const response = await fetch('/api/email/preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ marketingOptIn: nextValue }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Could not update your email preference.');
      setMarketingOptIn(nextValue);
      toast({ title: nextValue ? 'Email offers enabled' : 'Email offers disabled', description: nextValue ? 'You have opted in to promotional emails.' : 'You will no longer receive promotional emails.' });
    } catch (error) {
      toast({ variant: 'destructive', title: 'Preference not saved', description: error instanceof Error ? error.message : 'Please try again.' });
    } finally {
      setIsSavingMarketing(false);
    }
  };

  const ordersQuery = useMemoFirebase(() => {
    if (!firestore || !user?.uid) return null;
    return query(
      collection(firestore, 'orders'),
      where('customerId', '==', user.uid),
      orderBy('timestamp', 'desc')
    );
  }, [firestore, user?.uid]);

  const fleetQuery = useMemoFirebase(() => {
    if (!firestore || !user?.uid) return null;
    return query(collection(firestore, 'users', user.uid, 'fleet'));
  }, [firestore, user?.uid]);

  const { data: orders, loading: ordersLoading } = useCollection<Order>(ordersQuery);
  const { data: fleet, loading: fleetLoading } = useCollection<any>(fleetQuery);

  const stats = useMemo(() => {
    if (!orders) return { points: 0, totalSpent: 0, totalOrders: 0 };
    const paidOrders = orders.filter(o => o.status === 'PAID');
    const calculatedSpend = paidOrders.reduce((sum, o) => sum + (o.total || 0), 0);
    // The reconciled baseline includes historical orders matched by registration
    // number. Continue adding later customer-linked paid orders without recounting
    // the historical records already included in that baseline.
    const reconciledAt = Number(profile?.loyaltyReconciledAt || 0);
    const isReconciled = !!profile?.loyaltyReconciliationId;
    const postReconciliationSpend = isReconciled
      ? paidOrders.filter(o => Number(o.timestamp || 0) > reconciledAt).reduce((sum, o) => sum + (o.total || 0), 0)
      : 0;
    const totalSpent = isReconciled ? Number(profile?.totalSpent || 0) + postReconciliationSpend : calculatedSpend;
    const points = Math.floor(totalSpent / 10);
    return { points, totalSpent, totalOrders: paidOrders.length };
  }, [orders, profile]);

  const handlePhotoUpdate = async (url: string) => {
    if (!user || !firestore || !url) return;
    setIsUpdatingPhoto(true);
    try {
      await updateProfile(user, { photoURL: url });
      const userRef = doc(firestore, 'users', user.uid);
      updateDoc(userRef, { photoURL: url }).catch(err => {
         errorEmitter.emit('permission-error', new FirestorePermissionError({ path: userRef.path, operation: 'update', requestResourceData: { photoURL: url } }));
      });
      
      addDoc(collection(firestore, 'audit_logs'), {
        action: 'CLIENT_PHOTO_UPDATE',
        userId: user.uid,
        details: 'Client updated their account profile picture.',
        timestamp: Date.now(),
        severity: 'INFO'
      }).catch(err => console.error("[AUDIT LOG FAILURE]", err));

      toast({ title: "Identity Updated", description: "Your profile picture has been synchronized." });
    } catch (err) {
      console.error("[PROFILE PHOTO SYNC ERROR]", err);
      toast({ variant: "destructive", title: "Photo Not Updated", description: "We could not save your profile photo. Please try again." });
    } finally {
      setIsUpdatingPhoto(false);
    }
  };

  const handleHomeAddressSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !firestore || !homeAddress.trim()) { toast({ variant: 'destructive', title: 'Home address required' }); return; }
    setIsSavingAddress(true);
    try {
      await updateDoc(doc(firestore, 'users', user.uid), { address: homeAddress.trim(), deliveryLocation: homeLocation, updatedAt: Date.now() });
      toast({ title: 'Home address saved', description: 'Your delivery address is ready to use at checkout.' });
    } catch (error) {
      console.error('[HOME ADDRESS SAVE]', error);
      toast({ variant: 'destructive', title: 'Address not saved', description: 'Please try again.' });
    } finally { setIsSavingAddress(false); }
  };

  const handleInfoUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !firestore) return;
    const normalizedPhone = phone.replace(/[\s()-]/g, '');
    const validKenyanPhone = /^(?:\+254|254|0)(?:7|1)\d{8}$/.test(normalizedPhone);
    if (!displayName.trim() || displayName.trim().length < 2) {
      toast({ variant: "destructive", title: "Name Required", description: "Enter a name with at least 2 characters." });
      return;
    }
    if (!validKenyanPhone) {
      toast({ variant: "destructive", title: "Check Phone Number", description: "Use a Kenyan mobile number, for example 0712345678 or +254712345678." });
      return;
    }
    setIsUpdatingInfo(true);
    try {
      const userRef = doc(firestore, 'users', user.uid);
      await updateDoc(userRef, {
        displayName: displayName.trim(),
        phoneNumber: normalizedPhone.startsWith('0') ? `+254${normalizedPhone.slice(1)}` : normalizedPhone.startsWith('254') ? `+${normalizedPhone}` : normalizedPhone
      });
      if (displayName !== user.displayName) {
        await updateProfile(user, { displayName });
      }
      
      addDoc(collection(firestore, 'audit_logs'), {
        action: 'CLIENT_INFO_UPDATE',
        userId: user.uid,
        details: `Updated name to ${displayName} and phone to ${phone}`,
        timestamp: Date.now(),
        severity: 'INFO'
      }).catch(err => console.error("[AUDIT LOG FAILURE]", err));

      toast({ title: "Account Updated", description: "Your records have been synchronized." });
    } catch (err) {
      console.error("[PROFILE INFO SYNC ERROR]", err);
      toast({ variant: "destructive", title: "Account Not Updated", description: "Your changes could not be saved. Please check your connection and try again." });
    } finally {
      setIsUpdatingInfo(false);
    }
  };

  if (authLoading || (user && (profileHookLoading || ordersLoading || fleetLoading))) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center space-y-6">
        <div className="animate-pulse">
          <img src="/assets/logo.png" className="h-16 w-auto opacity-30" alt="Urban Express" />
        </div>
        <p className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-300">Synchronizing Identity...</p>
      </div>
    );
  }

  if (!user) return null;

  const canAccessAdmin = isSuperAdmin || role === 'ADMIN';
  const canAccessStaffWorkspace = isEmployee || isSuperAdmin;
  const initials = (profile?.displayName || user.displayName || user.email || 'U')
    .split(/[\\s@._-]+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase();

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 pb-10 sm:px-6 sm:py-9 lg:px-8">
      <div className="mb-7 flex flex-col gap-2 sm:mb-9">
        <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-primary">Customer account</p>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-950 sm:text-3xl">Your profile</h1>
        <p className="max-w-2xl text-sm leading-6 text-zinc-500">Manage your personal details, rewards, vehicles and account access in one place.</p>
      </div>

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12 lg:gap-8">
        <div className="space-y-6 lg:col-span-4">
          <section className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
            <div className="h-2 bg-primary" />
            <div className="p-5 text-center sm:p-7">
              <div className="relative mx-auto mb-4 h-28 w-28">
                <div className="h-28 w-28 overflow-hidden rounded-full border-4 border-white bg-zinc-100 shadow-md ring-1 ring-zinc-200">
                  {profile?.photoURL || user.photoURL ? (
                    <img src={profile?.photoURL || user.photoURL || ''} className="h-full w-full object-cover" alt="Your profile avatar" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-orange-50 text-3xl font-semibold text-primary">{initials}</div>
                  )}
                </div>
                <div className="absolute bottom-0 right-0 flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border-2 border-white bg-zinc-900 text-white shadow-md">
                  <Camera className="h-4 w-4" />
                  <ImageUpload onUploadComplete={handlePhotoUpdate} className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0" category="profile" />
                </div>
                {isUpdatingPhoto && <div className="absolute inset-0 flex items-center justify-center rounded-full bg-white/80"><RefreshCcw className="h-6 w-6 animate-spin text-primary" /></div>}
              </div>
              <h2 className="text-xl font-semibold tracking-tight text-zinc-950">{profile?.displayName || user.displayName || 'Urban Member'}</h2>
              <p className="mt-1 break-all text-xs text-zinc-500">{user.email}</p>
              <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                <Badge className="rounded-full border-0 bg-orange-50 px-3 py-1 text-[10px] font-semibold text-orange-700 hover:bg-orange-50">{role || 'CUSTOMER'}</Badge>
                <Badge variant="outline" className="rounded-full border-zinc-200 px-3 py-1 text-[10px] font-medium text-zinc-600">{stats.points.toLocaleString()} points</Badge>
              </div>
              <p className="mt-4 text-[11px] text-zinc-400">Tap the camera to update your profile photo.</p>
            </div>
            <div className="grid grid-cols-2 border-t border-zinc-100">
              <div className="p-4 text-center">
                <p className="text-xl font-semibold tabular-nums text-zinc-900">{stats.totalOrders}</p>
                <p className="mt-1 text-[9px] font-semibold uppercase tracking-widest text-zinc-400">Paid orders</p>
              </div>
              <div className="border-l border-zinc-100 p-4 text-center">
                <p className="text-xl font-semibold tabular-nums text-zinc-900">{fleet?.length || 0}</p>
                <p className="mt-1 text-[9px] font-semibold uppercase tracking-widest text-zinc-400">Vehicles</p>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="mb-5 flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-50 text-primary"><User className="h-4 w-4" /></div>
              <div>
                <h3 className="text-sm font-semibold text-zinc-900">Personal details</h3>
                <p className="text-xs text-zinc-500">Keep your contact information current.</p>
              </div>
            </div>
            <form onSubmit={handleInfoUpdate} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="profile-display-name" className="text-xs font-medium text-zinc-600">Full name</Label>
                <Input id="profile-display-name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="h-11 rounded-lg border-zinc-200 bg-white" autoComplete="name" required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="profile-phone" className="text-xs font-medium text-zinc-600">Phone number</Label>
                <Input id="profile-phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="07xx xxx xxx" className="h-11 rounded-lg border-zinc-200 bg-white" autoComplete="tel" required />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-zinc-600">Email address</Label>
                <div className="flex h-11 items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-500"><Mail className="h-4 w-4 shrink-0" /><span className="truncate">{user.email}</span></div>
              </div>
              <Button type="submit" disabled={isUpdatingInfo} className="h-11 w-full rounded-lg bg-zinc-900 text-xs font-semibold text-white hover:bg-zinc-800">
                {isUpdatingInfo ? <RefreshCcw className="mr-2 h-4 w-4 animate-spin" /> : null}Save details
              </Button>
            </form>
          </section>


        </div>

        <div className="space-y-6 lg:col-span-8">
          <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-50 text-primary"><MapPin className="h-4 w-4" /></div>
              <div><h2 className="text-sm font-semibold text-zinc-900">Home delivery address</h2><p className="text-xs text-zinc-500">Save your usual destination and pin the exact location.</p></div>
            </div>
            <form onSubmit={handleHomeAddressSave} className="space-y-4">
              <div className="space-y-1.5"><Label htmlFor="home-address" className="text-xs font-medium text-zinc-600">House, building, street or area</Label><Input id="home-address" value={homeAddress} onChange={e => setHomeAddress(e.target.value)} placeholder="e.g. Milimani, Nakuru — near..." className="h-11 rounded-lg border-zinc-200" required /></div>
              <LocationPicker initialLat={homeLocation?.latitude} initialLng={homeLocation?.longitude} onLocationSelect={(latitude, longitude, address) => { setHomeLocation({ latitude, longitude }); if (address && !address.startsWith('Pinned:') && !address.startsWith('Custom Point:')) setHomeAddress(address); }} />
              {homeLocation && <p className="text-[11px] text-zinc-500">Pinned coordinates: {homeLocation.latitude.toFixed(5)}, {homeLocation.longitude.toFixed(5)}</p>}
              <Button type="submit" disabled={isSavingAddress} className="h-11 w-full rounded-lg bg-zinc-900 text-xs font-semibold text-white">{isSavingAddress ? <RefreshCcw className="mr-2 h-4 w-4 animate-spin" /> : null}Save home address</Button>
            </form>
          </section>
          <section className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
            <div className="flex flex-col gap-5 p-5 sm:p-7 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-primary">Urban rewards</p>
                <h2 className="mt-1 text-xl font-semibold tracking-tight text-zinc-950 sm:text-2xl">Your loyalty balance</h2>
                <p className="mt-1 text-xs text-zinc-500">Earn one point for every KES 10 spent on eligible paid orders.</p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-orange-50 text-primary"><Award className="h-6 w-6" /></div>
            </div>
            <div className="grid grid-cols-1 border-t border-zinc-100 sm:grid-cols-3">
              <div className="p-5 sm:p-6">
                <p className="text-3xl font-semibold tracking-tight tabular-nums text-zinc-950">{stats.points.toLocaleString()}</p>
                <p className="mt-1 text-[10px] font-semibold uppercase tracking-widest text-zinc-400">Available points</p>
              </div>
              <div className="border-t border-zinc-100 p-5 sm:border-l sm:border-t-0 sm:p-6">
                <p className="text-2xl font-semibold tracking-tight tabular-nums text-zinc-900">KES {stats.points.toLocaleString()}</p>
                <p className="mt-1 text-[10px] font-semibold uppercase tracking-widest text-zinc-400">Redeemable value</p>
              </div>
              <div className="border-t border-zinc-100 p-5 sm:border-l sm:border-t-0 sm:p-6">
                <p className="text-2xl font-semibold tracking-tight tabular-nums text-zinc-900">KES {stats.totalSpent.toLocaleString()}</p>
                <p className="mt-1 text-[10px] font-semibold uppercase tracking-widest text-zinc-400">Lifetime spend</p>
              </div>
            </div>
            <div className="flex items-center justify-between border-t border-zinc-100 bg-zinc-50/70 px-5 py-3 sm:px-6">
              <span className="text-[11px] text-zinc-500">Your account tier</span>
              <Badge className="rounded-full border-0 bg-orange-100 text-orange-800 hover:bg-orange-100">{stats.points > 1000 ? 'Platinum' : stats.points > 500 ? 'Gold' : 'Silver'} member</Badge>
            </div>
          </section>

          <section id="fleet" className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-7">
            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-50 text-primary"><Car className="h-5 w-5" /></div>
                <div>
                  <h2 className="text-base font-semibold text-zinc-900">My vehicles</h2>
                  <p className="text-xs text-zinc-500">Service history and vehicle reward points.</p>
                </div>
              </div>
              <Button asChild variant="outline" className="h-10 rounded-lg border-zinc-200 text-xs font-semibold"><Link href="/client/carwash">Book a carwash</Link></Button>
            </div>
            {fleet && fleet.length > 0 ? (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {fleet.map((vehicle: any) => (
                  <div key={vehicle.id} className="rounded-xl border border-zinc-200 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-zinc-600"><Car className="h-5 w-5" /></div>
                        <div className="min-w-0">
                          <h3 className="truncate font-mono text-lg font-semibold text-zinc-900">{vehicle.plateNumber}</h3>
                          <p className="text-[10px] text-zinc-500">{vehicle.lastServiceType || 'Vehicle registered'}</p>
                        </div>
                      </div>
                      <Badge variant="outline" className="shrink-0 rounded-full text-[10px]">{vehicle.totalServices || 1} visits</Badge>
                    </div>
                    <div className="mt-4 flex items-center justify-between border-t border-zinc-100 pt-3">
                      <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-400">Vehicle points</span>
                      <span className="text-sm font-semibold tabular-nums text-primary">{Math.floor((Number(vehicle.totalLoyaltySpend || 0) + (orders || []).filter((order: Order) => order.status === 'PAID' && Number(order.timestamp || 0) > Number(profile?.loyaltyReconciledAt || 0) && String(order.plateNumber || '').toUpperCase().replace(/[^A-Z0-9]/g, '') === String(vehicle.plateNumber || '').toUpperCase().replace(/[^A-Z0-9]/g, '')).reduce((sum, order) => sum + Number(order.total || 0), 0)) / 10).toLocaleString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50 px-5 py-10 text-center">
                <Car className="mx-auto h-9 w-9 text-zinc-300" />
                <h3 className="mt-3 text-sm font-semibold text-zinc-800">No vehicles linked yet</h3>
                <p className="mx-auto mt-1 max-w-sm text-xs leading-5 text-zinc-500">Vehicles are linked to your account when they are registered during a service visit.</p>
                <Button asChild variant="outline" className="mt-4 h-10 rounded-lg text-xs font-semibold"><Link href="/client/carwash">Schedule your first wash</Link></Button>
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-zinc-100 text-zinc-600"><History className="h-4 w-4" /></div>
              <div>
                <h2 className="text-sm font-semibold text-zinc-900">Order history</h2>
                <p className="text-xs text-zinc-500">Review purchases and service transactions.</p>
              </div>
            </div>
            <ProfileActionLink icon={Package} label="View all orders" href="/client/orders" />
          </section>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 items-start gap-6 lg:grid-cols-2 lg:gap-8">
        <section className="h-full rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-6">
          <h3 className="mb-3 text-sm font-semibold text-zinc-900">Account shortcuts</h3>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <ProfileActionLink icon={History} label="My Orders" href="/client/orders" />
            <ProfileActionLink icon={Settings} label="Settings" href="/settings" />
            {canAccessStaffWorkspace && <ProfileActionLink icon={LayoutDashboard} label="Staff Workspace" href="/dashboard" />}
            {canAccessAdmin && <ProfileActionLink icon={Shield} label="Admin Console" href="/admin" />}
          </div>
          {(canAccessStaffWorkspace || canAccessAdmin) && (
            <p className="mt-3 text-[11px] leading-5 text-zinc-400">Work portals are shown according to the access assigned to your account.</p>
          )}
        </section>
        <div className="min-w-0"><AccountSecurity /></div>
        {role === 'CLIENT' && (
          <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-6 lg:col-span-2">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-primary"><Mail className="h-4 w-4" /></div>
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-semibold text-zinc-900">Email offers and updates</h3>
                <p className="mt-1 text-xs leading-5 text-zinc-500">Choose whether Urban Auto Express may email you occasional offers, service updates and news. Essential account and payment emails are unaffected.</p>
                <div className="mt-4 flex items-start gap-3">
                  <Checkbox id="client-marketing-opt-in" checked={marketingOptIn} disabled={isSavingMarketing} onCheckedChange={checked => void handleMarketingPreferenceChange(checked === true)} />
                  <label htmlFor="client-marketing-opt-in" className="cursor-pointer text-xs leading-5 text-zinc-700">I agree to receive promotional emails from Urban Auto Express. I can change this preference at any time.</label>
                </div>
                {isSavingMarketing && <p className="mt-2 text-[11px] text-zinc-400">Saving preference…</p>}
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function ProfileActionLink({ icon: Icon, label, href }: { icon: any; label: string; href: string }) {
  return (
    <Link href={href} className="group flex min-h-12 items-center justify-between rounded-xl border border-zinc-200 bg-white px-3 py-2.5 transition-colors hover:border-orange-200 hover:bg-orange-50/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2">
      <span className="flex items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-50 text-zinc-500 transition-colors group-hover:bg-orange-100 group-hover:text-primary"><Icon className="h-4 w-4" /></span>
        <span className="text-xs font-semibold text-zinc-700">{label}</span>
      </span>
      <ChevronRight className="h-4 w-4 text-zinc-300 transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
    </Link>
  );
}