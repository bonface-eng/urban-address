import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import InventoryCatalogue from './page';
const mocks = vi.hoisted(() => ({ state: {} as any, query: vi.fn(), save: vi.fn(), toast: vi.fn() }));
vi.mock('@/firebase', () => ({ useFirestore: () => 'db', useUser: () => ({ user: { uid: 'staff' } }), useCollection: () => { throw new Error('Management inventory must not subscribe through the browser.'); } }));
vi.mock('@/hooks/use-staff-inventory', () => ({ useStaffInventory: (retry: number) => { mocks.query(retry); return mocks.state; } }));
vi.mock('@/lib/inventory-update-client', () => ({ saveInventoryUpdate: mocks.save }));
vi.mock('@/hooks/use-toast', () => ({ toast: mocks.toast }));
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

  it('keeps the edit form and entered stock when server save fails', async () => {
    mocks.state.data = [stock]; mocks.save.mockRejectedValue(new Error('Stock changed. Ref: INVENTORY_STOCK_CONFLICT'));
    render(<InventoryCatalogue />);
    fireEvent.click(screen.getByText('Engine Oil').closest('tr')!.querySelector('button[data-edit]')!);
    const dialog = screen.getByRole('dialog');
    const stockInput = dialog.querySelector('input[data-stock]')!;
    fireEvent.change(stockInput, { target: { value: '25' } });
    fireEvent.submit(stockInput.closest('form')!);
    await waitFor(() => expect(mocks.save).toHaveBeenCalled());
    expect(mocks.save).toHaveBeenCalledWith(expect.objectContaining({ uid: 'staff' }), expect.objectContaining({ id: 'a', expectedStock: 12, changes: expect.objectContaining({ stockLevel: 25 }) }));
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());
    expect(stockInput).toHaveValue(25);
    expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Item save failed' }));
  });
  it('closes the edit form only after server acknowledgement', async () => {
    mocks.state.data = [stock]; mocks.save.mockResolvedValue({ success: true, stockLevel: 12 });
    render(<InventoryCatalogue />);
    fireEvent.click(screen.getByText('Engine Oil').closest('tr')!.querySelector('button[data-edit]')!);
    fireEvent.submit(screen.getByRole('button', { name: 'Authorize SKU Record' }).closest('form')!);
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(mocks.save).toHaveBeenCalledTimes(1);
  });

});
