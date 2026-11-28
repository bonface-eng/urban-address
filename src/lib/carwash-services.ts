import {
  CAR_WASH_CATEGORIES,
  CarWashCategory,
  CarWashPricingType,
  CarWashService,
  CarWashServiceTier,
  VehicleSizePricing,
} from '@/data/carWashServices';

export interface CarWashServiceInput {
  id?: string;
  name: string;
  category: CarWashCategory;
  pricingType: CarWashPricingType;
  price?: number | null;
  priceFrom?: number | null;
  priceTo?: number | null;
  tiers?: CarWashServiceTier[] | null;
  vehicleSizePricing?: VehicleSizePricing | null;
  isActive?: boolean;
  sortOrder?: number;
  note?: string | null;
  commission?: number | null;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  normalized?: Omit<CarWashService, 'id'> & { id?: string };
}

export function slugifyServiceId(name: string, category: string): string {
  const base = `${category}-${name}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return base || `carwash-${Date.now()}`;
}

export function validateCarWashServiceInput(input: CarWashServiceInput): ValidationResult {
  const errors: string[] = [];

  const name = typeof input.name === 'string' ? input.name.trim() : '';
  if (!name) {
    errors.push('Service name is required.');
  }

  if (!CAR_WASH_CATEGORIES.includes(input.category)) {
    errors.push('Valid category is required.');
  }

  if (!['fixed', 'range', 'tiers'].includes(input.pricingType)) {
    errors.push('Pricing type must be fixed, range, or tiers.');
  }

  let price: number | undefined;
  let priceFrom: number | undefined;
  let priceTo: number | undefined;
  let tiers: CarWashServiceTier[] | undefined;

  if (input.pricingType === 'fixed') {
    const num = Number(input.price);
    if (!Number.isFinite(num) || num <= 0) {
      errors.push('Fixed price must be a positive number.');
    } else {
      price = num;
    }
  } else if (input.pricingType === 'range') {
    const from = Number(input.priceFrom);
    const to = Number(input.priceTo);
    if (!Number.isFinite(from) || from <= 0) {
      errors.push('Minimum price (priceFrom) must be a positive number.');
    }
    if (!Number.isFinite(to) || to <= 0) {
      errors.push('Maximum price (priceTo) must be a positive number.');
    }
    if (Number.isFinite(from) && Number.isFinite(to) && from > to) {
      errors.push('Minimum price cannot be greater than maximum price.');
    }
    if (errors.length === 0) {
      priceFrom = from;
      priceTo = to;
    }
  } else if (input.pricingType === 'tiers') {
    const rawTiers = Array.isArray(input.tiers) ? input.tiers : [];
    if (rawTiers.length === 0) {
      errors.push('At least one pricing tier is required.');
    } else {
      const cleaned: CarWashServiceTier[] = [];
      rawTiers.forEach((tier, idx) => {
        const label = typeof tier?.label === 'string' ? tier.label.trim() : '';
        const tierPrice = Number(tier?.price);
        if (!label) {
          errors.push(`Tier ${idx + 1} label is required.`);
        }
        if (!Number.isFinite(tierPrice) || tierPrice <= 0) {
          errors.push(`Tier ${idx + 1} price must be a positive number.`);
        }
        if (label && Number.isFinite(tierPrice) && tierPrice > 0) {
          cleaned.push({ label, price: tierPrice });
        }
      });
      tiers = cleaned;
    }
  }

  let vehicleSizePricing: VehicleSizePricing | undefined;
  if (input.vehicleSizePricing) {
    const std =
      input.vehicleSizePricing.standard !== undefined && input.vehicleSizePricing.standard !== null
        ? Number(input.vehicleSizePricing.standard)
        : undefined;
    const suv =
      input.vehicleSizePricing.suv !== undefined && input.vehicleSizePricing.suv !== null
        ? Number(input.vehicleSizePricing.suv)
        : undefined;
    if (std !== undefined && (!Number.isFinite(std) || std <= 0)) {
      errors.push('Standard vehicle price must be a positive number.');
    }
    if (suv !== undefined && (!Number.isFinite(suv) || suv <= 0)) {
      errors.push('SUV vehicle price must be a positive number.');
    }
    if (std !== undefined || suv !== undefined) {
      vehicleSizePricing = {
        ...(std !== undefined ? { standard: std } : {}),
        ...(suv !== undefined ? { suv } : {}),
      };
    }
  }

  const commission =
    input.commission !== undefined && input.commission !== null
      ? Number(input.commission)
      : 30;
  if (!Number.isFinite(commission) || commission < 0 || commission > 100) {
    errors.push('Commission must be between 0 and 100.');
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    errors: [],
    normalized: {
      ...(input.id ? { id: input.id.trim() } : {}),
      name,
      category: input.category,
      pricingType: input.pricingType,
      currency: 'KES',
      ...(price !== undefined ? { price } : {}),
      ...(priceFrom !== undefined ? { priceFrom } : {}),
      ...(priceTo !== undefined ? { priceTo } : {}),
      ...(tiers !== undefined ? { tiers } : {}),
      ...(vehicleSizePricing ? { vehicleSizePricing } : {}),
      isActive: input.isActive !== false,
      sortOrder: Number.isFinite(Number(input.sortOrder)) ? Number(input.sortOrder) : 0,
      note: typeof input.note === 'string' && input.note.trim() ? input.note.trim() : undefined,
      commission,
    },
  };
}

export function mapRowToCarWashService(row: Record<string, any>): CarWashService {
  const pricingType = (row.pricing_type || row.pricingType || 'fixed') as CarWashPricingType;
  const price = row.price !== null && row.price !== undefined ? Number(row.price) : undefined;
  const priceFrom = row.price_from !== null && row.price_from !== undefined ? Number(row.price_from) : undefined;
  const priceTo = row.price_to !== null && row.price_to !== undefined ? Number(row.price_to) : undefined;

  return {
    id: String(row.id),
    name: String(row.name),
    category: row.category as CarWashCategory,
    pricingType,
    currency: 'KES',
    ...(price !== undefined && Number.isFinite(price) ? { price } : {}),
    ...(priceFrom !== undefined && Number.isFinite(priceFrom) ? { priceFrom } : {}),
    ...(priceTo !== undefined && Number.isFinite(priceTo) ? { priceTo } : {}),
    ...(Array.isArray(row.tiers) && row.tiers.length > 0 ? { tiers: row.tiers } : {}),
    ...(row.vehicle_size_pricing ? { vehicleSizePricing: row.vehicle_size_pricing } : {}),
    isActive: row.is_active !== false,
    sortOrder: Number.isFinite(Number(row.sort_order)) ? Number(row.sort_order) : 0,
    ...(row.note ? { note: String(row.note) } : {}),
    commission: Number.isFinite(Number(row.commission)) ? Number(row.commission) : 30,
  };
}

export function mapCarWashServiceToRow(service: Omit<CarWashService, 'id'> & { id: string }) {
  return {
    id: service.id,
    name: service.name,
    category: service.category,
    pricing_type: service.pricingType,
    price: service.pricingType === 'fixed' ? (service.price ?? null) : null,
    price_from: service.pricingType === 'range' ? (service.priceFrom ?? null) : null,
    price_to: service.pricingType === 'range' ? (service.priceTo ?? null) : null,
    tiers: service.pricingType === 'tiers' ? (service.tiers ?? null) : null,
    vehicle_size_pricing: service.vehicleSizePricing ?? null,
    currency: 'KES',
    is_active: service.isActive !== false,
    sort_order: service.sortOrder ?? 0,
    note: service.note ?? null,
    commission: service.commission ?? 30,
    updated_at: new Date().toISOString(),
  };
}
