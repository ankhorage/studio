import { describe, expect, test } from 'bun:test';

import { isStringArray, isStringRecord, readLocalizationConfig } from './localizationConfig';

describe('localizationConfig', () => {
  test('detects string arrays', () => {
    expect(isStringArray(['en', 'de'])).toBe(true);
    expect(isStringArray(['en', 1])).toBe(false);
    expect(isStringArray('en')).toBe(false);
  });

  test('detects string records', () => {
    expect(isStringRecord({ hello: 'world' })).toBe(true);
    expect(isStringRecord({ hello: 1 })).toBe(false);
    expect(isStringRecord(['hello'])).toBe(false);
  });

  test('reads optional locale config defensively', () => {
    expect(readLocalizationConfig({ locales: ['en', 'de'] })).toEqual({ locales: ['en', 'de'] });
    expect(readLocalizationConfig({})).toEqual({});
    expect(readLocalizationConfig({ locales: ['en', 1] })).toBeNull();
    expect(readLocalizationConfig(null)).toBeNull();
  });
});
