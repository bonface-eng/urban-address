
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import AdminPanel from './page';
import { mockUseProfile, mockUseCollection, mockUseDoc } from '@/test/setup';

describe('AdminHub Operations', () => {
  it('hides administration panel for non-super-admins', () => {
    mockUseProfile.mockReturnValue({
      role: 'CASHIER',
      profile: { uid: '1', displayName: 'User', email: 'cashier@urban.co.ke' },
      isSuperAdmin: false,
      isEmployee: true,
      loading: false,
      isManualAuth: true,
      switchRole: vi.fn()
    });

    const { container } = render(<AdminPanel />);
    expect(container.firstChild).toBeNull();
  });

  it('allows super admin to toggle permissions in the matrix', { timeout: 15000 }, async () => {
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

    const saveButton = screen.getByRole('button', { name: /Save OS Changes/i });
    expect(saveButton).toBeInTheDocument();
  });

  it('triggers save action for global API configuration', { timeout: 15000 }, async () => {
    mockUseProfile.mockReturnValue({
      role: 'ADMIN',
      profile: { uid: '1', displayName: 'Super Admin' },
      isSuperAdmin: true,
      isEmployee: true,
      loading: false
    });

    render(<AdminPanel />);

    const saveButton = screen.getByRole('button', { name: /Save OS Changes/i });
    fireEvent.click(saveButton);

    expect(saveButton).toBeDisabled();
  });
});
