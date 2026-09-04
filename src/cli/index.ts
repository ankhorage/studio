/***
 * Manage Studio development and projects through the Ankh CLI.
 *
 * @readme
 */
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { AnkhCommandHandler, AnkhRuntimeCommandProvider } from '@ankhorage/ankh';

import { createStudioHost } from '../host/createStudioHost';
import { startStudioHostServer } from '../host/http/server';
import { getProjectTemplateSource, type ProjectTemplateSelection } from '../host/templates';
import { resolveWorkspaceRoot } from '../host/utils/workspaceRoot';

const STUDIO_PACKAGE_NAME = '@ankhorage/studio';
const STUDIO_COMMAND_CATEGORY = 'studio';
const STUDIO_PACKAGE_VERSION = '0.0.21';

const STUDIO_CAPABILITIES = [
  'studio.dev',
  'studio.projects.list',
  'studio.projects.create',
  'studio.projects.delete',
  'studio.projects.sync',
] as const;

const COMMANDS = [
  {
    path: ['dev'],
    capability: 'studio.dev',
    summary: 'Start the local Studio host and first-party Studio app.',
    examples: ['ankh studio dev'],
  },
  {
    path: ['projects', 'list'],
    capability: 'studio.projects.list',
    summary: 'List projects in the Studio workspace.',
    examples: ['ankh studio projects list'],
  },
  {
    path: ['projects', 'create'],
    capability: 'studio.projects.create',
    summary: 'Create a Studio project from a template.',
    examples: ['ankh studio projects create --name Shop --category commerce --template shop'],
  },
  {
    path: ['projects', 'delete'],
    capability: 'studio.projects.delete',
    summary: 'Delete a Studio project.',
    examples: ['ankh studio projects delete shop'],
  },
  {
    path: ['projects', 'sync'],
    capability: 'studio.projects.sync',
    summary: 'Synchronize generated app host files.',
    examples: ['ankh studio projects sync shop'],
  },
] as const;

type CommandPath = (typeof COMMANDS)[number]['path'];

const handlers = [
  createHandler(['dev'], runStudioDev),
  createHandler(['projects', 'list'], listProjects),
  createHandler(['projects', 'create'], createProject),
  createHandler(['projects', 'delete'], deleteProject),
  createHandler(['projects', 'sync'], syncProject),
] as const;

/*** Pair one canonical Studio command path with its runtime handler. */
function createHandler(path: CommandPath, handler: AnkhCommandHandler) {
  return { path, handler };
}

const provider = {
  id: STUDIO_PACKAGE_NAME,
  category: STUDIO_COMMAND_CATEGORY,
  version: STUDIO_PACKAGE_VERSION,
  capabilities: [...STUDIO_CAPABILITIES],
  commands: COMMANDS,
  handlers,
} satisfies AnkhRuntimeCommandProvider;

export default provider;

/*** Resolve the installed Studio package root from the compiled CLI entrypoint. */
function resolvePackageRoot() {
  return resolve(dirname(fileURLToPath(import.meta.url)), '../..');
}

/*** Resolve the workspace root used by direct Studio CLI commands. */
function resolveHostWorkspaceRoot() {
  return resolveWorkspaceRoot(resolvePackageRoot());
}

/*** Start the Studio host and first-party Studio application together. */
async function runStudioDev() {
  const packageRoot = resolvePackageRoot();
  const projectRoot = resolveWorkspaceRoot(packageRoot);
  const host = await startStudioHostServer({ projectRoot, host: '127.0.0.1', port: 3000 });
  const subprocess = Bun.spawn(['bun', 'run', 'dev:studio'], {
    cwd: packageRoot,
    stdin: 'inherit',
    stdout: 'inherit',
    stderr: 'inherit',
  });

  const shutdown = () => {
    if (!subprocess.killed) subprocess.kill('SIGTERM');
  };
  const signalProcess = process as unknown as {
    off(signal: 'SIGINT' | 'SIGTERM', listener: () => void): void;
    once(signal: 'SIGINT' | 'SIGTERM', listener: () => void): void;
  };
  signalProcess.once('SIGINT', shutdown);
  signalProcess.once('SIGTERM', shutdown);

  try {
    return { exitCode: await subprocess.exited };
  } finally {
    signalProcess.off('SIGINT', shutdown);
    signalProcess.off('SIGTERM', shutdown);
    shutdown();
    await host.close();
  }
}

