
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import SalesHistoryPage from './page';
import { mockUseCollection, mockUseProfile } from '@/test/setup';

describe('Sales Ledger & Clearance', () => {
  it('renders paid orders and sales volume KPI', async () => {
    mockUseCollection.mockReturnValue({
      data: [
        { id: 'ORDER-123', type: 'STORE', total: 5000, status: 'PAID', timestamp: Date.now() }
      ],
      loading: false
    });

    render(<SalesHistoryPage />);

    expect(screen.getByText(/SALES VOLUME/i)).toBeInTheDocument();
    expect(screen.getAllByText(/KES 5,000/i).length).toBeGreaterThan(0);
  });

  it('switches to active backlog tab for pending orders', async () => {
    mockUseCollection.mockReturnValue({
      data: [{ id: 'PENDING-1', type: 'LOUNGE', total: 1000, status: 'PENDING', timestamp: Date.now() }],
      loading: false
    });

    render(<SalesHistoryPage />);
    const backlogTab = screen.getByRole('button', { name: /Active Backlog/i });
    fireEvent.click(backlogTab);

    expect(screen.getByText(/PENDING BACKLOG/i)).toBeInTheDocument();
    expect(screen.getAllByText(/KES 1,000/i).length).toBeGreaterThan(0);
  });
});
