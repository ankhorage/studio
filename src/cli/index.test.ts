import { expect, test } from 'bun:test';

import provider from './index';

test('declares exactly the capabilities implemented by the Studio provider', async () => {
  const packageJson = (await Bun.file(new URL('../../package.json', import.meta.url)).json()) as {
    readonly ankh?: { readonly capabilities?: readonly string[] };
  };

  expect(packageJson.ankh?.capabilities).toEqual(provider.capabilities);
});
