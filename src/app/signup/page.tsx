'use client';

import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { useUser, useAuth, useFirestore } from '@/firebase';
import { signInWithPopup, GoogleAuthProvider, createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc, setDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import placeholderImages from '@/app/lib/placeholder-images.json';
import { User as UserIcon, Mail, Lock, ShieldCheck, Eye, EyeOff, ArrowLeft, RefreshCcw } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useProfile } from '@/hooks/use-profile';
import { cn } from '@/lib/utils';
import { verifyRecaptcha } from '@/lib/actions';

export default function SignUpPage() {
  const { user } = useUser();
  const auth = useAuth();
  const firestore = useFirestore();
  const router = useRouter();
  const { isEmployee, loading, isSuperAdmin } = useProfile();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  React.useEffect(() => {
    if (user && !loading) {
      if (isEmployee || isSuperAdmin) {
        router.push('/dashboard');
      } else {
        router.push('/');
      }
    }
  }, [user, isEmployee, isSuperAdmin, loading, router]);

  const getRecaptchaToken = (): Promise<string | null> => {
    return new Promise((resolve) => {
      const grecaptcha = (window as any).grecaptcha;
      if (!grecaptcha?.enterprise) {
        resolve(null);
        return;
      }
      grecaptcha.enterprise.ready(async () => {
        try {
          const token = await grecaptcha.enterprise.execute(
            process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY, 
            { action: 'SIGNUP' }
          );
          resolve(token);
        } catch (e) {
          resolve(null);
        }
      });
    });
  };

  const passwordStrength = useMemo(() => {
    if (!password) return 0;
    let strength = 0;
    if (password.length >= 8) strength += 25;
    if (/[A-Z]/.test(password)) strength += 25;
    if (/[0-9]/.test(password)) strength += 25;
    if (/[^A-Za-z0-9]/.test(password)) strength += 25;
    return strength;
  }, [password]);

  const strengthColor = useMemo(() => {
    if (passwordStrength <= 25) return "bg-red-500";
    if (passwordStrength <= 50) return "bg-amber-500";
    if (passwordStrength <= 75) return "bg-blue-500";
    return "bg-green-500";
  }, [passwordStrength]);

  const handleManualSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth || !firestore || !email || !password || isSubmitting) return;

    if (password.length < 8) {
      toast({ variant: "destructive", title: "Password Too Short", description: "Use at least 8 characters." });
      return;
    }

    if (password !== confirmPassword) {
      toast({ variant: "destructive", title: "Passwords Mismatch", description: "Please ensure both entries match." });
      return;
    }

    if (!acceptTerms) {
      toast({ variant: "destructive", title: "Accept Terms", description: "Please accept the terms to create an account." });
      return;
    }

    setIsSubmitting(true);
    try {
      // 1. Security Check
      const token = await getRecaptchaToken();
      const captchaResult = await verifyRecaptcha(token);
      if (!captchaResult.success) {
        toast({ variant: "destructive", title: "Security Alert", description: captchaResult.message });
        setIsSubmitting(false);
        return;
      }

      // 2. Create Firebase Account
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(cred.user, { displayName: name });
      
      await setDoc(doc(firestore, 'users', cred.user.uid), {
        uid: cred.user.uid,
        email: email.toLowerCase(),
        displayName: name,
        role: 'CLIENT',
        createdAt: Date.now(),
        accountType: 'CLIENT',
        loyaltyPoints: 0,
        totalSpent: 0
      });

      toast({ title: "Welcome to Urban Express", description: "Your account has been created successfully." });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Registration Failed",
        description: error.message || "Something went wrong.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleSignUp = async () => {
    if (!auth || !firestore || isSubmitting) return;
    setIsSubmitting(true);
    try {
      // 1. Security Check
      const token = await getRecaptchaToken();
      const captchaResult = await verifyRecaptcha(token);
      if (!captchaResult.success) {
        toast({ variant: "destructive", title: "Security Alert", description: captchaResult.message });
        setIsSubmitting(false);
        return;
      }

      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      const result = await signInWithPopup(auth, provider);
      
      const q = query(collection(firestore, 'users'), where('email', '==', result.user.email?.toLowerCase()));
      const snap = await getDocs(q);
      
      if (snap.empty) {
        await setDoc(doc(firestore, 'users', result.user.uid), {
          uid: result.user.uid,
          email: result.user.email?.toLowerCase(),
          displayName: result.user.displayName || 'Urban Member',
          role: 'CLIENT',
          createdAt: Date.now(),
          accountType: 'CLIENT',
          loyaltyPoints: 0,
          totalSpent: 0
        });
      }
      toast({ title: "Welcome", description: "Your account is ready." });
    } catch (error: any) {
      if (error?.code !== 'auth/popup-closed-by-user') {
        toast({ 
          variant: "destructive", 
          title: "Login Error", 
          description: "Could not sync with Google." 
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (user && loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center space-y-4">
          <div className="animate-pulse">
            <img src="/assets/logo.png" className="h-16 w-auto mx-auto" alt="Urban Express" />
          </div>
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full flex overflow-hidden bg-white relative">
      <Link 
        href="/" 
        className="absolute top-8 left-8 z-[100] flex items-center gap-3 py-2.5 px-6 bg-white/80 lg:bg-black/20 backdrop-blur-xl rounded-full border border-zinc-200 lg:border-white/10 text-[10px] font-black uppercase tracking-[0.3em] text-zinc-900 lg:text-white hover:bg-primary/20 hover:border-primary/40 transition-all shadow-xl active:scale-95 group"
      >
        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
        Back to Home
      </Link>

      <div className="hidden lg:block w-1/2 relative overflow-hidden">
        <Image 
          src={placeholderImages.auth.url}
          alt="Urban Premium"
          fill
          className="object-cover"
          priority
          sizes="50vw"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black/40 to-transparent" />
      </div>

      <div className="flex-1 flex flex-col items-center justify-center p-6 relative overflow-y-auto">
        <div className="w-full max-sm space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 relative z-10 py-12">
          <div className="text-center">
            <img src="/assets/logo.png" alt="Urban Express" className="h-12 w-auto mx-auto mb-6 object-contain" />
            <h2 className="text-[11px] font-black uppercase tracking-[0.4em] text-zinc-900">Create Account</h2>
            <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest mt-2">Join Urban Express today</p>
          </div>

          <div className="space-y-4">
             <Button 
               onClick={handleGoogleSignUp} 
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

          <form className="space-y-4" onSubmit={handleManualSignUp}>
            <div className="space-y-1.5">
              <div className="relative">
                <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-300" />
                <Input value={name} onChange={e => setName(e.target.value)} placeholder="Full Name" className="h-14 bg-zinc-50 border-none rounded-2xl pl-12 text-sm font-bold" required />
              </div>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-300" />
                <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email address" className="h-14 bg-zinc-50 border-none rounded-2xl pl-12 text-sm font-bold" required />
              </div>
            </div>

            <div className="space-y-2">
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-300" />
                <Input type={showPassword ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} placeholder="Create Password" className="h-14 bg-zinc-50 border-none rounded-2xl pl-12 text-sm font-bold" required />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-300">
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {password && (
                <div className="space-y-1.5 px-1 animate-in fade-in">
                  <div className="h-1 w-full bg-zinc-100 rounded-full overflow-hidden">
                    <div className={cn("h-full transition-all duration-500", strengthColor)} style={{ width: `${passwordStrength}%` }} />
                  </div>
                  <p className="text-[8px] font-black uppercase text-zinc-400 tracking-widest text-right">Password Strength</p>
                </div>
              )}

              <div className="relative">
                <ShieldCheck className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-300" />
                <Input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Confirm Password" className="h-14 bg-zinc-50 border-none rounded-2xl pl-12 text-sm font-bold" required />
              </div>
            </div>

            <div className="flex items-start space-x-3 py-2">
              <Checkbox id="terms" checked={acceptTerms} onCheckedChange={(checked) => setAcceptTerms(!!checked)} className="mt-1 rounded-md border-zinc-200" />
              <div className="grid gap-1.5 leading-none">
                <label htmlFor="terms" className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest cursor-pointer">
                  I accept the <Link href="/terms" className="text-primary font-black hover:underline">Terms of Service</Link>
                </label>
              </div>
            </div>

            <Button type="submit" disabled={isSubmitting} className="w-full h-16 bg-primary hover:bg-primary/90 text-white font-black rounded-2xl uppercase tracking-[0.2em] text-[10px] shadow-xl shadow-primary/20">
              {isSubmitting ? <RefreshCcw className="w-4 h-4 animate-spin mr-2" /> : 'Sign Up'}
            </Button>

            <div className="text-center pt-2">
               <p className="text-[8px] font-bold text-zinc-300 uppercase leading-relaxed tracking-wider px-4">
                 This site is protected by reCAPTCHA and the Google <a href="https://policies.google.com/privacy" className="text-primary hover:underline">Privacy Policy</a> and <a href="https://policies.google.com/terms" className="text-primary hover:underline">Terms of Service</a> apply.
               </p>
            </div>
          </form>

          <p className="text-center text-[10px] font-black uppercase tracking-widest text-zinc-400">
            Already have an account? <Link href="/login" className="text-primary hover:underline">Sign In</Link>
          </p>
        </div>
      </div>
    </div>
  );
}