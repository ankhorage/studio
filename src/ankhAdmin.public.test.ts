import { expect, test } from 'bun:test';

import type { AnkhAdminPage, AnkhAdminShell } from './root';

type AdminShellExport = typeof AnkhAdminShell;
type AdminPageExport = typeof AnkhAdminPage;

test('exports generated-app admin composition components', () => {
  const exportsAreTyped: {
    readonly shell: AdminShellExport | null;
    readonly page: AdminPageExport | null;
  } = {
    shell: null,
    page: null,
  };

  expect(exportsAreTyped).toEqual({ shell: null, page: null });
});
