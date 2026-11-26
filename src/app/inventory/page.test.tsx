
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import InventoryCatalogue from './page';
import { mockUseCollection, mockUseProfile } from '@/test/setup';

describe('Master Catalog Operations', () => {
  it('opens product registry dialog on button click', () => {
    mockUseCollection.mockReturnValue({ data: [], loading: false });
    render(<InventoryCatalogue />);
    
    const addBtn = screen.getByText(/Add Product/i);
    fireEvent.click(addBtn);
    
    expect(screen.getByText(/Inventory Registry/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Full description/i)).toBeInTheDocument();
  });

  it('switches between unit catalogs correctly', () => {
    mockUseCollection.mockReturnValue({
      data: [
        { id: '1', name: 'Engine Oil', unit: 'STORE', category: 'Oils', price: 1000 },
        { id: '2', name: 'Espresso', unit: 'LOUNGE', category: 'Drinks', price: 200 }
      ],
      loading: false
    });

    render(<InventoryCatalogue />);
    
    expect(screen.getByText(/Engine Oil/i)).toBeInTheDocument();
    expect(screen.getByText(/Espresso/i)).toBeInTheDocument();
  });

  it('triggers delete confirmation for admin users', async () => {
    mockUseProfile.mockReturnValue({
      isSuperAdmin: true,
      profile: { uid: 'admin' },
      role: 'ADMIN'
    } as any);

    mockUseCollection.mockReturnValue({
      data: [{ id: '1', name: 'Scrap Item', unit: 'STORE', category: 'Other', price: 0 }],
      loading: false
    });

    window.confirm = vi.fn(() => true);
    render(<InventoryCatalogue />);
    
    const row = screen.getByText(/Scrap Item/i).closest('tr');
    const deleteBtn = row?.querySelector('button:last-child');
    
    if (deleteBtn) fireEvent.click(deleteBtn);
    expect(window.confirm).toHaveBeenCalled();
  });
});
