import type { ChildProcess } from 'child_process';
import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';

import { getProjectPath } from './projectPaths';

export type InfraLifecycleScript = 'up' | 'down' | 'status' | 'port-forward';

export interface InfraScriptOutput {
  stdout: string;
  stderr: string;
}

interface PortForwardSession {
  child: ChildProcess;
  url: string;
}

const PORT_FORWARD_STARTUP_TIMEOUT_MS = 1_000;
const portForwardSessions = new Map<string, PortForwardSession>();

export class InfraScriptExecutionError extends Error {
  readonly stdout: string;
  readonly stderr: string;
  readonly exitCode: number | null;

  constructor(args: { message: string; stdout: string; stderr: string; exitCode: number | null }) {
    super(args.message);
    this.name = 'InfraScriptExecutionError';
    this.stdout = args.stdout;
    this.stderr = args.stderr;
    this.exitCode = args.exitCode;
  }
}

function resolveProjectInfraScriptPath(args: {
  rootPath: string;
  projectId: string;
  target: string;
  script: InfraLifecycleScript;
}) {
  const { rootPath, projectId, target, script } = args;
  const projectPath = getProjectPath(rootPath, projectId);

  return path.join(projectPath, getInfraScriptsDir(target), `${script}.sh`);
}

export async function runProjectInfraScript(args: {
  rootPath: string;
  projectId: string;
  target: string;
  script: InfraLifecycleScript;
}) {
  const scriptPath = resolveProjectInfraScriptPath(args);

  if (!(await exists(scriptPath))) {
    throw new Error(
      `Infra script not found: ${scriptPath}. Run 'ankh infra:regenerate ${args.projectId}' first.`,
    );
  }

  await runShellScript(scriptPath, 'inherit');
}

export async function runProjectInfraScriptCapture(args: {
  rootPath: string;
  projectId: string;
  target: string;
  script: InfraLifecycleScript;
}) {
  const scriptPath = resolveProjectInfraScriptPath(args);

  if (!(await exists(scriptPath))) {
    throw new Error(
      `Infra script not found: ${scriptPath}. Run 'ankh infra:regenerate ${args.projectId}' first.`,
    );
  }

  return runShellScript(scriptPath, 'capture');
}

export async function ensureProjectInfraPortForward(args: {
  rootPath: string;
  projectId: string;
  target: string;
}): Promise<{ url: string; started: boolean }> {
  const scriptPath = resolveProjectInfraScriptPath({ ...args, script: 'port-forward' });
  if (!(await exists(scriptPath))) {
    throw new Error(
      `Infra script not found: ${scriptPath}. Run 'ankh infra:regenerate ${args.projectId}' first.`,
    );
  }

  const sessionKey = `${args.rootPath}:${args.projectId}:${args.target}`;
  const existing = portForwardSessions.get(sessionKey);
  if (existing?.child.exitCode === null && !existing.child.killed) {
    return {
      url: existing.url,
      started: false,
    };
  }

  portForwardSessions.delete(sessionKey);

  const localPort = await resolveProjectPortForwardLocalPort(args);
  const url = `http://127.0.0.1:${localPort}`;

  const child = spawn('bash', [scriptPath], {
    cwd: path.dirname(scriptPath),
    stdio: ['ignore', 'pipe', 'pipe'],
    env: process.env,
  });

  const session: PortForwardSession = { child, url };
  portForwardSessions.set(sessionKey, session);

  child.once('close', () => {
    portForwardSessions.delete(sessionKey);
  });
  child.once('error', () => {
    portForwardSessions.delete(sessionKey);
  });

  await waitForPortForwardStartup({ child, scriptPath });

  return {
    url,
    started: true,
  };
}

export async function stopAllProjectInfraPortForwards() {
  const sessions = [...portForwardSessions.values()];
  portForwardSessions.clear();
  await Promise.all(
    sessions.map(async ({ child }) => {
      if (child.exitCode !== null || child.killed) return;
      await new Promise<void>((resolve) => {
        const timer = setTimeout(resolve, 1_000);
        child.once('close', () => {
          clearTimeout(timer);
          resolve();
        });
        child.kill('SIGTERM');
      });
    }),
  );
}

