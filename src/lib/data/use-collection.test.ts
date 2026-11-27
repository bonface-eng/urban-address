import { describe, expect, it } from 'vitest';
import { shouldPublishSnapshot } from './use-collection';

describe('shouldPublishSnapshot', () => {
  it('publishes the initial snapshot even when the collection is empty', () => {
    expect(shouldPublishSnapshot(true, 0)).toBe(true);
  });

  it('publishes snapshots when at least one document changed', () => {
    expect(shouldPublishSnapshot(false, 1)).toBe(true);
  });

  it('skips unchanged snapshots without serializing every row', () => {
    expect(shouldPublishSnapshot(false, 0)).toBe(false);
  });
});
