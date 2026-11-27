import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import LoginPage from './page';
import { mockUseFirestore } from '@/test/setup';
import { signInWithEmailAndPassword } from '@/lib/db';
import { Toaster } from '@/components/ui/toaster';

const mockReplace = vi.fn();
const mockPush = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: mockReplace,
    prefetch: vi.fn(),
    back: vi.fn(),
  }),
  usePathname: () => '/login',
  useParams: () => ({}),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock('@/lib/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/db')>();
  return {
    ...actual,
    signInWithEmailAndPassword: vi.fn(),
    GoogleAuthProvider: vi.fn(),
    signInWithPopup: vi.fn(),
    doc: vi.fn(() => ({ path: 'users/uid' })),
    getDoc: vi.fn().mockResolvedValue({
      exists: () => true,
      data: () => ({ uid: 'test-uid', email: 'client@urban.co.ke', displayName: 'Client User', role: 'CLIENT' }),
    }),
    setDoc: vi.fn().mockResolvedValue(undefined),
    addDoc: vi.fn().mockResolvedValue({ id: 'audit-1' }),
    collection: vi.fn(),
  };
});

describe('LoginPage Auth Logic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseFirestore.mockReturnValue({} as any);
  });

  it('renders login form components', () => {
    render(<LoginPage />);
    expect(screen.getByPlaceholderText(/Email address/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Sign In/i })).toBeInTheDocument();
  });

  it('completes customer login and redirects even when audit_logs write is denied for CLIENT role', async () => {
    const { addDoc } = await import('@/lib/db');
    vi.mocked(addDoc).mockRejectedValueOnce({ code: 'permission-denied' });
    vi.mocked(signInWithEmailAndPassword).mockResolvedValueOnce({
      user: {
        uid: 'client-1',
        email: 'client@urban.co.ke',
        emailVerified: true,
        reload: vi.fn().mockResolvedValue(undefined),
        getIdToken: vi.fn().mockResolvedValue('id-token'),
      },
    } as any);

    render(<LoginPage />);

    fireEvent.change(screen.getByPlaceholderText(/Email address/i), { target: { value: 'client@urban.co.ke' } });
    fireEvent.change(screen.getByPlaceholderText(/Password/i), { target: { value: 'Password123!' } });
    fireEvent.click(screen.getByRole('button', { name: /Sign In/i }));

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/');
    });
  });

  it('masks provider errors for security', async () => {
    vi.mocked(signInWithEmailAndPassword).mockRejectedValueOnce({ code: 'auth/invalid-credential' });

    render(
      <>
        <LoginPage />
        <Toaster />
      </>
    );

    fireEvent.change(screen.getByPlaceholderText(/Email address/i), { target: { value: 'test@user.com' } });
    fireEvent.change(screen.getByPlaceholderText(/Password/i), { target: { value: 'wrongpass' } });
    fireEvent.click(screen.getByRole('button', { name: /Sign In/i }));

    await waitFor(() => {
      expect(screen.getByText(/Invalid email or password/i)).toBeInTheDocument();
      expect(screen.queryByText(/auth\/invalid-credential/i)).not.toBeInTheDocument();
    });
  });
});
