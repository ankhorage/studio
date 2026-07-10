import { expect, test } from 'bun:test';
import { mkdtemp, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { ModuleManager } from './orchestrator/moduleManager';
import { ProjectManager } from './orchestrator/projectManager';
import { getTemplateSummaries } from './templateRegistry';

async function collectSourceFiles(root: string): Promise<string[]> {
  const entries = await readdir(root, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const target = path.join(root, entry.name);
    if (entry.isDirectory()) return collectSourceFiles(target);
    return /\.(?:json|js|ts|tsx)$/u.test(entry.name) ? [target] : [];
  }));
  return nested.flat();
}

test('creates, synchronizes, edits and deletes a real generated app without ankhorage4', async () => {
  const workspaceRoot = await mkdtemp(path.join(tmpdir(), 'ankhorage-studio-lifecycle-'));
  await mkdir(path.join(workspaceRoot, 'apps', 'studio'), { recursive: true });
  await writeFile(
    path.join(workspaceRoot, 'package.json'),
    JSON.stringify({ name: '@ankhorage/studio', private: true, workspaces: ['apps/*'] }),
  );

  const projectManager = new ProjectManager(workspaceRoot);
  const moduleManager = new ModuleManager(workspaceRoot);
  const [template] = getTemplateSummaries();
  if (template === undefined) throw new Error('Published templates package returned no templates.');

  const created = await projectManager.createProject(
    'Host Smoke App',
    { category: template.category, templateId: template.templateId },
    (projectId) => moduleManager.generateModuleRegistry(projectId),
  );
  expect(created.success).toBe(true);

  const projects = await projectManager.listProjects();
  expect(projects.some((project) => project.id === created.id && project.isAnkhApp)).toBe(true);

  await moduleManager.syncProject({ projectId: created.id, includeStudio: true });
  const manifest = await projectManager.getStudioManifest(created.id);
  await projectManager.saveStudioManifest({
    projectId: created.id,
    manifest: { ...manifest, metadata: { ...manifest.metadata, name: 'Edited Smoke App' } },
  });
  expect((await projectManager.getStudioManifest(created.id)).metadata.name).toBe('Edited Smoke App');

  const generatedFiles = await collectSourceFiles(created.path);
  for (const file of generatedFiles) {
    expect(await readFile(file, 'utf8')).not.toContain('@ankh/');
  }

  const infrastructure = await projectManager.getInfrastructureStatus(created.id);
  expect(infrastructure).toBeDefined();

  await projectManager.deleteProject(created.id);
  expect((await projectManager.listProjects()).some((project) => project.id === created.id)).toBe(false);
});
