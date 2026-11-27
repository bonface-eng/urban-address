import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import SignUpPage from './page';
import { mockUseUser } from '@/test/setup';
import { Toaster } from '@/components/ui/toaster';

const mockReplace = vi.fn();
const mockSignUp = vi.fn();
const mockSignInWithPassword = vi.fn();
const mockMaybeSingle = vi.fn();
const mockSelectEq = vi.fn(() => ({ maybeSingle: mockMaybeSingle }));
const mockSelect = vi.fn(() => ({ eq: mockSelectEq }));
const mockProfileUpdateEq = vi.fn().mockResolvedValue({ error: null });
const mockProfileUpdate = vi.fn(() => ({ eq: mockProfileUpdateEq }));
const mockProfileInsert = vi.fn().mockResolvedValue({ error: null });
const mockFrom = vi.fn(() => ({
  select: mockSelect,
  update: mockProfileUpdate,
  insert: mockProfileInsert,
}));

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

vi.mock('@/lib/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/db')>();
  return {
    ...actual,
    getSupabaseBrowserClient: () => ({
      auth: {
        signUp: mockSignUp,
        signInWithPassword: mockSignInWithPassword,
        getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
        onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
      },
      from: mockFrom,
    }),
    GoogleAuthProvider: vi.fn(),
    signInWithPopup: vi.fn(),
    doc: vi.fn(() => ({ path: 'users/new-uid' })),
    setDoc: vi.fn().mockResolvedValue(undefined),
    getDoc: vi.fn(),
  };
});

describe('SignUp Integration Architecture', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseUser.mockReturnValue({ user: null as any, loading: false });
    mockMaybeSingle.mockResolvedValue({ data: { id: 'new-user-123', role: 'CLIENT' }, error: null });
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) } as any);
  });

  it('enforces password mismatch validation', async () => {
    render(<SignUpPage />);

    fireEvent.change(screen.getByPlaceholderText(/Full Name/i), { target: { value: 'Test User' } });
    fireEvent.change(screen.getByPlaceholderText(/Email address/i), { target: { value: 'test@urban.co.ke' } });
    fireEvent.change(screen.getByPlaceholderText(/Create Password/i), { target: { value: 'Password123!' } });
    fireEvent.change(screen.getByPlaceholderText(/Confirm Password/i), { target: { value: 'Mismatch123!' } });

    const submitBtn = screen.getByRole('button', { name: /Sign Up/i });
    fireEvent.click(submitBtn);

    expect(mockSignUp).not.toHaveBeenCalled();
  });

  it('renders password strength indicator during entry', () => {
    render(<SignUpPage />);
    const passInput = screen.getByPlaceholderText(/Create Password/i);

    fireEvent.change(passInput, { target: { value: 'weak' } });
    expect(screen.getByText(/Password Strength/i)).toBeInTheDocument();
  });

  it('creates user via Supabase signUp and redirects straight to / without email verification', async () => {
    mockSignUp.mockResolvedValueOnce({
      data: {
        user: {
          id: 'new-user-123',
          email: 'newuser@urban.co.ke',
          identities: [{ id: '1' }],
          user_metadata: { full_name: 'Jane Doe' },
          app_metadata: {},
        },
        session: {
          access_token: 'token-123',
          refresh_token: 'refresh-123',
        },
      },
      error: null,
    });

    render(<SignUpPage />);

    fireEvent.change(screen.getByPlaceholderText(/Full Name/i), { target: { value: 'Jane Doe' } });
    fireEvent.change(screen.getByPlaceholderText(/Email address/i), { target: { value: 'newuser@urban.co.ke' } });
    fireEvent.change(screen.getByPlaceholderText(/Create Password/i), { target: { value: 'StrongPass123!' } });
    fireEvent.change(screen.getByPlaceholderText(/Confirm Password/i), { target: { value: 'StrongPass123!' } });

    fireEvent.click(screen.getByRole('checkbox', { name: /Terms and Conditions/i }));
    fireEvent.click(screen.getByRole('button', { name: /Sign Up/i }));

    await waitFor(() => {
      expect(mockSignUp).toHaveBeenCalledWith(expect.objectContaining({
        email: 'newuser@urban.co.ke',
        password: 'StrongPass123!',
      }));
      expect(mockProfileUpdate).toHaveBeenCalled();
      expect(mockReplace).toHaveBeenCalledWith('/');
    });
  });

  it('falls back to signInWithPassword and creates CLIENT profile if signUp returns null session', async () => {
    mockSignUp.mockResolvedValueOnce({
      data: {
        user: {
          id: 'fallback-user-1',
          email: 'fallback@urban.co.ke',
          identities: [{ id: '1' }],
          user_metadata: { full_name: 'Fallback User' },
          app_metadata: {},
        },
        session: null,
      },
      error: null,
    });
    mockSignInWithPassword.mockResolvedValueOnce({
      data: {
        user: {
          id: 'fallback-user-1',
          email: 'fallback@urban.co.ke',
          user_metadata: { full_name: 'Fallback User' },
          app_metadata: {},
        },
        session: {
          access_token: 'token-fb',
          refresh_token: 'refresh-fb',
        },
      },
      error: null,
    });
    mockMaybeSingle.mockResolvedValueOnce({ data: null, error: null });

    render(<SignUpPage />);

    fireEvent.change(screen.getByPlaceholderText(/Full Name/i), { target: { value: 'Fallback User' } });
    fireEvent.change(screen.getByPlaceholderText(/Email address/i), { target: { value: 'fallback@urban.co.ke' } });
    fireEvent.change(screen.getByPlaceholderText(/Create Password/i), { target: { value: 'StrongPass123!' } });
    fireEvent.change(screen.getByPlaceholderText(/Confirm Password/i), { target: { value: 'StrongPass123!' } });

    fireEvent.click(screen.getByRole('checkbox', { name: /Terms and Conditions/i }));
    fireEvent.click(screen.getByRole('button', { name: /Sign Up/i }));

    await waitFor(() => {
      expect(mockSignInWithPassword).toHaveBeenCalledWith({
        email: 'fallback@urban.co.ke',
        password: 'StrongPass123!',
      });
      expect(mockProfileInsert).toHaveBeenCalledWith(expect.objectContaining({
        id: 'fallback-user-1',
        role: 'CLIENT',
      }));
      expect(mockReplace).toHaveBeenCalledWith('/');
    });
  });

  it('shows friendly error message for user_already_exists', async () => {
    mockSignUp.mockResolvedValueOnce({
      data: { user: null, session: null },
      error: { message: 'User already registered', code: 'user_already_exists' },
    });

    render(
      <>
        <SignUpPage />
        <Toaster />
      </>
    );

    fireEvent.change(screen.getByPlaceholderText(/Full Name/i), { target: { value: 'Jane Doe' } });
    fireEvent.change(screen.getByPlaceholderText(/Email address/i), { target: { value: 'existing@urban.co.ke' } });
    fireEvent.change(screen.getByPlaceholderText(/Create Password/i), { target: { value: 'StrongPass123!' } });
    fireEvent.change(screen.getByPlaceholderText(/Confirm Password/i), { target: { value: 'StrongPass123!' } });

    fireEvent.click(screen.getByRole('checkbox', { name: /Terms and Conditions/i }));
    fireEvent.click(screen.getByRole('button', { name: /Sign Up/i }));

    await waitFor(() => {
      expect(screen.getByText(/An account with this email already exists/i)).toBeInTheDocument();
    });
  });
});
