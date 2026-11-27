'use client';

import { PageHeader } from '@/components/shared/page-layout';

import React, { useEffect, useState } from 'react';
import {
  Activity, Check, Globe, LogOut, MapPin, Monitor, Printer,
  RefreshCcw, ShieldCheck, Usb, UserCircle, Maximize2,
  Settings2, Send
} from 'lucide-react';
import { signOut, updateProfile } from '@/lib/db';
import { addDoc, collection, doc, updateDoc } from '@/lib/db';
import { useRouter } from 'next/navigation';
import { useAuth, useDb, useUser } from '@/lib/data';
import { useProfile } from '@/hooks/use-profile';
import { HardwareService } from '@/lib/hardware-service';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ReceiptSettingsDialog } from '@/components/admin/receipt-settings-dialog';

export default function ProfilePage() {
  const { user } = useUser();
  const auth = useAuth();
  const firestore = useDb();
  const router = useRouter();
  const { role, profile, loading: profileLoading, isSuperAdmin } = useProfile();

  const [displayName, setDisplayName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [address, setAddress] = useState('');
  const [mpesaNumber, setMpesaNumber] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [telegramUserId, setTelegramUserId] = useState('');
  const [telegramCode, setTelegramCode] = useState('');
  const [telegramStep, setTelegramStep] = useState<'ID' | 'CODE' | 'LINKED'>('ID');
  const [linkedTelegramId, setLinkedTelegramId] = useState('');
  const [telegramBusy, setTelegramBusy] = useState(false);
  const [receiptSettingsOpen, setReceiptSettingsOpen] = useState(false);

  const [printMode, setPrintMode] = useState<'SERIAL' | 'PROXY' | 'NETWORK'>(HardwareService.getMode());
  const [paperWidth, setPaperWidth] = useState<'80mm' | '58mm'>(HardwareService.getPaperWidth());
  const [isTestingHardware, setIsTestingHardware] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setDisplayName(profile.displayName || '');
    setPhoneNumber(profile.phoneNumber || '');
    setAddress(profile.address || '');
    setMpesaNumber(profile.mpesaNumber || '');
  }, [profile]);

  const handleProfileSave = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user || !firestore) return;
    if (displayName.trim().length < 2) {
      toast({ variant: 'destructive', title: 'Enter your full name' });
      return;
    }
    setIsSaving(true);
    try {
      const cleanName = displayName.trim();
      await updateDoc(doc(firestore, 'users', user.uid), {
        displayName: cleanName,
        phoneNumber: phoneNumber.trim(),
        address: address.trim(),
        mpesaNumber: mpesaNumber.trim(),
        updatedAt: Date.now(),
      });
      if (cleanName !== user.displayName) {
        await updateProfile(user, { displayName: cleanName });
      }
      await addDoc(collection(firestore, 'audit_logs'), {
        action: 'PROFILE_INFO_UPDATE',
        userId: user.uid,
        details: 'User updated their personal profile details.',
        timestamp: Date.now(),
        severity: 'INFO',
      });
      toast({ title: 'Profile saved', description: 'Your details have been updated.' });
    } catch (error) {
      console.error('[PROFILE_UPDATE_FAILED]', error);
      toast({ variant: 'destructive', title: 'Could not save profile', description: 'Check your connection and try again.' });
    } finally {
      setIsSaving(false);
    }
  };


  useEffect(() => {
    if (!user || !role || role === 'CLIENT') return;
    let cancelled = false;
    user.getIdToken().then(token => fetch('/api/telegram/link', { headers: { Authorization: `Bearer ${token}`, 'Cache-Control': 'no-store' } }))
      .then(response => response.json())
      .then(result => {
        if (cancelled) return;
        if (result.linked && result.telegramUserId) {
          setLinkedTelegramId(String(result.telegramUserId));
          setTelegramStep('LINKED');
        }
      })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, [user, role]);

  const requestTelegramLink = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user) return;
    setTelegramBusy(true);
    try {
      const token = await user.getIdToken();
      const response = await fetch('/api/telegram/link', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'request', telegramUserId: telegramUserId.trim() }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not send Telegram verification code.');
      setTelegramStep('CODE');
      toast({ title: 'Verification code sent', description: 'Check your Telegram messages and enter the six-digit code here.' });
    } catch (error) {
      toast({ variant: 'destructive', title: 'Telegram connection failed', description: error instanceof Error ? error.message : 'Please try again.' });
    } finally { setTelegramBusy(false); }
  };

  const confirmTelegramLink = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user) return;
    setTelegramBusy(true);
    try {
      const token = await user.getIdToken();
      const response = await fetch('/api/telegram/link', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'confirm', telegramUserId: telegramUserId.trim(), code: telegramCode.trim() }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not verify Telegram account.');
      setLinkedTelegramId(String(result.telegramUserId));
      setTelegramStep('LINKED');
      setTelegramCode('');
      toast({ title: 'Telegram connected', description: 'Your staff role and branch access have been applied automatically.' });
    } catch (error) {
      toast({ variant: 'destructive', title: 'Verification failed', description: error instanceof Error ? error.message : 'Check the code and try again.' });
    } finally { setTelegramBusy(false); }
  };

  const handlePrintModeChange = (mode: 'SERIAL' | 'PROXY' | 'NETWORK') => {
    HardwareService.setMode(mode);
    setPrintMode(mode);
    toast({ title: 'Printer connection updated', description: `Using ${mode.toLowerCase()} connection.` });
  };

  const handlePaperWidthChange = (width: '80mm' | '58mm') => {
    HardwareService.setPaperWidth(width);
    setPaperWidth(width);
    toast({ title: 'Receipt paper size updated', description: `Using ${width} paper.` });
  };

  const handleHardwareTest = async () => {
    if (!profile) return;
    setIsTestingHardware(true);
    try {
      const result = await HardwareService.printReceipt({
        id: 'TEST-NODE',
        timestamp: Date.now(),
        total: 0,
        type: 'LOUNGE',
        paymentMethod: 'HW-TEST',
        items: [{ name: 'Printer connection test', quantity: 1, price: 0 }],
      });
      if (result.success) toast({ title: 'Test receipt sent', description: 'The printer accepted the test job.' });
      else toast({ variant: 'destructive', title: 'Printer test failed', description: result.error || 'Check the selected printer and connection.' });
    } catch (error) {
      toast({ variant: 'destructive', title: 'Printer test failed', description: 'Check the printer connection and try again.' });
    } finally {
      setIsTestingHardware(false);
    }
  };

  const handleLogout = async () => {
    if (auth) await signOut(auth);
    router.replace('/login');
  };

  if (profileLoading) return null;

  const fullName = displayName || profile?.displayName || user?.displayName || 'Team member';

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 pb-28 pt-2">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Your account</p>
          <PageHeader title="Profile" breadcrumb={["Account", "Profile"]} className="mb-0" />
          <p className="mt-1 max-w-2xl text-sm text-zinc-500">Keep your contact details current so your team can identify and reach you.</p>
        </div>
        <Button type="button" variant="outline" onClick={handleLogout} className="h-10 w-full border-zinc-200 text-red-600 hover:bg-red-50 sm:w-auto">
          <LogOut className="mr-2 h-4 w-4" /> Sign out
        </Button>
      </div>

      <Card className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
        <div className="h-24 bg-gradient-to-r from-zinc-100 via-zinc-50 to-orange-50 sm:h-28" />
        <div className="-mt-12 flex flex-col gap-4 px-5 pb-5 sm:-mt-14 sm:flex-row sm:items-end sm:px-7">
          <div className="relative h-24 w-24 shrink-0 rounded-2xl border-4 border-white bg-white shadow-md sm:h-28 sm:w-28">
            <Avatar className="h-full w-full rounded-xl">
              <AvatarImage src={profile?.photoURL || user?.photoURL || undefined} alt={fullName} className="object-cover" />
              <AvatarFallback className="rounded-xl bg-zinc-100 text-2xl font-bold text-zinc-600">{fullName.slice(0, 1).toUpperCase()}</AvatarFallback>
            </Avatar>
          </div>
          <div className="min-w-0 flex-1 pb-1">
            <h2 className="truncate text-xl font-bold text-zinc-900">{fullName}</h2>
            <p className="mt-1 truncate text-sm text-zinc-500">{user?.email || profile?.email || 'No email on file'}</p>
          </div>
          <Badge variant="secondary" className="w-fit rounded-md border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-semibold text-zinc-600">{role || 'Team member'}</Badge>
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(280px,0.8fr)]">
        <Card className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-7">
          <div className="mb-6 flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-primary"><UserCircle className="h-5 w-5" /></div>
            <div>
              <h3 className="font-semibold text-zinc-900">Personal information</h3>
              <p className="mt-1 text-sm text-zinc-500">Update the details saved to your staff account.</p>
            </div>
          </div>
          <form onSubmit={handleProfileSave} className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="profile-name">Full name</Label>
                <Input id="profile-name" autoComplete="name" value={displayName} onChange={event => setDisplayName(event.target.value)} placeholder="Enter your full name" className="h-11" required />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="profile-email">Email address</Label>
                <Input id="profile-email" type="email" value={user?.email || profile?.email || ''} readOnly disabled className="h-11 bg-zinc-50 text-zinc-500" />
                <p className="text-xs text-zinc-500">Your sign-in email is managed by account security. Contact an administrator if it needs to change.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="profile-phone">Phone number</Label>
                <Input id="profile-phone" type="tel" autoComplete="tel" value={phoneNumber} onChange={event => setPhoneNumber(event.target.value)} placeholder="+254 7XX XXX XXX" className="h-11" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="profile-mpesa">M-Pesa payout number</Label>
                <Input id="profile-mpesa" type="tel" value={mpesaNumber} onChange={event => setMpesaNumber(event.target.value)} placeholder="07XX XXX XXX" className="h-11" />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="profile-address">Address</Label>
                <div className="relative">
                  <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                  <Input id="profile-address" autoComplete="street-address" value={address} onChange={event => setAddress(event.target.value)} placeholder="Street, estate, town or area" className="h-11 pl-9" />
                </div>
              </div>
            </div>
            <div className="flex flex-col-reverse gap-3 border-t border-zinc-100 pt-5 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-zinc-500">Changes are saved to your account profile.</p>
              <Button type="submit" disabled={isSaving} className="h-11 w-full sm:w-auto">
                {isSaving ? <RefreshCcw className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                {isSaving ? 'Saving changes…' : 'Save profile'}
              </Button>
            </div>
          </form>
        </Card>

        <div className="space-y-6">
          <Card className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-100 text-zinc-700"><ShieldCheck className="h-5 w-5" /></div>
              <div><h3 className="font-semibold text-zinc-900">Account access</h3><p className="text-xs text-zinc-500">Your current access level</p></div>
            </div>
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between gap-3"><span className="text-zinc-500">Role</span><span className="font-medium text-zinc-900">{role || 'Not assigned'}</span></div>
              <div className="flex items-center justify-between gap-3"><span className="text-zinc-500">Account</span><span className="font-medium text-zinc-900">{user?.emailVerified ? 'Email verified' : 'Email not verified'}</span></div>
              <div className="flex items-center justify-between gap-3"><span className="text-zinc-500">Profile status</span><span className="font-medium text-zinc-900">{profile?.phoneNumber && profile?.address ? 'Details added' : 'Needs details'}</span></div>
            </div>
          </Card>

          {role && role !== 'CLIENT' && (
            <Card className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-50 text-sky-600"><Send className="h-5 w-5" /></div>
                <div><h3 className="font-semibold text-zinc-900">Telegram notifications</h3><p className="text-xs text-zinc-500">Connect your staff account to the operations bot</p></div>
                {telegramStep === 'LINKED' && <Badge className="ml-auto border-emerald-200 bg-emerald-50 text-emerald-700">Connected</Badge>}
              </div>
              {telegramStep === 'LINKED' ? (
                <div className="space-y-3">
                  <p className="text-sm text-zinc-600">Telegram account <span className="font-semibold text-zinc-900">{linkedTelegramId}</span> is linked to your staff profile.</p>
                  <p className="text-xs leading-5 text-zinc-500">Your {role.toLowerCase()} role and assigned branch permissions are synchronized automatically. You can now receive relevant sales and operational notifications.</p>
                </div>
              ) : telegramStep === 'ID' ? (
                <form onSubmit={requestTelegramLink} className="space-y-3">
                  <p className="text-sm leading-5 text-zinc-600">Open the Urban Address bot in Telegram, press Start, then copy the numeric Telegram ID it displays.</p>
                  <div className="space-y-1.5"><Label htmlFor="staff-telegram-id">Your Telegram user ID</Label><Input id="staff-telegram-id" inputMode="numeric" pattern="[0-9]{1,20}" required value={telegramUserId} onChange={event => setTelegramUserId(event.target.value)} placeholder="e.g. 123456789" className="h-11" /></div>
                  <Button type="submit" disabled={telegramBusy} className="h-11 w-full">{telegramBusy ? <RefreshCcw className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}{telegramBusy ? 'Sending verification…' : 'Verify Telegram ID'}</Button>
                </form>
              ) : (
                <form onSubmit={confirmTelegramLink} className="space-y-3">
                  <p className="text-sm leading-5 text-zinc-600">A six-digit code was sent to Telegram ID <span className="font-semibold text-zinc-900">{telegramUserId}</span>. Enter it below to finish linking.</p>
                  <div className="space-y-1.5"><Label htmlFor="staff-telegram-code">Verification code</Label><Input id="staff-telegram-code" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} required value={telegramCode} onChange={event => setTelegramCode(event.target.value.replace(/\D/g, '').slice(0,6))} placeholder="6-digit code" className="h-11 text-center text-lg tracking-[0.3em]" /></div>
                  <Button type="submit" disabled={telegramBusy || telegramCode.length !== 6} className="h-11 w-full">{telegramBusy ? <RefreshCcw className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}{telegramBusy ? 'Verifying…' : 'Confirm and connect'}</Button>
                  <Button type="button" variant="ghost" onClick={() => { setTelegramStep('ID'); setTelegramCode(''); }} className="h-10 w-full">Use a different Telegram ID</Button>
                </form>
              )}
            </Card>
          )}

          {(isSuperAdmin || role === 'MANAGER') && (
            <Card className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="mb-5">
                <div className="flex items-center gap-3"><Printer className="h-5 w-5 text-zinc-700" /><h3 className="font-semibold text-zinc-900">Receipt printer</h3></div>
                <p className="mt-1 text-sm text-zinc-500">Choose how this terminal connects to its printer.</p>
              </div>
              <div className="space-y-3">
                <Label>Connection method</Label>
                <RadioGroup value={printMode} onValueChange={value => handlePrintModeChange(value as 'SERIAL' | 'PROXY' | 'NETWORK')} className="grid grid-cols-1 gap-2">
                  <ModeOption id="SERIAL" label="USB / Serial" icon={Usb} active={printMode === 'SERIAL'} />
                  <ModeOption id="PROXY" label="Local print bridge" icon={Monitor} active={printMode === 'PROXY'} />
                  <ModeOption id="NETWORK" label="Network printer" icon={Globe} active={printMode === 'NETWORK'} />
                </RadioGroup>
                <div className="space-y-2 pt-2">
                  <Label>Receipt paper width</Label>
                  <RadioGroup value={paperWidth} onValueChange={value => handlePaperWidthChange(value as '80mm' | '58mm')} className="grid grid-cols-2 gap-2">
                    <ModeOption id="80mm" label="80 mm" icon={Maximize2} active={paperWidth === '80mm'} />
                    <ModeOption id="58mm" label="58 mm" icon={Printer} active={paperWidth === '58mm'} />
                  </RadioGroup>
                </div>
                <Button type="button" variant="outline" onClick={handleHardwareTest} disabled={isTestingHardware} className="h-11 w-full">
                  {isTestingHardware ? <RefreshCcw className="mr-2 h-4 w-4 animate-spin" /> : <Activity className="mr-2 h-4 w-4" />}
                  {isTestingHardware ? 'Sending test…' : 'Print test receipt'}
                </Button>
                {isSuperAdmin && <Button type="button" variant="outline" onClick={() => setReceiptSettingsOpen(true)} className="h-11 w-full"><Settings2 className="mr-2 h-4 w-4" /> Receipt branding</Button>}
              </div>
            </Card>
          )}
        </div>
      </div>
      <ReceiptSettingsDialog open={receiptSettingsOpen} onOpenChange={setReceiptSettingsOpen} />
    </div>
  );
}

function ModeOption({ id, label, icon: Icon, active }: { id: string; label: string; icon: React.ElementType; active: boolean }) {
  return (
    <Label htmlFor={id} className={cn('flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 text-sm transition-colors', active ? 'border-primary bg-primary/5 text-zinc-900' : 'border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50')}>
      <Icon className="h-4 w-4 shrink-0" />
      <span className="flex-1">{label}</span>
      <RadioGroupItem value={id} id={id} />
    </Label>
  );
}