/*** List current Studio projects through the shared ProjectManager. */
async function listProjects(request: Parameters<AnkhCommandHandler>[0]) {
  const studioHost = createStudioHost({ workspaceRoot: resolveHostWorkspaceRoot() });
  try {
    const projects = await studioHost.projectManager.listProjects();
    request.context.writeStdout(`${JSON.stringify(projects, null, 2)}\n`);
    return { exitCode: 0 };
  } finally {
    await studioHost.close();
  }
}

/*** Create one Studio project from a published standalone template. */
async function createProject(request: Parameters<AnkhCommandHandler>[0]) {
  const input = parseCreateProjectArgs(request.argv);
  const studioHost = createStudioHost({ workspaceRoot: resolveHostWorkspaceRoot() });
  try {
    const source = await getProjectTemplateSource({ category: input.category, slug: input.slug });
    const project = await studioHost.projectManager.createProject(input.name, source);
    request.context.writeStdout(`${JSON.stringify(project, null, 2)}\n`);
    return { exitCode: 0 };
  } finally {
    await studioHost.close();
  }
}

/*** Delete one Studio project by ID. */
async function deleteProject(request: Parameters<AnkhCommandHandler>[0]) {
  const projectId = requireProjectId(request.argv, 'projects delete');
  const studioHost = createStudioHost({ workspaceRoot: resolveHostWorkspaceRoot() });
  try {
    const result = await studioHost.projectManager.deleteProject(projectId);
    request.context.writeStdout(`${JSON.stringify(result, null, 2)}\n`);
    return { exitCode: 0 };
  } finally {
    await studioHost.close();
  }
}

/*** Synchronize one generated Studio project. */
async function syncProject(request: Parameters<AnkhCommandHandler>[0]) {
  const projectId = requireProjectId(request.argv, 'projects sync');
  const studioHost = createStudioHost({ workspaceRoot: resolveHostWorkspaceRoot() });
  try {
    const result = await studioHost.moduleManager.syncProject({ projectId, includeStudio: true });
    request.context.writeStdout(`${JSON.stringify(result, null, 2)}\n`);
    return { exitCode: 0 };
  } finally {
    await studioHost.close();
  }
}

/*** Read the required project ID positional argument for one Studio command. */
function requireProjectId(argv: readonly string[], command: string) {
  const [projectId] = argv;
  if (projectId === undefined || projectId.trim() === '') {
    throw new Error(`Usage: ankh studio ${command} <projectId>`);
  }
  return projectId;
}

/*** Parse project creation flags into one canonical template selection. */
function parseCreateProjectArgs(argv: readonly string[]): {
  name: string;
  category: ProjectTemplateSelection['category'];
  slug: string;
} {
  const name = readFlag(argv, '--name');
  const category = readFlag(argv, '--category');
  const slug = readFlag(argv, '--template');
  if (name === null || category === null || slug === null) {
    throw new Error(
      'Usage: ankh studio projects create --name <name> --category <category> --template <slug>',
    );
  }
  return { name, category: category as ProjectTemplateSelection['category'], slug };
}

/*** Read the non-empty value immediately following one CLI flag. */
function readFlag(argv: readonly string[], flag: string) {
  const index = argv.indexOf(flag);
  const value = index === -1 ? undefined : argv[index + 1];
  return value === undefined || value.trim() === '' ? null : value;
}
