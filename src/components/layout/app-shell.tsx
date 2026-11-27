'use client';

import React, { useEffect, useState, useMemo, Suspense } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Sidebar } from './sidebar';
import { Header } from './header';
import { BottomNav } from './bottom-nav';
import { useUser, useFirestore, useDoc } from '@/firebase';
import { doc } from 'firebase/firestore';
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
  const firestore = useFirestore();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { role, isSuperAdmin, isEmployee, isKitchen, loading: profileLoading, profile } = useProfile();
  const [mounted, setMounted] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);

  // Check if we are in "Preview Mode" (rendered inside the mobile mockup)
  const isPreviewMode = searchParams?.get('uax_preview') === 'true';

  // Guard document requests with user session
  const permissionsRef = useMemo(() => {
    if (!firestore || !user) return null;
    return doc(firestore, 'system', 'permissions');
  }, [firestore, user]);

  const configRef = useMemo(() => {
    if (!firestore || !user) return null;
    return doc(firestore, 'system', 'config');
  }, [firestore, user]);

  const { data: permMap } = useDoc<any>(permissionsRef);
  const { data: globalConfig } = useDoc<any>(configRef);

  const isAuthRoute = AUTH_ROUTES.includes(pathname) || pathname.startsWith('/auth/');
  const isClientView = pathname === '/' || 
                       pathname.startsWith('/client') || 
                       pathname === '/about' || 
                       pathname === '/contact' || 
                       pathname === '/terms' || 
                       pathname === '/privacy' ||
                       pathname === '/download';
  
  const isSetupPage = pathname === '/setup-profile';

  useEffect(() => {
    const storedCollapsed = typeof window !== 'undefined' ? localStorage.getItem('urban_sidebar_collapsed') : null;
    setSidebarCollapsed(storedCollapsed === 'false' ? false : true);
    setMounted(true);
  }, []);

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

  // Public content must be present in the initial HTML for search crawlers.
  // Keep staff and authentication screens behind the existing mount gate.
  if (!mounted && !isClientView) return null;

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
      <div className="flex flex-col h-screen bg-zinc-50 text-zinc-900 font-sans overflow-hidden relative">
        {showSnow && <Snowfall style={{ position: 'fixed', width: '100vw', height: '100vh', zIndex: 10000, pointerEvents: 'none' }} />}
        {showCelebration && <Snowfall color="#FFD700" snowflakeCount={150} style={{ position: 'fixed', width: '100vw', height: '100vh', zIndex: 10000, pointerEvents: 'none' }} />}
        <Header />
        <div className="flex flex-1 overflow-hidden relative pb-20 md:pb-0">
          <Sidebar isCollapsed={sidebarCollapsed} onToggle={toggleSidebar} />
          <main className="flex-1 overflow-y-auto pb-4 px-3 md:px-6 pt-4 flex flex-col no-scrollbar">
            <div className="flex-1">
              <TerminalLock unit={getUnitContext()}>
                {children}
              </TerminalLock>
            </div>
            <footer className="py-4 bg-transparent text-center shrink-0">
              <p className="text-[8px] font-black text-zinc-300 uppercase tracking-[0.4em]">powered by milleast global</p>
            </footer>
          </main>
        </div>
        <BottomNav />
        <VersionUpdateBriefing />
      </div>
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