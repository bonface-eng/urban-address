'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useProfile } from '@/hooks/use-profile';
import { useUser, useFirestore } from '@/firebase';
import { doc, updateDoc, addDoc, collection } from 'firebase/firestore';
import { updateProfile } from 'firebase/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { ImageUpload } from '@/components/shared/image-upload';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';

const AVATAR_PACK = [
  "https://api.dicebear.com/7.x/avataaars/svg?seed=Felix",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=Aria",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=Jack",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=Milo",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=Sasha",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=Zoe",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=Leo",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=Luna",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=Oscar",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=Ruby"
];

export default function SetupProfilePage() {
  const { profile, loading: profileLoading } = useProfile();
  const { user } = useUser();
  const firestore = useFirestore();
  const router = useRouter();

  const [firstName, setFirstName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [mpesaPhone, setMpesaPhone] = useState('');
  const [photo, setPhoto] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (profile) {
      const names = (profile.displayName || '').split(' ');
      setFirstName(profile.firstName || names[0] || '');
      setLastName(profile.lastName || names[names.length - 1] || '');
      setMiddleName(profile.middleName || (names.length > 2 ? names.slice(1, -1).join(' ') : ''));
      setPhone(profile.phoneNumber || '');
      setMpesaPhone(profile.mpesaNumber || '');
      setPhoto(profile.photoURL || '');
    }
  }, [profile]);

  const handleSync = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firestore || !profile || !user) return;
    
    if (!photo) {
      toast({ variant: "destructive", title: "IMAGE REQUIRED" });
      return;
    }

    setIsSubmitting(true);
    try {
      const fullDisplayName = `${firstName} ${lastName} ${middleName ? '(' + middleName + ')' : ''}`.trim();
      const userRef = doc(firestore, 'users', profile.uid);
      
      await updateDoc(userRef, {
        firstName: firstName.trim(),
        middleName: middleName.trim(),
        lastName: lastName.trim(),
        displayName: fullDisplayName,
        phoneNumber: phone.trim(),
        mpesaNumber: mpesaPhone.trim(),
        photoURL: photo,
        updatedAt: Date.now()
      });

      await updateProfile(user, {
        displayName: fullDisplayName,
        photoURL: photo
      });

      await addDoc(collection(firestore, 'audit_logs'), {
        action: 'PROFILE_COMPLETION',
        userId: profile.uid,
        details: `Staff member finalized account identity: ${fullDisplayName}`,
        timestamp: Date.now(),
        severity: 'INFO'
      });

      toast({ title: "ACCOUNT SYNCHRONIZED", description: "Details have been stored in the master registry." });
      router.push('/dashboard');
    } catch (err) {
      toast({ variant: "destructive", title: "SYNC FAILED" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemindLater = () => {
    sessionStorage.setItem('uax_setup_reminded', 'true');
    router.push('/dashboard');
    toast({ title: "SETUP POSTPONED" });
  };

  if (profileLoading) return null;

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center p-4 md:p-12 relative overflow-hidden">
       {/* Background Decoration */}
       <div className="absolute top-0 right-0 w-[400px] md:w-[600px] h-[400px] md:h-[600px] bg-primary/5 rounded-full translate-x-1/2 -translate-y-1/2 blur-3xl -z-10" />
       
       <div className="w-full max-w-5xl space-y-8 md:space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-1000">
          <div className="text-center space-y-3 md:space-y-4">
             <img src="/assets/logo.png" alt="Urban Express" className="h-8 md:h-12 w-auto mx-auto mb-4 md:mb-8" />
             <h1 className="text-2xl md:text-5xl font-black font-headline uppercase tracking-tighter text-zinc-900 leading-none px-4">Let's set up your profile</h1>
             <p className="text-[9px] md:text-xs font-bold uppercase text-zinc-400 tracking-[0.3em] md:tracking-[0.4em] max-w-2xl mx-auto leading-relaxed px-6">
                Please provide your details to ensure you are correctly identified and credited for your work.
             </p>
          </div>

          <Card className="rounded-none border-none shadow-[0_50px_100px_-20px_rgba(0,0,0,0.1)] bg-white overflow-hidden">
             <form onSubmit={handleSync} className="flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-zinc-100">
                <div className="md:w-2/5 p-8 md:p-12 bg-zinc-50/50 flex flex-col space-y-8 md:space-y-10">
                   <div className="space-y-4 md:space-y-6">
                      <p className="text-[8px] md:text-[9px] font-black uppercase tracking-[0.3em] text-zinc-400">Digital Identity Pack</p>
                      <ScrollArea className="w-full pb-4">
                        <div className="flex gap-3 md:gap-4">
                           {AVATAR_PACK.map((url, i) => (
                             <button
                               key={i}
                               type="button"
                               onClick={() => setPhoto(url)}
                               className={cn(
                                 "w-12 h-12 md:w-16 md:h-16 rounded-xl md:rounded-2xl bg-white border-2 transition-all shrink-0 overflow-hidden shadow-sm",
                                 photo === url ? "border-primary scale-110 shadow-lg" : "border-transparent opacity-60 hover:opacity-100"
                               )}
                             >
                                <img src={url} alt={`Avatar ${i}`} className="w-full h-full object-cover" />
                             </button>
                           ))}
                        </div>
                        <ScrollBar orientation="horizontal" />
                      </ScrollArea>
                   </div>

                   <div className="space-y-4 md:space-y-6">
                      <p className="text-[8px] md:text-[9px] font-black uppercase tracking-[0.3em] text-zinc-400">Manual Asset Capture</p>
                      <div className="w-full aspect-square relative group bg-white border-2 border-dashed border-zinc-200 transition-all hover:border-primary/40 cursor-pointer">
                         <ImageUpload 
                           onUploadComplete={setPhoto} 
                           defaultValue={photo} 
                           category="profile" 
                           hideIcons={true}
                           className="w-full h-full"
                         />
                         {!photo && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none p-6 text-center space-y-2 md:space-y-3">
                               <p className="text-[8px] md:text-[10px] font-black uppercase tracking-[0.3em] text-zinc-900 leading-tight">TAP TO UPLOAD</p>
                               <p className="text-[7px] md:text-[8px] font-bold uppercase tracking-[0.1em] text-zinc-400">OR USE CAMERA</p>
                            </div>
                         )}
                      </div>
                      <div className="space-y-2">
                         <p className="text-[7px] md:text-[8px] font-black uppercase text-zinc-900 text-center tracking-widest">Identification Mandatory</p>
                         <p className="text-[6px] md:text-[7px] font-bold uppercase text-zinc-400 text-center px-4 tracking-widest leading-relaxed">
                           Choose a pack avatar or upload a clear photo for station accountability.
                         </p>
                      </div>
                   </div>
                </div>

                <div className="md:w-3/5 p-8 md:p-12 space-y-8 md:space-y-12">
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
                      <div className="space-y-1.5 md:space-y-2">
                         <Label className="text-[9px] md:text-[10px] font-black uppercase tracking-[0.3em] text-zinc-400 px-1">First Name</Label>
                         <Input 
                           value={firstName} 
                           onChange={e => setFirstName(e.target.value)} 
                           className="h-12 md:h-16 bg-zinc-50 border-none rounded-none px-6 md:px-8 font-bold text-base md:text-lg" 
                           required 
                         />
                      </div>
                      <div className="space-y-1.5 md:space-y-2">
                         <Label className="text-[9px] md:text-[10px] font-black uppercase tracking-[0.3em] text-zinc-400 px-1">Last Name</Label>
                         <Input 
                           value={lastName} 
                           onChange={e => setLastName(e.target.value)} 
                           className="h-12 md:h-16 bg-zinc-50 border-none rounded-none px-6 md:px-8 font-bold text-base md:text-lg" 
                           required 
                         />
                      </div>
                      <div className="md:col-span-2 space-y-1.5 md:space-y-2">
                         <Label className="text-[9px] md:text-[10px] font-black uppercase tracking-[0.3em] text-zinc-400 px-1">Middle Name (Optional)</Label>
                         <Input 
                           value={middleName} 
                           onChange={e => setMiddleName(e.target.value)} 
                           className="h-12 md:h-16 bg-zinc-50 border-none rounded-none px-6 md:px-8 font-bold" 
                         />
                      </div>
                   </div>

                   <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
                      <div className="space-y-1.5 md:space-y-2">
                         <Label className="text-[9px] md:text-[10px] font-black uppercase tracking-[0.3em] text-zinc-400 px-1">Contact Phone</Label>
                         <Input 
                           value={phone} 
                           onChange={e => setPhone(e.target.value)} 
                           placeholder="07XX XXX XXX" 
                           className="h-12 md:h-16 bg-zinc-50 border-none rounded-none px-6 md:px-8 font-mono font-bold text-base md:text-lg" 
                           required 
                         />
                      </div>
                      <div className="space-y-1.5 md:space-y-2">
                         <Label className="text-[9px] md:text-[10px] font-black uppercase tracking-[0.3em] text-zinc-400 px-1">M-Pesa Payout Number</Label>
                         <Input 
                           value={mpesaPhone} 
                           onChange={e => setMpesaPhone(e.target.value)} 
                           placeholder="07XX XXX XXX" 
                           className="h-12 md:h-16 bg-zinc-50 border-none rounded-none px-6 md:px-8 font-mono font-bold text-base md:text-lg" 
                           required 
                         />
                      </div>
                   </div>

                   <div className="pt-8 md:pt-12 flex flex-col gap-4 md:gap-6">
                      <Button 
                        type="submit" 
                        disabled={isSubmitting} 
                        className="w-full h-16 md:h-20 bg-white text-zinc-900 border border-zinc-200 rounded-none font-black uppercase text-[10px] md:text-[12px] tracking-[0.4em] md:tracking-[0.5em] shadow-sm hover:bg-zinc-50 transition-all active:scale-95"
                      >
                        {isSubmitting ? 'SYNCING IDENTITY...' : 'FINALIZE PROFILE'}
                      </Button>
                      <button 
                        type="button" 
                        onClick={handleRemindLater} 
                        className="text-[9px] md:text-[10px] font-black uppercase tracking-[0.3em] md:tracking-[0.4em] text-primary hover:text-orange-600 transition-colors py-2 text-center"
                      >
                        REMIND ME LATER
                      </button>
                   </div>
                </div>
             </form>
          </Card>
          
          <p className="text-center text-[7px] md:text-[8px] font-black text-zinc-200 uppercase tracking-[0.6em] md:tracking-[0.8em]">Urban Express Personnel Compliance v2.5</p>
       </div>
    </div>
  );
}
