'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, Loader2, Plus, MapPin, Phone, Mail, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import ClientLayout from './client/layout';
import { ReviewList } from '@/components/reviews/review-list';
import { ReviewForm } from '@/components/reviews/review-form';
import { Footer } from '@/components/shared/footer';
import { LocationMap } from '@/components/shared/location-map';
import { useCart } from '@/hooks/use-cart';
import { toast } from '@/hooks/use-toast';
import { useUser } from '@/firebase';
import { Product } from '@/lib/types';
import { useProfile } from '@/hooks/use-profile';

type Department = 'LOUNGE' | 'STORE' | 'CARWASH';

const heroSlides: {
  image: string;
  eyebrow: string;
  title: string;
  accent: string;
  description: string;
  href: string;
  action: string;
  department: Department;
}[] = [
  {
    image: '/assets/lounge.jpg',
    eyebrow: 'A PLACE TO PAUSE',
    title: 'YOUR LOUNGE.',
    accent: 'YOUR MOMENT.',
    description: 'Take a well-earned break with refreshing drinks, great bites and warm hospitality.',
    href: '/client/lounge',
    action: 'Explore the lounge',
    department: 'LOUNGE',
  },
  {
    image: '/assets/hero3.png',
    eyebrow: 'CARE WITHOUT COMPROMISE',
    title: 'EXPERT.',
    accent: 'DETAILING.',
    description: 'Professional vehicle care, careful finishing and attention to every detail.',
    href: '/client/carwash',
    action: 'Book a service',
    department: 'CARWASH',
  },
  {
    image: '/assets/auto.png',
    eyebrow: 'QUALITY FOR EVERY JOURNEY',
    title: 'QUALITY.',
    accent: 'PARTS.',
    description: 'Discover automotive essentials and accessories selected for your vehicle.',
    href: '/client/store',
    action: 'Shop accessories',
    department: 'STORE',
  },
];

const departments = [
  { id: 'lounge', title: 'Food & Drinks', subtitle: 'Relax and recharge', description: 'Fresh food, refreshing drinks and a comfortable place to pause.', image: '/assets/lounge.jpg', href: '/client/lounge', action: 'Explore food & drinks' },
  { id: 'store', title: 'Accessories Store', subtitle: 'Quality for every journey', description: 'Automotive accessories and essentials selected for your vehicle.', image: '/assets/auto.jpeg', href: '/client/store', action: 'Shop accessories' },
  { id: 'carwash', title: 'Car Wash & Detailing', subtitle: 'Care without compromise', description: 'Professional vehicle cleaning and detailing services.', image: '/assets/hero3.png', href: '/client/carwash', action: 'View services' },
];

