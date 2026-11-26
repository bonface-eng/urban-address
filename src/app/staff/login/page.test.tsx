import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import StaffLoginPage from './page';

describe('Staff Portal Gate Logic', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
  });

  it('initially hides login form behind security gate', () => {
    render(<StaffLoginPage />);
    expect(screen.getByText(/Staff Gate Entry/i)).toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/Staff Email/i)).not.toBeInTheDocument();
  });

  it('opens gate with correct master passcode', async () => {
    render(<StaffLoginPage />);
    const input = screen.getByPlaceholderText('••••••••');
    fireEvent.change(input, { target: { value: '38448674' } });
    fireEvent.click(screen.getByRole('button', { name: /Enter Staff Portal/i }));

    vi.advanceTimersByTime(600);

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/Staff Email/i)).toBeInTheDocument();
    });
  });

  it('triggers lockout after multiple failed gate attempts', async () => {
    render(<StaffLoginPage />);
    const input = screen.getByPlaceholderText('••••••••');
    const button = screen.getByRole('button', { name: /Enter Staff Portal/i });

    // 3 failed attempts
    for(let i=0; i<3; i++) {
      fireEvent.change(input, { target: { value: '0000' } });
      fireEvent.click(button);
      vi.advanceTimersByTime(600);
    }

    await waitFor(() => {
      expect(screen.getByText(/Security Lockout/i)).toBeInTheDocument();
      expect(input).toBeDisabled();
    });
  });
});
