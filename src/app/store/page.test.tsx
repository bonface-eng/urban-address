
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import StorePOS from './page';
import { mockUseCollection } from '@/test/setup';

describe('Store POS Station Logic', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  it('filters items by category correctly', () => {
    const mockProducts = [
      { id: 's1', name: 'Engine Oil 5W30', category: 'Oils', unit: 'STORE', price: 4500, stockLevel: 10 },
      { id: 's2', name: 'Microfiber Cloth', category: 'Cleaning', unit: 'STORE', price: 500, stockLevel: 50 }
    ];
    
    mockUseCollection.mockReturnValue({ data: mockProducts, loading: false, error: null });
    render(<StorePOS />);

    const oilTab = screen.getByRole('button', { name: 'Oils' });
    fireEvent.click(oilTab);

    expect(screen.getByText(/Engine Oil 5W30/i)).toBeInTheDocument();
    expect(screen.queryByText(/Microfiber Cloth/i)).not.toBeInTheDocument();
  });

  it('updates quantity in cart', async () => {
     const mockProducts = [{ id: 's1', name: 'Item', category: 'Parts', unit: 'STORE', price: 100, stockLevel: 10 }];
     mockUseCollection.mockReturnValue({ data: mockProducts, loading: false, error: null });
     render(<StorePOS />);

     fireEvent.click(screen.getByText(/Item/i));
     
     await waitFor(() => {
       const plusBtn = screen.getByRole('button', { name: /Increase Item quantity/i });
       fireEvent.click(plusBtn);
     });

     expect(screen.getAllByText(/KES 200/i).length).toBeGreaterThan(0);
  });
});
