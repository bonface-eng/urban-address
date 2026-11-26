'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword, signOut } from 'firebase/auth';
import { collection, addDoc } from 'firebase/firestore';
import { LogOut, KeyRound, ShieldAlert, Loader2 } from 'lucide-react';
import { useAuth, useFirestore, useUser } from '@/firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';

export function AccountSecurity() {
  const { user } = useUser();
  const auth = useAuth();
  const firestore = useFirestore();
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const [requestingDeletion, setRequestingDeletion] = useState(false);

  const supportsPasswordAuth = Boolean(user?.providerData.some((provider) => provider.providerId === 'password'));

  const reauthenticate = async (password: string) => {
    if (!user?.email) throw new Error('Your account does not have an email address.');
    const credential = EmailAuthProvider.credential(user.email, password);
    await reauthenticateWithCredential(user, credential);
  };

  const handlePasswordChange = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user || !supportsPasswordAuth) return;
    if (newPassword.length < 8) {
      toast({ variant: 'destructive', title: 'Password too short', description: 'Use at least 8 characters for your new password.' });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ variant: 'destructive', title: 'Passwords do not match', description: 'Confirm the new password exactly.' });
      return;
    }
    setChangingPassword(true);
    try {
      await reauthenticate(currentPassword);
      await updatePassword(user, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      toast({ title: 'Password updated', description: 'Your account password has been changed.' });
    } catch (error: any) {
      const message = error?.code === 'auth/wrong-password' || error?.code === 'auth/invalid-credential'
        ? 'The current password is incorrect.'
        : error?.code === 'auth/weak-password'
          ? 'Choose a stronger password.'
          : error?.code === 'auth/requires-recent-login'
            ? 'Please sign in again and retry.'
            : 'We could not update your password. Please try again.';
      toast({ variant: 'destructive', title: 'Password not updated', description: message });
    } finally {
      setChangingPassword(false);
    }
  };

  const handleDeletionRequest = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user || !auth || !firestore || !supportsPasswordAuth) return;
    if (deleteConfirmation !== 'DELETE') {
      toast({ variant: 'destructive', title: 'Confirmation required', description: 'Type DELETE to confirm your request.' });
      return;
    }
    setRequestingDeletion(true);
    try {
      await reauthenticate(deletePassword);
      await addDoc(collection(firestore, 'account_deletion_requests'), {
        userId: user.uid,
        email: user.email || '',
        displayName: user.displayName || '',
        requestedAt: Date.now(),
        status: 'PENDING',
        source: 'CUSTOMER_PROFILE',
      });
      await signOut(auth);
      toast({ title: 'Deletion request submitted', description: 'Your request has been sent for secure account and data review.' });
      router.replace('/login?accountDeletionRequested=1');
    } catch (error: any) {
      const message = error?.code === 'auth/wrong-password' || error?.code === 'auth/invalid-credential'
        ? 'The current password is incorrect.'
        : 'We could not submit your request. Please try again.';
      toast({ variant: 'destructive', title: 'Request not submitted', description: message });
    } finally {
      setRequestingDeletion(false);
    }
  };

  const handleSignOut = async () => {
    if (!auth) return;
    await signOut(auth);
    router.replace('/login');
  };

  if (!user) return null;

  return (
    <section className="space-y-5">
      <div className="rounded-xl border border-zinc-200 bg-white p-5 sm:p-7 space-y-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-100 text-zinc-700"><KeyRound className="h-5 w-5" /></div>
          <div>
            <h3 className="text-sm font-bold text-zinc-900">Password & security</h3>
            <p className="text-xs text-zinc-500">Confirm your current password before changing it.</p>
          </div>
        </div>
        {supportsPasswordAuth ? (
          <form onSubmit={handlePasswordChange} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="current-password">Current password</Label>
              <Input id="current-password" type="password" autoComplete="current-password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-password">New password</Label>
              <Input id="new-password" type="password" autoComplete="new-password" minLength={8} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirm-password">Confirm new password</Label>
              <Input id="confirm-password" type="password" autoComplete="new-password" minLength={8} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
            </div>
            <div className="sm:col-span-2">
              <Button type="submit" disabled={changingPassword || !currentPassword || !newPassword || !confirmPassword} className="h-11 w-full sm:w-auto">
                {changingPassword && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Update password
              </Button>
            </div>
          </form>
        ) : (
          <p className="text-sm text-zinc-600">This account uses a third-party sign-in provider. Manage its password with that provider.</p>
        )}
      </div>

      <div className="rounded-xl border border-red-200 bg-white p-5 sm:p-7 space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-50 text-red-600"><ShieldAlert className="h-5 w-5" /></div>
          <div>
            <h3 className="text-sm font-bold text-zinc-900">Delete account</h3>
            <p className="text-xs text-zinc-500">Submit a verified request for account deletion.</p>
          </div>
        </div>
        <p className="text-xs leading-relaxed text-zinc-600">For security and record-retention purposes, deletion requests are reviewed before the account is permanently removed. Order and payment records may be retained where required for business or legal compliance.</p>
        {supportsPasswordAuth ? (
          <form onSubmit={handleDeletionRequest} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="delete-current-password">Current password</Label>
              <Input id="delete-current-password" type="password" autoComplete="current-password" value={deletePassword} onChange={(e) => setDeletePassword(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="delete-confirmation">Type DELETE to confirm</Label>
              <Input id="delete-confirmation" value={deleteConfirmation} onChange={(e) => setDeleteConfirmation(e.target.value)} autoComplete="off" required />
            </div>
            <Button type="submit" variant="destructive" disabled={requestingDeletion || !deletePassword || deleteConfirmation !== 'DELETE'} className="h-11 w-full sm:w-auto">
              {requestingDeletion && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Submit deletion request
            </Button>
          </form>
        ) : (
          <p className="text-xs text-zinc-500">Contact support to verify and submit an account deletion request for this sign-in provider.</p>
        )}
      </div>

      <Button type="button" variant="outline" onClick={handleSignOut} className="h-12 w-full justify-center gap-2 border-zinc-200 text-zinc-700">
        <LogOut className="h-4 w-4" /> Sign out
      </Button>
    </section>
  );
}
