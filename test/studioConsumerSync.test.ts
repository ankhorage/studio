import { describe, expect, test } from 'bun:test';

import { reconcileStudioConsumerManifest } from '../scripts/reconcileStudioConsumerManifest';

const root = {
  name: '@ankhorage/studio',
  version: '8.0.2',
  dependencies: {
    '@ankhorage/expo-runtime': '^7.0.2',
    '@ankhorage/utility': '^1.9.85',
  },
  devDependencies: {
    '@ankhorage/devtools': '^2.3.21',
  },
};

const app = {
  name: '@ankhorage/studio-app',
  version: '1.0.1',
  dependencies: {
    '@ankhorage/studio': '^8.0.1',
    '@ankhorage/expo-runtime': '^7.0.1',
    '@ankhorage/utility': '^1.10.0',
    'expo': '57.0.31',
  },
  devDependencies: {
    '@ankhorage/devtools': '^2.0.100',
    'typescript': '~6.0.3',
  },
};

describe('published Studio first-party owner dependency sync', () => {
  test('updates only already-declared owner floors while preserving platform pins and newer floors', () => {
    const result = reconcileStudioConsumerManifest(root, app, '8.0.2');
    expect(result.dependencies).toEqual({
      '@ankhorage/studio': '^8.0.2',
      '@ankhorage/expo-runtime': '^7.0.2',
      '@ankhorage/utility': '^1.10.0',
      expo: '57.0.31',
    });
    expect(result.devDependencies).toEqual({
      '@ankhorage/devtools': '^2.3.21',
      typescript: '~6.0.3',
    });
    expect(result.dependencies).not.toHaveProperty('@ankhorage/contracts');
  });

  test('is idempotent and does not mutate the source manifests', () => {
    const first = reconcileStudioConsumerManifest(root, app, '8.0.2');
    expect(reconcileStudioConsumerManifest(root, first, '8.0.2')).toEqual(first);
    expect(app.dependencies['@ankhorage/studio']).toBe('^8.0.1');
  });

  test('does not synchronize an unpublished or different root version', () => {
    expect(() => reconcileStudioConsumerManifest(root, app, '8.0.3')).toThrow('verified npm release');
  });

  test('fails closed on workspace aliases or unsupported owner ranges', () => {
    const modified = {
      ...app,
      dependencies: { ...app.dependencies, '@ankhorage/studio': 'workspace:*' },
    };
    expect(() => reconcileStudioConsumerManifest(root, modified, '8.0.2')).toThrow('Unsupported owner range');
  });
});
