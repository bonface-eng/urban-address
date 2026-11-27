'use client';

import React, { useMemo, useState, useEffect } from 'react';
import { 
  History, 
  ChevronRight, 
  Settings, 
  Car, 
  Package, 
  Award,
  Camera,
  User,
  ShieldCheck,
  RefreshCcw,
  Phone,
  Mail,
  MapPin,
  TrendingUp,
  CreditCard
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useUser, useFirestore, useCollection, useMemoFirebase, errorEmitter, FirestorePermissionError } from '@/firebase';
import { collection, query, where, orderBy, doc, updateDoc, addDoc } from 'firebase/firestore';
import { updateProfile } from 'firebase/auth';
import { Order } from '@/lib/types';
import Link from 'next/link';
import { useProfile } from '@/hooks/use-profile';
import { cn } from '@/lib/utils';
import { ImageUpload } from '@/components/shared/image-upload';
import { toast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';

export default function ClientProfilePage() {
  const { user, loading: authLoading } = useUser();
  const { profile, loading: profileHookLoading } = useProfile();
  const firestore = useFirestore();
  const router = useRouter();
  
  const [isUpdatingPhoto, setIsUpdatingPhoto] = useState(false);
  const [isUpdatingInfo, setIsUpdatingInfo] = useState(false);
  const [phone, setPhone] = useState('');
  const [displayName, setDisplayName] = useState('');

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
    }
  }, [profile]);

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
    const totalSpent = paidOrders.reduce((sum, o) => sum + (o.total || 0), 0);
    const points = Math.floor(totalSpent * 0.1);
    return { points, totalSpent, totalOrders: paidOrders.length };
  }, [orders]);

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

  return (
    <div className="max-w-7xl mx-auto px-6 py-12">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
        
        {/* Left Column: Account Identity */}
        <div className="lg:col-span-4 space-y-8">
          <div className="flex flex-col items-center text-center p-8 bg-zinc-50 rounded-[2rem] border border-zinc-100 shadow-inner">
             <div className="relative group w-32 h-32 mb-6">
                <div className="w-full h-full rounded-3xl bg-white shadow-xl overflow-hidden border border-zinc-100 p-1">
                   {profile?.photoURL ? (
                     <img src={profile.photoURL} className="w-full h-full object-cover rounded-2xl" alt="Profile" />
                   ) : (
                     <div className="w-full h-full flex items-center justify-center bg-primary/5 text-primary">
                        <User className="w-12 h-12" />
                     </div>
                   )}
                </div>
                <div className="absolute inset-1 rounded-2xl bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center cursor-pointer">
                   <ImageUpload 
                     onUploadComplete={handlePhotoUpdate}
                     className="w-full h-full absolute inset-0 opacity-0 z-10"
                     category="profile"
                   />
                   <Camera className="w-8 h-8 text-white" />
                </div>
                {isUpdatingPhoto && (
                  <div className="absolute inset-0 bg-white/80 rounded-3xl flex items-center justify-center z-20">
                    <RefreshCcw className="w-6 h-6 text-primary animate-spin" />
                  </div>
                )}
             </div>

             <h2 className="text-2xl font-black uppercase text-zinc-900 tracking-tighter leading-none">{profile?.displayName || 'Urban Member'}</h2>
             <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mt-2">{user?.email}</p>
             
             <div className="flex gap-2 mt-6">
                <Badge className="bg-primary text-white border-none text-[8px] font-black uppercase tracking-widest px-4 py-1.5 rounded-full shadow-lg shadow-primary/20">
                   {stats.points > 1000 ? 'Platinum Tier' : stats.points > 500 ? 'Gold Tier' : 'Silver Tier'}
                </Badge>
             </div>
          </div>

          <form onSubmit={handleInfoUpdate} className="p-8 bg-white border border-zinc-100 rounded-[2rem] shadow-sm space-y-6">
             <div className="flex items-center gap-2 mb-2">
                <ShieldCheck className="w-4 h-4 text-primary" />
                <h3 className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Verified Details</h3>
             </div>
             <div className="space-y-4">
               <div className="space-y-1.5">
                  <Label className="text-[9px] font-black uppercase text-zinc-400 px-1">Display Name</Label>
                  <Input value={displayName} onChange={e => setDisplayName(e.target.value)} className="h-12 bg-zinc-50 border-none rounded-xl font-bold" required />
               </div>
               <div className="space-y-1.5">
                  <Label className="text-[9px] font-black uppercase text-zinc-400 px-1">Phone Contact</Label>
                  <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="07xx xxx xxx" className="h-12 bg-zinc-50 border-none rounded-xl font-mono font-bold" required />
               </div>
             </div>
             <Button type="submit" disabled={isUpdatingInfo} className="w-full h-14 bg-zinc-900 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl active:scale-95 transition-all">
               {isUpdatingInfo ? <RefreshCcw className="w-4 h-4 animate-spin mr-2" /> : null}
               Save Account Changes
             </Button>
          </form>

          <div className="space-y-3">
             <h3 className="text-[10px] font-black text-zinc-400 uppercase tracking-widest px-2">Portal Navigation</h3>
             <ProfileActionLink icon={History} label="Order History" href="/client/orders" />
             <ProfileActionLink icon={Settings} label="Global Settings" href="/settings" />
          </div>
        </div>

        {/* Right Column: Loyalty & Fleet */}
        <div className="lg:col-span-8 space-y-12">
           <Card className="border border-zinc-100 shadow-2xl rounded-[2.5rem] bg-white overflow-hidden relative">
              <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full translate-x-1/2 -translate-y-1/2 blur-3xl" />
              <CardContent className="p-10 space-y-10 relative z-10">
                 <div className="flex items-center justify-between">
                    <div className="space-y-1">
                       <p className="text-[10px] font-black text-primary uppercase tracking-[0.4em]">Community Rewards</p>
                       <h3 className="text-5xl font-black font-headline uppercase tracking-tighter text-zinc-900">Loyalty Hub.</h3>
                    </div>
                    <div className="w-16 h-16 rounded-[2rem] bg-primary/5 flex items-center justify-center text-primary">
                       <Award className="w-10 h-10" />
                    </div>
                 </div>

                 <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                    <div className="space-y-1 p-6 bg-zinc-50 rounded-3xl border border-zinc-100">
                       <p className="text-6xl font-black tracking-tighter text-zinc-900 leading-none">{stats.points.toLocaleString()}</p>
                       <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest pt-2">Active Reward Points</p>
                    </div>
                    <div className="flex flex-col justify-end text-right md:text-left space-y-4">
                       <div className="space-y-1">
                          <p className="text-3xl font-black tracking-tighter text-zinc-400 leading-none">KES {(stats.points * 1).toLocaleString()}</p>
                          <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Redeemable Balance</p>
                       </div>
                       <div className="space-y-1">
                          <p className="text-3xl font-black tracking-tighter text-primary leading-none">KES {stats.totalSpent.toLocaleString()}</p>
                          <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Lifetime Volume</p>
                       </div>
                    </div>
                 </div>
              </CardContent>
           </Card>

           <div id="fleet" className="space-y-8">
              <div className="flex items-center justify-between px-2">
                 <div className="flex items-center gap-3">
                    <Car className="w-5 h-5 text-primary" />
                    <h3 className="text-sm font-black uppercase text-zinc-900 tracking-widest">Your Private Fleet</h3>
                 </div>
                 <Button asChild variant="outline" className="h-10 rounded-xl border-zinc-200 text-[10px] font-black uppercase tracking-widest">
                    <Link href="/client/carwash">Schedule Service</Link>
                 </Button>
              </div>

              {fleet && fleet.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                   {fleet.map((vehicle: any) => (
                     <div key={vehicle.id} className="p-8 bg-white border border-zinc-100 rounded-[2rem] shadow-sm hover:shadow-xl transition-all group relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-zinc-50 rounded-full translate-x-1/2 -translate-y-1/2 group-hover:bg-primary/5 transition-colors" />
                        <div className="flex items-center justify-between mb-6">
                           <div className="w-12 h-12 rounded-2xl bg-zinc-50 flex items-center justify-center text-zinc-400 group-hover:bg-primary group-hover:text-white transition-all shadow-inner">
                              <Car className="w-6 h-6" />
                           </div>
                           <Badge className="bg-zinc-900 text-white border-none uppercase font-black text-[8px] px-3 py-1 shadow-md">
                             {vehicle.totalServices || 1} Visits
                           </Badge>
                        </div>
                        <h4 className="text-4xl font-black font-mono tracking-tighter uppercase text-zinc-900 mb-2">{vehicle.plateNumber}</h4>
                        <div className="flex items-center gap-3">
                           <div className="w-3 h-3 rounded-full border border-zinc-200" style={{ backgroundColor: vehicle.vehicleColor || '#FFF' }} />
                           <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Last Service: {vehicle.lastServiceType || 'First Visit'}</p>
                        </div>
                     </div>
                   ))}
                </div>
              ) : (
                <div className="p-20 text-center bg-zinc-50 rounded-[3rem] border-2 border-dashed border-zinc-200 space-y-6">
                   <Car className="w-16 h-16 text-zinc-200 mx-auto" />
                   <div className="space-y-1">
                      <p className="text-[11px] font-black uppercase tracking-widest text-zinc-400 leading-relaxed px-12">No vehicles registered. Vehicles are automatically linked to your identity upon service completion.</p>
                   </div>
                   <Button asChild variant="outline" className="rounded-xl border-zinc-200 uppercase font-black text-[9px] tracking-widest px-8 h-12">
                      <Link href="/client/carwash">Schedule Your First Wash</Link>
                   </Button>
                </div>
              )}
           </div>
        </div>
      </div>
    </div>
  );
}

function ProfileActionLink({ icon: Icon, label, href }: { icon: any; label: string; href: string }) {
  return (
    <Link 
      href={href} 
      className="flex items-center justify-between p-5 bg-white border border-zinc-100 rounded-2xl hover:bg-zinc-50 hover:border-primary/20 transition-all group shadow-sm"
    >
       <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-zinc-50 flex items-center justify-center text-zinc-300 group-hover:bg-primary group-hover:text-white transition-all shadow-inner">
             <Icon className="w-5 h-5" />
          </div>
          <span className="text-xs font-black text-zinc-600 uppercase tracking-tight group-hover:text-zinc-900 transition-colors">{label}</span>
       </div>
       <ChevronRight className="w-5 h-5 text-zinc-200 group-hover:text-primary transition-all group-hover:translate-x-1" />
    </Link>
  );
}