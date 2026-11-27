'use client';

import React, { useMemo, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { 
  ArrowRight, 
  Coffee, 
  ShoppingBag, 
  Car, 
  MessageSquare, 
  Zap, 
  ChevronRight, 
  UtensilsCrossed, 
  Cigarette,
  Plus,
  ShoppingCart,
  Star,
  Tag,
  Loader2,
  Award,
  Clock,
  LayoutGrid,
  Layers,
  Package
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ClientLayout } from '@/app/client/layout';
import Autoplay from "embla-carousel-autoplay";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi
} from "@/components/ui/carousel";
import { ReviewList } from '@/components/reviews/review-list';
import { ReviewForm } from '@/components/reviews/review-form';
import { Footer } from '@/components/shared/footer';
import { LocationMap } from '@/components/shared/location-map';
import { QuickCatalogPopup } from '@/components/client/quick-catalog-popup';
import { useCart } from '@/hooks/use-cart';
import { toast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { useUser } from '@/firebase';
import { Product } from '@/lib/types';
import Link from 'next/link';
import { useProfile } from '@/hooks/use-profile';

export default function RootLandingPage() {
  const router = useRouter();
  const { user } = useUser();
  const { profile } = useProfile();
  const { addToCart, items: cartItems } = useCart();
  
  const [activeQuickUnit, setActiveQuickUnit] = useState<'LOUNGE' | 'STORE' | 'CARWASH' | null>(null);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [api, setApi] = useState<CarouselApi>();
  const [currentSlide, setCurrentSlide] = useState(0);

  const plugin = useMemo(
    () => Autoplay({ delay: 6000, stopOnInteraction: false }),
    []
  );

  useEffect(() => {
    if (!api) return;
    setCurrentSlide(api.selectedScrollSnap());
    api.on("select", () => {
      setCurrentSlide(api.selectedScrollSnap());
    });
  }, [api]);

  const [inventory, setInventory] = useState<Product[]>([]);
  const [inventoryLoading, setInventoryLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    async function loadFeaturedCatalogues() {
      setInventoryLoading(true);
      try {
        const units = ['LOUNGE', 'STORE', 'CARWASH'] as const;
        const responses = await Promise.all(units.map(async unit => {
          try {
            const params = new URLSearchParams({ unit, page: '1', pageSize: '4', sort: 'name' });
            const response = await fetch(`/api/public/catalogue?${params.toString()}`, {
              signal: controller.signal,
              cache: 'no-store',
            });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(payload.error || `Catalogue unavailable for ${unit}`);
            return Array.isArray(payload.products) ? payload.products as Product[] : [];
          } catch (error) {
            if (!controller.signal.aborted) {
              console.error(`[LANDING_CATALOGUE_LOAD_FAILED:${unit}]`, error);
            }
            return [];
          }
        }));
        if (!controller.signal.aborted) setInventory(responses.flat());
      } catch (error) {
        if (!controller.signal.aborted) {
          console.error('[LANDING_CATALOGUE_LOAD_FAILED]', error);
          setInventory([]);
        }
      } finally {
        if (!controller.signal.aborted) setInventoryLoading(false);
      }
    }
    loadFeaturedCatalogues();
    return () => controller.abort();
  }, []);

  const heroSlides = [
    {
      image: '/assets/lounge.jpg',
      title: 'YOUR LOUNGE.',
      accent: 'YOUR MOMENT.',
      desc: 'Drinks, bites and favourites — ready when you are.',
      unit: 'LOUNGE',
      href: '/client/lounge',
      btnLabel: 'Explore Lounge',
      quickPicks: [
        { icon: Coffee, label: "Drinks", unit: "LOUNGE", category: "Drinks" },
        { icon: UtensilsCrossed, label: "Food", unit: "LOUNGE", category: "Food" },
        { icon: Cigarette, label: "Tobacco", unit: "LOUNGE", category: "Tobacco" }
      ]
    },
    {
      image: '/assets/hero3.png',
      title: 'EXPERT.',
      accent: 'DETAILING.',
      desc: 'Professional vehicle care with absolute precision.',
      unit: 'CARWASH',
      href: '/client/carwash',
      btnLabel: 'Book Service',
      quickPicks: [
        { icon: Car, label: "Wash", unit: "CARWASH", category: "Wash" },
        { icon: Layers, label: "Carpet", unit: "CARWASH", category: "Carpets and Rugs" }
      ]
    },
    {
      image: '/assets/auto.png',
      title: 'QUALITY.',
      accent: 'PARTS.',
      desc: 'Premium accessories for your ultimate performance.',
      unit: 'STORE',
      href: '/client/store',
      btnLabel: 'Shop Parts',
      quickPicks: [
        { icon: ShoppingBag, label: "Parts", unit: "STORE", category: "Parts" },
        { icon: Tag, label: "Oils", unit: "STORE", category: "Oils" },
        { icon: Package, label: "Tyres", unit: "STORE", category: "Tyres" }
      ]
    }
  ];

  const sections = useMemo(() => {
    if (!inventory) return [];
    const activeInventory = inventory.filter(i => i.archived !== true);

    return [
      {
        id: 'lounge',
        title: 'Lounge Favorites',
        desc: 'Curated drinks and platters for your wait.',
        unit: 'LOUNGE',
        href: '/client/lounge',
        items: activeInventory.filter(i => i.unit === 'LOUNGE').slice(0, 4)
      },
      {
        id: 'store',
        title: 'Shop Accessories',
        desc: 'Premium parts and car care essentials.',
        unit: 'STORE',
        href: '/client/store',
        items: activeInventory.filter(i => i.unit === 'STORE').slice(0, 4)
      },
      {
        id: 'carwash',
        title: 'Detailing Packages',
        desc: 'Expert vehicle care and surface protection.',
        unit: 'CARWASH',
        href: '/client/carwash',
        items: activeInventory.filter(i => i.unit === 'CARWASH').slice(0, 4)
      }
    ];
  }, [inventory]);

  const handleQuickPick = (unit: 'LOUNGE' | 'STORE' | 'CARWASH', category: string) => {
    setActiveQuickUnit(unit);
    setActiveCategory(category);
  };

  const handleAddProduct = (e: React.MouseEvent, product: Product) => {
    e.stopPropagation();
    if (product.unit !== 'CARWASH' && product.stockLevel <= 0) {
      toast({ variant: "destructive", title: "Sold Out" });
      return;
    }
    addToCart(product);
    toast({
      title: "Added to Selection",
      description: `${product.name} is ready for checkout.`
    });
  };

  return (
    <ClientLayout>
      {/* HERO SECTION */}
      <section className="relative h-[85vh] min-h-[600px] bg-white overflow-hidden border-b border-zinc-100">
        <Carousel 
          plugins={[plugin]}
          setApi={setApi}
          className="w-full h-full"
          opts={{ align: "start", loop: true }}
        >
          <CarouselContent className="h-[85vh] min-h-[600px] ml-0">
            {heroSlides.map((slide, index) => (
              <CarouselItem key={index} className="pl-0 h-full relative">
                <div className="relative w-full h-full">
                  <Image src={slide.image} alt="Urban Express" fill priority={index === 0} className="object-cover" sizes="100vw" />
                  <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/30 to-transparent" />
                  <div className="max-w-7xl mx-auto px-6 w-full h-full relative z-10 flex flex-col justify-center pb-32">
                    <div className="max-w-3xl space-y-6 md:space-y-8 animate-in fade-in slide-in-from-left-8 duration-1000">
                       {user && profile && (
                         <div className="inline-flex items-center gap-4 p-4 bg-black/40 backdrop-blur-xl rounded-[1.5rem] border border-white/10 shadow-2xl mb-4">
                            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-white"><Award className="w-6 h-6" /></div>
                            <div className="text-left pr-4">
                               <p className="text-[10px] font-black text-white/50 uppercase tracking-widest leading-none mb-1">Welcome back, {profile.displayName?.split(' ')[0]}</p>
                               <div className="flex items-center gap-2"><span className="text-sm font-black text-white">{profile.loyaltyPoints || 0} Pts</span></div>
                            </div>
                         </div>
                       )}
                       <h1 className="text-5xl md:text-8xl font-black font-headline text-white uppercase leading-[0.85] tracking-tighter">
                         {slide.title} <br/> <span className="text-primary">{slide.accent}</span>
                       </h1>
                       <p className="text-sm md:text-lg text-white/80 font-bold uppercase tracking-[0.2em] max-w-xl leading-relaxed">{slide.desc}</p>
                       <div className="flex flex-wrap gap-4 pt-4">
                          <Button onClick={() => router.push(slide.href)} className="h-14 px-10 bg-primary text-white font-black uppercase text-[10px] tracking-widest rounded-full shadow-xl hover:bg-orange-600 transition-all active:scale-95 gap-3">
                            {slide.btnLabel} <ArrowRight className="w-4 h-4" />
                          </Button>
                       </div>
                    </div>
                  </div>
                </div>
              </CarouselItem>
            ))}
          </CarouselContent>
        </Carousel>
        <div className="absolute bottom-4 left-0 right-0 md:left-auto md:right-12 z-30 pb-12 hidden md:block">
           <div className="max-w-xl md:max-w-md mx-auto px-6 md:px-0">
              <div className="bg-white rounded-[2.5rem] shadow-2xl p-6 flex flex-col items-center gap-4 border border-zinc-100 animate-in slide-in-from-bottom-4 duration-700">
                 <div className="flex items-center gap-3"><div className="w-1 bg-primary h-5 rounded-full" /><span className="text-[11px] font-black uppercase tracking-0.4em text-zinc-900">Quick Picks</span></div>
                 <div className="flex flex-wrap md:flex-nowrap justify-center gap-3 w-full">
                    {heroSlides[currentSlide]?.quickPicks.map((pick, i) => (
                      <QuickPickButton key={i} icon={pick.icon} label={pick.label} onClick={() => handleQuickPick(pick.unit as any, pick.category)} />
                    ))}
                 </div>
              </div>
           </div>
        </div>
      </section>

      {/* MARKET PLACE */}
      <section className="py-24 bg-white overflow-hidden">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 mb-20">
             <div className="space-y-4">
                <p className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-300">Departmental Excellence</p>
                <h2 className="text-4xl md:text-7xl font-black font-headline text-zinc-900 uppercase tracking-tighter leading-none">Market <br/> <span className="text-primary">Place.</span></h2>
             </div>
          </div>

          {inventoryLoading ? (
            <div className="py-40 text-center flex flex-col items-center gap-6 opacity-30">
               <Loader2 className="w-10 h-10 animate-spin text-zinc-200" />
               <p className="text-[10px] font-black uppercase tracking-[0.4em]">Synchronizing Registry...</p>
            </div>
          ) : (
            <div className="space-y-32">
               {sections.map((section) => (
                 <div key={section.id} className="space-y-12">
                    <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-l-4 border-primary pl-8">
                       <div className="space-y-1">
                          <h3 className="text-3xl md:text-4xl font-black font-headline text-zinc-900 uppercase tracking-tighter">{section.title}</h3>
                          <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-[0.2em]">{section.desc}</p>
                       </div>
                       <Button asChild variant="ghost" className="h-10 text-[9px] font-black uppercase tracking-widest gap-2 text-primary hover:text-zinc-900 transition-all p-0">
                          <Link href={section.href}>Explore Collection <ArrowRight className="w-3.5 h-3.5" /></Link>
                       </Button>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-8">
                       {section.items.map((product) => (
                         <div key={product.id} onClick={() => router.push(`/client/product/${product.id}`)} className="flex flex-col bg-white border border-zinc-100 rounded-[2rem] overflow-hidden group cursor-pointer hover:shadow-2xl transition-all duration-500 hover:-translate-y-1">
                            <div className="aspect-[4/5] bg-zinc-50 relative overflow-hidden">
                              <Image src={product.image || '/assets/logo.png'} alt={product.name} fill className={cn("object-cover group-hover:scale-110 transition-transform duration-700", !product.image && "p-16 opacity-10")} sizes="25vw" />
                              <div className="absolute top-5 left-5"><Badge className="bg-white/90 backdrop-blur-md text-zinc-900 border-none font-black text-[7px] uppercase px-3 h-6 shadow-sm">{product.category}</Badge></div>
                              {product.stockLevel <= 0 && product.unit !== 'CARWASH' && (
                                <div className="absolute inset-0 bg-white/60 backdrop-blur-sm flex items-center justify-center"><Badge className="bg-red-500 text-white border-none font-black text-[9px] uppercase tracking-widest px-4 h-8 shadow-xl">Sold Out</Badge></div>
                              )}
                            </div>
                            <div className="p-6 flex flex-col flex-1 justify-between gap-6">
                              <h4 className="text-sm font-black text-zinc-900 uppercase tracking-tight leading-tight line-clamp-2">{product.name}</h4>
                              <div className="flex items-center justify-between pt-5 border-t border-zinc-50">
                                <div className="space-y-0"><p className="text-[8px] font-black uppercase text-zinc-300 tracking-widest">KES</p><p className="text-lg font-black text-zinc-900 tracking-tighter">{product.price.toLocaleString()}</p></div>
                                <button onClick={(e) => handleAddProduct(e, product)} className="w-12 h-12 rounded-2xl bg-zinc-900 text-white flex items-center justify-center hover:bg-primary transition-all shadow-lg active:scale-90"><Plus className="w-5 h-5" /></button>
                              </div>
                            </div>
                         </div>
                       ))}
                    </div>
                 </div>
               ))}
            </div>
          )}
        </div>
      </section>

      <ReviewList />
      <LocationMap />
      <Footer />

      <QuickCatalogPopup isOpen={activeQuickUnit !== null} onClose={() => { setActiveQuickUnit(null); setActiveCategory(null); }} unit={activeQuickUnit || 'LOUNGE'} initialCategory={activeCategory} />
    </ClientLayout>
  );
}

function QuickPickButton({ icon: Icon, label, onClick }: any) {
   return (
      <button onClick={onClick} className="flex items-center gap-2 px-4 h-11 bg-zinc-50 hover:bg-zinc-100 rounded-xl border border-zinc-100 transition-all active:scale-95 group min-w-[110px]">
         <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center text-zinc-400 group-hover:text-primary shadow-sm transition-colors border border-zinc-50"><Icon className="w-4 h-4" /></div>
         <span className="text-[9px] font-black uppercase tracking-widest text-zinc-600 group-hover:text-zinc-900 transition-colors">{label}</span>
         <ChevronRight className="w-3 h-3 text-zinc-200 group-hover:text-primary transition-all group-hover:translate-x-1" />
      </button>
   );
}