export default function RootLandingPage() {
  const router = useRouter();
  const { user } = useUser();
  const { profile } = useProfile();
  const { addToCart } = useCart();
  const [currentSlide, setCurrentSlide] = useState(0);
  const [heroPaused, setHeroPaused] = useState(false);
  const [inventory, setInventory] = useState<Product[]>([]);
  const [inventoryLoading, setInventoryLoading] = useState(true);
  const [inventoryError, setInventoryError] = useState(false);
  const [catalogueAttempt, setCatalogueAttempt] = useState(0);

  useEffect(() => {
    if (heroPaused) return;
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (media.matches) return;
    const timer = window.setInterval(() => {
      setCurrentSlide((current) => (current + 1) % heroSlides.length);
    }, 6500);
    return () => window.clearInterval(timer);
  }, [heroPaused]);

  useEffect(() => {
    const controller = new AbortController();

    async function loadFeaturedCatalogues() {
      setInventoryLoading(true);
      setInventoryError(false);
      const units: Department[] = ['LOUNGE', 'STORE', 'CARWASH'];

      const responses = await Promise.all(units.map(async (unit) => {
        try {
          const params = new URLSearchParams({ unit, page: '1', pageSize: '4', sort: 'name' });
          const response = await fetch('/api/public/catalogue?' + params.toString(), {
            signal: controller.signal,
            cache: 'no-store',
          });
          const payload = await response.json().catch(() => ({}));
          if (!response.ok) throw new Error(payload.error || 'Catalogue unavailable');
          return Array.isArray(payload.products) ? payload.products as Product[] : [];
        } catch (error) {
          if (!controller.signal.aborted) {
            console.error('[LANDING_CATALOGUE_LOAD_FAILED:' + unit + ']', error);
            setInventoryError(true);
          }
          return [];
        }
      }));

      if (!controller.signal.aborted) {
        setInventory(responses.flat().filter((item) => item.archived !== true));
        setInventoryLoading(false);
      }
    }

    loadFeaturedCatalogues();
    return () => controller.abort();
  }, [catalogueAttempt]);

  const sections = useMemo(() => [
    {
      id: 'lounge',
      title: 'Lounge favourites',
      description: 'Drinks and bites for your time at the lounge.',
      href: '/client/lounge',
      items: inventory.filter((item) => item.unit === 'LOUNGE').slice(0, 4),
    },
    {
      id: 'store',
      title: 'Auto essentials',
      description: 'Accessories and vehicle-care essentials.',
      href: '/client/store',
      items: inventory.filter((item) => item.unit === 'STORE').slice(0, 4),
    },
    {
      id: 'carwash',
      title: 'Detailing services',
      description: 'Professional care for a cleaner, better-finished vehicle.',
      href: '/client/carwash',
      items: inventory.filter((item) => item.unit === 'CARWASH').slice(0, 4),
    },
  ], [inventory]);

  const handleAddProduct = (event: React.MouseEvent<HTMLButtonElement>, product: Product) => {
    event.stopPropagation();
    if (!product.id) {
      toast({ variant: 'destructive', title: 'Item unavailable', description: 'This catalogue item cannot be added right now.' });
      return;
    }
    if (product.unit !== 'CARWASH' && product.stockLevel <= 0) {
      toast({ variant: 'destructive', title: 'Sold out', description: 'This item is currently unavailable.' });
      return;
    }
    addToCart(product);
    toast({ title: 'Added to cart', description: product.name });
  };

  const slide = heroSlides[currentSlide];

  return (
    <ClientLayout>
      <main className="ua-home bg-white text-zinc-800">
        <section
          className="relative isolate overflow-hidden bg-[#F7F4EF]"
          aria-roledescription="carousel"
          aria-label="Featured Urban Auto Express departments"
          onMouseEnter={() => setHeroPaused(true)}
          onMouseLeave={() => setHeroPaused(false)}
          onFocusCapture={() => setHeroPaused(true)}
          onBlurCapture={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setHeroPaused(false);
          }}
        >
          <div className="relative min-h-[560px] h-[min(76svh,820px)]">
            {heroSlides.map((item, index) => (
              <div
                key={item.department}
                aria-hidden={currentSlide !== index}
                className={'absolute inset-0 transition-opacity duration-700 ' + (currentSlide === index ? 'z-10 opacity-100' : 'z-0 opacity-0 pointer-events-none')}
              >
                <Image
                  src={item.image}
                  alt={item.department === 'LOUNGE' ? 'Urban Auto Express lounge' : item.department === 'CARWASH' ? 'Vehicle care and detailing at Urban Auto Express' : 'Automotive accessories at Urban Auto Express'}
                  fill
                  priority={index === 0}
                  className="object-cover object-center"
                  sizes="100vw"
                />
                <div className="absolute inset-0 bg-gradient-to-r from-[#fffaf3]/95 via-[#fffaf3]/80 to-[#fffaf3]/10" />
                <div className="absolute inset-0 bg-gradient-to-t from-[#fffaf3]/50 via-transparent to-white/10" />
              </div>
            ))}

            <div className="relative z-20 mx-auto flex h-full max-w-7xl items-center px-5 pb-20 pt-12 sm:px-8 lg:px-12">
              <div className="max-w-2xl">
                {user && profile && (
                  <div className="mb-7 inline-flex max-w-full items-center gap-3">
                    <span aria-hidden="true" className="h-10 w-1 shrink-0 bg-primary" />
                    <span className="min-w-0">
                      <span className="block truncate text-[9px] font-black uppercase tracking-[.18em] text-zinc-600">
                        Welcome back, {profile.displayName?.split(' ')[0] || 'Member'}
                      </span>
                      <span className="mt-1 block text-sm font-extrabold text-zinc-900">
                        {Math.max(0, Number(profile.loyaltyPoints) || 0).toLocaleString()} loyalty points
                      </span>
                    </span>
                    <Link href="/client/profile" className="ml-2 min-h-11 shrink-0 inline-flex items-center text-[9px] font-black uppercase tracking-wider text-primary underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary">View account</Link>
                  </div>
                )}

                <p className="mb-5 text-[10px] font-black uppercase tracking-[.28em] text-primary">
                  {slide.eyebrow} <span className="mx-2 text-zinc-300">/</span> NAKURU, KENYA
                </p>
                <h1 className="font-headline text-[clamp(3rem,8vw,6.6rem)] font-black uppercase leading-[.88] tracking-[-.075em] text-zinc-900">
                  {slide.title}<br /><span className="text-primary">{slide.accent}</span>
                </h1>
                <p className="mt-7 max-w-lg text-sm font-medium leading-7 text-zinc-600 sm:text-base">{slide.description}</p>
                <div className="mt-8 flex flex-wrap items-center gap-3">
                  <Button onClick={() => router.push(slide.href)} className="h-12 rounded-md bg-primary px-7 text-[10px] font-black uppercase tracking-[.16em] text-white shadow-sm shadow-orange-200 hover:bg-orange-600">
                    {slide.action} <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                  <Button asChild variant="outline" className="h-12 rounded-md border-zinc-300 bg-white/80 px-6 text-[10px] font-black uppercase tracking-[.14em] text-zinc-800 hover:border-primary hover:bg-white">
                    <Link href="/download"><Smartphone className="mr-2 h-4 w-4" /> Get the mobile app</Link>
                  </Button>
                </div>
                <p className="mt-7 text-[9px] font-bold uppercase tracking-[.15em] text-zinc-500">Main Highway, Naka Center · Nakuru, Kenya</p>
              </div>
            </div>

            <div className="absolute bottom-6 left-5 right-5 z-30 mx-auto flex max-w-7xl items-center justify-between sm:left-8 sm:right-8 lg:left-12 lg:right-12">
              <div className="flex items-center gap-2" aria-label="Choose featured department">
                {heroSlides.map((item, index) => (
                  <button
                    key={item.department}
                    type="button"
                    aria-label={'Show ' + item.department.toLowerCase() + ' slide'}
                    aria-current={currentSlide === index ? 'true' : undefined}
                    onClick={() => setCurrentSlide(index)}
                    className={'h-1 min-w-5 transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary ' + (currentSlide === index ? 'w-10 bg-primary' : 'w-5 bg-zinc-500/50 hover:bg-primary/70')}
                  />
                ))}
              </div>
              <span className="text-[9px] font-bold uppercase tracking-[.16em] text-zinc-600" aria-live="polite">
                0{currentSlide + 1} <span className="mx-1 text-zinc-300">/</span> 03
              </span>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-5 py-16 sm:px-8 lg:px-12 lg:py-24">
          <div className="mb-9 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <p className="text-[9px] font-black uppercase tracking-[.25em] text-primary">One destination. Three experiences.</p>
              <h2 className="mt-3 font-headline text-4xl font-black uppercase leading-none tracking-[-.06em] text-zinc-900 sm:text-5xl">Discover <span className="text-primary">Urban.</span></h2>
              <p className="mt-4 max-w-lg text-sm leading-6 text-zinc-500">Everything for the journey and the moments in between, brought together at Urban Auto Express.</p>
            </div>
            <span className="text-[9px] font-bold uppercase tracking-[.18em] text-zinc-400">Explore our departments</span>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3">
            {departments.map((department) => (
              <Link key={department.id} href={department.href} className={`group relative min-h-[230px] overflow-hidden rounded-lg bg-[#F4F0E9] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary sm:min-h-[330px] ${department.id === 'carwash' ? 'col-span-2 md:col-span-1' : ''}`}>
                <Image src={department.image} alt={department.title} fill className="object-cover transition duration-700 group-hover:scale-[1.045]" sizes="(max-width: 768px) 100vw, 33vw" />
                <div className="absolute inset-0 bg-gradient-to-t from-[#49372B]/80 via-[#49372B]/20 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-6 text-white sm:p-7">
                  <p className="text-[9px] font-black uppercase tracking-[.2em] text-orange-200">{department.subtitle}</p>
                  <h3 className="mt-2 text-lg font-black tracking-tight sm:text-2xl">{department.title}</h3>
                  <p className="mt-2 max-w-sm text-[10px] leading-4 text-white/85 sm:text-xs sm:leading-5">{department.description}</p>
                  <span className="mt-4 inline-flex items-center gap-2 text-[9px] font-black uppercase tracking-[.16em]">{department.action} <ArrowRight className="h-3.5 w-3.5" /></span>
                </div>
              </Link>
            ))}
          </div>
        </section>

        <section className="bg-[#F8F6F2]">
          <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8 lg:px-12 lg:py-24">
            <div className="mb-12 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
              <div>
                <p className="text-[9px] font-black uppercase tracking-[.25em] text-primary">The Urban marketplace</p>
                <h2 className="mt-3 font-headline text-4xl font-black uppercase leading-none tracking-[-.06em] text-zinc-900 sm:text-5xl">A better way to <span className="text-primary">shop.</span></h2>
                <p className="mt-4 max-w-lg text-sm leading-6 text-zinc-500">Browse products and services currently listed across our departments.</p>
              </div>
              <Link href="/client/store" className="inline-flex items-center gap-2 border-b border-primary pb-2 text-[9px] font-black uppercase tracking-[.16em] text-zinc-800 hover:text-primary">View marketplace</Link>
            </div>

            {inventoryLoading ? (
              <div className="flex min-h-56 flex-col items-center justify-center gap-4 text-zinc-400" role="status" aria-live="polite">
                <Loader2 className="h-7 w-7 animate-spin text-primary" />
                <p className="text-[9px] font-black uppercase tracking-[.2em]">Loading featured catalogue</p>
              </div>
            ) : (
              <div className="space-y-14">
                {inventoryError && (
                  <div className="flex flex-col gap-3 rounded-lg border border-orange-200 bg-orange-50 px-5 py-4 text-sm text-orange-900 sm:flex-row sm:items-center sm:justify-between" role="status">
                    <span>Some featured items could not be loaded. You can still browse each department.</span>
                    <button type="button" onClick={() => setCatalogueAttempt((attempt) => attempt + 1)} className="min-h-11 shrink-0 text-left text-[9px] font-black uppercase tracking-wider underline underline-offset-4">Retry catalogue</button>
                  </div>
                )}
                {sections.map((section) => (
                  <div key={section.id}>
                    <div className="mb-6 flex items-end justify-between gap-4 border-b border-zinc-200 pb-4">
                      <div>
                        <h3 className="text-xl font-black uppercase tracking-tight text-zinc-900">{section.title}</h3>
                        <p className="mt-1 text-xs text-zinc-500">{section.description}</p>
                      </div>
                      <Link href={section.href} className="min-h-11 shrink-0 inline-flex items-center text-[9px] font-black uppercase tracking-[.14em] text-primary hover:text-orange-700">View all</Link>
                    </div>

                    {section.items.length ? (
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
                        {section.items.map((product) => (
                          <article key={product.id || product.name} className="group flex min-w-0 flex-col overflow-hidden rounded-lg border border-zinc-200/80 bg-white transition duration-300 hover:-translate-y-1 hover:border-orange-200 hover:shadow-lg hover:shadow-orange-900/5">
                            <Link href={product.id ? '/client/product/' + product.id : section.href} aria-label={'View ' + product.name} className="block">
                              <div className="relative aspect-[4/4.4] overflow-hidden bg-[#F1EFEB]">
                                <Image src={product.image || '/assets/logo.png'} alt={product.name} fill className={'object-cover transition duration-700 group-hover:scale-105 ' + (!product.image ? 'p-12 opacity-20' : '')} sizes="(max-width: 640px) 50vw, 25vw" />
                                <Badge className="absolute left-3 top-3 rounded-md border-0 bg-white/95 px-2.5 py-1 text-[8px] font-black uppercase tracking-wider text-zinc-700 shadow-sm">{product.category}</Badge>
                                {product.unit !== 'CARWASH' && product.stockLevel <= 0 && (
                                  <div className="absolute inset-0 flex items-center justify-center bg-white/65"><Badge className="rounded-md bg-zinc-700 text-white">Sold out</Badge></div>
                                )}
                              </div>
                              <div className="px-3.5 pt-3.5 sm:px-4">
                                <h4 className="line-clamp-2 min-h-9 text-xs font-extrabold leading-5 text-zinc-800">{product.name}</h4>
                              </div>
                            </Link>
                            <div className="mt-auto flex items-center justify-between p-3.5 pt-3 sm:p-4">
                              <div><span className="block text-[8px] font-bold uppercase tracking-widest text-zinc-400">KES</span><span className="text-base font-black tracking-tight text-zinc-900">{Number(product.price || 0).toLocaleString('en-KE')}</span></div>
                              <button
                                type="button"
                                aria-label={'Add ' + product.name + ' to cart'}
                                onClick={(event) => handleAddProduct(event, product)}
                                disabled={!product.id || (product.unit !== 'CARWASH' && product.stockLevel <= 0)}
                                className="flex h-11 w-11 items-center justify-center rounded-md border border-zinc-200 text-zinc-700 transition hover:border-primary hover:bg-primary hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                              >
                                <Plus className="h-4 w-4" />
                              </button>
                            </div>
                          </article>
                        ))}
                      </div>
                    ) : (
                      <div className="rounded-lg border border-dashed border-zinc-300 bg-white/70 px-5 py-9 text-center">
                        <p className="text-xs font-semibold text-zinc-500">No featured items available in this department right now.</p>
                        <Link href={section.href} className="mt-3 inline-flex min-h-11 items-center text-[9px] font-black uppercase tracking-widest text-primary">Explore department</Link>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="mx-auto grid max-w-7xl gap-10 px-5 py-16 sm:px-8 md:grid-cols-[1.05fr_.95fr] md:items-center lg:px-12 lg:py-24">
          <div>
            <p className="text-[9px] font-black uppercase tracking-[.25em] text-primary">The complete experience</p>
            <h2 className="mt-3 font-headline text-4xl font-black uppercase leading-[.98] tracking-[-.06em] text-zinc-900 sm:text-5xl">Make every stop <span className="text-primary">worthwhile.</span></h2>
            <p className="mt-5 max-w-lg text-sm leading-7 text-zinc-500">From professional vehicle care to a comfortable place to relax, Urban Auto Express brings useful services and thoughtful hospitality together.</p>
            <div className="mt-8 grid grid-cols-3 gap-3 border-t border-zinc-200 pt-5">
              <div><p className="text-[10px] font-black uppercase tracking-wide text-zinc-800">Expert care</p><p className="mt-1 text-[10px] leading-4 text-zinc-500">Professional services</p></div>
              <div><p className="text-[10px] font-black uppercase tracking-wide text-zinc-800">Convenience</p><p className="mt-1 text-[10px] leading-4 text-zinc-500">Shop and book online</p></div>
              <div><p className="text-[10px] font-black uppercase tracking-wide text-zinc-800">Hospitality</p><p className="mt-1 text-[10px] leading-4 text-zinc-500">A welcoming lounge</p></div>
            </div>
            <Button asChild className="mt-8 h-12 rounded-md bg-primary px-7 text-[9px] font-black uppercase tracking-[.16em] text-white hover:bg-orange-600">
              <Link href="/client/carwash">Plan your visit</Link>
            </Button>
          </div>
          <div className="relative min-h-[280px] overflow-hidden rounded-lg bg-[#F1EDE6] md:min-h-[430px]">
            <Image src="/assets/hero.jpeg" alt="Urban Auto Express vehicle experience" fill className="object-cover" sizes="(max-width: 768px) 100vw, 50vw" />
            <div className="absolute bottom-4 left-4 rounded-md border-l-2 border-primary bg-white/95 px-5 py-4 shadow-lg sm:bottom-7 sm:left-7">
              <p className="text-[8px] font-black uppercase tracking-[.2em] text-primary">Urban Auto Express</p>
              <p className="mt-1 text-sm font-black text-zinc-900">One destination. More possibilities.</p>
            </div>
          </div>
        </section>

        <section className="border-y border-orange-100 bg-[#FFF9F2]">
          <div className="mx-auto flex max-w-7xl flex-col gap-5 px-5 py-9 sm:px-8 md:flex-row md:items-center md:justify-between lg:px-12">
            <div className="flex items-center gap-4">
              <div className="h-9 w-1 bg-primary" />
              <div>
                <p className="text-[9px] font-black uppercase tracking-[.2em] text-primary">Visit Urban Auto Express</p>
                <p className="mt-1 text-sm font-bold text-zinc-800">Main Highway, Naka Center, Nakuru, Kenya</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-x-6 gap-y-3 text-[10px] font-bold text-zinc-700">
              <a href="tel:+254785860753" className="inline-flex min-h-11 items-center gap-2 hover:text-primary"><Phone className="h-4 w-4 text-primary" /> 0785 860 753</a>
              <a href="mailto:info@urbanautoexpress.com" className="inline-flex min-h-11 items-center gap-2 hover:text-primary"><Mail className="h-4 w-4 text-primary" /> Email us</a>
              <Link href="/contact" className="inline-flex min-h-11 items-center gap-2 hover:text-primary">Contact support <ArrowRight className="h-3.5 w-3.5" /></Link>
            </div>
          </div>
        </section>

        <section className="bg-white px-5 py-16 sm:px-8 lg:px-12 lg:py-20">
          <div className="mx-auto max-w-7xl">
            <div className="mb-8 max-w-xl">
              <p className="text-[9px] font-black uppercase tracking-[.25em] text-primary">Customer confidence</p>
              <h2 className="mt-3 font-headline text-3xl font-black uppercase tracking-[-.05em] text-zinc-900 sm:text-4xl">Experiences from our customers.</h2>
              <p className="mt-3 text-sm leading-6 text-zinc-500">Read customer feedback and share your own experience with Urban Auto Express.</p>
            </div>
            <ReviewList />
            <div className="mt-8 max-w-2xl">
              <ReviewForm />
            </div>
          </div>
        </section>

        <section className="bg-[#FAF9F7]">
          <div className="mx-auto max-w-7xl px-5 pt-14 sm:px-8 lg:px-12">
            <div className="mb-6 max-w-xl">
              <p className="text-[9px] font-black uppercase tracking-[.25em] text-primary">Find us in Nakuru</p>
              <h2 className="mt-3 font-headline text-3xl font-black uppercase tracking-[-.05em] text-zinc-900 sm:text-4xl">Visit our location.</h2>
              <p className="mt-3 text-sm leading-6 text-zinc-500">Main Highway, Naka Center, Nakuru, Kenya. Directions are available when you choose to share your location.</p>
            </div>
          </div>
          <LocationMap />
        </section>

        <Footer />
      </main>
    </ClientLayout>
  );
}
