import { describe, expect, test } from 'bun:test';

import { getAuthAdapterTs } from './adapter';

describe('getAuthAdapterTs', () => {
  test('keeps Expo public environment reads static while narrowing their generated type', () => {
    const source = getAuthAdapterTs();

    expect(source).toContain('process.env.EXPO_PUBLIC_SUPABASE_URL as string | undefined');
    expect(source).toContain('process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY as string | undefined');
    expect(source).not.toContain('globalThis.process');
    expect(source).not.toContain('env[');
  });

  test('omits compile-time false OAuth branches when no providers are configured', () => {
    const source = getAuthAdapterTs();

    expect(source).not.toContain('generatedOAuthProviders');
    expect(source).not.toContain('oauthProviders: generatedOAuthProviders');
    expect(source).not.toContain('generatedOAuthProviders.length > 0');
  });

  test('renders configured OAuth providers directly without a generated length condition', () => {
    const source = getAuthAdapterTs({ oauthProviders: ['google'] });

    expect(source).toContain('const generatedOAuthProviders = ["google"] as const;');
    expect(source).toContain('oauthProviders: generatedOAuthProviders');
    expect(source).not.toContain('generatedOAuthProviders.length > 0');
  });
});
