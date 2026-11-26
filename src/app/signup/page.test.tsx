
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import SignUpPage from './page';
import { mockUseFirestore, mockUseAuth } from '@/test/setup';

describe('SignUp Integration Architecture', () => {
  it('enforces password mismatch validation', async () => {
    render(<SignUpPage />);
    
    fireEvent.change(screen.getByPlaceholderText(/Full Name/i), { target: { value: 'Test User' } });
    fireEvent.change(screen.getByPlaceholderText(/Email address/i), { target: { value: 'test@urban.co.ke' } });
    fireEvent.change(screen.getByPlaceholderText(/Create Password/i), { target: { value: 'password123' } });
    fireEvent.change(screen.getByPlaceholderText(/Confirm Password/i), { target: { value: 'mismatch123' } });
    
    const submitBtn = screen.getByRole('button', { name: /Sign Up/i });
    fireEvent.click(submitBtn);

    expect(screen.queryByText(/Welcome/i)).not.toBeInTheDocument();
  });

  it('renders password strength indicator during entry', () => {
    render(<SignUpPage />);
    const passInput = screen.getByPlaceholderText(/Create Password/i);
    
    fireEvent.change(passInput, { target: { value: 'weak' } });
    expect(screen.getByText(/Password Strength/i)).toBeInTheDocument();
  });
});
