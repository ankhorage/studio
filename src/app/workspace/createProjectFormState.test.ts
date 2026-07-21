import { expect, test } from 'bun:test';

import type { StudioProjectSummary } from '../../projectWorkspaceContracts';
import { resolveCreateProjectFormState } from './createProjectFormState';

const existingProject = {
  id: 'release-monitor',
  name: 'Release Monitor',
  path: '/workspace/apps/release-monitor',
  version: '1.0.0',
  isAnkhApp: true,
  category: 'music_audio',
  activeTheme: {
    id: 'default',
    name: 'Default',
    light: { primaryColor: '#2563eb', harmony: 'analogous' },
    dark: { primaryColor: '#60a5fa', harmony: 'analogous' },
  },
} satisfies StudioProjectSummary;

const existingProjects = [existingProject] satisfies StudioProjectSummary[];

test('does not enter a valid creation state while projects are loading', () => {
  const state = resolveCreateProjectFormState({
    projectName: 'Release Monitor',
    existingProjects: [],
    projectsLoading: true,
    projectsError: null,
    templateAvailable: true,
    isCreating: false,
  });

  expect(state.projectListState).toBe('loading');
  expect(state.validation).toBeNull();
  expect(state.canCreate).toBe(false);
});

test('surfaces project list failure as non-creatable', () => {
  const state = resolveCreateProjectFormState({
    projectName: 'Infra Health',
    existingProjects: [],
    projectsLoading: false,
    projectsError: 'Could not connect',
    templateAvailable: true,
    isCreating: false,
  });

  expect(state.projectListState).toBe('error');
  expect(state.validation).toBeNull();
  expect(state.canCreate).toBe(false);
});

test('blocks duplicate names, duplicate IDs, and reserved studio ID after projects load', () => {
  expect(
    resolveCreateProjectFormState({
      projectName: 'Release Monitor',
      existingProjects,
      projectsLoading: false,
      projectsError: null,
      templateAvailable: true,
      isCreating: false,
    }).validation,
  ).toMatchObject({ ok: false, reason: { code: 'project-id-exists' } });

  expect(
    resolveCreateProjectFormState({
      projectName: 'Existing Display',
      existingProjects: [
        {
          ...existingProject,
          id: 'different-id',
          name: 'Existing Display',
        },
      ],
      projectsLoading: false,
      projectsError: null,
      templateAvailable: true,
      isCreating: false,
    }).validation,
  ).toMatchObject({ ok: false, reason: { code: 'project-name-exists' } });

  expect(
    resolveCreateProjectFormState({
      projectName: 'Infra Health',
      existingProjects: [
        {
          ...existingProject,
          id: 'infra-health',
          name: 'Other',
        },
      ],
      projectsLoading: false,
      projectsError: null,
      templateAvailable: true,
      isCreating: false,
    }).validation,
  ).toMatchObject({ ok: false, reason: { code: 'project-id-exists' } });

  expect(
    resolveCreateProjectFormState({
      projectName: 'Studio',
      existingProjects,
      projectsLoading: false,
      projectsError: null,
      templateAvailable: true,
      isCreating: false,
    }).validation,
  ).toMatchObject({ ok: false, reason: { code: 'reserved-project-id' } });
});

test('enables creation only after template and project data are ready', () => {
  const state = resolveCreateProjectFormState({
    projectName: 'Infra Health',
    existingProjects,
    projectsLoading: false,
    projectsError: null,
    templateAvailable: true,
    isCreating: false,
  });

  expect(state.derivedProjectId).toBe('infra-health');
  expect(state.validation).toEqual({ ok: true, projectId: 'infra-health' });
  expect(state.canCreate).toBe(true);
});
