import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CAR_WASH_SERVICES } from '@/data/carWashServices';
import { mockUseCollection } from '@/test/setup';

const mockBatchSet = vi.fn();
const mockBatchUpdate = vi.fn();
const mockBatchDelete = vi.fn();
const mockBatchCommit = vi.fn().mockResolvedValue(undefined);

vi.mock('@/lib/db', () => ({
  getAuth: () => ({ currentUser: { uid: 'cashier-1' } }),
  collection: (_db: any, ...segments: string[]) => ({ path: segments.join('/') }),
  doc: (_dbOrCol: any, ...segments: string[]) => ({
    id: segments[segments.length - 1] || 'generated-order-id',
    path: segments.join('/') || 'orders/generated-order-id',
  }),
  query: (...args: any[]) => args,
  where: (...args: any[]) => args,
  orderBy: (...args: any[]) => args,
  limit: (...args: any[]) => args,
  getDoc: vi.fn().mockResolvedValue({ exists: () => false }),
  updateDoc: vi.fn(),
  increment: (n: number) => n,
  writeBatch: () => ({
    set: mockBatchSet,
    update: mockBatchUpdate,
    delete: mockBatchDelete,
    commit: mockBatchCommit,
  }),
}));

vi.mock('@/hooks/use-terminal', () => ({
  useTerminal: () => ({
    activeTerminal: { id: 'term-1', name: 'Bay 1' },
    activeCashier: { uid: 'cashier-1', displayName: 'Jane Cashier', activeBranchId: 'branch-1' },
    activeRegisterSession: { id: 'reg-1' },
  }),
}));

vi.mock('@/lib/hardware-service', () => ({
  HardwareService: { printReceipt: vi.fn().mockResolvedValue({ success: true }) },
}));

vi.mock('@/lib/telegram/client-notifications', () => ({
  notifyCommittedSale: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/telegram/client-events', () => ({
  notifyTelegramClientEvent: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/hooks/use-barcode-scanner', () => ({
  useBarcodeScanner: vi.fn(),
}));

vi.mock('@/components/pos/customer-lookup', () => ({
  CustomerLookup: () => <div data-testid="customer-lookup">Customer Lookup</div>,
}));

vi.mock('@/components/pos/payment-view', () => ({
  PaymentView: ({ total, onComplete }: { total: number; onComplete: (m: 'CASH' | 'MOBILE') => void }) => (
    <div data-testid="payment-view">
      <span>Pay {total}</span>
      <button type="button" onClick={() => onComplete('CASH')}>
        Complete Cash Sale
      </button>
    </div>
  ),
}));

vi.mock('@/components/pos/receipt-preview', () => ({
  ReceiptPreview: ({ data }: { data: any }) => (
    <div data-testid="receipt-preview">Receipt {data?.total}</div>
  ),
}));

import CarwashPOS from './page';

