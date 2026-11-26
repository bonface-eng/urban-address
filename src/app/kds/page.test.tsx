
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import KitchenDisplaySystem from './page';
import { mockUseCollection } from '@/test/setup';

describe('Kitchen Display System (KDS)', () => {
  it('strictly filters for orders containing Food items', () => {
    mockUseCollection.mockReturnValue({
      data: [
        { id: 'o1', items: [{ category: 'Food', name: 'Burger', quantity: 1 }], status: 'PAID', timestamp: Date.now() },
        { id: 'o2', items: [{ category: 'Drinks', name: 'Soda', quantity: 1 }], status: 'PAID', timestamp: Date.now() }
      ],
      loading: false
    });

    render(<KitchenDisplaySystem />);
    
    expect(screen.getByText(/Burger/i)).toBeInTheDocument();
    expect(screen.queryByText(/Soda/i)).not.toBeInTheDocument();
  });

  it('shows Table number clearly for waitstaff coordination', () => {
    mockUseCollection.mockReturnValue({
      data: [{ id: 'o1', tableNumber: 'T12', items: [{ category: 'Food', name: 'Burger', quantity: 1 }], status: 'PAID', timestamp: Date.now() }],
      loading: false
    });

    render(<KitchenDisplaySystem />);
    expect(screen.getByText('T12')).toBeInTheDocument();
  });
});
