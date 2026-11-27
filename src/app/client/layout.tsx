'use client';

import React, { useMemo, Suspense } from 'react';
import { ShoppingCart, LogOut, Package, Menu, ChevronRight, User, LayoutDashboard, ArrowUpRight, Smartphone } from 'lucide-react';
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
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { CartDrawer } from '@/components/cart/cart-drawer';
import { useCart } from '@/hooks/use-cart';
import { useProfile } from '@/hooks/use-profile';
import { doc } from 'firebase/firestore';
import Snowfall from 'react-snowfall';

function ClientLayoutContent({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user } = useUser();
  const { isEmployee, isSuperAdmin, role } = useProfile();
  const { totalItems } = useCart();
  const auth = useAuth();
  const firestore = useFirestore();
  const [isMenuOpen, setIsMenuOpen] = React.useState(false);

  // Check if we are in "Preview Mode" (rendered inside the mobile mockup)
  const isPreviewMode = searchParams?.get('uax_preview') === 'true';

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
    setIsMenuOpen(false);
  };

  const navLinks = [
    { href: '/', label: 'Home' },
    { href: '/client/lounge', label: 'Lounge' },
    { href: '/client/store', label: 'Auto Accessories' },
    { href: '/client/carwash', label: 'Carwash' },
    { href: '/download', label: 'Mobile App' },
    { href: 'https://www.nakurucutclippers.com/', label: 'Spa' },
  ];

  const canAccessStaffPortal = (isEmployee || isSuperAdmin);
  const visualTheme = globalConfig?.visualTheme || 'NONE';

  // If in Preview Mode, return only children to fit perfectly inside the mockup iframe
  if (isPreviewMode) {
    return <main className="flex-1 bg-white">{children}</main>;
  }

  return (
    <div className="min-h-screen bg-[#FDFDFD] flex flex-col relative text-zinc-900 selection:bg-primary/10">
      {visualTheme === 'SNOW' && <Snowfall style={{ position: 'fixed', width: '100vw', height: '100vh', zIndex: 10000, pointerEvents: 'none' }} />}
      {visualTheme === 'CELEBRATION' && <Snowfall color="#FFD700" snowflakeCount={150} style={{ position: 'fixed', width: '100vw', height: '100vh', zIndex: 10000, pointerEvents: 'none' }} />}
      
      <header className="bg-white border-b border-zinc-100 h-20 flex items-center sticky top-0 z-[1000] shadow-sm">
        <div className="max-w-7xl mx-auto w-full px-6 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <img 
              src="/assets/logo.png" 
              alt={SYSTEM_CONFIG.BUSINESS.NAME} 
              className="h-10 w-auto object-contain"
            />
          </Link>

          <nav className="hidden lg:flex items-center gap-10">
            {navLinks.map((link) => (
              <HeaderLink key={link.href} href={link.href} active={pathname === link.href || (link.href !== '/' && pathname.startsWith(link.href))}>
                {link.label}
              </HeaderLink>
            ))}
          </nav>
          
          <div className="flex items-center gap-4">
            {canAccessStaffPortal && (
              <Button 
                onClick={() => router.push('/dashboard')}
                className="hidden md:flex h-11 px-6 bg-primary text-white rounded-xl font-black uppercase text-[10px] tracking-widest gap-2 shadow-xl shadow-primary/20 hover:bg-orange-600 transition-all active:scale-95 border-none"
              >
                <LayoutDashboard className="w-3.5 h-3.5 text-white" />
                Staff Hub
              </Button>
            )}

            <CartDrawer>
              <Button variant="ghost" size="icon" className="relative rounded-xl hover:bg-zinc-50">
                <ShoppingCart className="w-5 h-5 text-zinc-700" />
                {totalItems > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-primary text-white text-[9px] font-black rounded-lg flex items-center justify-center animate-in zoom-in">
                    {totalItems}
                  </span>
                )}
              </Button>
            </CartDrawer>
            
            <div className="hidden lg:flex items-center gap-3">
              {!user ? (
                <>
                  <Button variant="ghost" onClick={() => router.push('/login')} className="text-[10px] font-black uppercase tracking-widest px-4 h-11 rounded-xl">Sign In</Button>
                  <Button onClick={() => router.push('/signup')} className="bg-primary text-white text-[10px] font-black uppercase tracking-widest px-6 h-11 rounded-xl shadow-lg shadow-primary/20">Join</Button>
                </>
              ) : (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="flex items-center gap-2 hover:bg-zinc-50 p-1 rounded-xl transition-all group shrink-0 active:scale-95 ml-1">
                      <Avatar className="h-10 w-10 rounded-xl border-2 border-transparent group-hover:border-primary/20 transition-all">
                        <AvatarImage src={user.photoURL || undefined} />
                        <AvatarFallback className="bg-primary/10 text-primary text-[10px] font-black">{user.displayName?.[0] || 'U'}</AvatarFallback>
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

            <div className="lg:hidden">
              <Sheet open={isMenuOpen} onOpenChange={setIsMenuOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" className="rounded-xl hover:bg-zinc-50">
                    <Menu className="w-5 h-5 text-zinc-700" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-[300px] border-none bg-white p-0 shadow-2xl flex flex-col">
                  <SheetHeader className="p-6 border-b border-zinc-50">
                    <SheetTitle className="text-left flex items-center gap-3">
                      {user ? (
                        <>
                          <Avatar className="h-10 w-10 rounded-xl border border-zinc-100">
                            <AvatarImage src={user.photoURL || undefined} />
                            <AvatarFallback className="bg-primary/10 text-primary font-black text-[10px]">{user.displayName?.[0] || 'U'}</AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="text-xs font-black uppercase text-zinc-900 truncate tracking-tight">{user.displayName || 'Member'}</p>
                            <p className="text-[8px] font-bold text-zinc-400 uppercase tracking-widest">{role}</p>
                          </div>
                        </>
                      ) : (
                        <div className="py-2">
                          <p className="text-xl font-black uppercase font-headline tracking-tighter text-zinc-900">Welcome.</p>
                        </div>
                      )}
                    </SheetTitle>
                  </SheetHeader>

                  <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6">
                    {canAccessStaffPortal && (
                      <div className="px-1 mb-4">
                        <Button 
                          onClick={() => { router.push('/dashboard'); setIsMenuOpen(false); }}
                          className="w-full h-14 bg-primary text-white rounded-xl font-black uppercase text-[10px] tracking-widest gap-2 shadow-xl shadow-primary/20 active:scale-95 transition-all"
                        >
                          <LayoutDashboard className="w-4 h-4 text-white" />
                          Staff Hub
                        </Button>
                      </div>
                    )}

                    <div className="space-y-1">
                      {navLinks.map((link) => {
                        const isExternal = link.href.startsWith('http');
                        const content = (
                          <div className={cn(
                            "flex items-center justify-between py-3 px-4 rounded-xl transition-all cursor-pointer",
                            pathname === link.href ? "bg-primary/5 text-primary" : "text-zinc-600 hover:bg-zinc-50"
                          )}>
                            <span className="text-[11px] font-black uppercase tracking-widest">{link.label}</span>
                            {isExternal ? (
                              <ArrowUpRight className="w-4 h-4 text-primary" />
                            ) : (
                              <ChevronRight className={cn("w-4 h-4", pathname === link.href ? "text-primary" : "text-zinc-200")} />
                            )}
                          </div>
                        );

                        if (isExternal) {
                          return (
                            <a key={link.href} href={link.href} target="_blank" rel="noopener noreferrer" onClick={() => setIsMenuOpen(false)}>
                              {content}
                            </a>
                          );
                        }

                        return (
                          <Link 
                            key={link.href} 
                            href={link.href} 
                            onClick={() => setIsMenuOpen(false)}
                          >
                            {content}
                          </Link>
                        );
                      })}
                    </div>

                    <Separator className="bg-zinc-50" />

                    <div className="space-y-2">
                      {user ? (
                        <>
                          <Link href="/client/profile" onClick={() => setIsMenuOpen(false)} className="flex items-center gap-3 py-3 px-4 rounded-xl text-zinc-600 hover:bg-zinc-50">
                            <User className="w-4 h-4 text-zinc-400" />
                            <span className="text-[11px] font-black uppercase tracking-widest">My Profile</span>
                          </Link>
                          <Link href="/client/orders" onClick={() => setIsMenuOpen(false)} className="flex items-center gap-3 py-3 px-4 rounded-xl text-zinc-600 hover:bg-zinc-50">
                            <Package className="w-4 h-4 text-zinc-400" />
                            <span className="text-[11px] font-black uppercase tracking-widest">My Orders</span>
                          </Link>
                          <button onClick={handleLogout} className="w-full flex items-center gap-3 py-3 px-4 rounded-xl text-red-500 hover:bg-red-50 text-left">
                            <LogOut className="w-4 h-4" />
                            <span className="text-[11px] font-black uppercase tracking-widest">Sign Out</span>
                          </button>
                        </>
                      ) : (
                        <div className="grid grid-cols-2 gap-2">
                          <Button onClick={() => { router.push('/login'); setIsMenuOpen(false); }} className="h-11 bg-zinc-900 text-white rounded-xl uppercase font-black text-[9px] tracking-widest">Sign In</Button>
                          <Button onClick={() => { router.push('/signup'); setIsMenuOpen(false); }} variant="outline" className="h-11 border-zinc-100 text-zinc-600 rounded-xl uppercase font-black text-[9px] tracking-widest">Join</Button>
                        </div>
                      )}
                    </div>
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 relative">
        {children}
      </main>

      <footer className="py-4 bg-transparent text-center shrink-0">
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
        "text-[10px] font-black uppercase tracking-[0.3em] transition-all",
        active ? "text-primary border-b-2 border-primary pb-1" : "text-zinc-400 hover:text-zinc-900"
      )}
    >
      {children}
    </Link>
  );
}