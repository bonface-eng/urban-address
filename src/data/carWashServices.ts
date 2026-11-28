export type CarWashCategory =
  | 'Wash'
  | 'Interior'
  | 'Exterior & Protection'
  | 'Restoration'
  | 'Engine';

export type CarWashPricingType = 'fixed' | 'range' | 'tiers';

export type VehicleSize = 'STANDARD' | 'SUV';

export interface CarWashServiceTier {
  label: string;
  price: number;
}

export interface VehicleSizePricing {
  standard?: number;
  suv?: number;
}

export interface CarWashService {
  id: string;
  name: string;
  category: CarWashCategory;
  pricingType: CarWashPricingType;
  currency: 'KES';
  price?: number;
  priceFrom?: number;
  priceTo?: number;
  tiers?: CarWashServiceTier[];
  vehicleSizePricing?: VehicleSizePricing;
  isActive: boolean;
  sortOrder: number;
  note?: string;
  commission?: number;
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
  return `KES ${Math.round(amount).toLocaleString('en-KE')}`;
}

export function formatKesRange(from: number, to: number): string {
  return `KES ${Math.round(from).toLocaleString('en-KE')} - ${Math.round(to).toLocaleString('en-KE')}`;
}

export function formatServicePrice(service: CarWashService): string {
  if (service.pricingType === 'fixed' && typeof service.price === 'number') {
    return formatKes(service.price);
  }
  if (
    service.pricingType === 'range' &&
    typeof service.priceFrom === 'number' &&
    typeof service.priceTo === 'number'
  ) {
    return formatKesRange(service.priceFrom, service.priceTo);
  }
  if (service.pricingType === 'tiers' && service.tiers && service.tiers.length > 0) {
    const lowest = Math.min(...service.tiers.map((tier) => tier.price));
    return `From ${formatKes(lowest)}`;
  }
  // Fallback for partial objects
  if (typeof service.price === 'number') return formatKes(service.price);
  if (typeof service.priceFrom === 'number' && typeof service.priceTo === 'number') {
    return formatKesRange(service.priceFrom, service.priceTo);
  }
  return 'Price on request';
}

export function resolveServicePriceForVehicleSize(
  service: CarWashService,
  vehicleSize: VehicleSize
): number | undefined {
  if (vehicleSize === 'SUV' && typeof service.vehicleSizePricing?.suv === 'number') {
    return service.vehicleSizePricing.suv;
  }
  if (vehicleSize === 'STANDARD' && typeof service.vehicleSizePricing?.standard === 'number') {
    return service.vehicleSizePricing.standard;
  }
  return service.price;
}

/**
 * Canonical default/fallback dataset for Urban Auto Express car wash & detailing pricing.
 * Live records are stored in `public.carwash_services` and managed via /admin/carwash-services.
 */
