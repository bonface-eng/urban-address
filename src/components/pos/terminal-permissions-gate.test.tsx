import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { TerminalPermissionsGate } from './terminal-permissions-gate';

class MockNotification {
  static permission: NotificationPermission = 'default';
  static requestPermission = vi.fn<() => Promise<NotificationPermission>>();
}

const originalPermissionsDescriptor = Object.getOwnPropertyDescriptor(navigator, 'permissions');
const originalMediaDevicesDescriptor = Object.getOwnPropertyDescriptor(navigator, 'mediaDevices');

function mockBrowserPermissions(microphoneState: PermissionState = 'prompt') {
  vi.stubGlobal('Notification', MockNotification);
  Object.defineProperty(navigator, 'permissions', {
    configurable: true,
    value: { query: vi.fn().mockResolvedValue({ state: microphoneState }) },
  });
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: {
      getUserMedia: vi.fn().mockResolvedValue({
        getTracks: () => [{ stop: vi.fn() }],
      }),
    },
  });
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  if (originalPermissionsDescriptor) Object.defineProperty(navigator, 'permissions', originalPermissionsDescriptor);
  else delete (navigator as any).permissions;
  if (originalMediaDevicesDescriptor) Object.defineProperty(navigator, 'mediaDevices', originalMediaDevicesDescriptor);
  else delete (navigator as any).mediaDevices;
});

beforeEach(() => {
  MockNotification.permission = 'default';
  MockNotification.requestPermission.mockReset();
  MockNotification.requestPermission.mockResolvedValue('granted');
  mockBrowserPermissions();
});

describe('TerminalPermissionsGate', () => {
  it('keeps staff in the gate when notification permission is denied', async () => {
    MockNotification.permission = 'denied';
    MockNotification.requestPermission.mockResolvedValue('denied');
    const onReady = vi.fn();

    render(<TerminalPermissionsGate onReady={onReady} />);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /continue without permissions/i })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /enable notifications and continue/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/notifications are blocked/i);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(onReady).not.toHaveBeenCalled();
  });

  it('allows an administrator to explicitly continue without granting permissions', () => {
    const onReady = vi.fn();
    render(<TerminalPermissionsGate canSkip onReady={onReady} />);

    fireEvent.click(screen.getByRole('button', { name: /continue without permissions/i }));

    expect(onReady).toHaveBeenCalledTimes(1);
  });

  it('does not offer the administrator override to non-admin roles', () => {
    render(<TerminalPermissionsGate canSkip={false} onReady={vi.fn()} />);

    expect(screen.queryByRole('button', { name: /continue without permissions/i })).not.toBeInTheDocument();
  });

  it('continues after notifications are granted without requesting microphone access', async () => {
    const onReady = vi.fn();
    render(<TerminalPermissionsGate onReady={onReady} />);

    fireEvent.click(screen.getByRole('button', { name: /enable notifications and continue/i }));

    await waitFor(() => expect(onReady).toHaveBeenCalledTimes(1));
    expect(navigator.mediaDevices.getUserMedia).not.toHaveBeenCalled();
  });

  it('allows devices without microphone hardware to enter the POS', async () => {
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: undefined });
    const onReady = vi.fn();
    render(<TerminalPermissionsGate onReady={onReady} />);

    fireEvent.click(screen.getByRole('button', { name: /enable notifications and continue/i }));

    await waitFor(() => expect(onReady).toHaveBeenCalledTimes(1));
  });

  it('automatically continues when notifications were already granted', async () => {
    MockNotification.permission = 'granted';
    const onReady = vi.fn();

    render(<TerminalPermissionsGate onReady={onReady} />);

    await waitFor(() => expect(onReady).toHaveBeenCalledTimes(1));
  });
});
