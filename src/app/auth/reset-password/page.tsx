'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/firebase';
import { confirmPasswordReset, verifyPasswordResetCode } from 'firebase/auth';
import Image from 'next/image';
import placeholderImages from '@/app/lib/placeholder-images.json';
import { Lock, Eye, EyeOff, RefreshCcw, CheckCircle2, AlertTriangle, ShieldCheck, ArrowLeft } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import Link from 'next/link';

export default function ResetPasswordPage() {
  const auth = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [oobCode, setOobCode] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isVerifying, setIsVerifying] = useState(true);
  const [isValidCode, setIsValidCode] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  useEffect(() => {
    const code = searchParams.get('oobCode');
    setOobCode(code);

    if (auth && code) {
      verifyPasswordResetCode(auth, code)
        .then((userEmail) => {
          setEmail(userEmail);
          setIsValidCode(true);
          setIsVerifying(false);
        })
        .catch((err) => {
          setIsVerifying(false);
          setIsValidCode(false);
        });
    } else {
      setIsVerifying(false);
    }
  }, [auth, searchParams]);

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

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth || !oobCode || isSubmitting) return;

    if (password.length < 8 || passwordStrength < 50) {
      toast({ variant: "destructive", title: "Password Too Weak", description: "Use at least 8 characters and add an uppercase letter, number or symbol." });
      return;
    }

    if (password !== confirmPassword) {
      toast({ variant: "destructive", title: "Passwords Mismatch", description: "Please ensure both passwords match." });
      return;
    }

    setIsSubmitting(true);
    try {
      await confirmPasswordReset(auth, oobCode, password);
      setIsSuccess(true);
      toast({ title: "Password Updated", description: "Your new password has been saved." });
      
      setTimeout(() => {
        router.push('/login');
      }, 3000);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Update Failed",
        description: "The link may have expired. Please try requesting a new reset email.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isVerifying) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center space-y-4">
          <RefreshCcw className="w-10 h-10 text-primary animate-spin mx-auto" />
          <p className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-300">Verifying link...</p>
        </div>
      </div>
    );
  }

  if (!oobCode || !isValidCode) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 p-6 text-center">
        <div className="max-w-md w-full rounded-[3rem] border-none shadow-2xl p-12 space-y-8 bg-white">
           <div className="w-20 h-20 rounded-3xl bg-red-50 flex items-center justify-center text-red-500 mx-auto">
              <AlertTriangle className="w-10 h-10" />
           </div>
           <div className="space-y-2">
              <h2 className="text-2xl font-black uppercase font-headline">Invalid Link</h2>
              <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest leading-relaxed">
                This reset link is no longer valid or has already been used.
              </p>
           </div>
           <Button asChild className="w-full h-14 bg-zinc-900 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest">
              <Link href="/forgot-password">Request a New Link</Link>
           </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full flex overflow-hidden bg-white relative font-sans">
      {/* Back Button - Relocated to Top Left for maximum visibility */}
      <Link 
        href="/" 
        className="absolute top-8 left-8 z-[100] flex items-center gap-3 py-2.5 px-6 bg-white/80 lg:bg-black/20 backdrop-blur-xl rounded-full border border-zinc-200 lg:border-white/10 text-[10px] font-black uppercase tracking-[0.3em] text-zinc-900 lg:text-white hover:bg-primary/20 hover:border-primary/40 transition-all shadow-xl active:scale-95 group"
      >
        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
        Back to Home
      </Link>

      <div className="hidden lg:block w-1/2 relative overflow-hidden">
        <Image src={placeholderImages.auth.url} alt="Urban Excellence" fill className="object-cover brightness-50" priority />
        <div className="absolute inset-0 bg-gradient-to-r from-black/40 to-transparent" />
        <div className="absolute bottom-12 left-12 z-20 text-white space-y-2">
           <h1 className="text-4xl font-black font-headline uppercase tracking-tighter">Set New Password</h1>
           <p className="text-[10px] font-bold uppercase tracking-[0.4em] opacity-60">Security Update for {email}</p>
        </div>
      </div>
      
      <div className="flex-1 flex flex-col items-center justify-center p-8 relative bg-white">
        <div className="w-full max-sm space-y-10">
          <div className="text-center">
            <img src="/assets/logo.png" alt="Urban Express" className="h-16 w-auto mx-auto mb-8" />
            <h2 className="text-[11px] font-black uppercase tracking-[0.4em] text-zinc-900">New Password</h2>
            <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest mt-2">Create a secure password for your account</p>
          </div>

          {isSuccess ? (
            <div className="space-y-8 text-center animate-in zoom-in-95 duration-500">
               <div className="w-20 h-20 rounded-[2.5rem] bg-green-50 flex items-center justify-center text-green-500 mx-auto">
                  <CheckCircle2 className="w-10 h-10" />
               </div>
               <div className="space-y-2">
                  <h3 className="text-2xl font-black uppercase text-zinc-900">Success</h3>
                  <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Your password has been changed. Redirecting to sign in...</p>
               </div>
            </div>
          ) : (
            <form className="space-y-6" onSubmit={handleReset}>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase text-zinc-400 px-1">New Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-300" />
                    <Input 
                      type={showPassword ? "text" : "password"} 
                      value={password} 
                      onChange={e => setPassword(e.target.value)} 
                      placeholder="Enter new password" 
                      className="h-14 bg-zinc-50 border-none rounded-2xl pl-12 text-sm font-bold shadow-inner focus:ring-2 focus:ring-primary/10" 
                      required 
                    />
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
                </div>

                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase text-zinc-400 px-1">Confirm Password</Label>
                  <div className="relative">
                    <ShieldCheck className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-300" />
                    <Input 
                      type={showConfirmPassword ? "text" : "password"} 
                      value={confirmPassword} 
                      onChange={e => setConfirmPassword(e.target.value)} 
                      placeholder="Repeat password" 
                      className="h-14 bg-zinc-50 border-none rounded-2xl pl-12 pr-12 text-sm font-bold shadow-inner focus:ring-2 focus:ring-primary/10" 
                      required 
                    />
                    <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} aria-label={showConfirmPassword ? "Hide confirmation password" : "Show confirmation password"} className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-900">
                      {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>

              <Button type="submit" disabled={isSubmitting || password.length < 8 || passwordStrength < 50} className="w-full h-16 bg-zinc-900 text-white font-black rounded-2xl uppercase tracking-[0.3em] text-[10px] shadow-xl hover:bg-zinc-800 active:scale-95 transition-all gap-3">
                {isSubmitting ? <RefreshCcw className="w-4 h-4 animate-spin" /> : 'Save Password'}
              </Button>
            </form>
          )}
          
          <div className="pt-12">
            <p className="text-center text-[8px] font-bold text-zinc-200 uppercase tracking-widest">
              © 2024 Urban Express
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
