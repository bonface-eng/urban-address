
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
  const isOutOfStock = !isCarwash && (product.stockLevel || 0) <= 0;
  
  // Use custom commission percentage if defined, otherwise fallback to 30%
  const commissionPercent = product.commission !== undefined && product.commission > 0 
    ? product.commission 
    : 30;

  return (
    <button 
      onClick={() => !isOutOfStock && onAdd(product)}
      disabled={isOutOfStock}
      className={cn(
        "flex items-center justify-between p-5 bg-white rounded-[1.5rem] ring-1 ring-zinc-100 transition-all text-left group active:scale-[0.98] min-h-[80px]",
        isOutOfStock 
          ? "opacity-60 grayscale cursor-not-allowed bg-zinc-50" 
          : "hover:ring-primary/40 hover:bg-primary/5 active:scale-[0.98]"
      )}
    >
      <div className="flex-1 min-w-0 pr-4">
        <div className="flex items-center gap-2 mb-1.5">
          <span className={cn(
            "text-sm font-black uppercase truncate",
            isOutOfStock ? "text-zinc-400" : "text-zinc-900"
          )}>
            {product.name}
          </span>
          {product.size && !isOutOfStock && (
            <Badge className={cn(
              "text-[8px] font-black border-none uppercase px-2 py-0.5",
              product.sizeUnit === 'Shot' 
                ? "bg-amber-100 text-amber-700" 
                : "bg-primary/10 text-primary"
            )}>
              {product.size}{product.sizeUnit}
            </Badge>
          )}
          {isOutOfStock && (
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
            <p className="text-[8px] font-black uppercase text-zinc-300 tracking-widest">
              Stock: {product.stockLevel}
            </p>
          )}
        </div>
      </div>
      <div className="text-right flex items-center gap-6">
        <span className={cn(
          "text-sm font-black whitespace-nowrap tracking-tight",
          isOutOfStock ? "text-zinc-300" : "text-zinc-900"
        )}>
          KES {product.price.toLocaleString()}
        </span>
        <div className={cn(
          "w-12 h-12 rounded-2xl flex items-center justify-center transition-all border",
          isOutOfStock 
            ? "bg-zinc-100 text-zinc-200 border-zinc-100" 
            : "bg-zinc-50 text-zinc-400 group-hover:bg-primary group-hover:text-white group-hover:shadow-lg group-hover:shadow-primary/20 border-zinc-100"
        )}>
          {isOutOfStock ? <AlertCircle className="w-5 h-5" /> : <Plus className="w-6 h-6" />}
        </div>
      </div>
    </button>
  );
}
