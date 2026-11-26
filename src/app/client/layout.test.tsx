import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import ClientLayout from './layout';
import { mockUseUser, mockUseProfile } from '@/test/setup';

const navigationState = vi.hoisted(() => ({ pathname: '/client/store', replace: vi.fn() }));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: navigationState.replace, back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => navigationState.pathname,
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock('@/hooks/use-cart', () => ({
  useCart: () => ({ totalItems: 2 }),
}));

vi.mock('@/components/cart/cart-drawer', () => ({
  CartDrawer: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/components/layout/notifications', () => ({
  Notifications: () => <button aria-label="Notifications">Notifications</button>,
}));

vi.mock('firebase/firestore', async (importOriginal) => {
  const actual = await importOriginal<typeof import('firebase/firestore')>();
  return { ...actual, doc: vi.fn(() => ({ path: 'system/config' })) };
});

vi.mock('react-snowfall', () => ({ default: () => null }));

describe('customer-facing navigation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    navigationState.pathname = '/client/store';
    mockUseUser.mockReturnValue({
      user: { uid: 'customer-1', displayName: 'Customer', photoURL: null },
      loading: false,
    } as any);
    mockUseProfile.mockReturnValue({
      role: 'CUSTOMER',
      profile: { uid: 'customer-1', displayName: 'Customer' },
      isSuperAdmin: false,
      isEmployee: false,
      loading: false,
      isManualAuth: false,
      switchRole: vi.fn(),
    } as any);
  });

  it('renders the five mobile destinations and labels the authenticated destination Profile', () => {
    render(<ClientLayout><div>Customer page</div></ClientLayout>);

    const navigation = screen.getByRole('navigation', { name: /customer navigation/i });
    expect(navigation).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/');
    expect(screen.getByRole('link', { name: 'Shop' })).toHaveAttribute('href', '/client/store');
    expect(screen.getByRole('link', { name: 'Carwash' })).toHaveAttribute('href', '/client/carwash');
    expect(screen.getByRole('link', { name: 'Lounge' })).toHaveAttribute('href', '/client/lounge');
    expect(screen.getByRole('link', { name: 'Profile' })).toHaveAttribute('href', '/client/profile');
    expect(screen.getByRole('link', { name: 'Profile' }).querySelector('.rounded-full')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Open cart' })).toHaveAttribute('href', '/client/cart');
    expect(screen.getByRole('button', { name: 'Notifications' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Orders' })).not.toBeInTheDocument();
  });

  it('marks the current customer section as active', () => {
    render(<ClientLayout><div>Customer page</div></ClientLayout>);

    expect(screen.getByRole('link', { name: 'Shop' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Carwash' })).not.toHaveAttribute('aria-current', 'page');
  });

  it('routes guests to sign in from the account destination', () => {
    mockUseUser.mockReturnValue({ user: null, loading: false } as any);

    render(<ClientLayout><div>Customer page</div></ClientLayout>);

    const navigation = screen.getByRole('navigation', { name: /customer navigation/i });
    expect(screen.getByRole('link', { name: 'Sign In' })).toHaveAttribute('href', '/login');
    expect(navigation.querySelector('a[href="/client/profile"]')).toBeNull();
    expect(screen.queryByRole('link', { name: 'Profile' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /open navigation menu/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Sign Up' })).not.toBeInTheDocument();
  });


  it('redirects signed-out visitors away from protected customer routes', async () => {
    navigationState.pathname = '/client/orders';
    mockUseUser.mockReturnValue({ user: null, loading: false } as any);

    render(<ClientLayout><div>Private customer data</div></ClientLayout>);

    expect(screen.queryByText('Private customer data')).not.toBeInTheDocument();
    await waitFor(() => {
      expect(navigationState.replace).toHaveBeenCalledWith('/login?redirect=%2Fclient%2Forders');
    });
  });

  it('waits for Firebase auth state before deciding access to a protected route', () => {
    navigationState.pathname = '/client/profile';
    mockUseUser.mockReturnValue({ user: null, loading: true } as any);

    render(<ClientLayout><div>Private profile</div></ClientLayout>);

    expect(screen.getByText(/Verifying your account/i)).toBeInTheDocument();
    expect(navigationState.replace).not.toHaveBeenCalled();
  });

  it('keeps the staff portal entry out of customer navigation for customers', () => {
    render(<ClientLayout><div>Customer page</div></ClientLayout>);

    expect(screen.queryByRole('button', { name: /staff workspace/i })).not.toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: /customer navigation/i })).toBeInTheDocument();
  });

  it('keeps page content rendered and gives it bottom clearance for the fixed mobile bar', () => {
    render(<ClientLayout><div>Customer page content</div></ClientLayout>);

    expect(screen.getByText('Customer page content')).toBeInTheDocument();
    expect(screen.getByRole('main')).toHaveClass('pb-[calc(5rem+env(safe-area-inset-bottom))]');
  });
});
