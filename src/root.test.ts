import { expect, test } from 'bun:test';

import { AnkhStudio, StudioProvider, useStudio, useStudioAppBarAugmentation } from './root';

test('exports the Studio runtime symbols used by generated app layouts', () => {
  expect(typeof StudioProvider).toBe('function');
  expect(typeof AnkhStudio).toBe('function');
  expect(typeof useStudio).toBe('function');
  expect(typeof useStudioAppBarAugmentation).toBe('function');
});

test('includes generated apps in workspace installs', async () => {
  const packageJson = await Bun.file(new URL('../package.json', import.meta.url)).text();

  expect(packageJson).toContain('"apps/*"');
});