function getInfraScriptsDir(target: string) {
  switch (target) {
    case 'minikube':
      return 'infra/minikube/scripts';
    default:
      throw new Error(`Unsupported deployment target for infra scripts: ${target}`);
  }
}

async function resolveProjectPortForwardLocalPort(args: {
  rootPath: string;
  projectId: string;
  target: string;
}): Promise<number> {
  const projectPath = getProjectPath(args.rootPath, args.projectId);
  const infraRoot = path.join(projectPath, 'infra', args.target);

  const envPath = path.join(infraRoot, '.env');
  const fallbackEnvPath = path.join(infraRoot, '.env.example');

  const envMap = await readSimpleEnvMap((await exists(envPath)) ? envPath : fallbackEnvPath);
  const localPortRaw = envMap.get('APP_PORT_FORWARD_LOCAL_PORT');
  const parsedPort = parsePositivePort(localPortRaw);

  return parsedPort ?? 18080;
}

async function readSimpleEnvMap(filePath: string): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (!(await exists(filePath))) return out;

  const content = await fs.readFile(filePath, 'utf8');
  const lines = content.split(/\r?\n/u);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx <= 0) continue;
    const key = trimmed.slice(0, idx).trim();
    const value = trimmed
      .slice(idx + 1)
      .trim()
      .replace(/^['"]|['"]$/g, '');
    out.set(key, value);
  }

  return out;
}

function parsePositivePort(value?: string): number | null {
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed)) return null;
  if (parsed < 1 || parsed > 65535) return null;
  return parsed;
}

function waitForPortForwardStartup(args: {
  child: ChildProcess;
  scriptPath: string;
}): Promise<void> {
  const { child, scriptPath } = args;
  return new Promise<void>((resolve, reject) => {
    let settled = false;
    let stderr = '';

    child.stderr?.setEncoding('utf8');
    child.stderr?.on('data', (chunk: string) => {
      stderr += chunk;
      if (stderr.length > 8_000) {
        stderr = stderr.slice(stderr.length - 8_000);
      }
    });

    const completeResolve = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve();
    };

    const completeReject = (error: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(error);
    };

    const timer = setTimeout(() => {
      completeResolve();
    }, PORT_FORWARD_STARTUP_TIMEOUT_MS);

    child.once('error', (err) => {
      completeReject(new Error(`Failed to start infra script '${scriptPath}': ${err.message}`));
    });

    child.once('close', (code) => {
      if (code === 0) {
        completeResolve();
        return;
      }

      const stderrSnippet = stderr.trim();
      const suffix = stderrSnippet ? ` stderr: ${stderrSnippet}` : '';
      completeReject(
        new Error(`Infra script '${scriptPath}' exited with code ${code ?? 'unknown'}.${suffix}`),
      );
    });
  });
}

function runShellScript(
  scriptPath: string,
  mode: 'inherit' | 'capture',
): Promise<InfraScriptOutput> {
  return new Promise<InfraScriptOutput>((resolve, reject) => {
    const child = spawn('bash', [scriptPath], {
      cwd: path.dirname(scriptPath),
      stdio: mode === 'inherit' ? 'inherit' : 'pipe',
      env: process.env,
    });

    let stdout = '';
    let stderr = '';

    if (mode === 'capture') {
      child.stdout?.setEncoding('utf8');
      child.stderr?.setEncoding('utf8');
      child.stdout?.on('data', (chunk: string) => {
        stdout += chunk;
      });
      child.stderr?.on('data', (chunk: string) => {
        stderr += chunk;
      });
    }

    child.once('error', (err) => {
      reject(new Error(`Failed to start infra script '${scriptPath}': ${err.message}`));
    });

    child.once('close', (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }

      reject(
        new InfraScriptExecutionError({
          message: `Infra script '${scriptPath}' exited with code ${code ?? 'unknown'}.`,
          stdout,
          stderr,
          exitCode: code,
        }),
      );
    });
  });
}

async function exists(p: string) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}
