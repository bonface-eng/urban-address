import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import SignUpPage from './page';
import { mockUseUser } from '@/test/setup';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';

const mockReplace = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: mockReplace,
    prefetch: vi.fn(),
    back: vi.fn(),
  }),
  usePathname: () => '/signup',
  useParams: () => ({}),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock('firebase/auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('firebase/auth')>();
  return {
    ...actual,
    createUserWithEmailAndPassword: vi.fn(),
    updateProfile: vi.fn().mockResolvedValue(undefined),
    GoogleAuthProvider: vi.fn(),
    signInWithPopup: vi.fn(),
  };
});

vi.mock('firebase/firestore', async (importOriginal) => {
  const actual = await importOriginal<typeof import('firebase/firestore')>();
  return {
    ...actual,
    doc: vi.fn(() => ({ path: 'users/new-uid' })),
    setDoc: vi.fn().mockResolvedValue(undefined),
    getDoc: vi.fn(),
  };
});

describe('SignUp Integration Architecture', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseUser.mockReturnValue({ user: null as any, loading: false });
  });

  it('enforces password mismatch validation', async () => {
    render(<SignUpPage />);

    fireEvent.change(screen.getByPlaceholderText(/Full Name/i), { target: { value: 'Test User' } });
    fireEvent.change(screen.getByPlaceholderText(/Email address/i), { target: { value: 'test@urban.co.ke' } });
    fireEvent.change(screen.getByPlaceholderText(/Create Password/i), { target: { value: 'Password123!' } });
    fireEvent.change(screen.getByPlaceholderText(/Confirm Password/i), { target: { value: 'Mismatch123!' } });

    const submitBtn = screen.getByRole('button', { name: /Sign Up/i });
    fireEvent.click(submitBtn);

    expect(createUserWithEmailAndPassword).not.toHaveBeenCalled();
  });

  it('renders password strength indicator during entry', () => {
    render(<SignUpPage />);
    const passInput = screen.getByPlaceholderText(/Create Password/i);

    fireEvent.change(passInput, { target: { value: 'weak' } });
    expect(screen.getByText(/Password Strength/i)).toBeInTheDocument();
  });

  it('creates user and redirects to /auth/verify-email', async () => {
    vi.mocked(createUserWithEmailAndPassword).mockResolvedValueOnce({
      user: {
        uid: 'new-user-123',
        email: 'newuser@urban.co.ke',
        getIdToken: vi.fn().mockResolvedValue('token-123'),
      },
    } as any);

    render(<SignUpPage />);

    fireEvent.change(screen.getByPlaceholderText(/Full Name/i), { target: { value: 'Jane Doe' } });
    fireEvent.change(screen.getByPlaceholderText(/Email address/i), { target: { value: 'newuser@urban.co.ke' } });
    fireEvent.change(screen.getByPlaceholderText(/Create Password/i), { target: { value: 'StrongPass123!' } });
    fireEvent.change(screen.getByPlaceholderText(/Confirm Password/i), { target: { value: 'StrongPass123!' } });

    const termsCheckbox = screen.getByRole('checkbox', { name: /Terms and Conditions/i });
    fireEvent.click(termsCheckbox);

    const submitBtn = screen.getByRole('button', { name: /Sign Up/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(createUserWithEmailAndPassword).toHaveBeenCalled();
      expect(updateProfile).toHaveBeenCalled();
      expect(mockReplace).toHaveBeenCalledWith('/auth/verify-email');
    });
  });
});