export const CAR_WASH_SERVICES: CarWashService[] = [
  // WASH
  {
    id: 'wash-normal',
    name: 'Normal Wash',
    category: 'Wash',
    pricingType: 'fixed',
    price: 300,
    vehicleSizePricing: { standard: 300, suv: 400 },
    currency: 'KES',
    isActive: true,
    sortOrder: 10,
    commission: 30,
  },
  {
    id: 'wash-normal-suv',
    name: 'Normal Wash (SUV)',
    category: 'Wash',
    pricingType: 'fixed',
    price: 400,
    vehicleSizePricing: { standard: 400, suv: 400 },
    currency: 'KES',
    isActive: true,
    sortOrder: 20,
    commission: 30,
  },
  {
    id: 'wash-exterior',
    name: 'Exterior Wash',
    category: 'Wash',
    pricingType: 'fixed',
    price: 200,
    currency: 'KES',
    isActive: true,
    sortOrder: 30,
    commission: 30,
  },

  // INTERIOR
  {
    id: 'interior-vacuum',
    name: 'Vacuum',
    category: 'Interior',
    pricingType: 'fixed',
    price: 300,
    currency: 'KES',
    isActive: true,
    sortOrder: 40,
    commission: 30,
  },
  {
    id: 'interior-dashboard-cleaning',
    name: 'Dashboard Cleaning',
    category: 'Interior',
    pricingType: 'fixed',
    price: 300,
    currency: 'KES',
    isActive: true,
    sortOrder: 50,
    commission: 30,
  },
  {
    id: 'interior-leather-treatment',
    name: 'Leather Treatment',
    category: 'Interior',
    pricingType: 'fixed',
    price: 300,
    currency: 'KES',
    isActive: true,
    sortOrder: 60,
    commission: 30,
  },
  {
    id: 'interior-roof-cleaning',
    name: 'Roof Cleaning',
    category: 'Interior',
    pricingType: 'range',
    priceFrom: 1000,
    priceTo: 1500,
    currency: 'KES',
    isActive: true,
    sortOrder: 70,
    note: RANGE_PRICE_NOTE,
    commission: 30,
  },
  {
    id: 'interior-detailing',
    name: 'Interior Detailing',
    category: 'Interior',
    pricingType: 'range',
    priceFrom: 3500,
    priceTo: 5000,
    currency: 'KES',
    isActive: true,
    sortOrder: 80,
    note: RANGE_PRICE_NOTE,
    commission: 30,
  },

  // EXTERIOR & PROTECTION
  {
    id: 'exterior-tire-shine',
    name: 'Tire Shine',
    category: 'Exterior & Protection',
    pricingType: 'fixed',
    price: 400,
    currency: 'KES',
    isActive: true,
    sortOrder: 90,
    commission: 30,
  },
  {
    id: 'exterior-wax',
    name: 'Wax',
    category: 'Exterior & Protection',
    pricingType: 'fixed',
    price: 300,
    currency: 'KES',
    isActive: true,
    sortOrder: 100,
    commission: 30,
  },
  {
    id: 'exterior-buffing-polishing',
    name: 'Buffing / Polishing',
    category: 'Exterior & Protection',
    pricingType: 'range',
    priceFrom: 500,
    priceTo: 4500,
    currency: 'KES',
    isActive: true,
    sortOrder: 110,
    note: RANGE_PRICE_NOTE,
    commission: 30,
  },
  {
    id: 'exterior-watermark-removal',
    name: 'Watermark Removal',
    category: 'Exterior & Protection',
    pricingType: 'tiers',
    // TODO: confirm tier names with owner
    tiers: [
      { label: 'Option 1', price: 1000 },
      { label: 'Option 2', price: 2000 },
    ],
    currency: 'KES',
    isActive: true,
    sortOrder: 120,
    commission: 30,
  },
  {
    id: 'exterior-detailing',
    name: 'Exterior Detailing',
    category: 'Exterior & Protection',
    pricingType: 'range',
    priceFrom: 1000,
    priceTo: 2000,
    currency: 'KES',
    isActive: true,
    sortOrder: 130,
    note: RANGE_PRICE_NOTE,
    commission: 30,
  },

  // RESTORATION
  {
    id: 'restoration-plastic',
    name: 'Plastic Restoration',
    category: 'Restoration',
    pricingType: 'tiers',
    // TODO: confirm tier names with owner
    tiers: [
      { label: 'Option 1', price: 1000 },
      { label: 'Option 2', price: 2000 },
    ],
    currency: 'KES',
    isActive: true,
    sortOrder: 140,
    commission: 30,
  },
  {
    id: 'restoration-headlight',
    name: 'Headlight Restoration',
    category: 'Restoration',
    pricingType: 'tiers',
    // TODO: confirm tier names with owner
    tiers: [
      { label: 'Option 1', price: 500 },
      { label: 'Option 2', price: 1000 },
    ],
    currency: 'KES',
    isActive: true,
    sortOrder: 150,
    commission: 30,
  },
  {
    id: 'restoration-wheel-cleaning',
    name: 'Wheel Cleaning',
    category: 'Restoration',
    pricingType: 'fixed',
    price: 2000,
    currency: 'KES',
    isActive: true,
    sortOrder: 160,
    commission: 30,
  },

  // ENGINE
  {
    id: 'engine-wash',
    name: 'Engine Wash',
    category: 'Engine',
    pricingType: 'fixed',
    price: 300,
    currency: 'KES',
    isActive: true,
    sortOrder: 170,
    commission: 30,
  },
  {
    id: 'engine-degreasing',
    name: 'Engine Degreasing',
    category: 'Engine',
    pricingType: 'fixed',
    price: 600,
    currency: 'KES',
    isActive: true,
    sortOrder: 180,
    commission: 30,
  },
  {
    id: 'engine-detailing',
    name: 'Engine Detailing',
    category: 'Engine',
    pricingType: 'fixed',
    price: 2000,
    currency: 'KES',
    isActive: true,
    sortOrder: 190,
    commission: 30,
  },
];
