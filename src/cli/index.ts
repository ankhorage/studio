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
import type { ProjectTemplateSelection } from '../host/templateRegistry';
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
  'studio.workspace.install',
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
    examples: ['ankh studio projects create --name Shop --category commerce --template blank'],
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
  {
    path: ['workspace', 'install'],
    capability: 'studio.workspace.install',
    summary: 'Install packages required by the Studio workspace.',
    examples: ['ankh studio workspace install'],
  },
] as const;

type CommandPath = (typeof COMMANDS)[number]['path'];

const handlers = [
  createHandler(['dev'], runStudioDev),
  createHandler(['projects', 'list'], listProjects),
  createHandler(['projects', 'create'], createProject),
  createHandler(['projects', 'delete'], deleteProject),
  createHandler(['projects', 'sync'], syncProject),
  createHandler(['workspace', 'install'], installWorkspacePackages),
] as const;

/*** Pair one Studio command path with its Ankh command handler for provider registration. */
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

/***
 * Resolve the package root relative to the current ESM module URL.
 * @utility @ankhorage/utility/node/path
 */
function resolvePackageRoot() {
  return resolve(dirname(fileURLToPath(import.meta.url)), '../..');
}

/*** Resolve Studio's host workspace root by applying the host workspace policy to this package root. */
function resolveHostWorkspaceRoot() {
  return resolveWorkspaceRoot(resolvePackageRoot());
}

/***
 * Start the Studio host and development app together, forwarding process signals and closing both resources on exit.
 * @todo Keep this Bun/process lifecycle orchestration at the Studio CLI edge; reusable signal/subprocess primitives discovered underneath belong to Node/Bun Utility when extracted.
 */
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

  /*** Terminate the Studio development subprocess when it is still running. */
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

/*** List Studio workspace projects through the host manager and print them as formatted JSON. */
async function listProjects(request: Parameters<AnkhCommandHandler>[0]) {
  const studioHost = createStudioHost({ workspaceRoot: resolveHostWorkspaceRoot() });
  try {
    const projects = await studioHost.projectManager.listProjects();
    request.context.writeStdout(`${JSON.stringify(projects, null, 2)}
`);
    return { exitCode: 0 };
  } finally {
    await studioHost.close();
  }
}

/*** Parse project-creation CLI flags, create the project through the host manager, and print the result. */
async function createProject(request: Parameters<AnkhCommandHandler>[0]) {
  const input = parseCreateProjectArgs(request.argv);
  const studioHost = createStudioHost({ workspaceRoot: resolveHostWorkspaceRoot() });
  try {
    const project = await studioHost.projectManager.createProject(input.name, {
      category: input.category,
      templateId: input.templateId,
    });
    request.context.writeStdout(`${JSON.stringify(project, null, 2)}
`);
    return { exitCode: 0 };
  } finally {
    await studioHost.close();
  }
}

/*** Require a project id, delete that project through the host manager, and print the result. */
async function deleteProject(request: Parameters<AnkhCommandHandler>[0]) {
  const projectId = requireProjectId(request.argv, 'projects delete');
  const studioHost = createStudioHost({ workspaceRoot: resolveHostWorkspaceRoot() });
  try {
    const result = await studioHost.projectManager.deleteProject(projectId);
    request.context.writeStdout(`${JSON.stringify(result, null, 2)}
`);
    return { exitCode: 0 };
  } finally {
    await studioHost.close();
  }
}

/*** Require a project id, synchronize its generated output through the module manager, and print the result. */
async function syncProject(request: Parameters<AnkhCommandHandler>[0]) {
  const projectId = requireProjectId(request.argv, 'projects sync');
  const studioHost = createStudioHost({ workspaceRoot: resolveHostWorkspaceRoot() });
  try {
    const result = await studioHost.moduleManager.syncProject({ projectId, includeStudio: true });
    request.context.writeStdout(`${JSON.stringify(result, null, 2)}
`);
    return { exitCode: 0 };
  } finally {
    await studioHost.close();
  }
}

/*** Install Studio workspace packages through the host manager and print the workspace-scoped result. */
async function installWorkspacePackages(request: Parameters<AnkhCommandHandler>[0]) {
  const studioHost = createStudioHost({ workspaceRoot: resolveHostWorkspaceRoot() });
  try {
    const result = await studioHost.projectManager.installWorkspacePackages();
    request.context.writeStdout(`${JSON.stringify({ ...result, scope: 'workspace' }, null, 2)}
`);
    return { exitCode: 0 };
  } finally {
    await studioHost.close();
  }
}

/*** Require the first positional CLI argument as a non-empty project id and produce the command-specific usage error otherwise. */
function requireProjectId(argv: readonly string[], command: string) {
  const [projectId] = argv;
  if (projectId === undefined || projectId.trim() === '') {
    throw new Error(`Usage: ankh studio ${command} <projectId>`);
  }
  return projectId;
}

/*** Parse and validate the Studio-specific `projects create` flag set into the host template-selection input. */
function parseCreateProjectArgs(argv: readonly string[]): {
  name: string;
  category: ProjectTemplateSelection['category'];
  templateId: string;
} {
  const name = readFlag(argv, '--name');
  const category = readFlag(argv, '--category');
  const templateId = readFlag(argv, '--template');
  if (name === null || category === null || templateId === null) {
    throw new Error(
      'Usage: ankh studio projects create --name <name> --category <category> --template <templateId>',
    );
  }
  return { name, category: category as ProjectTemplateSelection['category'], templateId };
}

/***
 * Read the value following a named CLI flag and return null when the flag/value is absent or blank.
 * @utility @ankhorage/utility/cli
 */
function readFlag(argv: readonly string[], flag: string) {
  const index = argv.indexOf(flag);
  const value = index === -1 ? undefined : argv[index + 1];
  return value === undefined || value.trim() === '' ? null : value;
}
