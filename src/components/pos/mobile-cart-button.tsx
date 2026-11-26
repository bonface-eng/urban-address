'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowRight, ShoppingCart } from 'lucide-react';

interface MobileCartButtonProps {
  itemCount: number;
  onClick: () => void;
}

/** Persistent mobile shortcut positioned just above the application bottom bar. */
export function MobileCartButton({ itemCount, onClick }: MobileCartButtonProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  return createPortal((
    <button
      type="button"
      onClick={onClick}
      aria-label={`Open cart, ${itemCount} ${itemCount === 1 ? 'item' : 'items'}`}
      className="fixed right-4 bottom-[calc(4.25rem+env(safe-area-inset-bottom)+0.75rem)] z-[70] inline-flex min-h-12 items-center gap-2.5 rounded-lg bg-orange-500 px-5 text-sm font-bold text-white shadow-[0_8px_24px_rgba(249,115,22,0.3)] transition hover:bg-orange-600 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 md:hidden"
    >
      <ShoppingCart aria-hidden="true" className="h-4 w-4" />
      <span>Cart</span>
      <span className="min-w-5 rounded-full bg-white/20 px-1.5 py-0.5 text-center text-[11px] tabular-nums">{itemCount}</span>
      <ArrowRight aria-hidden="true" className="h-4 w-4" />
    </button>
  ), document.body);
}
