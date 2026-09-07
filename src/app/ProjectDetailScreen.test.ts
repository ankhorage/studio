import { readFileSync } from 'node:fs';
import path from 'node:path';

import { expect, test } from 'bun:test';

const projectDetailSource = readFileSync(
  path.join(import.meta.dir, 'ProjectDetailScreen.tsx'),
  'utf8',
);
const appBarSource = readFileSync(
  path.join(import.meta.dir, '..', 'ui', 'createStudioAppBarActions.ts'),
  'utf8',
);

test('keeps package and repository lifecycle controls beside Sync on the project dashboard', () => {
  const syncIndex = projectDetailSource.indexOf('label="Sync"');
  const installIndex = projectDetailSource.indexOf('label="Install packages"');
  const connectIndex = projectDetailSource.indexOf('label="Connect GitHub"');

  expect(syncIndex).toBeGreaterThan(-1);
  expect(installIndex).toBeGreaterThan(syncIndex);
  expect(connectIndex).toBeGreaterThan(installIndex);
  expect(appBarSource).not.toContain('Install packages');
  expect(appBarSource).not.toContain('installProjectPackages');
});
