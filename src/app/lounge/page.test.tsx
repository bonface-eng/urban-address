
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import LoungePOS from './page';
import { mockUseCollection, mockUseProfile } from '@/test/setup';

describe('Lounge POS Station Logic', () => {
  it('renders table selection and category filters', () => {
    mockUseCollection.mockReturnValue({ data: [], loading: false, error: null });
    render(<LoungePOS />);
    
    expect(screen.getByPlaceholderText(/TABLE/i)).toBeInTheDocument();
    expect(screen.getByText(/Drinks/i)).toBeInTheDocument();
    expect(screen.getByText(/Popular/i)).toBeInTheDocument();
  });

  it('adds items to cart and calculates total', async () => {
    const mockProducts = [
      { id: 'p1', name: 'Black Coffee', price: 250, unit: 'LOUNGE', category: 'Drinks', stockLevel: 100 }
    ];
    
    mockUseCollection.mockReturnValue({ data: mockProducts, loading: false, error: null });
    render(<LoungePOS />);

    const item = screen.getByText(/Black Coffee/i);
    fireEvent.click(item);

    await waitFor(() => {
      expect(screen.getByText(/KES 250/i)).toBeInTheDocument();
      expect(screen.getByText(/Cart/i)).toBeInTheDocument();
    });
  });

  it('prevents adding out of stock items', async () => {
    const mockProducts = [
      { id: 'p2', name: 'Sold Out Item', price: 500, unit: 'LOUNGE', category: 'Food', stockLevel: 0 }
    ];
    
    mockUseCollection.mockReturnValue({ data: mockProducts, loading: false, error: null });
    render(<LoungePOS />);

    const item = screen.getByText(/Sold Out Item/i).closest('button');
    expect(item).toBeDisabled();
  });
});
