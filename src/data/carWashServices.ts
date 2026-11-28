export type CarWashCategory =
  | 'Wash'
  | 'Interior'
  | 'Exterior & Protection'
  | 'Restoration'
  | 'Engine';

export interface CarWashServiceTier {
  label: string;
  price: number;
}

export interface CarWashService {
  id: string;
  name: string;
  category: CarWashCategory;
  currency: 'KES';
  price?: number;
  priceFrom?: number;
  priceTo?: number;
  tiers?: CarWashServiceTier[];
  note?: string;
}

export const CAR_WASH_CATEGORIES: readonly CarWashCategory[] = [
  'Wash',
  'Interior',
  'Exterior & Protection',
  'Restoration',
  'Engine',
];

const RANGE_PRICE_NOTE = 'Final price depends on vehicle size and condition.';

export function formatKes(amount: number): string {
  return `KES ${amount.toLocaleString('en-KE')}`;
}

export function formatServicePrice(service: CarWashService): string {
  if (typeof service.price === 'number') {
    return formatKes(service.price);
  }
  if (typeof service.priceFrom === 'number' && typeof service.priceTo === 'number') {
    return `${formatKes(service.priceFrom)} – ${service.priceTo.toLocaleString('en-KE')}`;
  }
  if (service.tiers && service.tiers.length > 0) {
    const lowest = Math.min(...service.tiers.map((tier) => tier.price));
    return `From ${formatKes(lowest)}`;
  }
  return 'Price on request';
}

/**
 * Single source of truth for Urban Auto Express car wash & detailing pricing.
 * Update prices here to reflect changes across the catalog.
 */
export const CAR_WASH_SERVICES: CarWashService[] = [
  // WASH
  {
    id: 'wash-normal',
    name: 'Normal Wash',
    category: 'Wash',
    price: 300,
    currency: 'KES',
  },
  {
    id: 'wash-normal-suv',
    name: 'Normal Wash (SUV)',
    category: 'Wash',
    price: 400,
    currency: 'KES',
  },
  {
    id: 'wash-exterior',
    name: 'Exterior Wash',
    category: 'Wash',
    price: 200,
    currency: 'KES',
  },

  // INTERIOR
  {
    id: 'interior-vacuum',
    name: 'Vacuum',
    category: 'Interior',
    price: 300,
    currency: 'KES',
  },
  {
    id: 'interior-dashboard-cleaning',
    name: 'Dashboard Cleaning',
    category: 'Interior',
    price: 300,
    currency: 'KES',
  },
  {
    id: 'interior-leather-treatment',
    name: 'Leather Treatment',
    category: 'Interior',
    price: 300,
    currency: 'KES',
  },
  {
    id: 'interior-roof-cleaning',
    name: 'Roof Cleaning',
    category: 'Interior',
    priceFrom: 1000,
    priceTo: 1500,
    currency: 'KES',
    note: RANGE_PRICE_NOTE,
  },
  {
    id: 'interior-detailing',
    name: 'Interior Detailing',
    category: 'Interior',
    priceFrom: 3500,
    priceTo: 5000,
    currency: 'KES',
    note: RANGE_PRICE_NOTE,
  },

  // EXTERIOR & PROTECTION
  {
    id: 'exterior-tire-shine',
    name: 'Tire Shine',
    category: 'Exterior & Protection',
    price: 400,
    currency: 'KES',
  },
  {
    id: 'exterior-wax',
    name: 'Wax',
    category: 'Exterior & Protection',
    price: 300,
    currency: 'KES',
  },
  {
    id: 'exterior-buffing-polishing',
    name: 'Buffing / Polishing',
    category: 'Exterior & Protection',
    priceFrom: 500,
    priceTo: 4500,
    currency: 'KES',
    note: RANGE_PRICE_NOTE,
  },
  {
    id: 'exterior-watermark-removal',
    name: 'Watermark Removal',
    category: 'Exterior & Protection',
    // TODO: confirm tier names with owner
    tiers: [
      { label: 'Standard', price: 1000 },
      { label: 'Premium', price: 2000 },
    ],
    currency: 'KES',
  },
  {
    id: 'exterior-detailing',
    name: 'Exterior Detailing',
    category: 'Exterior & Protection',
    priceFrom: 1000,
    priceTo: 2000,
    currency: 'KES',
    note: RANGE_PRICE_NOTE,
  },

  // RESTORATION
  {
    id: 'restoration-plastic',
    name: 'Plastic Restoration',
    category: 'Restoration',
    // TODO: confirm tier names with owner
    tiers: [
      { label: 'Standard', price: 1000 },
      { label: 'Premium', price: 2000 },
    ],
    currency: 'KES',
  },
  {
    id: 'restoration-headlight',
    name: 'Headlight Restoration',
    category: 'Restoration',
    // TODO: confirm tier names with owner
    tiers: [
      { label: 'Standard', price: 500 },
      { label: 'Premium', price: 1000 },
    ],
    currency: 'KES',
  },
  {
    id: 'restoration-wheel-cleaning',
    name: 'Wheel Cleaning',
    category: 'Restoration',
    price: 2000,
    currency: 'KES',
  },

  // ENGINE
  {
    id: 'engine-wash',
    name: 'Engine Wash',
    category: 'Engine',
    price: 300,
    currency: 'KES',
  },
  {
    id: 'engine-degreasing',
    name: 'Engine Degreasing',
    category: 'Engine',
    price: 600,
    currency: 'KES',
  },
  {
    id: 'engine-detailing',
    name: 'Engine Detailing',
    category: 'Engine',
    price: 2000,
    currency: 'KES',
  },
];
