import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import DatabaseMetricsPage from './page';
import { mockUseCollection, mockUseMemoSupabase, mockUseProfile } from '@/test/setup';

describe('Database infrastructure telemetry', () => {
  beforeEach(() => {
    mockUseProfile.mockReturnValue({ isSuperAdmin: true, profile: { uid: 'admin-1' }, loading: false } as any);
    mockUseMemoSupabase.mockReturnValue(null);
    mockUseCollection.mockReturnValue({ data: [], loading: false, error: null } as any);
  });

  it('shows actual collection telemetry instead of simulated telemetry', async () => {
    render(<DatabaseMetricsPage />);
    expect(await screen.findByRole('heading', { name: /System Telemetry/i })).toBeInTheDocument();
    expect(screen.getByText(/Operational order records/i)).toBeInTheDocument();
    expect(screen.getByText(/Inventory records/i)).toBeInTheDocument();
    expect(screen.getByText(/Staff profiles/i)).toBeInTheDocument();
    expect(screen.queryByText(/Neural Link Latency/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/IO Persistence Node/i)).not.toBeInTheDocument();
  });
});
