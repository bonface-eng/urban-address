'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { Product } from '@/lib/types';

export interface CartItem extends Product {
  quantity: number;
}

interface CartContextType {
  items: CartItem[];
  addToCart: (product: Product, quantity?: number) => void;
  removeFromCart: (id: string) => void;
  updateQuantity: (id: string, delta: number) => void;
  clearCart: () => void;
  subtotal: number;
  totalItems: number;
  isLoaded: boolean;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

/**
 * CartProvider
 * Centralizes cart state for the entire client-facing application.
 * Ensures the cart badge in the layout stays in sync with page actions.
 */
export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('urban_cart');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          const validItems = parsed.filter((item: any) =>
            item && typeof item.id === 'string' && item.id.length > 0 &&
            typeof item.name === 'string' && Number.isFinite(Number(item.price)) &&
            Number(item.price) >= 0 && Number.isFinite(Number(item.quantity)) &&
            Number(item.quantity) > 0
          ).map((item: any) => ({
            ...item,
            price: Number(item.price),
            quantity: Math.min(99, Math.max(1, Math.floor(Number(item.quantity))))
          }));
          setItems(validItems);
        }
      } catch (e) {
        console.error('Failed to parse cart');
      }
    }
    setIsLoaded(true);
  }, []);

  // Save to localStorage whenever items change
  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem('urban_cart', JSON.stringify(items));
    }
  }, [items, isLoaded]);

  const addToCart = useCallback((product: Product, quantity: number = 1) => {
    if (!product.id || !Number.isFinite(quantity) || quantity <= 0) return;
    setItems(prev => {
      const existing = prev.find(i => i.id === product.id);
      const maxQuantity = product.unit === 'CARWASH'
        ? 99
        : Math.max(0, Math.floor(Number(product.stockLevel) || 0));
      if (maxQuantity < 1) return prev;
      if (existing) {
        return prev.map(i => i.id === product.id
          ? { ...i, ...product, quantity: Math.min(maxQuantity, existing.quantity + Math.floor(quantity)) }
          : i);
      }
      return [...prev, { ...product, quantity: Math.min(maxQuantity, Math.floor(quantity)) }];
    });
  }, []);

  const removeFromCart = useCallback((id: string) => {
    setItems(prev => prev.filter(i => i.id !== id));
  }, []);

  const updateQuantity = useCallback((id: string, delta: number) => {
    setItems(prev => prev.map(i => {
      if (i.id === id) {
        const maxQuantity = i.unit === 'CARWASH'
          ? 99
          : Math.max(1, Math.floor(Number(i.stockLevel) || 1));
        return { ...i, quantity: Math.min(maxQuantity, Math.max(1, i.quantity + Math.trunc(delta))) };
      }
      return i;
    }));
  }, []);

  const clearCart = useCallback(() => {
    setItems([]);
  }, []);

  const subtotal = useMemo(() => items.reduce((sum, i) => sum + (i.price * i.quantity), 0), [items]);
  const totalItems = useMemo(() => items.reduce((sum, i) => sum + i.quantity, 0), [items]);

  const value = useMemo(() => ({
    items,
    addToCart,
    removeFromCart,
    updateQuantity,
    clearCart,
    subtotal,
    totalItems,
    isLoaded
  }), [items, addToCart, removeFromCart, updateQuantity, clearCart, subtotal, totalItems, isLoaded]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

/**
 * useCart Hook
 * Consumes the global cart context.
 */
export function useCart() {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}
