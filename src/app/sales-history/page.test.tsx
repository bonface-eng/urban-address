
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import SalesHistoryPage from './page';
import { mockUseCollection, mockUseProfile } from '@/test/setup';

describe('Sales Ledger & Returns', () => {
  it('opens return dialog for paid orders', async () => {
    mockUseCollection.mockReturnValue({
      data: [
        { id: 'ORDER-123', type: 'STORE', total: 5000, status: 'PAID', timestamp: Date.now() }
      ],
      loading: false
    });

    render(<SalesHistoryPage />);
    
    const returnBtn = screen.getByText(/Return/i);
    fireEvent.click(returnBtn);
    
    expect(screen.getByText(/Process Product Return/i)).toBeInTheDocument();
    expect(screen.getByText(/Original Value/i)).toBeInTheDocument();
  });

  it('requires supervisor pin for refund authorization', async () => {
    mockUseCollection.mockReturnValue({
      data: [{ id: '1', type: 'LOUNGE', total: 1000, status: 'PAID', timestamp: Date.now() }],
      loading: false
    });

    render(<SalesHistoryPage />);
    fireEvent.click(screen.getByText(/Return/i));
    
    const pinInput = screen.getByPlaceholderText('••••');
    fireEvent.change(pinInput, { target: { value: '1234' } });
    
    const authBtn = screen.getByText(/Authorize Reversal/i);
    fireEvent.click(authBtn);
    
    expect(authBtn).toBeDisabled();
  });
});
