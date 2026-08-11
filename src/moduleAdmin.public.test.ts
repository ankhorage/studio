import { expect, test } from 'bun:test';

import { STUDIO_PUBLIC_CONTRACTS } from './index';
import type {
  StudioModuleAdminContribution,
  StudioModuleOperationResult,
  StudioModuleState,
} from './root';

test('exports only generic module administration view contracts from the package root', () => {
  const admin: StudioModuleAdminContribution = {
    kind: 'config-schema',
    title: 'Example',
    description: 'Package-owned configuration',
    fields: [{ key: 'value', label: 'Value', control: 'text', required: false }],
  };
  const module: StudioModuleState = {
    id: 'example/module',
    name: 'Example',
    description: 'Example module',
    available: true,
    installed: false,
    pendingRemoval: false,
    dependencies: [],
    dependents: [],
    config: null,
    admin,
  };
  const result: StudioModuleOperationResult = {
    success: true,
    module,
    needsReload: false,
  };

  expect(result.module?.admin).toBe(admin);
  expect(STUDIO_PUBLIC_CONTRACTS).toContain('StudioModuleState');
  expect(STUDIO_PUBLIC_CONTRACTS).toContain('StudioModuleAdminContribution');
  expect(STUDIO_PUBLIC_CONTRACTS).toContain('StudioModuleOperationResult');
});
