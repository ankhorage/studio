import type { AppManifest } from '@ankhorage/contracts';
import { createOAuthFixtureManifest, OAUTH_CALLBACK_ROUTE } from '@ankhorage/templates';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { ModuleManager } from '../orchestrator/moduleManager.js';
import { ProjectManager } from '../orchestrator/projectManager.js';
import { getTemplateCatalog } from '../templateRegistry.js';
import { AUTH5_NATIVE_OAUTH_SMOKE } from './auth5NativeOAuthSmokeConfig.js';

export interface Auth5NativeOAuthSmokeFixture {
  readonly callbackRoute: string;
  readonly projectId: string;
  readonly projectRoot: string;
  readonly workspaceRoot: string;
}

export async function createAuth5NativeOAuthSmokeFixture(
  workspaceRoot: string,
): Promise<Auth5NativeOAuthSmokeFixture> {
  await prepareWorkspace(workspaceRoot);
  const projectManager = new ProjectManager(workspaceRoot);
  const moduleManager = new ModuleManager(workspaceRoot);
  const template = getTemplateCatalog()
    .categories.find((candidate) => candidate.id === 'developer_tools')
    ?.templates.at(0);
  if (!template) throw new Error('Developer-tools template is unavailable.');

  const created = await projectManager.createProject(
    AUTH5_NATIVE_OAUTH_SMOKE.projectName,
    { category: 'developer_tools', templateId: template.templateId },
    undefined,
    { includeStudio: false },
  );
  const manifest = createSmokeManifest();
  await moduleManager.saveProjectManifest({ projectId: created.id, manifest });

  return {
    callbackRoute: OAUTH_CALLBACK_ROUTE,
    projectId: created.id,
    projectRoot: created.path,
    workspaceRoot,
  };
}

function createSmokeManifest(): AppManifest {
  return {
    ...createOAuthFixtureManifest({
      category: 'developer_tools',
      fixture: 'google',
      overrides: {
        metadata: {
          name: AUTH5_NATIVE_OAUTH_SMOKE.projectName,
          slug: AUTH5_NATIVE_OAUTH_SMOKE.projectId,
        },
      },
    }),
    deploy: {
      targets: {
        web: { enabled: true },
        android: { enabled: true, ...AUTH5_NATIVE_OAUTH_SMOKE.android },
        ios: { enabled: true, ...AUTH5_NATIVE_OAUTH_SMOKE.ios },
      },
    },
  };
}

async function prepareWorkspace(workspaceRoot: string): Promise<void> {
  await mkdir(path.join(workspaceRoot, 'apps', 'studio'), { recursive: true });
  await writeFile(
    path.join(workspaceRoot, 'package.json'),
    `${JSON.stringify({ name: '@ankhorage/auth5-native-oauth-smoke', private: true, packageManager: 'bun@1.3.13', workspaces: ['apps/*'] }, null, 2)}\n`,
    'utf8',
  );
}