describe('CarwashPOS end-to-end flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    mockUseCollection.mockReturnValue({ data: [], loading: false, error: null });

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        services: [
          ...CAR_WASH_SERVICES,
          {
            id: 'inactive-service',
            name: 'Hidden Inactive Wash',
            category: 'Wash',
            pricingType: 'fixed',
            price: 999,
            currency: 'KES',
            isActive: false,
            sortOrder: 999,
          },
        ],
      }),
    }) as any;
  });

  it('loads only active services, handles fixed/SUV/range/tier pricing, computes total, and saves checkout', async () => {
    render(<CarwashPOS />);

    // Wait for services to load
    await waitFor(() => {
      expect(screen.getByText('Normal Wash')).toBeInTheDocument();
    });

    // Inactive service must not appear
    expect(screen.queryByText('Hidden Inactive Wash')).not.toBeInTheDocument();

    // Entry card elements are visible and accessible
    expect(screen.getByRole('heading', { name: /Carwash POS Entry/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Recall Bill/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Vehicle/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Carpet/i })).toBeInTheDocument();

    // Enter plate number
    fireEvent.change(screen.getByLabelText(/Plate Number/i), { target: { value: 'KDA 123X' } });

    // 1. Add fixed service: Exterior Wash (KES 200)
    fireEvent.click(screen.getByRole('button', { name: /Exterior Wash/i }));

    // 2. Switch to SUV and add Normal Wash (KES 400)
    fireEvent.click(screen.getByRole('button', { name: /^SUV$/i }));
    const normalWashBtn = screen
      .getAllByRole('button', { name: /^Normal Wash\b/i })
      .find((el) => !el.textContent?.includes('(SUV)'))!;
    fireEvent.click(normalWashBtn);

    // 3. Add range service: Roof Cleaning (1,000 - 1,500), test invalid then valid 1,250
    fireEvent.click(screen.getByRole('button', { name: /Roof Cleaning/i }));
    const rangeInput = screen.getByLabelText(/Final Price/i);
    fireEvent.change(rangeInput, { target: { value: '500' } });
    fireEvent.click(screen.getByRole('button', { name: /Add to Cart/i }));
    expect(screen.getByRole('alert')).toHaveTextContent(/between KES 1,000 and KES 1,500/i);

    fireEvent.change(rangeInput, { target: { value: '1250' } });
    fireEvent.click(screen.getByRole('button', { name: /Add to Cart/i }));

    // 4. Add tier service: Watermark Removal -> Option 2 (KES 2,000)
    fireEvent.click(screen.getByRole('button', { name: /Watermark Removal/i }));
    fireEvent.click(screen.getByRole('button', { name: /Option 2/i }));

    // Running total = 200 + 400 + 1250 + 2000 = KES 3,850
    expect(screen.getAllByText(/KES 3,850/i).length).toBeGreaterThan(0);

    // Increase Exterior Wash quantity by 1 (+200 => KES 4,050) then decrease back (-200 => KES 3,850)
    fireEvent.click(screen.getByRole('button', { name: /Increase Exterior Wash quantity/i }));
    expect(screen.getAllByText(/KES 4,050/i).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: /Decrease Exterior Wash quantity/i }));
    expect(screen.getAllByText(/KES 3,850/i).length).toBeGreaterThan(0);

    // Checkout -> Complete Cash Sale
    fireEvent.click(screen.getByRole('button', { name: /Checkout/i }));
    fireEvent.click(screen.getByRole('button', { name: /Complete Cash Sale/i }));

    await waitFor(() => {
      expect(mockBatchCommit).toHaveBeenCalledTimes(1);
    });

    // Verify order saved with price at time of sale
    const savedOrderCall = mockBatchSet.mock.calls.find((call) => call[1]?.type === 'CARWASH' && call[1]?.status === 'PAID');
    expect(savedOrderCall).toBeTruthy();
    expect(savedOrderCall![1].total).toBe(3850);
    expect(savedOrderCall![1].plateNumber).toBe('KDA 123X');
    expect(savedOrderCall![1].items).toHaveLength(4);
    expect(savedOrderCall![1].items.map((i: any) => i.price)).toEqual([200, 400, 1250, 2000]);
  }, 15000);

  it('supports Hold Bill and Recall Bill without losing prices when catalog prices change', async () => {
    const heldOrder = {
      id: 'held-1',
      type: 'CARWASH',
      jobType: 'VEHICLE',
      status: 'PENDING',
      total: 300,
      plateNumber: 'KDC 777A',
      items: [{ productId: 'wash-normal', name: 'Normal Wash (Standard)', price: 300, quantity: 1, category: 'Wash', status: 'COMMITTED' }],
      timestamp: Date.now(),
    };
    (mockUseCollection as any).mockImplementation((q: any) => {
      const qStr = JSON.stringify(q || '');
      if (qStr.includes('held_bills')) {
        return { data: [heldOrder], loading: false, error: null };
      }
      return { data: [], loading: false, error: null };
    });

    // Suppose Normal Wash catalog price was later changed to 500
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        services: CAR_WASH_SERVICES.map((s) => (s.id === 'wash-normal' ? { ...s, price: 500 } : s)),
      }),
    });

    render(<CarwashPOS />);
    await waitFor(() => expect(screen.getByText('Exterior Wash')).toBeInTheDocument());

    // Recall existing bill -> historical line price (KES 300) is preserved!
    fireEvent.click(screen.getByRole('button', { name: /Recall Bill/i }));
    expect(screen.getByText('KDC 777A')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^Open$/i }));
    expect(screen.getAllByText(/KES 300/i).length).toBeGreaterThan(0);

    // Now test Hold Bill on a new selection
    fireEvent.change(screen.getByLabelText(/Plate Number/i), { target: { value: 'KDB 999Z' } });
    fireEvent.click(screen.getByRole('button', { name: /Exterior Wash/i }));
    fireEvent.click(screen.getByRole('button', { name: /Hold/i }));

    await waitFor(() => {
      expect(mockBatchCommit).toHaveBeenCalledTimes(1);
    });

    const heldCall = mockBatchSet.mock.calls.find((call) => call[1]?.status === 'PENDING');
    expect(heldCall).toBeTruthy();
    expect(heldCall![1].total).toBe(500); // 300 recalled + 200 added
    expect(heldCall![1].plateNumber).toBe('KDB 999Z');
  }, 15000);
});
