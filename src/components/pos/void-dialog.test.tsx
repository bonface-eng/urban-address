import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { VoidDialog } from './void-dialog';

const mockToast = vi.fn();
vi.mock('@/hooks/use-toast', () => ({
  toast: (options: unknown) => mockToast(options),
}));

function chooseReason(label: string) {
  fireEvent.pointerDown(screen.getByRole('combobox'), {
    button: 0,
    ctrlKey: false,
    pointerType: 'mouse',
  });
  return screen.findByRole('option', { name: label }).then(option => fireEvent.click(option));
}

afterEach(() => {
  cleanup();
  mockToast.mockClear();
});

describe('POS authorization dialog', () => {
  it('does not render while closed', () => {
    render(<VoidDialog isOpen={false} onClose={vi.fn()} onConfirm={vi.fn()} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('requires a reason and supervisor PIN before enabling confirmation', async () => {
    render(<VoidDialog isOpen onClose={vi.fn()} onConfirm={vi.fn().mockResolvedValue(undefined)} />);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Authorization Required')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /confirm void/i })).toBeDisabled();

    await chooseReason('Duplicate Item');
    fireEvent.change(screen.getByPlaceholderText('••••'), { target: { value: '1234' } });

    expect(screen.getByRole('button', { name: /confirm void/i })).toBeEnabled();
  });

  it('submits the selected reason and PIN, then closes after success', async () => {
    const onClose = vi.fn();
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    render(<VoidDialog isOpen onClose={onClose} onConfirm={onConfirm} />);

    await chooseReason('Out of Stock');
    fireEvent.change(screen.getByPlaceholderText('••••'), { target: { value: '4826' } });
    fireEvent.click(screen.getByRole('button', { name: /confirm void/i }));

    await waitFor(() => expect(onConfirm).toHaveBeenCalledWith('Out of Stock', '4826'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('keeps the dialog open and reports an authorization failure when confirmation rejects', async () => {
    const onClose = vi.fn();
    const onConfirm = vi.fn().mockRejectedValue(new Error('Invalid PIN'));
    render(<VoidDialog isOpen onClose={onClose} onConfirm={onConfirm} />);

    await chooseReason('Test Transaction');
    fireEvent.change(screen.getByPlaceholderText('••••'), { target: { value: '0000' } });
    fireEvent.click(screen.getByRole('button', { name: /confirm void/i }));

    await waitFor(() => expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({
      variant: 'destructive',
      title: 'Auth Failed',
    })));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });
});
