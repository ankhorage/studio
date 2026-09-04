import type { AppCategory, AppManifest } from '@ankhorage/contracts';
import { resolveOAuthFixture, type OAuthFixtureId } from '@ankhorage/templates';

import { createSmokeProjectSource } from './createSmokeProjectSource';

interface OAuthFixtureManifestOverrides {
  readonly metadata?: Partial<AppManifest['metadata']>;
}

/*** Compose a local smoke manifest around the published OAuth fixture without requiring a catalog template. */
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
        oauth: fixture.oauth,
      },
    },
  };
}
