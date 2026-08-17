import { describe, expect, test } from 'bun:test';

import { resolveStandaloneStudioHostOptions } from './resolveStandaloneStudioHostOptions';

describe('resolveStandaloneStudioHostOptions', () => {
  test('binds the development host to LAN-reachable interfaces by default', () => {
    expect(resolveStandaloneStudioHostOptions(undefined)).toEqual({
      port: 3000,
      host: '0.0.0.0',
    });
  });

  test('keeps the configured standalone port', () => {
    expect(resolveStandaloneStudioHostOptions('4321')).toEqual({
      port: 4321,
      host: '0.0.0.0',
    });
  });

  test('rejects invalid standalone ports', () => {
    for (const value of ['0', '65536', 'invalid']) {
      expect(() => resolveStandaloneStudioHostOptions(value)).toThrow(
        `Invalid ANKHORAGE_STUDIO_HOST_PORT: ${value}`,
      );
    }
  });
});
