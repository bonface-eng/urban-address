'use client';

import React, { useMemo, Suspense } from 'react';
import { ShoppingCart, LogOut, Package, User, LayoutDashboard, ArrowUpRight, Home, Store, Car, Coffee, LogIn } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { SYSTEM_CONFIG } from '@/lib/config';
import { useUser, useAuth, useFirestore, useDoc } from '@/firebase';
import { signOut } from 'firebase/auth';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { CartDrawer } from '@/components/cart/cart-drawer';
import { Notifications } from '@/components/layout/notifications';
import { useCart } from '@/hooks/use-cart';
import { useProfile } from '@/hooks/use-profile';
import { doc } from 'firebase/firestore';
import Snowfall from 'react-snowfall';

function ClientLayoutContent({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user, loading: authLoading } = useUser();
  const { isEmployee, isSuperAdmin, role } = useProfile();
  const { totalItems } = useCart();
  const auth = useAuth();
  const firestore = useFirestore();

  // Check if we are in "Preview Mode" (rendered inside the mobile mockup)
  const isPreviewMode = searchParams?.get('uax_preview') === 'true';

  // Customer data and payment workflows must never render for signed-out visitors.
  const isPrivateCustomerRoute = useMemo(() => {
    const protectedRoots = ['/client/orders', '/client/profile', '/client/payment', '/client/success'];
    return protectedRoots.some((root) => pathname === root || pathname.startsWith(root + '/'));
  }, [pathname]);

  // Revalidate protected customer pages after a browser back/forward cache restore.
  React.useEffect(() => {
    if (isPreviewMode || !isPrivateCustomerRoute) return;
    const handlePageShow = (event: PageTransitionEvent) => {
      if (!event.persisted) return;
      document.documentElement.style.visibility = 'hidden';
      window.location.reload();
    };
    window.addEventListener('pageshow', handlePageShow);
    return () => window.removeEventListener('pageshow', handlePageShow);
  }, [isPreviewMode, isPrivateCustomerRoute]);

  React.useEffect(() => {
    if (isPreviewMode || authLoading || !isPrivateCustomerRoute || user) return;
    const returnTo = pathname + (typeof window !== 'undefined' ? window.location.search : '');
    router.replace('/login?redirect=' + encodeURIComponent(returnTo));
  }, [authLoading, isPrivateCustomerRoute, isPreviewMode, pathname, router, user]);

  const configRef = useMemo(() => {
    if (!firestore || !user) return null;
    return doc(firestore, 'system', 'config');
  }, [firestore, user]);

  const { data: globalConfig } = useDoc<any>(configRef);

  const handleLogout = async () => {
    if (auth) {
      await signOut(auth);
      router.replace('/login');
    }
  };

  const navLinks = [
    { href: '/', label: 'Home' },
    { href: '/client/lounge', label: 'Lounge' },
    { href: '/client/store', label: 'Auto Accessories' },
    { href: '/client/carwash', label: 'Carwash' },
    { href: '/download', label: 'Mobile App' },
    { href: 'https://www.nakurucutclippers.com/', label: 'Spa' },
  ];

  const mobileLinks = [
    { href: '/', label: 'Home', icon: Home },
    { href: '/client/store', label: 'Shop', icon: Store },
    { href: '/client/carwash', label: 'Carwash', icon: Car },
    { href: '/client/lounge', label: 'Lounge', icon: Coffee },
    user
      ? { href: '/client/profile', label: 'Profile', icon: User }
      : { href: '/login', label: 'Sign In', icon: LogIn },
  ];

  const canAccessStaffPortal = (isEmployee || isSuperAdmin);
  const visualTheme = globalConfig?.visualTheme || 'NONE';

  // If in Preview Mode, return only children to fit perfectly inside the mockup iframe
  if (isPreviewMode) {
    return <main className="flex-1 bg-white">{children}</main>;
  }

  if (isPrivateCustomerRoute && (authLoading || !user)) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center px-6">
        <div className="text-center space-y-3" role="status" aria-live="polite">
          <div className="mx-auto h-8 w-8 rounded-full border-2 border-zinc-200 border-t-primary animate-spin" />
          <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">Verifying your account…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FDFDFD] flex flex-col relative text-zinc-900 selection:bg-primary/10">
      {visualTheme === 'SNOW' && <Snowfall style={{ position: 'fixed', width: '100vw', height: '100vh', zIndex: 10000, pointerEvents: 'none' }} />}
      {visualTheme === 'CELEBRATION' && <Snowfall color="#FFD700" snowflakeCount={150} style={{ position: 'fixed', width: '100vw', height: '100vh', zIndex: 10000, pointerEvents: 'none' }} />}
      
      <header className="bg-white/95 backdrop-blur-md border-b border-zinc-200/80 h-16 md:h-[72px] flex items-center sticky top-0 z-[1000]">
        <div className="w-full px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-5">
          <Link href="/" className="flex items-center gap-3 shrink-0">
            <img 
              src="/assets/logo.png" 
              alt={SYSTEM_CONFIG.BUSINESS.NAME} 
              className="h-10 w-auto object-contain"
            />
          </Link>

          <nav className="hidden lg:flex flex-1 min-w-0 items-center justify-start gap-4 xl:gap-7 pl-5 whitespace-nowrap">
            {navLinks.map((link) => (
              <HeaderLink key={link.href} href={link.href} active={pathname === link.href || (link.href !== '/' && pathname.startsWith(link.href))}>
                {link.label}
              </HeaderLink>
            ))}
          </nav>
          
          <div className="flex items-center gap-2 xl:gap-3 shrink-0 whitespace-nowrap">
            {canAccessStaffPortal && (
              <Button 
                onClick={() => router.push('/dashboard')}
                className="hidden md:flex h-9 px-3.5 bg-white text-zinc-600 border border-zinc-200 rounded-md font-semibold normal-case text-xs tracking-normal gap-2 shadow-none hover:bg-zinc-50 hover:text-primary hover:border-orange-200 transition-colors active:scale-[.98] whitespace-nowrap"
              >
                <LayoutDashboard className="w-3.5 h-3.5 text-white" />
                Staff Workspace
              </Button>
            )}

            {user && <Notifications />}
            <div className="lg:hidden">
              <Button asChild variant="ghost" size="icon" aria-label="Open cart" className="relative rounded-xl hover:bg-zinc-50">
                <Link href="/client/cart">
                  <ShoppingCart className="w-5 h-5 text-zinc-700" />
                  {totalItems > 0 && (
                    <span className="absolute -top-1 -right-1 w-5 h-5 bg-primary text-white text-[9px] font-black rounded-lg flex items-center justify-center animate-in zoom-in">
                      {totalItems}
                    </span>
                  )}
                </Link>
              </Button>
            </div>
            <div className="hidden lg:block">
              <CartDrawer>
                <Button variant="ghost" size="icon" aria-label="Open cart drawer" className="relative rounded-xl hover:bg-zinc-50">
                  <ShoppingCart className="w-5 h-5 text-zinc-700" />
                  {totalItems > 0 && (
                    <span className="absolute -top-1 -right-1 w-5 h-5 bg-primary text-white text-[9px] font-black rounded-lg flex items-center justify-center animate-in zoom-in">
                      {totalItems}
                    </span>
                  )}
                </Button>
              </CartDrawer>
            </div>
            
            <div className="hidden lg:flex items-center gap-3">
              {!user ? (
                <Button variant="ghost" onClick={() => router.push('/login')} className="text-[10px] font-black uppercase tracking-widest px-5 h-11 rounded-xl">Sign In</Button>
              ) : (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button aria-label="Open profile menu" className="flex items-center gap-2 hover:bg-zinc-50 px-2 py-1 rounded-xl transition-all group shrink-0 active:scale-95 ml-1">
                      <span className="text-[10px] font-black uppercase tracking-widest text-zinc-700">Profile</span>
                      <Avatar className="h-10 w-10 rounded-full border-2 border-white shadow-sm ring-1 ring-zinc-200 transition-all group-hover:ring-primary/40">
                        <AvatarImage src={user.photoURL || undefined} alt={user.displayName || 'Profile avatar'} />
                        <AvatarFallback className="bg-orange-50 text-primary text-xs font-semibold">{(user.displayName || user.email || 'U').trim().charAt(0).toUpperCase()}</AvatarFallback>
                      </Avatar>
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-64 rounded-2xl border-none shadow-2xl p-2 mt-2">
                    <DropdownMenuLabel className="font-normal px-3 py-4">
                       <div className="flex flex-col gap-1">
                          <p className="text-sm font-black uppercase text-zinc-900">{user.displayName || 'Urban Member'}</p>
                          <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest">{role || 'CLIENT'}</p>
                       </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator className="bg-zinc-50" />
                    
                    <DropdownMenuItem onClick={() => router.push('/client/profile')} className="rounded-xl gap-3 py-3 cursor-pointer text-zinc-600">
                      <User className="w-4 h-4 text-zinc-400" />
                      <span className="text-xs font-bold uppercase tracking-widest">My Profile</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => router.push('/client/orders')} className="rounded-xl gap-3 py-3 cursor-pointer text-zinc-600">
                      <Package className="w-4 h-4 text-zinc-400" />
                      <span className="text-xs font-bold uppercase tracking-widest">My Orders</span>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator className="bg-zinc-50" />
                    <DropdownMenuItem onClick={handleLogout} className="rounded-xl gap-3 py-3 text-red-500 focus:text-red-600 focus:bg-red-50 cursor-pointer">
                      <LogOut className="w-4 h-4" />
                      <span className="text-xs font-bold uppercase tracking-widest">Sign Out</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>


          </div>
        </div>
      </header>

      <main className="flex-1 relative pb-[calc(5rem+env(safe-area-inset-bottom))] lg:pb-0">
        {children}
      </main>

      <nav aria-label="Customer navigation" className="lg:hidden fixed bottom-0 inset-x-0 z-[1100] border-t border-zinc-200 bg-white/95 backdrop-blur-lg pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto grid max-w-xl grid-cols-5">
          {mobileLinks.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || (href !== '/' && pathname.startsWith(href));
            return (
              <Link key={href} href={href} aria-current={active ? 'page' : undefined}
                className={cn("min-h-[64px] flex flex-col items-center justify-center gap-1 text-[10px] font-semibold transition-colors", active ? "text-primary" : "text-zinc-500 hover:text-zinc-900")}>
                {label === 'Profile' && user ? (
                  <Avatar className={cn("h-7 w-7 rounded-full border border-white shadow-sm ring-1", active ? "ring-primary" : "ring-zinc-200")}>
                    <AvatarImage src={user.photoURL || undefined} alt="Profile" />
                    <AvatarFallback className="bg-orange-50 text-primary text-[9px] font-semibold">{(user.displayName || user.email || 'U').trim().charAt(0).toUpperCase()}</AvatarFallback>
                  </Avatar>
                ) : (
                  <Icon className={cn("h-5 w-5", active && "stroke-[2.5px]")} />
                )}
                <span>{label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      <footer className="py-4 bg-transparent text-center shrink-0 hidden lg:block">
        <p className="text-[8px] font-black text-zinc-300 uppercase tracking-[0.4em]">
          powered by milleast global
        </p>
      </footer>
    </div>
  );
}

export function ClientLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={null}>
      <ClientLayoutContent>{children}</ClientLayoutContent>
    </Suspense>
  );
}

// Next.js App Router requires a default export from every route layout.
export default ClientLayout;

function HeaderLink({ href, active, children }: { href: string; active?: boolean; children: React.ReactNode }) {
  const isExternal = href.startsWith('http');
  if (isExternal) {
     return (
        <a 
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            "text-[10px] font-black uppercase tracking-[0.3em] transition-all text-zinc-400 hover:text-primary flex items-center gap-1"
          )}
        >
          {children}
          <ArrowUpRight className="w-3 h-3" />
        </a>
     )
  }
  return (
    <Link 
      href={href} 
      className={cn(
        "text-[10px] font-semibold uppercase tracking-[0.12em] whitespace-nowrap transition-colors",
        active ? "text-primary border-b-2 border-primary pb-1" : "text-zinc-400 hover:text-zinc-900"
      )}
    >
      {children}
    </Link>
  );
}