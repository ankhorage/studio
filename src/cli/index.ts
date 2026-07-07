import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { AnkhCommandHandler, AnkhRuntimeCommandProvider } from '@ankhorage/ankh';

const STUDIO_PACKAGE_NAME = '@ankhorage/studio';
const STUDIO_COMMAND_CATEGORY = 'studio';
const STUDIO_PACKAGE_VERSION = '0.0.18';
const DEFAULT_STUDIO_API_BASE = 'http://localhost:3000/api';

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
    summary: 'Start the first-party Studio app workspace.',
    examples: ['ankh studio dev'],
  },
  {
    path: ['projects', 'list'],
    capability: 'studio.projects.list',
    summary: 'List Studio projects from the Studio project API.',
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
    summary: 'Synchronize generated app host files for a Studio project.',
    examples: ['ankh studio projects sync shop'],
  },
  {
    path: ['workspace', 'install'],
    capability: 'studio.workspace.install',
    summary: 'Install packages required by the current Studio workspace.',
    examples: ['ankh studio workspace install'],
  },
] as const;

type CommandPath = (typeof COMMANDS)[number]['path'];

interface ParsedCreateProjectArgs {
  readonly name: string;
  readonly category: string;
  readonly templateId: string;
}

const handlers = [
  createHandler(['dev'], runStudioDev),
  createHandler(['projects', 'list'], listProjects),
  createHandler(['projects', 'create'], createProject),
  createHandler(['projects', 'delete'], deleteProject),
  createHandler(['projects', 'sync'], syncProject),
  createHandler(['workspace', 'install'], installWorkspacePackages),
] as const;

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

async function runStudioDev() {
  const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
  const subprocess = Bun.spawn(['bun', 'run', 'dev:studio'], {
    cwd: packageRoot,
    stdin: 'inherit',
    stdout: 'inherit',
    stderr: 'inherit',
  });

  return { exitCode: await subprocess.exited };
}

async function listProjects(request: Parameters<AnkhCommandHandler>[0]) {
  const projects = await requestStudioApi('/projects');
  request.context.writeStdout(`${JSON.stringify(projects, null, 2)}\n`);
  return { exitCode: 0 };
}

async function createProject(request: Parameters<AnkhCommandHandler>[0]) {
  const input = parseCreateProjectArgs(request.argv);
  const project = await requestStudioApi('/projects', {
    method: 'POST',
    body: input,
  });
  request.context.writeStdout(`${JSON.stringify(project, null, 2)}\n`);
  return { exitCode: 0 };
}

async function deleteProject(request: Parameters<AnkhCommandHandler>[0]) {
  const projectId = requireProjectId(request.argv, 'projects delete');
  const result = await requestStudioApi(`/projects/${encodeURIComponent(projectId)}`, {
    method: 'DELETE',
  });
  request.context.writeStdout(`${JSON.stringify(result ?? { success: true }, null, 2)}\n`);
  return { exitCode: 0 };
}

async function syncProject(request: Parameters<AnkhCommandHandler>[0]) {
  const projectId = requireProjectId(request.argv, 'projects sync');
  const result = await requestStudioApi(`/projects/${encodeURIComponent(projectId)}/sync`, {
    method: 'POST',
  });
  request.context.writeStdout(`${JSON.stringify(result, null, 2)}\n`);
  return { exitCode: 0 };
}

async function installWorkspacePackages(request: Parameters<AnkhCommandHandler>[0]) {
  const result = await requestStudioApi('/workspace/packages/install', { method: 'POST' });
  request.context.writeStdout(`${JSON.stringify(result, null, 2)}\n`);
  return { exitCode: 0 };
}

async function requestStudioApi(
  path: string,
  options: { method?: string; body?: unknown } = {},
): Promise<unknown> {
  const response = await fetch(`${resolveStudioApiBase()}${path}`, {
    method: options.method ?? 'GET',
    headers: options.body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });

  const text = await response.text();
  const body = text.length > 0 ? JSON.parse(text) : null;

  if (!response.ok) {
    throw new Error(
      typeof body === 'object' && body !== null && 'error' in body
        ? String(body.error)
        : `Studio API request failed: ${response.status}`,
    );
  }

  return body;
}

function resolveStudioApiBase() {
  return (
    process.env.ANKHORAGE_STUDIO_API_URL ??
    process.env.EXPO_PUBLIC_API_URL ??
    DEFAULT_STUDIO_API_BASE
  );
}

function requireProjectId(argv: readonly string[], command: string) {
  const [projectId] = argv;
  if (projectId === undefined || projectId.trim() === '') {
    throw new Error(`Usage: ankh studio ${command} <projectId>`);
  }

  return projectId;
}

function parseCreateProjectArgs(argv: readonly string[]): ParsedCreateProjectArgs {
  const name = readFlag(argv, '--name');
  const category = readFlag(argv, '--category');
  const templateId = readFlag(argv, '--template');

  if (name === null || category === null || templateId === null) {
    throw new Error(
      'Usage: ankh studio projects create --name <name> --category <category> --template <templateId>',
    );
  }

  return { name, category, templateId };
}

function readFlag(argv: readonly string[], flag: string) {
  const index = argv.indexOf(flag);
  const value = index === -1 ? undefined : argv[index + 1];
  return value === undefined || value.trim() === '' ? null : value;
}
