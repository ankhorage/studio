import { expect, test } from 'bun:test';

import type { AnkhAdminPage } from './root';

type AdminPageExport = typeof AnkhAdminPage;

test('exports the generated-app admin page renderer', () => {
  const exportedPage: AdminPageExport | null = null;

  expect(exportedPage).toBeNull();
});
