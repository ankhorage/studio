import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';

import { getProjectPath } from './projectPaths';

export type InfraLifecycleScript = 'up' | 'down' | 'reset' | 'destroy' | 'status' | 'port-forward';

export interface InfraScriptOutput {
  stdout: string;
  stderr: string;
}

interface PortForwardSession {
  rootPath: string;
  projectId: string;
  target: string;
  url: string;
}

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
  env?: Record<string, string | undefined>;
}) {
  const scriptPath = resolveProjectInfraScriptPath(args);

  if (!(await exists(scriptPath))) {
    throw new Error(
      `Infra script not found: ${scriptPath}. Run 'ankh infra:regenerate ${args.projectId}' first.`,
    );
  }

  await runShellScript(scriptPath, 'inherit', [], args.env);
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
  const localPort = await resolveProjectPortForwardLocalPort(args);
  const url = `http://127.0.0.1:${localPort}`;
  const status = await runShellScript(scriptPath, 'capture', ['status', 'app']);
  if (/\bapp:\s+running\b/u.test(status.stdout)) {
    portForwardSessions.set(sessionKey, { ...args, url });
    return {
      url,
      started: false,
    };
  }

  await runShellScript(scriptPath, 'capture', ['start', 'app']);
  portForwardSessions.set(sessionKey, { ...args, url });

  return {
    url,
    started: true,
  };
}

export async function registerProjectInfraPortForwardOwner(args: {
  rootPath: string;
  projectId: string;
  target: string;
}): Promise<{ url: string }> {
  const scriptPath = resolveProjectInfraScriptPath({ ...args, script: 'port-forward' });
  if (!(await exists(scriptPath))) {
    throw new Error(
      `Infra script not found: ${scriptPath}. Run 'ankh infra:regenerate ${args.projectId}' first.`,
    );
  }

  const localPort = await resolveProjectPortForwardLocalPort(args);
  const url = `http://127.0.0.1:${localPort}`;
  const sessionKey = `${args.rootPath}:${args.projectId}:${args.target}`;
  portForwardSessions.set(sessionKey, { ...args, url });
  return { url };
}

export async function stopAllProjectInfraPortForwards() {
  const sessions = [...portForwardSessions.values()];
  portForwardSessions.clear();
  await Promise.all(
    sessions.map(async (session) => {
      const scriptPath = resolveProjectInfraScriptPath({ ...session, script: 'port-forward' });
      if (!(await exists(scriptPath))) return;
      try {
        await runShellScript(scriptPath, 'capture', ['stop', 'all']);
      } catch {
        // Close hooks should never prevent Studio shutdown; status surfaces stale forwards later.
      }
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

function runShellScript(
  scriptPath: string,
  mode: 'inherit' | 'capture',
  args: string[] = [],
  env: Record<string, string | undefined> = process.env,
): Promise<InfraScriptOutput> {
  return new Promise<InfraScriptOutput>((resolve, reject) => {
    const child = spawn('bash', [scriptPath, ...args], {
      cwd: path.dirname(scriptPath),
      stdio: mode === 'inherit' ? 'inherit' : 'pipe',
      env: env as NodeJS.ProcessEnv,
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
