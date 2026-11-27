
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ReceiptPreview } from './receipt-preview';

vi.mock('@/hooks/use-receipt-settings', () => ({
  useReceiptSettings: () => ({
    settings: {
      storeHeader: 'URBAN ACCESSORIES',
      branchName: 'NAKA BRANCH',
      location: 'NAKURU'
    }
  })
}));

describe('Thermal Receipt Formatting', () => {
  const mockOrder = {
    id: 'TEST-123',
    total: 1500,
    type: 'STORE',
    status: 'PAID',
    items: [{ name: 'Oil Filter', price: 1500, quantity: 1 }]
  };

  it('renders the PAID status tag prominently', () => {
    render(<ReceiptPreview data={mockOrder} />);
    expect(screen.getByText(/PAYMENT RECEIVED/i)).toBeInTheDocument();
  });

  it('displays the correct departmental brand header', () => {
    render(<ReceiptPreview data={mockOrder} />);
    expect(screen.getByText(/URBAN ACCESSORIES/i)).toBeInTheDocument();
  });

  it('lists items and grand total correctly', () => {
    render(<ReceiptPreview data={mockOrder} />);
    expect(screen.getByText(/Oil Filter/i)).toBeInTheDocument();
    expect(screen.getByText(/KES 1,500/i)).toBeInTheDocument();
  });
});
