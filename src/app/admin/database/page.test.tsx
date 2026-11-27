
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import DatabaseMetricsPage from './page';
import { mockUseCollection, mockUseProfile } from '@/test/setup';

describe('Database Infrastructure Telemetry', () => {
  it('renders storage used and file count for R2', () => {
    mockUseProfile.mockReturnValue({ isSuperAdmin: true, profile: { uid: '1' }, loading: false } as any);
    mockUseCollection.mockReturnValue({ data: [], loading: false });

    render(<DatabaseMetricsPage />);
    
    expect(screen.getByText(/428 MB/i)).toBeInTheDocument();
    expect(screen.getByText(/842 Files/i)).toBeInTheDocument();
    expect(screen.getByText(/Cloudflare R2 Storage/i)).toBeInTheDocument();
  });

  it('shows system node distribution chart containers', () => {
    render(<DatabaseMetricsPage />);
    expect(screen.getByText(/Document Distribution/i)).toBeInTheDocument();
    expect(screen.getByText(/Sync Velocity/i)).toBeInTheDocument();
  });
});
