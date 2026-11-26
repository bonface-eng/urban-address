
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import LoginPage from './page';
import { mockUseFirestore, mockUseAuth } from '@/test/setup';
import { signInWithEmailAndPassword } from 'firebase/auth';

// Setup explicit modular mocks
vi.mock('firebase/auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('firebase/auth')>();
  return { 
    ...actual, 
    signInWithEmailAndPassword: vi.fn(),
    GoogleAuthProvider: vi.fn(),
    signInWithPopup: vi.fn()
  };
});

describe('LoginPage Auth Logic', () => {
  it('renders login form components', () => {
    render(<LoginPage />);
    expect(screen.getByPlaceholderText(/Email address/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Sign In/i })).toBeInTheDocument();
  });

  it('prevents staff login on client portal', async () => {
    const mockGetDocs = vi.fn().mockResolvedValue({
      empty: false,
      docs: [{ data: () => ({ role: 'ADMIN' }) }]
    });
    
    mockUseFirestore.mockReturnValue({} as any);
    vi.mock('firebase/firestore', async (importOriginal) => {
      const actual = await importOriginal<typeof import('firebase/firestore')>();
      return { 
        ...actual, 
        getDocs: () => mockGetDocs(),
        query: vi.fn(),
        collection: vi.fn(),
        where: vi.fn()
      };
    });

    render(<LoginPage />);
    
    fireEvent.change(screen.getByPlaceholderText(/Email address/i), { target: { value: 'admin@urban.co.ke' } });
    fireEvent.change(screen.getByPlaceholderText(/Password/i), { target: { value: 'password123' } });
    fireEvent.click(screen.getByRole('button', { name: /Sign In/i }));

    await waitFor(() => {
      expect(screen.getByText(/Staff Account Detected/i)).toBeInTheDocument();
    });
  });

  it('masks Firebase errors for security', async () => {
    vi.mocked(signInWithEmailAndPassword).mockRejectedValue({ code: 'auth/invalid-credential' });
    
    render(<LoginPage />);
    
    fireEvent.change(screen.getByPlaceholderText(/Email address/i), { target: { value: 'test@user.com' } });
    fireEvent.change(screen.getByPlaceholderText(/Password/i), { target: { value: 'wrongpass' } });
    fireEvent.click(screen.getByRole('button', { name: /Sign In/i }));

    await waitFor(() => {
      expect(screen.getByText(/Invalid email or password/i)).toBeInTheDocument();
      // Ensure raw technical code isn't shown
      expect(screen.queryByText(/auth\/invalid-credential/i)).not.toBeInTheDocument();
    });
  });
});
