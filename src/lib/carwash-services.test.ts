import { describe, expect, it, vi } from 'vitest';
import {
  CAR_WASH_SERVICES,
  formatKes,
  formatKesRange,
  formatServicePrice,
  resolveServicePriceForVehicleSize,
} from '@/data/carWashServices';
import { validateCarWashServiceInput } from './carwash-services';
import { CAR_WASH_SERVICE_SEEDS, seedCarWashServices } from '../../scripts/seed-carwash-services.mjs';

describe('carwash services single source of truth', () => {
  it('formats KES amounts and ranges consistently', () => {
    expect(formatKes(1000)).toBe('KES 1,000');
    expect(formatKesRange(1000, 1500)).toBe('KES 1,000 - 1,500');
    const roof = CAR_WASH_SERVICES.find((s) => s.id === 'interior-roof-cleaning')!;
    expect(formatServicePrice(roof)).toBe('KES 1,000 - 1,500');
  });

  it('resolves Standard vs SUV pricing for Normal Wash', () => {
    const normalWash = CAR_WASH_SERVICES.find((s) => s.id === 'wash-normal')!;
    expect(resolveServicePriceForVehicleSize(normalWash, 'STANDARD')).toBe(300);
    expect(resolveServicePriceForVehicleSize(normalWash, 'SUV')).toBe(400);
  });

  it('validates fixed, range, and tier inputs on client/server', () => {
    expect(
      validateCarWashServiceInput({
        name: '',
        category: 'Wash',
        pricingType: 'fixed',
        price: 300,
      }).valid
    ).toBe(false);

    expect(
      validateCarWashServiceInput({
        name: 'Bad Price',
        category: 'Wash',
        pricingType: 'fixed',
        price: -10,
      }).valid
    ).toBe(false);

    expect(
      validateCarWashServiceInput({
        name: 'Inverted Range',
        category: 'Interior',
        pricingType: 'range',
        priceFrom: 2000,
        priceTo: 1000,
      }).valid
    ).toBe(false);

    expect(
      validateCarWashServiceInput({
        name: 'Valid Range',
        category: 'Interior',
        pricingType: 'range',
        priceFrom: 1000,
        priceTo: 1500,
      }).valid
    ).toBe(true);
  });

  it('seed script runs twice idempotently without creating duplicates', async () => {
    const store = new Map<string, any>();
    const mockSupabase = {
      from: vi.fn(() => ({
        upsert: vi.fn((rows: any[], opts: { onConflict: string; ignoreDuplicates: boolean }) => ({
          select: vi.fn(async () => {
            const inserted: any[] = [];
            for (const row of rows) {
              if (!store.has(row.id)) {
                store.set(row.id, row);
                inserted.push(row);
              } else if (!opts.ignoreDuplicates) {
                store.set(row.id, row);
              }
            }
            return { data: inserted, error: null };
          }),
        })),
      })),
    };

    const first = await seedCarWashServices(mockSupabase);
    const second = await seedCarWashServices(mockSupabase);

    expect(first.inserted).toBe(CAR_WASH_SERVICE_SEEDS.length);
    expect(second.inserted).toBe(0);
    expect(store.size).toBe(19);
  });
});
