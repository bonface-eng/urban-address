import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import DatabaseMetricsPage from './page';
import { mockUseCollection, mockUseMemoFirebase, mockUseProfile } from '@/test/setup';

describe('Database infrastructure telemetry', () => {
  beforeEach(() => {
    mockUseProfile.mockReturnValue({ isSuperAdmin: true, profile: { uid: 'admin-1' }, loading: false } as any);
    mockUseMemoFirebase.mockReturnValue(null);
    mockUseCollection.mockReturnValue({ data: [], loading: false, error: null } as any);
  });

  it('shows actual Firestore collection metrics instead of simulated telemetry', async () => {
    render(<DatabaseMetricsPage />);
    expect(await screen.findByText(/SYSTEM TELEMETRY/i)).toBeInTheDocument();
    expect(screen.getByText(/Firestore order records/i)).toBeInTheDocument();
    expect(screen.getByText(/Inventory records/i)).toBeInTheDocument();
    expect(screen.getByText(/Staff profiles/i)).toBeInTheDocument();
    expect(screen.queryByText(/Neural Link Latency/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/IO Persistence Node/i)).not.toBeInTheDocument();
  });
});
