
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import CarwashPage from './page';
import { mockUseCollection } from '@/test/setup';

describe('Service Queue Integrity', () => {
  it('separates jobs into status columns', () => {
    mockUseCollection.mockReturnValue({
      data: [
        { id: '1', plateNumber: 'KDA 111A', status: 'QUEUED', service: 'Full Wash' },
        { id: '2', plateNumber: 'KDB 222B', status: 'IN_PROGRESS', service: 'Engine Clean' }
      ],
      loading: false,
      error: null
    });

    render(<CarwashPage />);
    
    expect(screen.getByText(/KDA 111A/i)).toBeInTheDocument();
    expect(screen.getByText(/KDB 222B/i)).toBeInTheDocument();
    
    // Check column labels
    expect(screen.getByText(/Waiting/i)).toBeInTheDocument();
    expect(screen.getByText(/In Progress/i)).toBeInTheDocument();
  });

  it('shows empty queue message when no jobs active', () => {
    mockUseCollection.mockReturnValue({ data: [], loading: false, error: null });
    render(<CarwashPage />);
    expect(screen.getAllByText(/No vehicles/i)).toHaveLength(3); // One for each col
  });
});
