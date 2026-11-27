import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { InventoryLoadState } from './load-state';
const defaults = { loading: false, error: null, ready: true, total: 0, visible: 0, unit: 'STORE', onReset: vi.fn(), onRetry: vi.fn() };
afterEach(cleanup);
describe('inventory loading truthfulness', () => {
  it('shows a denied read instead of an empty catalogue', () => {
    render(<InventoryLoadState {...defaults} error={{ code: 'permission-denied' }} />);
    expect(screen.getByRole('alert')).toHaveTextContent('INVENTORY_READ_DENIED');
    expect(screen.queryByText('No inventory records were returned')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('Retry inventory')); expect(defaults.onRetry).toHaveBeenCalled();
  });
  it('distinguishes network failure', () => {
    render(<InventoryLoadState {...defaults} error={{ code: 'unavailable' }} />);
    expect(screen.getByRole('alert')).toHaveTextContent('INVENTORY_READ_FAILED');
  });
  it('does not present loading as zero stock', () => {
    render(<InventoryLoadState {...defaults} loading />);
    expect(screen.getByRole('status')).toHaveTextContent('Loading inventory');
    expect(screen.queryByText('No inventory records were returned')).not.toBeInTheDocument();
  });
  it('waits for a profile rather than claiming an empty database', () => {
    render(<InventoryLoadState {...defaults} ready={false} />);
    expect(screen.getByRole('status')).toHaveTextContent('Waiting for your staff profile');
  });
  it('distinguishes successfully loaded but filtered records', () => {
    render(<InventoryLoadState {...defaults} total={24} />);
    expect(screen.getByRole('status')).toHaveTextContent('24 records loaded');
    expect(screen.getByRole('status')).toHaveTextContent('Archived');
    fireEvent.click(screen.getByText('Reset filters')); expect(defaults.onReset).toHaveBeenCalled();
  });
  it('reports a successful zero-row query without claiming deletion', () => {
    render(<InventoryLoadState {...defaults} />);
    expect(screen.getByRole('status')).toHaveTextContent('No inventory records were returned');
    expect(screen.getByRole('status')).toHaveTextContent('No records have been changed or restored');
  });
  it('does not show empty state when items are visible', () => {
    render(<InventoryLoadState {...defaults} total={10} visible={3} />);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});
