import type { AppCategory, AppManifest } from '@ankhorage/contracts';
import { type OAuthFixtureId, resolveOAuthFixture } from '@ankhorage/templates';

import { createSmokeProjectSource } from './createSmokeProjectSource';

interface OAuthFixtureManifestOverrides {
  readonly metadata?: Partial<AppManifest['metadata']>;
}

/***
 * Compose a local smoke manifest around the published OAuth fixture without requiring a catalog template.
 * @todo Move this acceptance-fixture composition from production src/host/smoke to test/smoke.
 */
export function createOAuthFixtureManifest(args: {
  readonly category: AppCategory;
  readonly fixture: OAuthFixtureId;
  readonly overrides?: OAuthFixtureManifestOverrides;
}): AppManifest {
  const base = createSmokeProjectSource(args.category).manifest;
  const fixture = resolveOAuthFixture(args.fixture);
  return {
    ...base,
    metadata: {
      ...base.metadata,
      ...args.overrides?.metadata,
    },
    infra: {
      ...base.infra,
      auth: {
        ...base.infra.auth,
        scope: base.infra.auth?.scope ?? 'global',
        provider: base.infra.auth?.provider ?? 'supabase',
        oauth: fixture.oauth,
      },
    },
  };
}
