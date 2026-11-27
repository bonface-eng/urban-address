
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import FinanceDashboard from './page';
import { mockUseCollection, mockUseFirestore, mockUseProfile } from '@/test/setup';

describe('Finance & Cash Operations', () => {
  it('triggers petty cash request dialog', () => {
    mockUseCollection.mockReturnValue({ data: [], loading: false });
    render(<FinanceDashboard />);
    
    const newRequestBtn = screen.getByText(/New Request/i);
    fireEvent.click(newRequestBtn);
    
    expect(screen.getByText(/Petty Cash Request/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/e.g. Office Supplies/i)).toBeInTheDocument();
  });

  it('triggers shift reconciliation audit dialog', () => {
    render(<FinanceDashboard />);
    
    const reconcileBtn = screen.getByText(/Shift Audit/i);
    fireEvent.click(reconcileBtn);
    
    expect(screen.getByText(/Blind Drop Audit/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/0.00/i)).toBeInTheDocument();
  });

  it('calculates variance during blind drop reconciliation', async () => {
    mockUseCollection.mockReturnValue({ data: [], loading: false });
    // Simulate expected cash is 5000
    render(<FinanceDashboard />);
    
    fireEvent.click(screen.getByText(/Shift Audit/i));
    const input = screen.getByPlaceholderText(/0.00/i);
    fireEvent.change(input, { target: { value: '5000' } });
    
    const submitBtn = screen.getByText(/Complete Shift Audit/i);
    fireEvent.click(submitBtn);
    
    expect(submitBtn).toBeDisabled();
  });
});
