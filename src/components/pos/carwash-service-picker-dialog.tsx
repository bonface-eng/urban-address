'use client';

import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  CarWashService,
  CarWashServiceTier,
  formatKes,
  formatKesRange,
} from '@/data/carWashServices';
import { cn } from '@/lib/utils';

interface CarWashServicePickerDialogProps {
  service: CarWashService | null;
  onClose: () => void;
  onConfirmRange: (service: CarWashService, chosenPrice: number) => void;
  onConfirmTier: (service: CarWashService, tier: CarWashServiceTier) => void;
}

export function CarWashServicePickerDialog({
  service,
  onClose,
  onConfirmRange,
  onConfirmTier,
}: CarWashServicePickerDialogProps) {
  const [rangePrice, setRangePrice] = useState('');
  const [rangeError, setRangeError] = useState('');

  useEffect(() => {
    if (service?.pricingType === 'range' && typeof service.priceFrom === 'number') {
      setRangePrice(String(service.priceFrom));
      setRangeError('');
    } else {
      setRangePrice('');
      setRangeError('');
    }
  }, [service]);

  if (!service) return null;

  const handleRangeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const min = service.priceFrom ?? 0;
    const max = service.priceTo ?? Number.MAX_SAFE_INTEGER;
    const parsed = Number(rangePrice);

    if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
      setRangeError(`Enter an amount between ${formatKes(min)} and ${formatKes(max)}.`);
      return;
    }

    onConfirmRange(service, parsed);
    onClose();
  };

  return (
    <Dialog open={Boolean(service)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-black uppercase tracking-tight text-zinc-900">
            {service.name}
          </DialogTitle>
          <DialogDescription>
            {service.pricingType === 'range' &&
            typeof service.priceFrom === 'number' &&
            typeof service.priceTo === 'number'
              ? `Allowed range: ${formatKesRange(service.priceFrom, service.priceTo)}.`
              : 'Select an option to add to the cart.'}
          </DialogDescription>
        </DialogHeader>

        {service.pricingType === 'range' &&
          typeof service.priceFrom === 'number' &&
          typeof service.priceTo === 'number' && (
            <form onSubmit={handleRangeSubmit} noValidate className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="pos-range-price" className="text-xs font-bold uppercase tracking-wider text-zinc-600">
                  Final Price (KES)
                </Label>
                <Input
                  id="pos-range-price"
                  type="number"
                  min={service.priceFrom}
                  max={service.priceTo}
                  step="1"
                  value={rangePrice}
                  onChange={(e) => {
                    setRangePrice(e.target.value);
                    setRangeError('');
                  }}
                  className="h-12 text-lg font-black"
                  autoFocus
                />
                <p className="text-xs text-zinc-500">
                  Hint: {formatKesRange(service.priceFrom, service.priceTo)}
                  {service.note ? ` — ${service.note}` : ''}
                </p>
                {rangeError && (
                  <p role="alert" className="text-xs font-semibold text-red-600">
                    {rangeError}
                  </p>
                )}
              </div>
              <DialogFooter className="gap-2">
                <Button type="button" variant="outline" onClick={onClose} className="h-11">
                  Cancel
                </Button>
                <Button type="submit" className="h-11 bg-primary text-white font-black uppercase text-xs">
                  Add to Cart
                </Button>
              </DialogFooter>
            </form>
          )}

        {service.pricingType === 'tiers' && service.tiers && service.tiers.length > 0 && (
          <div className="space-y-3">
            <div className="grid grid-cols-1 gap-2.5">
              {service.tiers.map((tier) => (
                <button
                  key={tier.label}
                  type="button"
                  onClick={() => {
                    onConfirmTier(service, tier);
                    onClose();
                  }}
                  className={cn(
                    'flex min-h-[52px] items-center justify-between rounded-xl border border-zinc-200 bg-white px-4 py-3 text-left transition-all',
                    'hover:border-primary hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary'
                  )}
                >
                  <span className="font-bold text-zinc-900">{tier.label}</span>
                  <span className="font-headline font-black text-primary">{formatKes(tier.price)}</span>
                </button>
              ))}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose} className="h-11 w-full sm:w-auto">
                Cancel
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
