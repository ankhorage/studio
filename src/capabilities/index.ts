import type { Capability } from '@ankhorage/contracts/capability';

/*** Publish the canonical catalog for Studio's executable CLI capabilities. */
export const CAPABILITIES = [
  {
    id: 'studio.dev',
    owner: '@ankhorage/studio',
    access: ['invoke'],
    binding: { kind: 'action', bindableAs: ['target'] },
    label: 'Start Studio development',
    description: 'Start the local Studio host and first-party Studio app.',
  },
  {
    id: 'studio.projects.list',
    owner: '@ankhorage/studio',
    access: ['invoke'],
    binding: { kind: 'action', bindableAs: ['target'] },
    label: 'List Studio projects',
    description: 'List projects in the Studio workspace.',
  },
  {
    id: 'studio.projects.create',
    owner: '@ankhorage/studio',
    access: ['invoke'],
    binding: { kind: 'action', bindableAs: ['target'] },
    label: 'Create Studio project',
    description: 'Create a Studio project from a template.',
  },
  {
    id: 'studio.projects.delete',
    owner: '@ankhorage/studio',
    access: ['invoke'],
    binding: { kind: 'action', bindableAs: ['target'] },
    label: 'Delete Studio project',
    description: 'Delete a Studio project.',
  },
] as const satisfies readonly Capability[];
