import type { AppManifest } from '@ankhorage/contracts';
import { describe, expect, test } from 'bun:test';

import { initializeProjectLocalInfraNetworking } from './initializeProjectLocalInfraNetworking';

function createManifest(
  options: { readonly supabase?: boolean; readonly publicBaseUrl?: string } = {},
): AppManifest {
  const { supabase = true, publicBaseUrl } = options;
  return {
    metadata: {
      name: 'Demo',
      slug: 'demo',
      version: '1.0.0',
      category: 'developer_tools',
      themeId: 'default',
    },
    settings: { localization: { defaultLocale: 'en', locales: ['en'] } },
    infra: {
      environments: {
        local: {
          deployment: {
            compute: { provider: 'local' },
            runtime: { provider: 'minikube' },
          },
          ...(supabase ? { database: { provider: 'supabase' as const } } : {}),
          ...(publicBaseUrl === undefined ? {} : { networking: { publicBaseUrl } }),
        },
      },
      modules: {},
    },
    navigator: { type: 'stack', routes: [] },
    screens: {},
    themes: {
      default: {
        id: 'default',
        name: 'Default',
        light: { primaryColor: '#2563eb', harmony: 'analogous' },
        dark: { primaryColor: '#60a5fa', harmony: 'analogous' },
      },
    },
    activeThemeId: 'default',
  };
}

describe('initializeProjectLocalInfraNetworking', () => {
  test('adds a stable project-specific local Supabase public origin', () => {
    const first = initializeProjectLocalInfraNetworking(createManifest(), 'project-one');
    const repeated = initializeProjectLocalInfraNetworking(createManifest(), 'project-one');
    const second = initializeProjectLocalInfraNetworking(createManifest(), 'project-two');

    expect(first.infra.environments.local.networking?.publicBaseUrl).toMatch(
      /^http:\/\/127\.0\.0\.1:\d+$/u,
    );
    expect(repeated.infra.environments.local.networking?.publicBaseUrl).toBe(
      first.infra.environments.local.networking?.publicBaseUrl,
    );
    expect(second.infra.environments.local.networking?.publicBaseUrl).not.toBe(
      first.infra.environments.local.networking?.publicBaseUrl,
    );
  });

  test('preserves explicitly authored networking intent', () => {
    const manifest = createManifest({ publicBaseUrl: 'https://api.example.test' });
    const initialized = initializeProjectLocalInfraNetworking(manifest, 'project-one');

    expect(initialized).toBe(manifest);
  });

  test('does not add networking state when Supabase is not selected', () => {
    const manifest = createManifest({ supabase: false });
    const initialized = initializeProjectLocalInfraNetworking(manifest, 'project-one');

    expect(initialized).toBe(manifest);
    expect(initialized.infra.environments.local.networking).toBeUndefined();
  });
});
