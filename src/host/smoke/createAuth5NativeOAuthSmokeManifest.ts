import type { AppManifest } from '@ankhorage/contracts';
import { createOAuthFixtureManifest } from './createOAuthFixtureManifest';

import { AUTH5_NATIVE_OAUTH_SMOKE } from './auth5NativeOAuthSmokeConfig.js';

export function createAuth5NativeOAuthSmokeManifest(): AppManifest {
  return {
    ...createOAuthFixtureManifest({
      category: 'developer_tools',
      fixture: 'google',
      overrides: {
        metadata: {
          name: AUTH5_NATIVE_OAUTH_SMOKE.projectName,
          slug: AUTH5_NATIVE_OAUTH_SMOKE.projectId,
        },
      },
    }),
    deploy: {
      targets: {
        web: { enabled: true },
        android: { enabled: true, ...AUTH5_NATIVE_OAUTH_SMOKE.android },
        ios: { enabled: true, ...AUTH5_NATIVE_OAUTH_SMOKE.ios },
      },
    },
  };
}
