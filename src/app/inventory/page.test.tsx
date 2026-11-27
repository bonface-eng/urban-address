
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import InventoryCatalogue from './page';
import { mockUseCollection, mockUseProfile } from '@/test/setup';

describe('Master Catalog Operations', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', '/inventory');
    localStorage.clear();
  });
  it('opens product registry dialog on button click', () => {
    mockUseCollection.mockReturnValue({ data: [], loading: false });
    render(<InventoryCatalogue />);
    
    const addBtn = screen.getByRole('button', { name: /Add Item/i });
    fireEvent.click(addBtn);
    
    expect(screen.getByText(/Add product/i)).toBeInTheDocument();
    expect(screen.getByText(/Product information/i)).toBeInTheDocument();
  });

  it('switches between unit catalogs correctly', () => {
    mockUseCollection.mockReturnValue({
      data: [
        { id: '1', name: 'Engine Oil', unit: 'STORE', category: 'Oils', price: 1000, stockLevel: 5, minStock: 1 },
        { id: '2', name: 'Espresso', unit: 'LOUNGE', category: 'Drinks', price: 200, stockLevel: 10, minStock: 2 }
      ],
      loading: false
    });

    render(<InventoryCatalogue />);
    
    expect(screen.getByText(/Engine Oil/i)).toBeInTheDocument();
    expect(screen.queryByText(/Espresso/i)).not.toBeInTheDocument();
  });

  it('opens product details workflow for inventory rows', async () => {
    mockUseProfile.mockReturnValue({
      isSuperAdmin: true,
      profile: { uid: 'admin' },
      role: 'ADMIN'
    } as any);

    mockUseCollection.mockReturnValue({
      data: [{ id: '1', name: 'Scrap Item', unit: 'STORE', category: 'Other', price: 0, stockLevel: 0, minStock: 0 }],
      loading: false
    });

    render(<InventoryCatalogue />);
    
    const row = screen.getByText(/Scrap Item/i).closest('tr');
    const actionButtons = row?.querySelectorAll('button');
    expect(actionButtons && actionButtons.length).toBeGreaterThan(0);
  });
});
