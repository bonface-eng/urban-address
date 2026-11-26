'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth, useFirestore } from '@/firebase';
import { signInWithEmailAndPassword, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { useRouter, useSearchParams } from 'next/navigation';
import { doc, getDoc, addDoc, collection, setDoc } from 'firebase/firestore';
import Image from 'next/image';
import placeholderImages from '@/app/lib/placeholder-images.json';
import { Mail, Lock, Eye, EyeOff, RefreshCcw, ShieldCheck, ArrowLeft } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { UserProfile } from '@/lib/types';
import Link from 'next/link';
import { notifyTelegramClientEvent, notifyTelegramFailedSignIn } from '@/lib/telegram/client-events';

export default function LoginPage() {
  const auth = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const firestore = useFirestore();

  // Only allow same-origin customer destinations; never accept external redirect URLs.
  const getPostLoginDestination = (role?: string) => {
    const requested = searchParams.get('redirect');
    if (requested && requested.startsWith('/client/') && !requested.startsWith('//') && !requested.includes(String.fromCharCode(92))) {
      return requested;
    }
    return role && role !== 'CLIENT' ? '/dashboard' : '/';
  };
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const continueAfterLogin = async (signedInUser: any, role?: string) => {
    await signedInUser.reload();
    if (role === 'CLIENT' && !signedInUser.emailVerified) {
      const verificationToken = await signedInUser.getIdToken(true);
      await fetch('/api/auth/send-verification', {
        method: 'POST',
        headers: { Authorization: `Bearer ${verificationToken}` },
      });
      router.replace('/auth/verify-email');
      return;
    }
    const token = await signedInUser.getIdToken(true);
    const response = await fetch('/api/admin/otp/request', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Administrator verification could not start.');
    if (data.required) {
      router.replace('/admin-otp');
      return;
    }
    router.replace(getPostLoginDestination(role));
  };

  const handleGoogleLogin = async () => {
    if (!auth || !firestore || isSubmitting) return;
    setIsSubmitting(true);
    try {

      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      const result = await signInWithPopup(auth, provider);
      
      const userRef = doc(firestore, 'users', result.user.uid);
      const userSnap = await getDoc(userRef);
      
      let profileData: UserProfile;
      
      if (!userSnap.exists()) {
        profileData = {
          uid: result.user.uid,
          email: result.user.email?.toLowerCase() || '',
          displayName: result.user.displayName || 'Urban Member',
          role: 'CLIENT',
          createdAt: Date.now(),
          accountType: 'CLIENT',
          loyaltyPoints: 0,
          totalSpent: 0
        };
        await setDoc(userRef, profileData);
      } else {
        profileData = userSnap.data() as UserProfile;
      }
      
      await addDoc(collection(firestore, 'audit_logs'), {
        action: 'USER_SIGN_IN_GOOGLE',
        userId: profileData.uid,
        details: `Signed in with Google: ${profileData.displayName}`,
        timestamp: Date.now(),
        severity: 'INFO'
      });

      await notifyTelegramClientEvent(result.user, { type: 'SIGNIN', method: 'GOOGLE' });
      await continueAfterLogin(result.user, profileData.role);
    } catch (error: any) {
      if (error?.code !== 'auth/popup-closed-by-user') {
        await notifyTelegramFailedSignIn(email);
        toast({ 
          variant: "destructive", 
          title: "Login Failed", 
          description: "Could not sign in with Google." 
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleManualLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth || !email || !password || isSubmitting) return;
    
    setIsSubmitting(true);
    try {

      const normalizedEmail = email.toLowerCase().trim();
      const cred = await signInWithEmailAndPassword(auth, normalizedEmail, password);
      const userRef = doc(firestore!, 'users', cred.user.uid);
      const snap = await getDoc(userRef);
      
      if (snap.exists()) {
        const profileData = snap.data() as UserProfile;
        
        await addDoc(collection(firestore!, 'audit_logs'), {
          action: 'USER_SIGN_IN',
          userId: profileData.uid,
          details: `Signed in: ${profileData.displayName}`,
          timestamp: Date.now(),
          severity: 'INFO'
        });

        await notifyTelegramClientEvent(cred.user, { type: 'SIGNIN', method: 'EMAIL' });
        await continueAfterLogin(cred.user, profileData.role);
      }
    } catch (error: any) {
      await notifyTelegramFailedSignIn(email);
      toast({ variant: "destructive", title: "Login Failed", description: "Invalid email or password." });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex overflow-hidden bg-white relative font-sans">
      <div className="hidden lg:block w-1/2 relative overflow-hidden">
        <Image src={placeholderImages.auth.url} alt="Urban" fill className="object-cover brightness-90" priority />
        <div className="absolute inset-0 bg-gradient-to-r from-black/40 to-transparent" />
        <div className="absolute bottom-12 left-12 z-20 text-white space-y-2">
           <h1 className="text-4xl font-black font-headline uppercase tracking-tighter text-white">Urban Express</h1>
           <p className="text-[10px] font-bold uppercase tracking-[0.4em] opacity-60">Lounge, Shop & Detailing</p>
        </div>
      </div>
      
      <div className="flex-1 flex flex-col items-center justify-center p-8 relative bg-white">
        <Link
          href="/"
          className="mb-5 self-end inline-flex min-h-10 items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-[9px] font-black uppercase tracking-[0.18em] text-zinc-600 shadow-sm transition-colors hover:border-primary/40 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Home
        </Link>


        <div className="w-full max-w-sm space-y-10">
          <div className="text-center">
            <img src="/assets/logo.png" alt="Urban" className="h-16 w-auto mx-auto mb-8" />
            <h2 className="text-[11px] font-black uppercase tracking-[0.4em] text-zinc-900">Welcome Back</h2>
            <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest mt-2">Sign in to your account</p>
          </div>

          <div className="space-y-4">
             <Button 
               onClick={handleGoogleLogin} 
               disabled={isSubmitting}
               variant="outline" 
               className="w-full h-14 rounded-2xl font-black uppercase text-[10px] tracking-widest gap-3 border-zinc-100 shadow-sm hover:bg-zinc-50 transition-all"
             >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                Continue with Google
             </Button>
             
             <div className="flex items-center gap-4 py-2">
                <div className="h-px bg-zinc-100 flex-1" />
                <span className="text-[8px] font-black text-zinc-300 uppercase tracking-widest">or use email</span>
                <div className="h-px bg-zinc-100 flex-1" />
             </div>
          </div>

          <form className="space-y-5" onSubmit={handleManualLogin}>
            <div className="space-y-3">
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-300" />
                <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email address" className="h-14 bg-zinc-50 border-none rounded-2xl pl-12 text-sm font-bold shadow-inner focus:ring-2 focus:ring-primary/10" required />
              </div>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-300" />
                <Input type={showPassword ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} placeholder="Password" className="h-14 bg-zinc-50 border-none rounded-2xl pl-12 text-sm font-bold shadow-inner focus:ring-2 focus:ring-primary/10" required />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-300 hover:text-zinc-900 transition-colors">
                   {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="flex justify-end px-1">
               <Link href="/forgot-password" size="sm" className="text-[10px] font-black text-zinc-400 uppercase tracking-widest hover:text-primary transition-colors">
                 Forgot password?
               </Link>
            </div>

            <Button type="submit" disabled={isSubmitting} className="w-full h-16 bg-zinc-900 text-white font-black rounded-2xl uppercase tracking-[0.3em] text-[10px] shadow-xl hover:bg-zinc-800 active:scale-95 transition-all">
              {isSubmitting ? <RefreshCcw className="w-4 h-4 animate-spin" /> : 'Sign In'}
            </Button>

            <div className="text-center pt-2">
               
            </div>
          </form>
          
          <div className="flex items-center justify-center gap-2 py-4">
             <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">New to Urban Express?</span>
             <Link href="/signup" className="text-[10px] font-black text-primary uppercase tracking-widest hover:underline">Create Account</Link>
          </div>

          <div className="pt-10 flex flex-col items-center gap-4">
            <div className="flex items-center gap-2 text-[8px] font-black text-zinc-300 uppercase tracking-[0.3em]">
               <ShieldCheck className="w-3.5 h-3.5 text-primary" /> Secure connection active
            </div>
            <p className="text-center text-[8px] font-bold text-zinc-200 uppercase tracking-widest">
              © 2024 Urban Express
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}