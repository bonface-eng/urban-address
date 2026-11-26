import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('terminal lock navigation isolation', () => {
  const source = readFileSync(resolve(process.cwd(), 'src/components/layout/app-shell.tsx'), 'utf8');

  it('mounts the terminal PIN/account-switch gate above the entire application shell', () => {
    const gateOpen = source.indexOf('<TerminalLock unit={getUnitContext()}>');
    const shellOpen = source.indexOf('<div className="flex h-[100dvh]');
    const shellClose = source.indexOf('</TerminalLock>', shellOpen);

    expect(gateOpen).toBeGreaterThan(-1);
    expect(shellOpen).toBeGreaterThan(gateOpen);
    expect(shellClose).toBeGreaterThan(shellOpen);
  });

  it('keeps the mobile bottom navigation inside the gated application shell', () => {
    const gateOpen = source.indexOf('<TerminalLock unit={getUnitContext()}>');
    const gateClose = source.indexOf('</TerminalLock>', gateOpen);
    const bottomNav = source.indexOf('<BottomNav />');

    expect(bottomNav).toBeGreaterThan(gateOpen);
    expect(bottomNav).toBeLessThan(gateClose);
  });

  it('does not render the terminal gate only around the page content', () => {
    expect(source).not.toContain('<TerminalLock unit={getUnitContext()}>{children}</TerminalLock>');
  });
});
