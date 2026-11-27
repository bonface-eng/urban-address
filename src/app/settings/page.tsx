'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { 
  LogOut,
  UserCircle,
  Printer,
  ShieldCheck,
  RefreshCcw,
  Activity,
  Camera,
  Phone,
  Usb,
  Cpu,
  Zap,
  Check,
  Globe,
  Monitor,
  Maximize2,
  Smartphone,
  User,
  CreditCard,
  Settings2,
  ChevronRight,
  ShieldAlert,
  Snowflake
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Switch } from '@/components/ui/switch';
import { useAuth, useUser, useFirestore, useDoc } from '@/firebase';
import { signOut, updateProfile } from 'firebase/auth';
import { doc, updateDoc, addDoc, collection, setDoc } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import { useProfile } from '@/hooks/use-profile';
import { cn } from '@/lib/utils';
import { HardwareService } from '@/lib/hardware-service';
import { toast } from '@/hooks/use-toast';
import { ImageUpload } from '@/components/shared/image-upload';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ReceiptSettingsDialog } from '@/components/admin/receipt-settings-dialog';

export default function SettingsPage() {
  const { user } = useUser();
  const auth = useAuth();
  const firestore = useFirestore();
  const router = useRouter();
  const { role, profile, loading: profileHookLoading, isSuperAdmin, isEmployee } = useProfile();
  
  // Restricted doc: system/config requires auth. Gate with user to avoid Permission Error.
  const configRef = useMemo(() => {
    if (!firestore || !user) return null;
    return doc(firestore, 'system', 'config');
  }, [firestore, user]);
  
  const { data: remoteConfig } = useDoc<any>(configRef);

  // Hardware States
  const [printMode, setPrintMode] = useState<'QZ' | 'SERIAL' | 'PROXY' | 'NETWORK'>(HardwareService.getMode());
  const [paperWidth, setPaperWidth] = useState<'80mm' | '58mm'>(HardwareService.getPaperWidth());
  const [proxyUrl, setProxyUrl] = useState(HardwareService.getProxyUrl());
  const [availablePrinters, setAvailablePrinters] = useState<string[]>([]);
  const [selectedPrinter, setSelectedPrinter] = useState<string | null>(HardwareService.getConfiguredPrinter());
  const [isScanning, setIsScanning] = useState(false);
  const [isTestingHardware, setIsTestingHardware] = useState(false);
  
  // Profile States
  const [displayName, setDisplayName] = useState('');
  const [mpesaNumber, setMpesaNumber] = useState('');
  const [isUpdatingInfo, setIsUpdatingInfo] = useState(false);
  const [isReceiptSettingsOpen, setIsReceiptSettingsOpen] = useState(false);

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.displayName || '');
      setMpesaNumber(profile.mpesaNumber || '');
    }
  }, [profile]);

  const handlePhotoUpdate = async (url: string) => {
    if (!user || !firestore || !url) return;
    try {
      await updateProfile(user, { photoURL: url });
      await updateDoc(doc(firestore, 'users', user.uid), { photoURL: url });
      
      await addDoc(collection(firestore, 'audit_logs'), {
        action: 'PROFILE_PHOTO_UPDATE',
        userId: user.uid,
        details: 'Operator updated their profile picture in system settings.',
        timestamp: Date.now(),
        severity: 'INFO'
      });

      toast({ title: "Identity Synchronized", description: "Profile photo updated across all nodes." });
    } catch (err) {
      toast({ variant: "destructive", title: "Update Failed" });
    }
  };

  const handleInfoUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !firestore) return;
    setIsUpdatingInfo(true);
    try {
      await updateDoc(doc(firestore, 'users', user.uid), { 
        displayName, 
        mpesaNumber 
      });

      if (displayName !== user.displayName) {
        await updateProfile(user, { displayName });
      }

      await addDoc(collection(firestore, 'audit_logs'), {
        action: 'PROFILE_INFO_UPDATE',
        userId: user.uid,
        details: `Updated name and payment node (M-Pesa: ${mpesaNumber})`,
        timestamp: Date.now(),
        severity: 'INFO'
      });

      toast({ title: "Account Updated", description: "Payment node and identity records synchronized." });
    } catch (err) {
      toast({ variant: "destructive", title: "Update Refused" });
    } finally {
      setIsUpdatingInfo(false);
    }
  };

  const handleModeChange = (mode: 'QZ' | 'SERIAL' | 'PROXY' | 'NETWORK') => {
    HardwareService.setMode(mode);
    setPrintMode(mode);
    toast({ title: "Hardware Mode Updated", description: `Terminal now using ${mode}` });
  };

  const handleWidthChange = (width: '80mm' | '58mm') => {
    HardwareService.setPaperWidth(width);
    setPaperWidth(width);
  };

  const handleHardwareTest = async () => {
    if (!firestore || !profile) return;
    setIsTestingHardware(true);
    const printRes = await HardwareService.printReceipt({
      id: 'TEST-NODE',
      timestamp: Date.now(),
      total: 0,
      type: 'LOUNGE',
      paymentMethod: 'HW-TEST',
      items: [{ name: 'Thermal Pulse & Alignment', quantity: 1, price: 0 }]
    });
    setIsTestingHardware(false);
    if (printRes.success) toast({ title: "Handshake Successful" });
    else toast({ variant: "destructive", title: "Handshake Failed", description: printRes.error });
  };

  const handleLogout = async () => {
    if (auth) await signOut(auth);
    router.replace('/login');
  };

  if (profileHookLoading) return null;

  return (
    <div className="space-y-8 pb-32 max-w-[1400px] mx-auto pt-4 px-2">
      {/* 1. PROFILE IDENTITY HERO */}
      <section className="relative overflow-hidden bg-white border border-zinc-100 rounded-[2.5rem] shadow-mobile">
        <div className="absolute top-0 left-0 w-full h-32 bg-zinc-50 border-b border-zinc-100" />
        <div className="relative p-10 pt-16 flex flex-col md:flex-row items-center md:items-end gap-10">
          <div className="relative group">
            <div className="w-32 h-32 rounded-[2.5rem] bg-white border-4 border-white shadow-2xl overflow-hidden flex items-center justify-center">
               <Avatar className="h-full w-full rounded-none">
                  <AvatarImage src={profile?.photoURL || undefined} className="object-cover" />
                  <AvatarFallback className="bg-primary/5 text-primary text-2xl font-black">{profile?.displayName?.[0]}</AvatarFallback>
               </Avatar>
               <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer">
                  <ImageUpload 
                    onUploadComplete={handlePhotoUpdate}
                    className="absolute inset-0 opacity-0 z-10 cursor-pointer"
                    category="profile"
                  />
                  <Camera className="w-8 h-8 text-white" />
               </div>
            </div>
          </div>
          <div className="flex-1 text-center md:text-left space-y-2">
            <div className="flex flex-col md:flex-row md:items-center gap-3">
              <h2 className="text-3xl font-black uppercase text-zinc-900 tracking-tighter leading-none">{profile?.displayName}</h2>
              <Badge className="bg-primary/5 text-primary border-none text-[8px] font-black uppercase tracking-widest px-4 py-1.5 shadow-sm rounded-full w-fit mx-auto md:mx-0">
                {role} SECURITY CLEARANCE
              </Badge>
            </div>
            <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-[0.3em]">{user?.email}</p>
          </div>
          <Button variant="outline" onClick={handleLogout} className="h-12 px-8 rounded-xl border-zinc-100 text-red-500 font-black uppercase text-[10px] tracking-widest bg-white shadow-sm hover:bg-red-50 transition-all">
            <LogOut className="w-4 h-4 mr-2" /> Disconnect Node
          </Button>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* 2. PERSONAL ACCOUNT SETTINGS (Always Visible to Staff) */}
        <div className={cn("space-y-6", isSuperAdmin || role === 'MANAGER' ? "lg:col-span-6" : "lg:col-span-12")}>
          <div className="flex items-center gap-2 px-2">
             <UserCircle className="w-4 h-4 text-primary" />
             <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-400">Account Identity</h3>
          </div>
          <Card className="rounded-[2.5rem] border-none shadow-mobile bg-white p-10 border border-zinc-100">
             <form onSubmit={handleInfoUpdate} className="space-y-6">
                <div className="space-y-1.5">
                   <Label className="text-[9px] font-black uppercase text-zinc-400 px-1 tracking-widest">Full Display Name</Label>
                   <div className="relative">
                      <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-300" />
                      <Input value={displayName} onChange={e => setDisplayName(e.target.value)} className="h-14 bg-zinc-50 border-none rounded-2xl pl-12 font-bold" required />
                   </div>
                </div>

                <div className="space-y-1.5">
                   <Label className="text-[9px] font-black uppercase text-zinc-400 px-1 tracking-widest">M-Pesa Payout Number</Label>
                   <div className="relative">
                      <Smartphone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-300" />
                      <Input value={mpesaNumber} onChange={e => setMpesaNumber(e.target.value)} placeholder="07xx xxx xxx" className="h-14 bg-zinc-50 border-none rounded-2xl pl-12 font-mono font-bold" required />
                   </div>
                   <p className="text-[8px] font-bold text-zinc-300 uppercase tracking-widest px-1 mt-1">This number is used for automated commission & salary disbursements.</p>
                </div>

                <Button type="submit" disabled={isUpdatingInfo} className="w-full h-16 bg-zinc-900 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl active:scale-95 transition-all gap-3">
                   {isUpdatingInfo ? <RefreshCcw className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4 text-primary" />}
                   Synchronize Profile
                </Button>
             </form>
          </Card>
        </div>

        {/* 3. HARDWARE & STATION CONFIG (Gated for Admins/Managers) */}
        {(isSuperAdmin || role === 'MANAGER') && (
          <div className="lg:col-span-6 space-y-6">
            <div className="flex items-center gap-2 px-2">
               <Printer className="w-4 h-4 text-primary" />
               <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-400">Terminal Peripherals</h3>
            </div>
            <Card className="rounded-[2.5rem] border-none shadow-mobile bg-white p-10 space-y-8 border border-zinc-100">
               <div className="space-y-4">
                  <Label className="text-[9px] font-black uppercase text-zinc-400 px-1 tracking-widest">Hardware Bridge Mode</Label>
                  <RadioGroup value={printMode} onValueChange={(v: any) => handleModeChange(v)} className="grid grid-cols-2 gap-3">
                      <ModeOption id="SERIAL" label="Serial" sub="USB Direct" icon={Usb} active={printMode === 'SERIAL'} />
                      <ModeOption id="PROXY" label="Proxy" sub="Local Bridge" icon={Monitor} active={printMode === 'PROXY'} />
                      <ModeOption id="QZ" label="QZ Tray" sub="Signed Hub" icon={ShieldCheck} active={printMode === 'QZ'} />
                      <ModeOption id="NETWORK" label="Network" sub="IP Protocol" icon={Globe} active={printMode === 'NETWORK'} />
                  </RadioGroup>
               </div>

               <div className="space-y-4">
                  <Label className="text-[9px] font-black uppercase text-zinc-400 px-1 tracking-widest">Paper Width Standard</Label>
                  <RadioGroup value={paperWidth} onValueChange={(v: any) => handleWidthChange(v)} className="grid grid-cols-2 gap-3">
                      <ModeOption id="80mm" label="80mm" sub="Standard" icon={Maximize2} active={paperWidth === '80mm'} />
                      <ModeOption id="58mm" label="58mm" sub="Compact" icon={Printer} active={paperWidth === '58mm'} />
                  </RadioGroup>
               </div>

               <div className="p-6 bg-zinc-50 rounded-[1.5rem] border border-zinc-100 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                     <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center text-primary shadow-sm">
                        <Activity className="w-5 h-5" />
                     </div>
                     <div>
                        <p className="text-[10px] font-black uppercase text-zinc-900 tracking-tighter leading-none">Diagnostic Pulse</p>
                        <p className="text-[8px] font-bold text-zinc-400 uppercase tracking-widest mt-1">Test thermal cut & feed</p>
                     </div>
                  </div>
                  <Button 
                    onClick={handleHardwareTest} 
                    disabled={isTestingHardware}
                    variant="outline"
                    className="h-10 px-5 rounded-lg font-black uppercase text-[9px] tracking-widest border-zinc-200 bg-white"
                  >
                    {isTestingHardware ? <RefreshCcw className="w-3 h-3 animate-spin" /> : 'Run Test'}
                  </Button>
               </div>

               {isSuperAdmin && (
                 <div className="p-6 bg-zinc-900 text-white rounded-[1.5rem] flex items-center justify-between mt-4 shadow-xl">
                    <div className="flex items-center gap-3">
                       <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-primary">
                          <Settings2 className="w-5 h-5" />
                       </div>
                       <div>
                          <p className="text-[10px] font-black uppercase tracking-tighter leading-none text-white">Receipt Header & Branding</p>
                          <p className="text-[8px] font-bold text-zinc-400 uppercase tracking-widest mt-1">Global branding nodes</p>
                       </div>
                    </div>
                    <Button 
                      onClick={() => setIsReceiptSettingsOpen(true)}
                      className="h-10 px-5 rounded-lg font-black uppercase text-[9px] tracking-widest bg-primary hover:bg-orange-600 text-white shadow-md"
                    >
                      Edit Data
                    </Button>
                 </div>
               )}
            </Card>
          </div>
        )}
      </div>

      <ReceiptSettingsDialog open={isReceiptSettingsOpen} onOpenChange={setIsReceiptSettingsOpen} />
    </div>
  );
}

function ModeOption({ id, label, sub, icon: Icon, active }: any) {
  return (
    <Label 
      htmlFor={id} 
      className={cn(
        "flex items-center gap-3 p-4 rounded-2xl border-2 transition-all cursor-pointer group",
        active ? "border-primary bg-primary/5 shadow-sm" : "border-zinc-50 bg-zinc-50/30 hover:bg-zinc-50"
      )}
    >
      <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center transition-all", active ? "bg-white text-primary shadow-sm" : "bg-white text-zinc-300")}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-black uppercase text-zinc-900 truncate">{label}</p>
        <p className="text-[8px] font-bold text-zinc-400 uppercase truncate">{sub}</p>
      </div>
      <RadioGroupItem value={id} id={id} className="sr-only" />
    </Label>
  );
}
