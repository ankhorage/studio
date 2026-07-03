import { describe, expect, test } from 'bun:test';

import type { StudioLocalizationConfig } from './localizationConfig';
import { isStringArray, isStringRecord, readLocalizationConfig } from './localizationConfig';

describe('localization config public exports', () => {
  test('types and helpers are usable from the public module', () => {
    const config: StudioLocalizationConfig = { locales: ['en'] };

    expect(isStringArray(config.locales)).toBe(true);
    expect(isStringRecord({ greeting: 'Hello' })).toBe(true);
    expect(readLocalizationConfig(config)).toEqual(config);
  });
});
