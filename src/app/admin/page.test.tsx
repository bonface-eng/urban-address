
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import AdminPanel from './page';
import { mockUseProfile, mockUseCollection, mockUseDoc } from '@/test/setup';

describe('AdminHub Operations', () => {
  it('shows Restricted Area message for non-admins', () => {
    mockUseProfile.mockReturnValue({
      role: 'CASHIER',
      profile: { uid: '1', displayName: 'User', email: 'cashier@urban.co.ke' },
      isSuperAdmin: false,
      isEmployee: true,
      loading: false,
      isManualAuth: true,
      switchRole: vi.fn()
    });

    render(<AdminPanel />);
    expect(screen.getByText(/Restricted Area/i)).toBeInTheDocument();
  });

  it('allows super admin to toggle permissions in the matrix', async () => {
    mockUseProfile.mockReturnValue({
      role: 'ADMIN',
      profile: { uid: '1', displayName: 'Super Admin', email: 'admin@urban.co.ke' },
      isSuperAdmin: true,
      isEmployee: true,
      loading: false,
      isManualAuth: true,
      switchRole: vi.fn()
    });

    mockUseDoc.mockReturnValue({
      data: { MANAGER: ['/dashboard'] },
      loading: false
    });

    render(<AdminPanel />);
    
    // Find the toggle for MANAGER at /dashboard
    const toggles = screen.getAllByRole('button');
    const dashboardToggle = toggles.find(t => t.className.includes('bg-green-500'));
    
    expect(dashboardToggle).toBeDefined();
    fireEvent.click(dashboardToggle!);
    
    await waitFor(() => {
      expect(dashboardToggle).not.toHaveClass('bg-green-500');
    });
  });

  it('triggers save action for global API configuration', async () => {
    mockUseProfile.mockReturnValue({
      role: 'ADMIN',
      profile: { uid: '1', displayName: 'Super Admin' },
      isSuperAdmin: true,
      isEmployee: true,
      loading: false
    });

    render(<AdminPanel />);
    
    const saveButton = screen.getByText(/Save All Changes/i);
    fireEvent.click(saveButton);
    
    expect(saveButton).toBeDisabled();
  });
});
