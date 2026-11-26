'use client';

import React from 'react';
import { Minus, Plus, Trash2 } from 'lucide-react';

interface POSCartItemProps {
  item: any;
  onUpdate: (id: string, delta: number) => void;
  onRemove: (id: string) => void;
}

export function POSCartItem({ item, onUpdate, onRemove }: POSCartItemProps) {
  return (
    <div className="ua-pos-cart-item flex min-w-0 gap-3 bg-white p-3 sm:gap-4 sm:p-4 rounded-xl sm:rounded-[1.5rem] ring-1 ring-zinc-50 group shadow-sm">
      <div className="flex-1 min-w-0">
        <div className="flex min-w-0 flex-wrap items-start justify-between gap-2 mb-3">
          <div>
            <h4 className="text-[11px] font-black text-zinc-900 uppercase truncate leading-none">{item.name}</h4>
            <p className="text-[9px] font-bold text-zinc-400 uppercase mt-1">Unit: KES {item.price.toLocaleString()}</p>
          </div>
          <span className="text-xs font-black text-zinc-900 ml-2 tracking-tight">KES {(item.price * item.quantity).toLocaleString()}</span>
        </div>
        <div className="flex items-center gap-2 sm:gap-4">
          <div className="flex items-center bg-zinc-50 rounded-xl p-1 ring-1 ring-zinc-100 h-10">
            <button type="button" aria-label={`Decrease ${item.name} quantity`} 
              onClick={() => onUpdate(item.id, -1)} 
              className="w-10 h-full flex items-center justify-center text-zinc-400 hover:text-primary active:scale-90"
            >
              <Minus className="w-4 h-4"/>
            </button>
            <span className="text-xs font-black w-8 text-center">{item.quantity}</span>
            <button type="button" aria-label={`Increase ${item.name} quantity`} 
              onClick={() => onUpdate(item.id, 1)} 
              className="w-10 h-full flex items-center justify-center text-zinc-400 hover:text-primary active:scale-90"
            >
              <Plus className="w-4 h-4"/>
            </button>
          </div>
          <button type="button" aria-label={`Remove ${item.name} from cart`} 
            onClick={() => onRemove(item.id)} 
            className="ml-auto w-10 h-10 flex items-center justify-center text-zinc-200 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
          >
            <Trash2 className="w-4 h-4"/>
          </button>
        </div>
      </div>
    </div>
  );
}