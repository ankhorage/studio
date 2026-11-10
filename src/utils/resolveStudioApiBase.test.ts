import { describe, expect, it } from 'bun:test';

import { resolveStudioApiBase } from './resolveStudioApiBase';

describe('resolveStudioApiBase', () => {
  it('uses Android device loopback for the default local Studio API', () => {
    expect(
      resolveStudioApiBase({
        configuredApiBase: undefined,
        explicitApiBase: undefined,
        expoHostUri: '192.168.1.109:8081',
        platform: 'android',
      }),
    ).toBe('http://127.0.0.1:3000/api');
  });

  it('keeps an explicit API URL authoritative on Android', () => {
    expect(
      resolveStudioApiBase({
        configuredApiBase: undefined,
        explicitApiBase: 'https://studio-api.example.com/api',
        expoHostUri: '192.168.1.109:8081',
        platform: 'android',
      }),
    ).toBe('https://studio-api.example.com/api');
  });

  it('preserves Expo host resolution for Web and iOS', () => {
    for (const platform of ['web', 'ios']) {
      expect(
        resolveStudioApiBase({
          configuredApiBase: undefined,
          explicitApiBase: undefined,
          expoHostUri: '192.168.1.109:8081',
          platform,
        }),
      ).toBe('http://192.168.1.109:3000/api');
    }
  });

  it('uses the app-owned Expo configuration when a runtime environment is unavailable', () => {
    expect(
      resolveStudioApiBase({
        configuredApiBase: 'https://studio-api.example.com/api',
        explicitApiBase: undefined,
        expoHostUri: null,
        platform: 'web',
      }),
    ).toBe('https://studio-api.example.com/api');
  });
});
