'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { ArrowLeft, CheckCircle2, Eye, EyeOff, Lock, Mail, RefreshCcw, ShieldCheck, User as UserIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { useAuth, useDb, useUser } from '@/lib/data';
import {
  doc,
  getDoc,
  getSupabaseBrowserClient,
  GoogleAuthProvider,
  setDoc,
  signInWithPopup,
} from '@/lib/db';
import { useProfile } from '@/hooks/use-profile';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { notifyTelegramClientEvent } from '@/lib/telegram/client-events';
import { getRoleHomeRoute } from '@/lib/role-routing';
import placeholderImages from '@/app/lib/placeholder-images.json';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TERMS_VERSION = '2024-08';

type FieldErrors = {
  name?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
  acceptTerms?: string;
};

export default function SignUpPage() {
  const { user, loading: authLoading } = useUser();
  const auth = useAuth();
  const firestore = useDb();
  const router = useRouter();
  const { role, loading: profileLoading, isSuperAdmin, profile } = useProfile();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [marketingOptIn, setMarketingOptIn] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  useEffect(() => {
    if (!authLoading && user && !profileLoading) {
      router.replace(
        getRoleHomeRoute({
          role,
          email: user.email,
          isSuperAdmin,
          assignedUnits: profile?.assignedUnits,
        })
      );
    }
  }, [authLoading, user, role, isSuperAdmin, profile, profileLoading, router]);

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
    if (passwordStrength <= 25) return 'bg-red-500';
    if (passwordStrength <= 50) return 'bg-amber-500';
    if (passwordStrength <= 75) return 'bg-blue-500';
    return 'bg-green-500';
  }, [passwordStrength]);

  const strengthLabel =
    passwordStrength <= 25 ? 'Weak' : passwordStrength <= 50 ? 'Fair' : passwordStrength <= 75 ? 'Good' : 'Strong';

  const handleManualSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    const fullName = name.trim();
    const normalizedEmail = email.trim().toLowerCase();
    const nextErrors: FieldErrors = {};

    if (!fullName || fullName.length < 2) {
      nextErrors.name = 'Enter your full name (at least 2 characters).';
    }
    if (!normalizedEmail || !EMAIL_PATTERN.test(normalizedEmail)) {
      nextErrors.email = 'Enter a valid email address.';
    }
    if (password.length < 8 || passwordStrength < 50) {
      nextErrors.password = 'Use at least 8 characters and include an uppercase letter, number, or symbol.';
    }
    if (password !== confirmPassword) {
      nextErrors.confirmPassword = 'Passwords do not match.';
    }
    if (!acceptTerms) {
      nextErrors.acceptTerms = 'Please accept the Terms and Conditions to continue.';
    }

    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors(nextErrors);
      setFormError(
        nextErrors.name ||
          nextErrors.email ||
          nextErrors.password ||
          nextErrors.confirmPassword ||
          nextErrors.acceptTerms ||
          'Please fix the highlighted fields.'
      );
      return;
    }

    setFieldErrors({});
    setFormError('');
    setFormSuccess('');
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName,
          email: normalizedEmail,
          password,
          confirmPassword,
          acceptTerms,
          marketingOptIn,
        }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (payload.field === 'fullName') setFieldErrors({ name: payload.error });
        else if (payload.field === 'email' || payload.field === 'password' || payload.field === 'confirmPassword' || payload.field === 'acceptTerms') {
          setFieldErrors({ [payload.field]: payload.error });
        }
        throw new Error(payload.error || 'Could not complete registration. Please try again.');
      }

      const supabase = getSupabaseBrowserClient();
      await supabase.auth.getSession();

      setFormSuccess('Your account is ready! Redirecting…');
      toast({
        title: 'Welcome to Urban Express',
        description: 'Your account is ready and you are signed in.',
      });

      router.replace(payload.redirectTo || '/');
      router.refresh();
    } catch (error: any) {
      const message = error instanceof Error ? error.message : 'Could not complete registration. Please try again.';
      setFormError(message);
      toast({
        variant: 'destructive',
        title: 'Registration Failed',
        description: message,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleSignUp = async () => {
    if (!acceptTerms) {
      const msg = 'Please review and accept the Terms and Conditions before continuing with Google.';
      setFieldErrors({ acceptTerms: msg });
      setFormError(msg);
      toast({ variant: 'destructive', title: 'Accept Terms First', description: msg });
      return;
    }
    if (!auth || !firestore || isSubmitting) return;
    setFieldErrors({});
    setFormError('');
    setIsSubmitting(true);
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      const result = await signInWithPopup(auth, provider);

      const userRef = doc(firestore, 'users', result.user.uid);
      const userSnap = await getDoc(userRef);
      const acceptedAt = Date.now();

      if (!userSnap.exists()) {
        await setDoc(userRef, {
          uid: result.user.uid,
          email: result.user.email?.toLowerCase() || '',
          displayName: result.user.displayName || 'Urban Member',
          role: 'CLIENT',
          createdAt: acceptedAt,
          accountType: 'CLIENT',
          loyaltyPoints: 0,
          totalSpent: 0,
          termsAcceptedAt: acceptedAt,
          termsVersion: TERMS_VERSION,
          marketingOptIn,
          marketingConsent: marketingOptIn,
          ...(marketingOptIn ? { marketingConsentUpdatedAt: acceptedAt, marketingConsentSource: 'signup' } : {}),
        });
      } else {
        await setDoc(
          userRef,
          {
            termsAcceptedAt: acceptedAt,
            termsVersion: TERMS_VERSION,
          },
          { merge: true }
        );
      }
      if (!userSnap.exists()) await notifyTelegramClientEvent(result.user, { type: 'SIGNUP', name: result.user.displayName || name });
      if (marketingOptIn) {
        const idToken = await result.user.getIdToken();
        await fetch('/api/email/preferences', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + idToken },
          body: JSON.stringify({ marketingOptIn: true }),
        });
      }
      toast({ title: 'Welcome', description: 'Your account is ready.' });
    } catch (error: any) {
      if (error?.code !== 'auth/popup-closed-by-user') {
        const msg = 'Could not sync with Google. Please try again.';
        setFormError(msg);
        toast({
          variant: 'destructive',
          title: 'Sign Up Error',
          description: msg,
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (user && profileLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center space-y-4" role="status" aria-live="polite">
          <img src="/assets/logo.png" className="h-16 w-auto mx-auto animate-pulse" alt="Urban Auto Express" />
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Checking session…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full flex overflow-hidden bg-white relative">
      <div className="hidden lg:block w-1/2 relative overflow-hidden">
        <Image
          src={placeholderImages.auth.url}
          alt="Urban Auto Express"
          fill
          className="object-cover"
          priority
          sizes="50vw"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black/40 to-transparent" />
      </div>

      <div className="flex-1 flex flex-col items-center justify-center p-6 relative overflow-y-auto">
        <Link
          href="/"
          className="mb-5 self-end inline-flex min-h-10 items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-[9px] font-black uppercase tracking-[0.18em] text-zinc-700 shadow-sm transition-colors hover:border-primary/40 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to Home
        </Link>

        <div className="w-full max-w-sm space-y-6 relative z-10 py-2">
          <div className="text-center">
            <img src="/assets/logo.png" alt="Urban Auto Express" className="h-12 w-auto mx-auto mb-5 object-contain" />
            <h2 className="text-xs font-black uppercase tracking-[0.35em] text-zinc-900">Create Account</h2>
            <p className="text-[11px] font-bold text-zinc-500 uppercase tracking-widest mt-2">Join Urban Express today</p>
          </div>

          <div className="space-y-3">
            <div className="flex items-start gap-3 rounded-xl border border-zinc-200 bg-zinc-50 p-3">
              <Checkbox
                id="signup-terms"
                checked={acceptTerms}
                onCheckedChange={(checked) => {
                  setAcceptTerms(checked === true);
                  if (fieldErrors.acceptTerms) setFieldErrors((prev) => ({ ...prev, acceptTerms: undefined }));
                }}
                aria-invalid={Boolean(fieldErrors.acceptTerms)}
                className="mt-0.5 rounded-md border-zinc-400"
              />
              <label htmlFor="signup-terms" className="text-xs leading-relaxed font-semibold text-zinc-700 cursor-pointer">
                I have read and agree to the{' '}
                <Link href="/terms" className="font-black text-primary underline underline-offset-2" target="_blank" rel="noopener noreferrer">
                  Terms and Conditions
                </Link>{' '}
                and acknowledge the{' '}
                <Link href="/privacy" className="font-black text-primary underline underline-offset-2" target="_blank" rel="noopener noreferrer">
                  Privacy Policy
                </Link>
                .
              </label>
            </div>
            <div className="flex items-start gap-3 rounded-xl border border-zinc-200 bg-white p-3">
              <Checkbox
                id="signup-marketing"
                checked={marketingOptIn}
                onCheckedChange={(checked) => setMarketingOptIn(checked === true)}
                className="mt-0.5 rounded-md border-zinc-400"
              />
              <label htmlFor="signup-marketing" className="cursor-pointer text-xs leading-relaxed font-semibold text-zinc-600">
                I would like to receive occasional offers, service updates and news from Urban Auto Express by email (optional).
              </label>
            </div>

            <Button
              type="button"
              onClick={handleGoogleSignUp}
              disabled={isSubmitting || !acceptTerms}
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

          <form className="space-y-4" onSubmit={handleManualSignUp} noValidate>
            {/* Reserved status/error region to prevent layout jumps */}
            <div
              role="alert"
              aria-live="polite"
              className={cn(
                'min-h-[2.75rem] rounded-xl px-3.5 py-2.5 text-xs font-semibold flex items-center gap-2 transition-opacity',
                formSuccess
                  ? 'border border-green-200 bg-green-50 text-green-800 opacity-100'
                  : formError
                    ? 'border border-red-200 bg-red-50 text-red-700 opacity-100'
                    : 'border border-transparent bg-transparent text-transparent opacity-0 pointer-events-none select-none'
              )}
            >
              {formSuccess ? (
                <>
                  <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>{formSuccess}</span>
                </>
              ) : (
                <span>{formError || '\u00A0'}</span>
              )}
            </div>

            <div className="space-y-3">
              <div>
                <label htmlFor="signup-name" className="sr-only">
                  Full Name
                </label>
                <div className="relative">
                  <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" aria-hidden="true" />
                  <Input
                    id="signup-name"
                    name="name"
                    autoComplete="name"
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      if (fieldErrors.name) setFieldErrors((prev) => ({ ...prev, name: undefined }));
                    }}
                    placeholder="Full Name"
                    aria-invalid={Boolean(fieldErrors.name)}
                    aria-describedby={fieldErrors.name ? 'signup-name-error' : undefined}
                    className={cn(
                      'h-14 bg-zinc-50 border rounded-2xl pl-12 text-sm font-bold text-zinc-900 placeholder:text-zinc-500 focus-visible:ring-2 focus-visible:ring-primary',
                      fieldErrors.name ? 'border-red-400' : 'border-zinc-200'
                    )}
                    required
                  />
                </div>
                {fieldErrors.name && (
                  <p id="signup-name-error" className="mt-1 px-1 text-xs font-semibold text-red-600">
                    {fieldErrors.name}
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="signup-email" className="sr-only">
                  Email address
                </label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" aria-hidden="true" />
                  <Input
                    id="signup-email"
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
                    aria-describedby={fieldErrors.email ? 'signup-email-error' : undefined}
                    className={cn(
                      'h-14 bg-zinc-50 border rounded-2xl pl-12 text-sm font-bold text-zinc-900 placeholder:text-zinc-500 focus-visible:ring-2 focus-visible:ring-primary',
                      fieldErrors.email ? 'border-red-400' : 'border-zinc-200'
                    )}
                    required
                  />
                </div>
                {fieldErrors.email && (
                  <p id="signup-email-error" className="mt-1 px-1 text-xs font-semibold text-red-600">
                    {fieldErrors.email}
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="signup-password" className="sr-only">
                  Create Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" aria-hidden="true" />
                  <Input
                    id="signup-password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (fieldErrors.password) setFieldErrors((prev) => ({ ...prev, password: undefined }));
                    }}
                    placeholder="Create Password"
                    aria-invalid={Boolean(fieldErrors.password)}
                    aria-describedby="signup-password-rules"
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
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-zinc-500 hover:text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                <div id="signup-password-rules" className="mt-2 space-y-1.5 px-1">
                  <div className="h-1 w-full bg-zinc-100 rounded-full overflow-hidden">
                    <div className={cn('h-full transition-all duration-300', strengthColor)} style={{ width: `${passwordStrength}%` }} />
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[11px] font-medium text-zinc-600">
                      At least 8 characters with an uppercase letter, number, or symbol.
                    </p>
                    {password && (
                      <span
                        className={cn(
                          'text-[10px] font-black uppercase tracking-wider shrink-0',
                          passwordStrength <= 25
                            ? 'text-red-600'
                            : passwordStrength <= 50
                              ? 'text-amber-600'
                              : passwordStrength <= 75
                                ? 'text-blue-600'
                                : 'text-green-600'
                        )}
                      >
                        {strengthLabel}
                      </span>
                    )}
                  </div>
                  {fieldErrors.password && (
                    <p className="text-xs font-semibold text-red-600">{fieldErrors.password}</p>
                  )}
                </div>
              </div>

              <div>
                <label htmlFor="signup-confirm-password" className="sr-only">
                  Confirm Password
                </label>
                <div className="relative">
                  <ShieldCheck className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" aria-hidden="true" />
                  <Input
                    id="signup-confirm-password"
                    name="confirmPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value);
                      if (fieldErrors.confirmPassword) setFieldErrors((prev) => ({ ...prev, confirmPassword: undefined }));
                    }}
                    placeholder="Confirm Password"
                    aria-invalid={Boolean(fieldErrors.confirmPassword)}
                    aria-describedby={fieldErrors.confirmPassword ? 'signup-confirm-error' : undefined}
                    className={cn(
                      'h-14 bg-zinc-50 border rounded-2xl pl-12 pr-12 text-sm font-bold text-zinc-900 placeholder:text-zinc-500 focus-visible:ring-2 focus-visible:ring-primary',
                      fieldErrors.confirmPassword ? 'border-red-400' : 'border-zinc-200'
                    )}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    aria-label={showConfirmPassword ? 'Hide confirmation password' : 'Show confirmation password'}
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-zinc-500 hover:text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {fieldErrors.confirmPassword && (
                  <p id="signup-confirm-error" className="mt-1 px-1 text-xs font-semibold text-red-600">
                    {fieldErrors.confirmPassword}
                  </p>
                )}
              </div>
            </div>

            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-14 bg-primary hover:bg-primary/90 text-white font-black rounded-2xl uppercase tracking-[0.2em] text-[11px] shadow-xl shadow-primary/20 focus-visible:ring-2 focus-visible:ring-primary"
            >
              {isSubmitting ? (
                <span className="inline-flex items-center gap-2">
                  <RefreshCcw className="w-4 h-4 animate-spin" aria-hidden="true" />
                  Creating Account…
                </span>
              ) : (
                'Sign Up'
              )}
            </Button>
          </form>

          <p className="text-center text-[11px] font-black uppercase tracking-widest text-zinc-600">
            Already have an account?{' '}
            <Link href="/login" className="text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded">
              Sign In
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
