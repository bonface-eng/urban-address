
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import DashboardPage from './page';
import { mockUseProfile } from '@/test/setup';

describe('DashboardPage Role Branching', () => {
  it('renders Admin Dashboard by default for Super Admins', () => {
    mockUseProfile.mockReturnValue({
      role: 'ADMIN',
      profile: { uid: '1', displayName: 'Admin', email: 'admin@urban.co.ke' },
      isSuperAdmin: true,
      isEmployee: true,
      loading: false,
      isManualAuth: true,
      switchRole: vi.fn()
    });

    render(<DashboardPage />);
    expect(screen.getByText(/Global Network Overview/i)).toBeInTheDocument();
  });

  it('renders Attendant Dashboard for detailers', () => {
    mockUseProfile.mockReturnValue({
      role: 'ATTENDANT',
      profile: { uid: '2', displayName: 'Samuel Maina', email: 'sam@urban.co.ke' },
      isSuperAdmin: false,
      isEmployee: true,
      loading: false,
      isManualAuth: true,
      switchRole: vi.fn()
    });

    render(<DashboardPage />);
    expect(screen.getByText(/Personal Shift Summary/i)).toBeInTheDocument();
  });

  it('renders Cashier Dashboard for POS operators', () => {
    mockUseProfile.mockReturnValue({
      role: 'CASHIER',
      profile: { uid: '3', displayName: 'Jane Doe', email: 'jane@urban.co.ke' },
      isSuperAdmin: false,
      isEmployee: true,
      loading: false,
      isManualAuth: true,
      switchRole: vi.fn()
    });

    render(<DashboardPage />);
    expect(screen.getByText(/Personal Shift Summary/i)).toBeInTheDocument();
  });
});
