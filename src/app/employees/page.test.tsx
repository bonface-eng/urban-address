
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import EmployeeDirectory from './page';
import { mockUseCollection, mockUseProfile } from '@/test/setup';

describe('Personnel Management Actions', () => {
  it('opens create account dialog on button click', async () => {
    mockUseCollection.mockReturnValue({
      data: [],
      loading: false
    });
    
    render(<EmployeeDirectory />);
    
    const createButton = screen.getByText(/Create Staff Account/i);
    fireEvent.click(createButton);
    
    expect(screen.getByText(/New Staff Member/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/e.g. Samuel Maina/i)).toBeInTheDocument();
  });

  it('validates required fields in the provisioning form', async () => {
    render(<EmployeeDirectory />);
    fireEvent.click(screen.getByText(/Create Staff Account/i));
    
    const submitButton = screen.getByText(/Add Staff Account/i);
    fireEvent.click(submitButton);
    
    // Form should still be open as HTML5 validation prevents sub
    expect(screen.getByText(/New Staff Member/i)).toBeInTheDocument();
  });

  it('filters personnel table based on search input', () => {
    mockUseCollection.mockReturnValue({
      data: [
        { uid: '1', displayName: 'Jane Doe', email: 'jane@urban.co.ke', role: 'CASHIER' },
        { uid: '2', displayName: 'John Smith', email: 'john@urban.co.ke', role: 'MANAGER' }
      ],
      loading: false
    });

    render(<EmployeeDirectory />);
    
    const searchInput = screen.getByPlaceholderText(/Find staff by name or role/i);
    fireEvent.change(searchInput, { target: { value: 'Jane' } });
    
    expect(screen.getByText(/Jane Doe/i)).toBeInTheDocument();
    expect(screen.queryByText(/John Smith/i)).not.toBeInTheDocument();
  });
});
