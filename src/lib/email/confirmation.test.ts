import { describe, expect, it } from 'vitest';
import { buildEmailConfirmationMessage } from './confirmation';

describe('email send confirmation', () => {
  it('shows the exact irreversible-send warning for one specified address', () => {
    expect(buildEmailConfirmationMessage('Official communication from Urban Auto Express', 1))
      .toBe('Send “Official communication from Urban Auto Express” to 1 specified address(es)? This action cannot be recalled.');
  });

  it('uses the supplied recipient count', () => {
    expect(buildEmailConfirmationMessage('Notice', 3))
      .toBe('Send “Notice” to 3 specified address(es)? This action cannot be recalled.');
  });
});
