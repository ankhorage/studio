import { describe, expect, test } from 'bun:test';

import { assertNoBrowserErrors } from './assertNoBrowserErrors';

describe('assertNoBrowserErrors', () => {
  test('rejects a synthetic React hydration mismatch', () => {
    expect(() =>
      assertNoBrowserErrors(
        ['[console.error] Hydration failed because the server rendered HTML did not match.'],
        'static export',
      ),
    ).toThrow('React hydration/recoverable-render mismatch');
  });

  test('rejects arbitrary console errors instead of relying on selected substrings', () => {
    expect(() =>
      assertNoBrowserErrors(['[console.error] application-specific failure'], 'development'),
    ).toThrow('failed asset request');
  });

  test('allows only exact known React Native Web deprecation warnings', () => {
    expect(() =>
      assertNoBrowserErrors(
        [
          '[console.warning] "\\"shadow*\\" style props are deprecated. Use \\"boxShadow\\"."\nat preprocess (bundle.js:1:1)',
        ],
        'development',
      ),
    ).not.toThrow();
    expect(() =>
      assertNoBrowserErrors(['[console.warning] "different warning"'], 'development'),
    ).toThrow('different warning');
  });

  test('accepts a browser session with no severe issues', () => {
    expect(() => assertNoBrowserErrors([], 'clean session')).not.toThrow();
  });
});
