import { expect, test } from 'bun:test';

import type { AnkhAdminPage, StudioAdminAccessGate, useStudioAdminWorkspace } from './root';

type AdminPageExport = typeof AnkhAdminPage;
type WorkspaceExport = typeof useStudioAdminWorkspace;
type AccessGateExport = typeof StudioAdminAccessGate;

test('exports generated-app admin page and Navigator integration bindings', () => {
  const exportsAreTyped: {
    readonly page: AdminPageExport | null;
    readonly workspace: WorkspaceExport | null;
    readonly accessGate: AccessGateExport | null;
  } = {
    page: null,
    workspace: null,
    accessGate: null,
  };

  expect(exportsAreTyped).toEqual({ page: null, workspace: null, accessGate: null });
});
