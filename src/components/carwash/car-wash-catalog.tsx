'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowDown,
  ArrowUpRight,
  Car,
  Cog,
  MessageCircle,
  Phone,
  ShieldCheck,
  Sparkles,
  Wrench,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  CAR_WASH_CATEGORIES,
  CAR_WASH_SERVICES,
  CarWashCategory,
  CarWashService,
  formatKes,
  formatServicePrice,
} from '@/data/carWashServices';
import { cn } from '@/lib/utils';

const CATEGORY_ICONS: Record<CarWashCategory, React.ComponentType<{ className?: string }>> = {
  Wash: Car,
  Interior: Sparkles,
  'Exterior & Protection': ShieldCheck,
  Restoration: Wrench,
  Engine: Cog,
};

interface CarWashCatalogProps {
  bookingSectionId?: string;
  services?: CarWashService[];
}

export function CarWashCatalog({
  bookingSectionId = 'carwash-booking',
  services: providedServices,
}: CarWashCatalogProps) {
  const [selectedCategory, setSelectedCategory] = useState<CarWashCategory | 'All'>('All');
  const [liveServices, setLiveServices] = useState<CarWashService[]>(
    () => (providedServices && providedServices.length > 0 ? providedServices : CAR_WASH_SERVICES.filter((s) => s.isActive))
  );

  useEffect(() => {
    if (providedServices) {
      setLiveServices(providedServices.filter((s) => s.isActive !== false));
      return;
    }

    const controller = new AbortController();
    fetch('/api/public/carwash-services', { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((payload) => {
        if (!controller.signal.aborted && Array.isArray(payload?.services)) {
          setLiveServices((payload.services as CarWashService[]).filter((s) => s.isActive !== false));
        }
      })
      .catch(() => {
        // Retain fallback services when offline or during static render.
      });

    return () => controller.abort();
  }, [providedServices]);

  const activeServices = useMemo(
    () =>
      [...liveServices]
        .filter((s) => s.isActive !== false)
        .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name)),
    [liveServices]
  );

  const groupedCategories = useMemo(() => {
    const categoriesToShow =
      selectedCategory === 'All'
        ? CAR_WASH_CATEGORIES
        : CAR_WASH_CATEGORIES.filter((cat) => cat === selectedCategory);

    return categoriesToShow
      .map((category) => ({
        category,
        services: activeServices.filter((service) => service.category === category),
      }))
      .filter((group) => group.services.length > 0);
  }, [selectedCategory, activeServices]);

  const scrollToBooking = () => {
    const target = document.getElementById(bookingSectionId);
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <section
      aria-labelledby="carwash-catalog-heading"
      className="border-b border-zinc-100 bg-white py-16 lg:py-20"
    >
      <div className="mx-auto max-w-7xl px-6 w-full space-y-12">
        {/* Section Header + Primary CTAs */}
        <div className="flex flex-col justify-between gap-8 lg:flex-row lg:items-end">
          <div className="max-w-2xl space-y-3">
            <p className="text-[10px] font-black uppercase tracking-[0.28em] text-primary">
              Service Menu &amp; Pricing
            </p>
            <h2
              id="carwash-catalog-heading"
              className="font-headline text-3xl font-black uppercase tracking-tighter text-zinc-900 sm:text-5xl"
            >
              Car Wash <span className="text-primary">Catalog.</span>
            </h2>
            <p className="text-sm font-medium leading-relaxed text-zinc-600 sm:text-base">
              Transparent KES pricing across wash, interior care, exterior protection,
              restoration, and engine services.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              onClick={scrollToBooking}
              className="h-12 rounded-xl bg-primary px-6 text-[11px] font-black uppercase tracking-[0.18em] text-white shadow-sm hover:bg-orange-600"
            >
              Book Now
              <ArrowDown className="ml-2 h-4 w-4" aria-hidden="true" />
            </Button>
            <Button
              asChild
              variant="outline"
              className="h-12 rounded-xl border-zinc-200 bg-white px-5 text-[11px] font-black uppercase tracking-[0.16em] text-zinc-800 hover:border-[#167C45] hover:text-[#167C45]"
            >
              <a
                href="https://wa.me/254785860753?text=Hello%20Urban%20Auto%20Express%2C%20I%20would%20like%20to%20inquire%20about%20a%20car%20wash%20service."
                target="_blank"
                rel="noopener noreferrer"
              >
                <MessageCircle className="mr-2 h-4 w-4" aria-hidden="true" />
                WhatsApp
                <ArrowUpRight className="ml-1.5 h-3.5 w-3.5" aria-hidden="true" />
              </a>
            </Button>
            <Button
              asChild
              variant="ghost"
              className="h-12 rounded-xl px-4 text-[11px] font-black uppercase tracking-[0.16em] text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900"
            >
              <Link href="/contact">
                <Phone className="mr-2 h-4 w-4" aria-hidden="true" />
                Contact Us
              </Link>
            </Button>
          </div>
        </div>

        {/* Category Filter Tabs */}
        <nav aria-label="Filter services by category" className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setSelectedCategory('All')}
            aria-pressed={selectedCategory === 'All'}
            className={cn(
              'rounded-full px-4 py-2 text-[11px] font-black uppercase tracking-wider transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
              selectedCategory === 'All'
                ? 'bg-zinc-900 text-white'
                : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
            )}
          >
            All Services ({activeServices.length})
          </button>
          {CAR_WASH_CATEGORIES.map((category) => {
            const count = activeServices.filter((s) => s.category === category).length;
            const isActive = selectedCategory === category;
            return (
              <button
                key={category}
                type="button"
                onClick={() => setSelectedCategory(category)}
                aria-pressed={isActive}
                className={cn(
                  'rounded-full px-4 py-2 text-[11px] font-black uppercase tracking-wider transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
                  isActive
                    ? 'bg-primary text-white'
                    : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
                )}
              >
                {category} ({count})
              </button>
            );
          })}
        </nav>

        {/* Grouped Service Categories */}
        <div className="space-y-12">
          {groupedCategories.map(({ category, services }) => {
            const Icon = CATEGORY_ICONS[category];
            const headingId = `category-${category.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;

            return (
              <div key={category} aria-labelledby={headingId} className="space-y-5">
                <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Icon className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <h3
                      id={headingId}
                      className="font-headline text-lg font-black uppercase tracking-tight text-zinc-900 sm:text-xl"
                    >
                      {category}
                    </h3>
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                    {services.length} {services.length === 1 ? 'service' : 'services'}
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {services.map((service) => (
                    <ServiceCard key={service.id} service={service} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function ServiceCard({ service }: { service: CarWashService }) {
  const hasTiers = Boolean(service.tiers && service.tiers.length > 0);
  const hasRange = typeof service.priceFrom === 'number' && typeof service.priceTo === 'number';

  return (
    <Card className="flex flex-col justify-between rounded-2xl border border-zinc-200/80 bg-[#FDFDFD] shadow-sm transition-shadow hover:shadow-md">
      <CardContent className="flex h-full flex-col justify-between gap-4 p-6">
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-3">
            <h4 className="text-base font-extrabold tracking-tight text-zinc-900">
              {service.name}
            </h4>
            {!hasTiers && (
              <span className="shrink-0 whitespace-nowrap font-headline text-base font-black text-primary">
                {formatServicePrice(service)}
              </span>
            )}
          </div>

          {hasTiers && service.tiers && (
            <div className="space-y-2 pt-1">
              <div className="flex flex-wrap gap-2">
                {service.tiers.map((tier) => (
                  <Badge
                    key={tier.label}
                    variant="secondary"
                    className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-xs font-bold text-zinc-800"
                  >
                    <span className="text-[10px] font-black uppercase tracking-wider text-zinc-500">
                      {tier.label}
                    </span>
                    <span className="font-headline font-black text-primary">
                      {formatKes(tier.price)}
                    </span>
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>

        {(hasRange || service.note) && (
          <p className="border-t border-zinc-100 pt-3 text-xs font-medium leading-relaxed text-zinc-500">
            {service.note}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
