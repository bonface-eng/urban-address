import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CAR_WASH_SERVICES } from '@/data/carWashServices';

const mockUseProfile = vi.fn();

vi.mock('@/hooks/use-profile', () => ({
  useProfile: () => mockUseProfile(),
}));

import AdminCarWashServicesPage from './page';

describe('AdminCarWashServicesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('denies non-admin staff roles on the admin management screen', () => {
    mockUseProfile.mockReturnValue({ role: 'CASHIER', isSuperAdmin: false, loading: false });
    render(<AdminCarWashServicesPage />);
    expect(screen.getByText(/Admin Privileges Required/i)).toBeInTheDocument();
  });

  it('allows admin to view services, validate inputs, and create/deactivate services', async () => {
    mockUseProfile.mockReturnValue({ role: 'ADMIN', isSuperAdmin: true, loading: false });

    const fetchMock = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
      if (url === '/api/admin/carwash-services' && (!init || !init.method || init.method === 'GET')) {
        return {
          ok: true,
          json: async () => ({ services: CAR_WASH_SERVICES.slice(0, 3) }),
        };
      }
      if (url === '/api/admin/carwash-services' && init?.method === 'POST') {
        return {
          ok: true,
          json: async () => ({
            service: {
              id: 'wash-foam',
              name: 'Foam Wash',
              category: 'Wash',
              pricingType: 'fixed',
              price: 450,
              currency: 'KES',
              isActive: true,
              sortOrder: 40,
            },
          }),
        };
      }
      if (url.startsWith('/api/admin/carwash-services/') && init?.method === 'PATCH') {
        return {
          ok: true,
          json: async () => ({
            service: { ...CAR_WASH_SERVICES[0], isActive: false },
          }),
        };
      }
      return { ok: true, json: async () => ({}) };
    });
    global.fetch = fetchMock as any;

    render(<AdminCarWashServicesPage />);

    await waitFor(() => {
      expect(screen.getByText('Normal Wash')).toBeInTheDocument();
    });

    // Open Add Service modal and test creating a service
    fireEvent.click(screen.getByRole('button', { name: /Add Service/i }));
    fireEvent.change(screen.getByLabelText(/Service Name/i), { target: { value: 'Foam Wash' } });
    fireEvent.change(screen.getByLabelText(/Price \(KES\)/i), { target: { value: '450' } });
    fireEvent.click(screen.getByRole('button', { name: /Create Service/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/admin/carwash-services',
        expect.objectContaining({ method: 'POST' })
      );
    });

    // Deactivate an existing service
    const deactivateButtons = screen.getAllByRole('button', { name: /Deactivate/i });
    fireEvent.click(deactivateButtons[0]);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/admin/carwash-services/wash-normal',
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({ isActive: false }),
        })
      );
    });
  });
});
