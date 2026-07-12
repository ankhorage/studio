import { describe, expect, test } from 'bun:test';

import { findRawSecretResponseKey } from './secretResponseGuard';

describe('secretResponseGuard', () => {
  test('detects nested raw secret-shaped response keys without exposing values', () => {
    const sentinel = 'sentinel-phase2-secret-do-not-leak';
    const match = findRawSecretResponseKey({
      ok: true,
      data: [{ metadata: { nested: { clientSecret: sentinel } } }],
    });

    expect(match).toEqual({
      key: 'clientSecret',
      path: '$.data[0].metadata.nested.clientSecret',
    });
    expect(JSON.stringify(match)).not.toContain(sentinel);
  });
});
