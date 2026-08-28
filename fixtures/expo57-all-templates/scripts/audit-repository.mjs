import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { assertNoStaleExpo57StateAsync } from './assertNoStaleExpo57StateAsync.mjs';

const scriptRoot = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptRoot, '../../..');
const negativeAssertionReason =
  'The active test or acceptance gate rejects this artifact; it is not emitted runtime state.';

await assertNoStaleExpo57StateAsync({
  root: repositoryRoot,
  mode: 'repository',
  includePaths: ['.github/workflows', 'apps/studio', 'fixtures', 'package.json', 'scripts', 'src'],
  ignoredPaths: ['fixtures/expo57-all-templates/scripts/assertNoStaleExpo57StateAsync.mjs'],
  allowedFindings: [
    {
      artifactId: 'direct-react-navigation-import',
      relativePath: 'fixtures/expo57-all-templates/scripts/assertNoStaleExpo57StateAsync.test.mjs',
      reason: negativeAssertionReason,
    },
    {
      artifactId: 'direct-react-navigation-import',
      relativePath: 'src/host/layout/templates/nestedLayout.test.ts',
      reason: negativeAssertionReason,
    },
    {
      artifactId: 'direct-react-navigation-import',
      relativePath: 'src/host/orchestrator/templates.test.ts',
      reason: negativeAssertionReason,
    },
    {
      artifactId: 'legacy-vector-icons-package',
      relativePath: 'src/host/orchestrator/templates.test.ts',
      reason: negativeAssertionReason,
    },
    {
      artifactId: 'router-babel-alias',
      relativePath: 'src/host/orchestrator/templates.test.ts',
      reason: negativeAssertionReason,
    },
    {
      artifactId: 'direct-react-navigation-import',
      relativePath: 'src/host/smoke/createExpo57NavigationFixtureManifest.test.ts',
      reason: negativeAssertionReason,
    },
    {
      artifactId: 'direct-react-navigation-import',
      relativePath: 'src/host/smoke/runExpo57GeneratedNavigationAcceptance.ts',
      reason: negativeAssertionReason,
    },
  ],
});

console.log(
  'HISTORICAL/NON-ACTIVE: CHANGELOG.md, README.md, docs/**, paradox/**, bun.lock and generated build/cache output are intentionally outside the active-state scan.',
);
