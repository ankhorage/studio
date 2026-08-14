import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import type { AppManifest } from '@ankhorage/contracts';
import { expect, test } from 'bun:test';

import type { ProjectManager } from '../orchestrator/projectManager';
import type { ProjectDeploySecretStore } from './ProjectDeploySecretStore';
import { ProjectDeployService } from './ProjectDeployService';

test('Studio host authors deployment state only through released Deploy project APIs', async () => {
  const workspaceRoot = await fs.mkdtemp(path.join(tmpdir(), 'ankh-studio-deploy-'));
  try {
    await createProject(workspaceRoot, 'demo');
    const service = createService(workspaceRoot);

    await service.updateConfig('demo', {
      targets: {
        web: { enabled: true },
        ios: { enabled: true, bundleIdentifier: 'com.example.demo' },
      },
    });
    await service.writeListingLocale('demo', {
      locale: 'en-us',
      name: 'Demo',
      description: 'Demo app',
    });
    await service.writeMonetization('demo', [
      {
        id: 'pro',
        kind: 'non-consumable',
        localizations: [{ locale: 'en-US', name: 'Pro', description: 'Pro unlock' }],
        basePrice: { country: 'CH', currency: 'CHF', amount: '4.9' },
      },
    ]);
    await service.writeRelease('demo', {
      version: '1.0.0',
      targets: ['web', 'ios'],
      notes: [{ locale: 'en-us', text: 'Initial release' }],
      rollout: {
        web: { mode: 'immediate' },
        ios: { mode: 'staged' },
      },
    });

    expect(await service.readConfig('demo')).toEqual({
      targets: {
        web: { enabled: true },
        ios: { enabled: true, bundleIdentifier: 'com.example.demo' },
      },
    });
    expect((await service.readListing('demo')).locales[0]).toMatchObject({
      locale: 'en-US',
      name: 'Demo',
    });
    expect((await service.readMonetization('demo')).products[0]?.basePrice.amount).toBe('4.9');
    expect(await service.readRelease('demo')).toMatchObject({
      version: '1.0.0',
      targets: ['ios', 'web'],
      notes: [{ locale: 'en-US', text: 'Initial release' }],
    });
  } finally {
    await fs.rm(workspaceRoot, { recursive: true, force: true });
  }
});

test('Studio project path validation remains authoritative for Deploy host access', async () => {
  const workspaceRoot = await fs.mkdtemp(path.join(tmpdir(), 'ankh-studio-deploy-path-'));
  try {
    const service = createService(workspaceRoot);
    expect(() => service.readConfig('../escape')).toThrow('Invalid project id');
  } finally {
    await fs.rm(workspaceRoot, { recursive: true, force: true });
  }
});

function createService(workspaceRoot: string): ProjectDeployService {
  const secretStore: ProjectDeploySecretStore = {
    list: () => Promise.resolve({ ok: true, data: [] }),
    resolve: () =>
      Promise.resolve({
        ok: false,
        error: { code: 'not_found', message: 'Not configured.' },
      }),
  };
  return new ProjectDeployService({
    projectManager: Object.create(null) as ProjectManager,
    workspaceRoot,
    secretStore,
  });
}

async function createProject(workspaceRoot: string, projectId: string): Promise<void> {
  const projectRoot = path.join(workspaceRoot, 'apps', projectId);
  await fs.mkdir(projectRoot, { recursive: true });
  const manifest: AppManifest = {
    metadata: {
      name: 'Demo',
      slug: 'demo',
      version: '1.0.0',
      category: 'developer_tools',
      themeId: 'default',
    },
    themes: [],
    activeThemeId: 'default',
    infra: { modules: [] },
    navigator: {
      type: 'stack',
      routes: [{ name: 'index', screenId: 'index' }],
    },
    screens: {},
    settings: {
      localization: {
        defaultLocale: 'en',
        locales: ['en'],
      },
    },
  };
  await fs.writeFile(
    path.join(projectRoot, 'ankh.config.json'),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );
}
