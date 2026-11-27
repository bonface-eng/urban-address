import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import InventoryCatalogue from './page';
const mocks = vi.hoisted(() => ({ state: {} as any, query: vi.fn() }));
vi.mock('@/firebase', () => ({ useFirestore: () => 'db', useCollection: () => { throw new Error('Management inventory must not subscribe through the browser.'); } }));
vi.mock('@/hooks/use-staff-inventory', () => ({ useStaffInventory: (retry: number) => { mocks.query(retry); return mocks.state; } }));
vi.mock('@/hooks/use-profile', () => ({ useProfile: () => ({ profile: { uid: 'staff' }, isSuperAdmin: true }) }));
vi.mock('firebase/firestore', () => ({ collection: vi.fn(), query: mocks.query, orderBy: vi.fn(), addDoc: vi.fn(), where: vi.fn(), doc: vi.fn(), updateDoc: vi.fn(), deleteDoc: vi.fn(), getDocs: vi.fn(), limit: vi.fn(), writeBatch: vi.fn() }));
vi.mock('@/components/shared/image-upload', () => ({ ImageUpload: () => null }));
vi.mock('@/components/pos/receipt-preview', () => ({ ReceiptPreview: () => null }));
const stock = { id: 'a', unit: 'STORE', name: 'Engine Oil', category: 'Oils', price: 100, costPrice: 50, stockLevel: 12, minStock: 2 };
beforeEach(() => { localStorage.clear(); vi.clearAllMocks(); mocks.query.mockReturnValue({}); mocks.state = { data: [], loading: false, error: null }; });
afterEach(cleanup);
describe('inventory page query-state integration', () => {
  it('keeps server authorization denial blocked and hides misleading zero-valued metrics', () => {
    mocks.state.error = { code: 'INVENTORY_STAFF_REQUIRED' };
    render(<InventoryCatalogue />);
    expect(screen.getByRole('alert')).toHaveTextContent('INVENTORY_STAFF_REQUIRED');
    expect(screen.queryByText('Total Items')).not.toBeInTheDocument();
    const count = mocks.query.mock.calls.length;
    fireEvent.click(screen.getByText('Retry inventory'));
    expect(mocks.query.mock.calls.length).toBeGreaterThan(count);
  });
  it('shows a pending request instead of an empty table', () => {
    mocks.state.loading = true;
    render(<InventoryCatalogue />);
    expect(screen.getByRole('status')).toHaveTextContent('Loading inventory');
    expect(screen.queryByText('Total Items')).not.toBeInTheDocument();
  });
  it('recovers invalid saved department/status filters without editing data', () => {
    localStorage.setItem('uax_inventory_unit', 'UNKNOWN'); localStorage.setItem('uax_inventory_status', 'BAD');
    mocks.state.data = [stock];
    render(<InventoryCatalogue />);
    expect(screen.getByText('Engine Oil')).toBeInTheDocument();
  });
  it('reset filters restores records hidden by saved stock status', () => {
    localStorage.setItem('uax_inventory_status', 'OUT'); mocks.state.data = [stock];
    render(<InventoryCatalogue />);
    expect(screen.getByRole('status')).toHaveTextContent('1 records loaded');
    fireEvent.click(screen.getByText('Reset filters'));
    expect(screen.getByText('Engine Oil')).toBeInTheDocument();
  });
  it('loads management inventory from the server hook without a browser collection subscription', () => {
    mocks.state.data = [stock];
    render(<InventoryCatalogue />);
    expect(screen.getByText('Engine Oil')).toBeInTheDocument();
    expect(mocks.query).toHaveBeenCalledWith(0);
    fireEvent.click(screen.getByText('Refresh inventory'));
    expect(mocks.query).toHaveBeenLastCalledWith(1);
  });

});
