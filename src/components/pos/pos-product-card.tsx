
'use client';

import React from 'react';
import { Plus, Tag, Wine, Coffee, Coins, AlertCircle } from 'lucide-react';
import { Product } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

interface POSProductCardProps {
  product: Product;
  onAdd: (product: Product) => void;
}

export function POSProductCard({ product, onAdd }: POSProductCardProps) {
  const isAlcohol = product.sizeUnit === 'Shot' || (product.unit === 'LOUNGE' && product.category === 'Drinks');
  const isCarwash = product.unit === 'CARWASH';
  const isNeedsPrice = product.price === null || product.price === undefined || product.price <= 0;
  const hasUntrackedStock = (product as any).track_stock === false || product.stockLevel === null || product.stockLevel === undefined;
  const isOutOfStock = !isCarwash && !hasUntrackedStock && (product.stockLevel || 0) <= 0;
  const isDisabled = isNeedsPrice || isOutOfStock;
  
  // Use custom commission percentage if defined, otherwise fallback to 30%
  const commissionPercent = product.commission !== undefined && product.commission > 0 
    ? product.commission 
    : 30;

  return (
    <button 
      onClick={() => !isDisabled && onAdd(product)}
      disabled={isDisabled}
      className={cn(
        "flex min-w-0 items-center justify-between gap-2 p-3 sm:p-5 bg-white rounded-xl sm:rounded-[1.5rem] ring-1 ring-zinc-100 transition-all text-left group active:scale-[0.98] min-h-[72px] sm:min-h-[80px]",
        isDisabled 
          ? "opacity-60 grayscale cursor-not-allowed bg-zinc-50" 
          : "hover:ring-primary/40 hover:bg-primary/5 active:scale-[0.98]"
      )}
    >
      <div className="flex-1 min-w-0 pr-1 sm:pr-4">
        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
          <span className={cn(
            "text-sm font-black uppercase truncate",
            isDisabled ? "text-zinc-400" : "text-zinc-900"
          )}>
            {product.name}
          </span>
          {product.size && !isDisabled && (
            <Badge className={cn(
              "text-[8px] font-black border-none uppercase px-2 py-0.5",
              product.sizeUnit === 'Shot' 
                ? "bg-amber-100 text-amber-700" 
                : "bg-primary/10 text-primary"
            )}>
              {product.size}{product.sizeUnit || ''}
            </Badge>
          )}
          {isNeedsPrice && (
            <Badge className="bg-amber-500 text-white border-none uppercase font-black text-[7px] px-2 h-4">
              Set Price in Inventory
            </Badge>
          )}
          {!isNeedsPrice && isOutOfStock && (
            <Badge className="bg-red-500 text-white border-none uppercase font-black text-[7px] px-2 h-4 animate-pulse">
              Out of Stock
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 opacity-60">
            {isAlcohol ? (
              <Wine className="w-3 h-3 text-amber-600" />
            ) : product.unit === 'LOUNGE' ? (
              <Coffee className="w-3 h-3 text-zinc-400" />
            ) : (
              <Tag className="w-3 h-3 text-zinc-400" />
            )}
            <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest truncate">
              {product.category}
            </p>
          </div>
          {isCarwash && (
            <div className="flex items-center gap-1 text-green-600">
              <Coins className="w-3 h-3" />
              <p className="text-[8px] font-black uppercase tracking-widest">{commissionPercent}% Comm.</p>
            </div>
          )}
          {!isCarwash && !isOutOfStock && (
            <p className="text-[8px] font-black uppercase text-zinc-400 tracking-widest">
              {hasUntrackedStock ? 'Stock: Untracked' : `Stock: ${product.stockLevel}`}
            </p>
          )}
        </div>
      </div>
      <div className="shrink-0 text-right flex items-center gap-2 sm:gap-6">
        <span className={cn(
          "text-xs sm:text-sm font-black whitespace-nowrap tracking-tight",
          isDisabled ? "text-zinc-400 italic" : "text-zinc-900"
        )}>
          {isNeedsPrice ? 'Price Required' : `KES ${(product.price || 0).toLocaleString()}`}
        </span>
        <div className={cn(
          "w-9 h-9 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl flex items-center justify-center transition-all border",
          isDisabled 
            ? "bg-zinc-100 text-zinc-300 border-zinc-100" 
            : "bg-zinc-50 text-zinc-400 group-hover:bg-primary group-hover:text-white group-hover:shadow-lg group-hover:shadow-primary/20 border-zinc-100"
        )}>
          {isDisabled ? <AlertCircle className="w-5 h-5 text-amber-500" /> : <Plus className="w-5 h-5 sm:w-6 sm:h-6" />}
        </div>
      </div>
    </button>
  );
}
