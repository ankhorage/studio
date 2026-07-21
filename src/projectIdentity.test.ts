import { expect, test } from 'bun:test';

import { deriveProjectId, validateProjectCreationInput } from './projectIdentity';
import type { StudioProjectSummary } from './projectWorkspaceContracts';

const existingProjects = [
  {
    id: 'foo',
    name: 'Foo',
    path: '/workspace/apps/foo',
    version: '1.0.0',
    isAnkhApp: true,
    category: 'developer_tools',
    activeTheme: {
      id: 'default',
      name: 'Default',
      light: { primaryColor: '#2563eb', harmony: 'analogous' },
      dark: { primaryColor: '#60a5fa', harmony: 'analogous' },
    },
  },
] satisfies StudioProjectSummary[];

test('derives project IDs with the shared canonical rules', () => {
  expect(deriveProjectId('Spotify')).toBe('spotify');
  expect(deriveProjectId('Spot the fly')).toBe('spot-the-fly');
});

test('validates duplicate and reserved project identities', () => {
  expect(validateProjectCreationInput({ name: 'New app', existingProjects })).toEqual({
    ok: true,
    projectId: 'new-app',
  });

  expect(validateProjectCreationInput({ name: 'Foo', existingProjects })).toMatchObject({
    ok: false,
    projectId: 'foo',
    reason: { code: 'project-id-exists' },
  });

  expect(validateProjectCreationInput({ name: 'Studio', existingProjects })).toMatchObject({
    ok: false,
    projectId: 'studio',
    reason: { code: 'reserved-project-id' },
  });

  expect(validateProjectCreationInput({ name: '!!!', existingProjects })).toMatchObject({
    ok: false,
    projectId: '',
    reason: { code: 'invalid-project-id' },
  });
});
