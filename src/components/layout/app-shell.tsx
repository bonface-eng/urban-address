'use client';

import React, { useEffect, useState, useMemo, Suspense, useRef } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Sidebar } from './sidebar';
import { Header } from './header';
import { BottomNav } from './bottom-nav';
import { useUser, useDb, useDoc } from '@/lib/data';
import { doc } from '@/lib/db';
import { TooltipProvider } from '@/components/ui/tooltip';
import { useProfile } from '@/hooks/use-profile';
import { toast } from '@/hooks/use-toast';
import { TerminalLock } from '@/components/pos/terminal-lock';
import { BusinessUnit } from '@/lib/types';
import { VersionUpdateBriefing } from '@/components/shared/version-update';
import Snowfall from 'react-snowfall';

const AUTH_ROUTES = ['/login', '/signup', '/forgot-password'];

function AppShellContent({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useUser();
  const firestore = useDb();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { role, isSuperAdmin, isEmployee, isKitchen, loading: profileLoading, profile } = useProfile();
  const [mounted, setMounted] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [adminOtpCheck, setAdminOtpCheck] = useState<'checking' | 'verified' | 'required'>('checking');
  const previousStaffPath = useRef<string | null>(null);

  // Check if we are in "Preview Mode" (rendered inside the mobile mockup)
  const isPreviewMode = searchParams?.get('uax_preview') === 'true';

  // Guard document requests with user session
  const permissionsRef = useMemo(() => {
    if (!firestore || !user) return null;
    return doc(firestore, 'system', 'permissions');
  }, [firestore, user]);

  const configRef = useMemo(() => {
    // system/config may contain payment gateway secrets; only super-admins need it.
    if (!firestore || !user || !isSuperAdmin) return null;
    return doc(firestore, 'system', 'config');
  }, [firestore, user, isSuperAdmin]);

  const { data: permMap } = useDoc<any>(permissionsRef);
  const { data: globalConfig } = useDoc<any>(configRef);

  const isAdminOtpRoute = pathname === '/admin-otp';
  const isEmailVerificationRoute = pathname === '/auth/verify-email';
  const isAuthRoute = AUTH_ROUTES.includes(pathname) || pathname.startsWith('/auth/') || isAdminOtpRoute;
  const isClientView = pathname === '/' || 
                       pathname.startsWith('/client') || 
                       pathname === '/about' || 
                       pathname === '/contact' || 
                       pathname === '/terms' || 
                       pathname === '/privacy' ||
                       pathname === '/legal' ||
                       pathname === '/download' ||
                       pathname.startsWith('/display');
  
  const isSetupPage = pathname === '/setup-profile';
  const isProtectedStaffRoute = !isAuthRoute && !isClientView && !isSetupPage;

  // Super administrators must complete one email OTP verification per UTC day
  // before any staff workspace or administrative screen is rendered.
  useEffect(() => {
    if (!mounted || authLoading || profileLoading || isPreviewMode) return;
    if (!user || !isSuperAdmin || isClientView || isSetupPage || isAdminOtpRoute) {
      setAdminOtpCheck('verified');
      return;
    }
    let active = true;
    setAdminOtpCheck('checking');
    user.getIdTokenResult(true).then((tokenResult) => {
      const today = new Date().toISOString().slice(0, 10);
      const verified = tokenResult.claims.adminOtpVerifiedDate === today;
      if (active) setAdminOtpCheck(verified ? 'verified' : 'required');
      if (!verified) router.replace('/admin-otp');
    }).catch(() => {
      if (active) setAdminOtpCheck('required');
      router.replace('/admin-otp');
    });
    return () => { active = false; };
  }, [mounted, authLoading, profileLoading, isPreviewMode, user, isSuperAdmin, isClientView, isSetupPage, isAdminOtpRoute, router]);

  // Browser back/forward can restore a page from the back-forward cache without
  // remounting React. Force a fresh document/auth check before showing staff data.
  useEffect(() => {
    if (isPreviewMode || !isProtectedStaffRoute) return;
    const handlePageShow = (event: PageTransitionEvent) => {
      if (!event.persisted) return;
      document.documentElement.style.visibility = 'hidden';
      window.location.reload();
    };
    window.addEventListener('pageshow', handlePageShow);
    return () => window.removeEventListener('pageshow', handlePageShow);
  }, [isPreviewMode, isProtectedStaffRoute]);

  useEffect(() => {
    const storedCollapsed = typeof window !== 'undefined' ? localStorage.getItem('urban_sidebar_collapsed') : null;
    setSidebarCollapsed(storedCollapsed === 'true');
    setMounted(true);
  }, []);

  // Keep a server-verified heartbeat for the Telegram active-account roster.
  // The monitor reports only accounts seen within the last four minutes.
  useEffect(() => {
    if (!mounted || authLoading || profileLoading || isPreviewMode || !user) return;
    let cancelled = false;
    const heartbeat = async () => {
      try {
        const token = await user.getIdToken();
        if (cancelled) return;
        await fetch('/api/telegram/presence', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store',
          keepalive: true,
        });
      } catch {
        // Presence telemetry is best-effort and must not interrupt the session.
      }
    };
    void heartbeat();
    const interval = window.setInterval(() => { void heartbeat(); }, 180_000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [mounted, authLoading, profileLoading, isPreviewMode, user]);

  // Record each authenticated staff page transition on the server. The
  // server validates the staff role and applies a short duplicate-event window.
  useEffect(() => {
    if (!mounted || authLoading || profileLoading || isPreviewMode || !user || !isProtectedStaffRoute || (!isEmployee && !isSuperAdmin)) {
      previousStaffPath.current = pathname;
      return;
    }
    const fromPath = previousStaffPath.current;
    previousStaffPath.current = pathname;
    if (!fromPath || fromPath === pathname) return;
    let cancelled = false;
    void user.getIdToken().then(token => {
      if (cancelled) return;
      return fetch('/api/telemetry/navigation', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ fromPath, toPath: pathname }),
        cache: 'no-store',
        keepalive: true,
      });
    }).catch(error => console.warn('[STAFF_NAVIGATION_LOG]', error));
    return () => { cancelled = true; };
  }, [mounted, authLoading, profileLoading, isPreviewMode, user, isProtectedStaffRoute, isEmployee, isSuperAdmin, pathname]);

  const isIncomplete = useMemo(() => {
    if (profileLoading || !profile || (!isEmployee && !isSuperAdmin)) return false;
    const hasName = !!profile.displayName && profile.displayName !== profile.email;
    const hasPhone = !!profile.phoneNumber;
    const hasMpesa = !!profile.mpesaNumber;
    const hasPhoto = !!profile.photoURL;
    return !hasName || !hasPhone || !hasMpesa || !hasPhoto;
  }, [profile, isEmployee, isSuperAdmin, profileLoading]);

  useEffect(() => {
    if (!mounted || authLoading || profileLoading || isPreviewMode) return;
    if (!user) {
      if (!isAuthRoute && !isClientView) router.replace('/login');
      return;
    }
    if (isAuthRoute) {
      if (isAdminOtpRoute || isEmailVerificationRoute) return;
      router.replace(isKitchen ? '/kds' : (isEmployee || isSuperAdmin) ? '/dashboard' : '/');
      return;
    }
    if (!isEmployee && !isSuperAdmin && !isClientView) {
      router.replace('/');
      return;
    }

    if (!isClientView && !isSetupPage && isIncomplete) {
      const hasReminded = sessionStorage.getItem('uax_setup_reminded');
      if (!hasReminded) {
        router.replace('/setup-profile');
        return;
      }
    }

    if (!isSuperAdmin && permMap && role && !isClientView && !isSetupPage) {
      const baseline = ['/dashboard', '/settings'];
      const allowedPaths = permMap[role] || [];
      const isExplicitlyAllowed = allowedPaths.includes(pathname);

      if (!baseline.includes(pathname) && !isExplicitlyAllowed) {
        const units = profile?.assignedUnits || [];
        const isAuthorizedToStay = (role === 'CASHIER' || role === 'ATTENDANT' || role === 'STOREKEEPER' || role === 'KITCHEN');

        if (isAuthorizedToStay) {
          const departmentalPages = ['/lounge', '/store', '/carwash/pos', '/carwash', '/attendants', '/kds'];
          
          if (departmentalPages.includes(pathname)) {
            let authorized = false;
            if (units.includes('LOUNGE') && (pathname === '/lounge' || pathname === '/kds')) authorized = true;
            if (role === 'KITCHEN' && pathname === '/kds') authorized = true;
            if (units.includes('STORE') && pathname === '/store') authorized = true;
            if (units.includes('CARWASH') && ['/carwash/pos', '/carwash', '/attendants'].includes(pathname)) authorized = true;

            if (!authorized && units.length > 0) {
              const redirectMap: any = { 'LOUNGE': '/lounge', 'STORE': '/store', 'CARWASH': '/carwash/pos' };
              const fallback = isKitchen ? '/kds' : (redirectMap[units[0]] || '/dashboard');
              router.replace(fallback);
              return;
            }
          }
        }
        if (!baseline.includes(pathname)) {
          router.replace(isKitchen ? '/kds' : '/dashboard');
        }
      }
    }
  }, [mounted, authLoading, profileLoading, user, role, pathname, router, isAuthRoute, isSuperAdmin, profile, permMap, isEmployee, isClientView, isIncomplete, isSetupPage, isKitchen, isPreviewMode]);

  const toggleSidebar = () => {
    const newState = !sidebarCollapsed;
    setSidebarCollapsed(newState);
    localStorage.setItem('urban_sidebar_collapsed', String(newState));
  };

  const getUnitContext = (): BusinessUnit | undefined => {
    if (pathname.startsWith('/lounge')) return 'LOUNGE';
    if (pathname.startsWith('/store')) return 'STORE';
    if (pathname.startsWith('/carwash/pos')) return 'CARWASH';
    return undefined;
  };

  if (!mounted) return null;

  if (!isPreviewMode && isProtectedStaffRoute && isSuperAdmin && adminOtpCheck !== 'verified') {
    return <div className="min-h-screen bg-white flex items-center justify-center px-6"><div className="text-center space-y-3" role="status" aria-live="polite"><div className="mx-auto h-8 w-8 rounded-full border-2 border-zinc-200 border-t-primary animate-spin" /><p className="text-xs font-bold uppercase tracking-widest text-zinc-500">Verifying administrator access…</p></div></div>;
  }

  // Never render staff/admin content while the auth session is restoring or has no user.
  if (!isPreviewMode && isProtectedStaffRoute && (authLoading || profileLoading || !user)) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center px-6">
        <div className="text-center space-y-3" role="status" aria-live="polite">
          <div className="mx-auto h-8 w-8 rounded-full border-2 border-zinc-200 border-t-primary animate-spin" />
          <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">Verifying your account…</p>
        </div>
      </div>
    );
  }

  const visualTheme = globalConfig?.visualTheme || 'NONE';
  const showSnow = visualTheme === 'SNOW';
  const showCelebration = visualTheme === 'CELEBRATION';

  // If in Preview Mode, render only the content to look like a standalone app
  if (isPreviewMode) {
    return (
      <div className="min-h-screen bg-white">
        {children}
      </div>
    );
  }

  if (isAuthRoute || isClientView || isSetupPage) {
    return (
      <div className="min-h-screen bg-white relative">
        {showSnow && <Snowfall style={{ position: 'fixed', width: '100vw', height: '100vh', zIndex: 10000, pointerEvents: 'none' }} />}
        {showCelebration && <Snowfall color="#FFD700" snowflakeCount={150} style={{ position: 'fixed', width: '100vw', height: '100vh', zIndex: 10000, pointerEvents: 'none' }} />}
        {children}
        {!isAuthRoute && <VersionUpdateBriefing />}
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={0}>
      <TerminalLock unit={getUnitContext()}>
        <div className="flex h-[100dvh] min-h-0 flex-col overflow-hidden bg-[#f1f3f6] font-sans text-zinc-900 relative">
          {showSnow && <Snowfall style={{ position: 'fixed', width: '100vw', height: '100vh', zIndex: 10000, pointerEvents: 'none' }} />}
          {showCelebration && <Snowfall color="#FFD700" snowflakeCount={150} style={{ position: 'fixed', width: '100vw', height: '100vh', zIndex: 10000, pointerEvents: 'none' }} />}
          <Header />
          <div className="relative flex min-h-0 flex-1 overflow-hidden">
            <Sidebar isCollapsed={sidebarCollapsed} onToggle={toggleSidebar} />
            <main id="app-main-content" className="app-main min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain px-3 pb-28 pt-4 md:px-5 md:py-5 md:pb-4 flex flex-col no-scrollbar">
              <div className="flex-1">
                {children}
              </div>
              <footer className="py-4 bg-transparent text-center shrink-0">
                <p className="text-[8px] font-black text-zinc-300 uppercase tracking-[0.4em]">powered by milleast global</p>
              </footer>
            </main>
          </div>
          <BottomNav />
          <VersionUpdateBriefing />
        </div>
      </TerminalLock>
    </TooltipProvider>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={null}>
      <AppShellContent>{children}</AppShellContent>
    </Suspense>
  );
}