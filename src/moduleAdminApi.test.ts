import { describe, expect, test } from 'bun:test';

import {
  createProjectModuleApiPath,
  parseStudioModuleState,
  StudioModuleApiError,
} from './moduleAdminApi';

describe('moduleAdminApi', () => {
  test('builds encoded project-scoped canonical module routes', () => {
    expect(
      createProjectModuleApiPath({ projectId: 'project one', moduleId: 'vendor/module' }),
    ).toBe('/projects/project%20one/modules/vendor%2Fmodule');
  });

  test('parses contribution absence and exposes explicit HTTP error status', () => {
    expect(parseStudioModuleState(createModuleState({ admin: null })).admin).toBeNull();
    expect(() => parseStudioModuleState({ id: 'broken' })).toThrow(
      'Module state response was invalid.',
    );

    const error = new StudioModuleApiError('Module not found', 404);
    expect(error.status).toBe(404);
    expect(error.message).toBe('Module not found');
  });
});

function createModuleState(overrides: Record<string, unknown> = {}) {
  return {
    id: 'vendor/module',
    name: 'Example',
    description: 'Example module',
    available: true,
    installed: false,
    pendingRemoval: false,
    dependencies: [],
    dependents: [],
    config: null,
    admin: {
      kind: 'config-schema',
      title: 'Example',
      description: 'Example config',
      fields: [{ key: 'value', label: 'Value', control: 'text', required: false }],
    },
    ...overrides,
  };
}
