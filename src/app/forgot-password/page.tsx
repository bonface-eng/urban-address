'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import placeholderImages from '@/app/lib/placeholder-images.json';
import { Mail, ArrowLeft, RefreshCcw, CheckCircle2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import Link from 'next/link';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSent, setIsSent] = useState(false);

  const handleResetRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || isSubmitting) return;
    
    setIsSubmitting(true);
    try {
      const normalizedEmail = email.toLowerCase().trim();
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: normalizedEmail }),
      });
      if (!response.ok) throw new Error('Password reset request failed.');
      setIsSent(true);
      toast({ title: "Email Sent", description: "Instructions have been sent to your email address." });
    } catch (error: any) {
      toast({ 
        variant: "destructive", 
        title: "Request Failed", 
        description: "Please check the email address and try again." 
      });
    } finally {
      setIsSubmitting(false);
    }
  };

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
        <Image src={placeholderImages.auth.url} alt="Urban Express" fill className="object-cover brightness-50" priority />
        <div className="absolute inset-0 bg-gradient-to-r from-black/40 to-transparent" />
        <div className="absolute bottom-12 left-12 z-20 text-white space-y-2">
           <h1 className="text-4xl font-black font-headline uppercase tracking-tighter">Reset Password</h1>
           <p className="text-[10px] font-bold uppercase tracking-[0.4em] opacity-60">Account Recovery</p>
        </div>
      </div>
      
      <div className="flex-1 flex flex-col items-center justify-center p-8 relative bg-white">
        <div className="w-full max-w-sm space-y-10">
          <div className="text-center">
            <img src="/assets/logo.png" alt="Urban Express" className="h-16 w-auto mx-auto mb-8" />
            <h2 className="text-[11px] font-black uppercase tracking-[0.4em] text-zinc-900">Forgot Password</h2>
            <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest mt-2">Enter your email to receive a reset link</p>
          </div>

          {isSent ? (
            <div className="space-y-8 animate-in fade-in zoom-in duration-500 text-center">
               <div className="w-20 h-20 rounded-[2.5rem] bg-green-50 flex items-center justify-center text-green-500 mx-auto">
                  <CheckCircle2 className="w-10 h-10" />
               </div>
               <div className="space-y-3">
                  <h3 className="text-xl font-black uppercase text-zinc-900 tracking-tight">Check your email</h3>
                  <div className="p-6 bg-zinc-50 rounded-2xl border border-zinc-100 text-left">
                    <p className="text-[11px] font-bold text-zinc-600 uppercase leading-relaxed">
                      We've sent a link to <span className="text-primary font-black">{email}</span>. Please follow the link in the email to reset your password.
                    </p>
                  </div>
               </div>
               <Button asChild className="w-full h-16 bg-zinc-900 text-white font-black rounded-2xl uppercase tracking-[0.3em] text-[10px] shadow-xl">
                  <Link href="/login">Return to Sign In</Link>
               </Button>
               <button onClick={() => setIsSent(false)} className="text-[9px] font-black text-primary uppercase tracking-widest hover:underline">Try another email</button>
            </div>
          ) : (
            <form className="space-y-6" onSubmit={handleResetRequest}>
              <div className="space-y-4">
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-300" />
                  <Input 
                    type="email" 
                    value={email} 
                    onChange={e => setEmail(e.target.value)} 
                    placeholder="Email address" 
                    className="h-14 bg-zinc-50 border-none rounded-2xl pl-12 text-sm font-bold shadow-inner focus:ring-2 focus:ring-primary/10" 
                    required 
                  />
                </div>
              </div>

              <Button type="submit" disabled={isSubmitting} className="w-full h-16 bg-zinc-900 text-white font-black rounded-2xl uppercase tracking-[0.3em] text-[10px] shadow-xl hover:bg-zinc-800 active:scale-95 transition-all">
                {isSubmitting ? <RefreshCcw className="w-4 h-4 animate-spin" /> : 'Send Reset Link'}
              </Button>

              <div className="flex items-center justify-center pt-2">
                <Link href="/login" className="flex items-center gap-2 text-[10px] font-black text-zinc-400 uppercase tracking-widest hover:text-zinc-900 transition-colors">
                  <ArrowLeft className="w-3.5 h-3.5" /> Back to Sign In
                </Link>
              </div>
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
