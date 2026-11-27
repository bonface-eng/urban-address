import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppShell } from './app-shell';

const route = vi.hoisted(() => ({ pathname: '/' }));
vi.mock('next/navigation', () => ({
  usePathname: () => route.pathname,
  useRouter: () => ({ replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock('@/firebase', () => ({
  useUser: () => ({ user: null, loading: true }),
  useFirestore: () => null,
  useDoc: () => ({ data: null }),
}));
vi.mock('./sidebar', () => ({ Sidebar: () => null }));
vi.mock('./header', () => ({ Header: () => null }));
vi.mock('./bottom-nav', () => ({ BottomNav: () => null }));
vi.mock('@/components/pos/terminal-lock', () => ({ TerminalLock: () => null }));
vi.mock('@/components/shared/version-update', () => ({ VersionUpdateBriefing: () => null }));
vi.mock('react-snowfall', () => ({ default: () => null }));

describe('AppShell initial server HTML', () => {
  beforeEach(() => { route.pathname = '/'; });

  it.each(['/', '/about', '/contact', '/client/carwash'])('renders public content on %s before mount', pathname => {
    route.pathname = pathname;
    expect(renderToStaticMarkup(<AppShell><h1>Public business content</h1></AppShell>))
      .toContain('<h1>Public business content</h1>');
  });

  it.each(['/dashboard', '/admin', '/login', '/signup'])('preserves the pre-mount gate on %s', pathname => {
    route.pathname = pathname;
    expect(renderToStaticMarkup(<AppShell><h1>Protected screen</h1></AppShell>))
      .not.toContain('Protected screen');
  });
});
