import { expect, test } from 'bun:test';

import provider from './index';

test('declares exactly the capabilities implemented by the Studio provider', async () => {
  const packageJson = (await Bun.file(new URL('../../package.json', import.meta.url)).json()) as {
    readonly ankh?: { readonly capabilities?: readonly string[] };
  };

  expect(packageJson.ankh?.capabilities).toEqual(provider.capabilities);
});

test('keeps CLI provider loading independent from Studio host runtime modules', async () => {
  const source = await Bun.file(new URL('./index.ts', import.meta.url)).text();

  expect(source).not.toMatch(/^import(?! type).*from ['"]\.\.\/host\//m);
  expect(source).toContain("import('../host/createStudioHost')");
  expect(source).toContain("import('../host/http/server')");
});
