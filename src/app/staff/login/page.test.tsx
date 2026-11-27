import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import StaffLoginPage from './page';

const mockReplace = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace, push: vi.fn(), prefetch: vi.fn(), back: vi.fn() }),
  usePathname: () => '/staff/login',
  useParams: () => ({}),
  useSearchParams: () => new URLSearchParams(),
}));

describe('Staff Portal Redirect Logic', () => {
  beforeEach(() => {
    mockReplace.mockClear();
  });

  it('renders unified portal redirect indicator', () => {
    render(<StaffLoginPage />);
    expect(screen.getByText(/Redirecting to Unified Portal/i)).toBeInTheDocument();
  });

  it('redirects immediately to /login', async () => {
    render(<StaffLoginPage />);
    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/login');
    });
  });
});
