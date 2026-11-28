'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Eye, EyeOff, Lock, Mail, RefreshCcw, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth, useDb, useUser } from '@/lib/data';
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getSupabaseBrowserClient,
  GoogleAuthProvider,
  setDoc,
  signInWithPopup,
} from '@/lib/db';
import { useProfile } from '@/hooks/use-profile';
import { toast } from '@/hooks/use-toast';
import { UserProfile } from '@/lib/types';
import { getRoleHomeRoute } from '@/lib/role-routing';
import { notifyTelegramClientEvent, notifyTelegramFailedSignIn } from '@/lib/telegram/client-events';
import placeholderImages from '@/app/lib/placeholder-images.json';
import { cn } from '@/lib/utils';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const ROOT_ADMINS = [
  'gackstoneb@gmail.com',
  'bonfacewana3072@gmail.com',
  'urbanautoexpressnakuru@gmail.com',
  'urbanaautoexpressnakuru@gmail.com',
  'samuelkarani044@gmail.com',
  'gmaina424@gmail.com',
];

export default function LoginPage() {
  const auth = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const firestore = useDb();
  const { user, loading: authLoading } = useUser();
  const { role, isSuperAdmin, profile, loading: profileLoading } = useProfile();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});

  const getPostLoginDestination = (prof?: Partial<UserProfile> | null, fallbackEmail?: string | null) => {
    const normalizedEmail = String(prof?.email || fallbackEmail || '').trim().toLowerCase();
    const isRoot = ROOT_ADMINS.includes(normalizedEmail) || prof?.isSuperAdmin === true;
    const upperRole = String(prof?.role || (isRoot ? 'ADMIN' : 'CLIENT')).toUpperCase();
    const roleHome = getRoleHomeRoute({
      role: upperRole,
      email: normalizedEmail,
      isSuperAdmin: isRoot,
      assignedUnits: prof?.assignedUnits,
    });

    const nextParam = searchParams.get('next');
    if (nextParam && nextParam.startsWith('/') && !nextParam.startsWith('//') && !nextParam.includes('\\')) {
      if (upperRole === 'CLIENT' && !isRoot) {
        if (nextParam === '/' || nextParam.startsWith('/client/')) {
          return nextParam;
        }
        return '/';
      }
      if (nextParam === '/dashboard' && roleHome !== '/dashboard') {
        return roleHome;
      }
      return nextParam;
    }

    const requested = searchParams.get('redirect');
    if (requested && requested.startsWith('/client/') && !requested.startsWith('//') && !requested.includes('\\')) {
      return requested;
    }

    return roleHome;
  };

  // Redirect already signed-in users away from the login page.
  useEffect(() => {
    if (authLoading || profileLoading || !user) return;
    router.replace(
      getPostLoginDestination(
        {
          role: role ?? undefined,
          email: user.email ?? undefined,
          isSuperAdmin,
          assignedUnits: profile?.assignedUnits,
        },
        user.email
      )
    );
  }, [authLoading, profileLoading, user, role, isSuperAdmin, profile, router]);

  useEffect(() => {
    if (searchParams.get('error') === 'suspended') {
      const msg = 'This account has been suspended. Please contact an administrator.';
      setFormError(msg);
      toast({
        variant: 'destructive',
        title: 'Account Suspended',
        description: msg,
      });
    }
  }, [searchParams]);

  const handleGoogleLogin = async () => {
    if (!auth || !firestore || isSubmitting) return;
    setFormError('');
    setFieldErrors({});
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
          totalSpent: 0,
        };
        await setDoc(userRef, profileData);
      } else {
        profileData = userSnap.data() as UserProfile;
      }

      if (profileData.role && profileData.role !== 'CLIENT' && profileData.role !== 'KITCHEN') {
        await addDoc(collection(firestore, 'audit_logs'), {
          action: 'USER_SIGN_IN_GOOGLE',
          userId: profileData.uid,
          details: `Signed in with Google: ${profileData.displayName}`,
          timestamp: Date.now(),
          severity: 'INFO',
        }).catch(() => undefined);
      }

      void notifyTelegramClientEvent(result.user, { type: 'SIGNIN', method: 'GOOGLE' });
      router.replace(getPostLoginDestination(profileData, result.user.email));
      router.refresh();
    } catch (error: any) {
      if (error?.code !== 'auth/popup-closed-by-user') {
        void notifyTelegramFailedSignIn(email);
        const code = error?.code || '';
        const description =
          code === 'auth/unauthorized-domain' || code === 'auth/operation-not-allowed'
            ? 'Google sign-in is not authorized for this domain yet. Please use email and password or contact support.'
            : code === 'auth/network-request-failed'
              ? 'Network error while connecting to Google. Check your internet connection and retry.'
              : 'Could not sign in with Google. Please try again.';
        setFormError(description);
        toast({
          variant: 'destructive',
          title: 'Login Failed',
          description,
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleManualLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    const normalizedEmail = email.trim().toLowerCase();
    const nextErrors: { email?: string; password?: string } = {};

    if (!normalizedEmail || !EMAIL_PATTERN.test(normalizedEmail)) {
      nextErrors.email = 'Enter a valid email address.';
    }
    if (!password) {
      nextErrors.password = 'Enter your password.';
    }

    if (nextErrors.email || nextErrors.password) {
      setFieldErrors(nextErrors);
      setFormError(nextErrors.email || nextErrors.password || 'Please check your details.');
      return;
    }

    setFieldErrors({});
    setFormError('');
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/auth/signin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: normalizedEmail,
          password,
          next: searchParams.get('next'),
          redirect: searchParams.get('redirect'),
        }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (payload.field === 'email' || payload.field === 'password') {
          setFieldErrors({ [payload.field]: payload.error });
        }
        throw new Error(payload.error || 'Invalid email or password.');
      }

      const supabase = getSupabaseBrowserClient();
      await supabase.auth.getSession();

      toast({
        title: 'Welcome back',
        description: 'You are now signed in.',
      });

      router.replace(payload.redirectTo || '/');
      router.refresh();
    } catch (error: any) {
      void notifyTelegramFailedSignIn(normalizedEmail);
      const message = error instanceof Error ? error.message : 'Invalid email or password.';
      setFormError(message);
      toast({
        variant: 'destructive',
        title: 'Sign In Failed',
        description: message,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (user && profileLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center space-y-4" role="status" aria-live="polite">
          <img src="/assets/logo.png" className="h-14 w-auto mx-auto animate-pulse" alt="Urban Auto Express" />
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Checking session…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full flex overflow-hidden bg-white relative font-sans">
      <div className="hidden lg:block w-1/2 relative overflow-hidden">
        <Image src={placeholderImages.auth.url} alt="Urban Auto Express" fill className="object-cover brightness-90" priority />
        <div className="absolute inset-0 bg-gradient-to-r from-black/40 to-transparent" />
        <div className="absolute bottom-12 left-12 z-20 text-white space-y-2">
          <h1 className="text-4xl font-black font-headline uppercase tracking-tighter text-white">Urban Express</h1>
          <p className="text-[10px] font-bold uppercase tracking-[0.4em] opacity-80">Lounge, Shop &amp; Detailing</p>
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center p-6 sm:p-8 relative bg-white overflow-y-auto">
        <Link
          href="/"
          className="mb-5 self-end inline-flex min-h-10 items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-[9px] font-black uppercase tracking-[0.18em] text-zinc-700 shadow-sm transition-colors hover:border-primary/40 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to Home
        </Link>

        <div className="w-full max-w-sm space-y-8">
          <div className="text-center">
            <img src="/assets/logo.png" alt="Urban Auto Express" className="h-16 w-auto mx-auto mb-6 object-contain" />
            <h2 className="text-xs font-black uppercase tracking-[0.35em] text-zinc-900">Welcome Back</h2>
            <p className="text-[11px] font-bold text-zinc-500 uppercase tracking-widest mt-2">Sign in to your account</p>
          </div>

          <div className="space-y-4">
            <Button
              type="button"
              onClick={handleGoogleLogin}
              disabled={isSubmitting}
              variant="outline"
              className="w-full h-14 rounded-2xl font-black uppercase text-[10px] tracking-widest gap-3 border-zinc-200 shadow-sm hover:bg-zinc-50 transition-all focus-visible:ring-2 focus-visible:ring-primary"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
              Continue with Google
            </Button>

            <div className="flex items-center gap-4 py-1">
              <div className="h-px bg-zinc-200 flex-1" />
              <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">or use email</span>
              <div className="h-px bg-zinc-200 flex-1" />
            </div>
          </div>

          <form className="space-y-4" onSubmit={handleManualLogin} noValidate>
            {/* Reserved status/error region to prevent layout jumps */}
            <div
              role="alert"
              aria-live="polite"
              className={cn(
                'min-h-[2.75rem] rounded-xl px-3.5 py-2.5 text-xs font-semibold flex items-center transition-opacity',
                formError
                  ? 'border border-red-200 bg-red-50 text-red-700 opacity-100'
                  : 'border border-transparent bg-transparent text-transparent opacity-0 pointer-events-none select-none'
              )}
            >
              {formError || '\u00A0'}
            </div>

            <div className="space-y-3">
              <div>
                <label htmlFor="login-email" className="sr-only">
                  Email address
                </label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" aria-hidden="true" />
                  <Input
                    id="login-email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (fieldErrors.email) setFieldErrors((prev) => ({ ...prev, email: undefined }));
                    }}
                    placeholder="Email address"
                    aria-invalid={Boolean(fieldErrors.email)}
                    aria-describedby={fieldErrors.email ? 'login-email-error' : undefined}
                    className={cn(
                      'h-14 bg-zinc-50 border rounded-2xl pl-12 text-sm font-bold text-zinc-900 placeholder:text-zinc-500 focus-visible:ring-2 focus-visible:ring-primary',
                      fieldErrors.email ? 'border-red-400' : 'border-zinc-200'
                    )}
                    required
                  />
                </div>
                {fieldErrors.email && (
                  <p id="login-email-error" className="mt-1 px-1 text-xs font-semibold text-red-600">
                    {fieldErrors.email}
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="login-password" className="sr-only">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" aria-hidden="true" />
                  <Input
                    id="login-password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (fieldErrors.password) setFieldErrors((prev) => ({ ...prev, password: undefined }));
                    }}
                    placeholder="Password"
                    aria-invalid={Boolean(fieldErrors.password)}
                    aria-describedby={fieldErrors.password ? 'login-password-error' : undefined}
                    className={cn(
                      'h-14 bg-zinc-50 border rounded-2xl pl-12 pr-12 text-sm font-bold text-zinc-900 placeholder:text-zinc-500 focus-visible:ring-2 focus-visible:ring-primary',
                      fieldErrors.password ? 'border-red-400' : 'border-zinc-200'
                    )}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-zinc-500 hover:text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {fieldErrors.password && (
                  <p id="login-password-error" className="mt-1 px-1 text-xs font-semibold text-red-600">
                    {fieldErrors.password}
                  </p>
                )}
              </div>
            </div>

            <div className="flex justify-end px-1">
              <Link
                href="/forgot-password"
                className="text-[11px] font-black text-zinc-600 uppercase tracking-widest hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
              >
                Forgot password?
              </Link>
            </div>

            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-14 bg-zinc-900 text-white font-black rounded-2xl uppercase tracking-[0.25em] text-[11px] shadow-xl hover:bg-zinc-800 active:scale-[0.99] transition-all focus-visible:ring-2 focus-visible:ring-primary"
            >
              {isSubmitting ? (
                <span className="inline-flex items-center gap-2">
                  <RefreshCcw className="w-4 h-4 animate-spin" aria-hidden="true" />
                  Signing In…
                </span>
              ) : (
                'Sign In'
              )}
            </Button>
          </form>

          <div className="flex items-center justify-center gap-2 py-2">
            <span className="text-[11px] font-bold text-zinc-600 uppercase tracking-wider">New to Urban Express?</span>
            <Link
              href="/signup"
              className="text-[11px] font-black text-primary uppercase tracking-wider hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
            >
              Create Account
            </Link>
          </div>

          <div className="pt-4 flex flex-col items-center gap-3">
            <div className="flex items-center gap-2 text-[9px] font-black text-zinc-500 uppercase tracking-[0.25em]">
              <ShieldCheck className="w-3.5 h-3.5 text-primary" aria-hidden="true" /> Secure connection active
            </div>
            <p className="text-center text-[9px] font-bold text-zinc-400 uppercase tracking-widest">
              © {new Date().getFullYear()} Urban Auto Express
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
