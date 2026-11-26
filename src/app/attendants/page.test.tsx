
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import AttendantsPage from './page';
import { mockUseCollection } from '@/test/setup';

describe('Personnel Performance Tracking', () => {
  it('aggregates revenue and commissions for detailers', () => {
    // Mock staff
    const mockStaff = [{ uid: 'att1', displayName: 'John Detailer', email: 'john@urban.co.ke', role: 'ATTENDANT' }];
    // Mock completed jobs for John
    const mockJobs = [
      { id: 'j1', attendantId: 'John Detailer', status: 'COMPLETED', price: 1000, commission: 300 },
      { id: 'j2', attendantId: 'John Detailer', status: 'COMPLETED', price: 500, commission: 150 }
    ];

    mockUseCollection
      .mockReturnValueOnce({ data: mockStaff, loading: false, error: null } as any) // first call for staff
      .mockReturnValueOnce({ data: mockJobs, loading: false, error: null } as any); // second call for jobs

    render(<AttendantsPage />);
    
    // Revenue: 1500
    expect(screen.getByText(/KES 1,500/i)).toBeInTheDocument();
    // Commissions: 450
    expect(screen.getByText(/KES 450/i)).toBeInTheDocument();
    // Job count: 2
    expect(screen.getByText('2')).toBeInTheDocument();
  });
});
