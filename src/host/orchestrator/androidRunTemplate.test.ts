import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'bun:test';

import { ProjectScaffolder } from './scaffolder';
import { getAndroidRunTs } from './templates';

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true })),
  );
});

describe('generated Android development launcher', () => {
  it('accepts any response from a reachable local gateway and skips Studio recovery', async () => {
    const gatewayRequests: string[] = [];
    const studioRequests: string[] = [];
    const gateway = Bun.serve({
      port: 0,
      fetch(request) {
        gatewayRequests.push(new URL(request.url).pathname);
        return Response.json({ message: 'missing API key' }, { status: 401 });
      },
    });
    const studio = Bun.serve({
      port: 0,
      fetch(request) {
        studioRequests.push(new URL(request.url).pathname);
        return Response.json({ error: 'recovery should not run' }, { status: 500 });
      },
    });

    try {
      const harness = await createHarness({
        supabaseUrl: `http://127.0.0.1:${gateway.port}`,
        studioHostUrl: studio.url.origin,
      });
      const result = await runHarness(harness, ['--device', 'emulator-5554']);

      expect(result.exitCode).toBe(0);
      expect(gatewayRequests).toEqual(['/auth/v1/health']);
      expect(studioRequests).toEqual([]);
      expect(await readFile(harness.adbRecordPath, 'utf8')).toBe(
        `reverse\ntcp:${gateway.port}\ntcp:${gateway.port}\n`,
      );
      expect(await readFile(harness.expoRecordPath, 'utf8')).toBe(
        'run:android\n--device\nemulator-5554\n',
      );
    } finally {
      await Promise.all([gateway.stop(true), studio.stop(true)]);
    }
  });

  it('leaves hosted Supabase URLs unchanged', async () => {
    const studioRequests: string[] = [];
    const studio = Bun.serve({
      port: 0,
      fetch(request) {
        studioRequests.push(new URL(request.url).pathname);
        return Response.json({ success: true });
      },
    });

    try {
      const harness = await createHarness({
        supabaseUrl: 'https://project.supabase.co',
        studioHostUrl: studio.url.origin,
      });
      const result = await runHarness(harness, []);

      expect(result.exitCode).toBe(0);
      expect(studioRequests).toEqual([]);
      expect(await exists(harness.adbRecordPath)).toBe(false);
      expect(await readFile(harness.expoRecordPath, 'utf8')).toBe('run:android\n');
    } finally {
      await studio.stop(true);
    }
  });

  it('asks Studio to recover an unreachable gateway before bridging and running Expo', async () => {
    const reservedGateway = Bun.serve({ port: 0, fetch: () => new Response(null) });
    const gatewayPort = reservedGateway.port;
    await reservedGateway.stop(true);

    const studioRequests: { method: string; path: string }[] = [];
    let gateway: ReturnType<typeof Bun.serve> | undefined;
    const studio = Bun.serve({
      port: 0,
      fetch(request) {
        const url = new URL(request.url);
        studioRequests.push({ method: request.method, path: url.pathname });
        gateway = Bun.serve({
          port: gatewayPort,
          fetch: () => Response.json({ message: 'missing API key' }, { status: 401 }),
        });
        return Response.json({
          success: true,
          target: 'minikube',
          url: 'http://127.0.0.1:4000',
          started: false,
        });
      },
    });

    try {
      const harness = await createHarness({
        projectId: 'canonical-project-id',
        supabaseUrl: `http://127.0.0.1:${gatewayPort}`,
        studioHostUrl: studio.url.origin,
      });
      const result = await runHarness(harness, []);

      expect(result.exitCode).toBe(0);
      expect(studioRequests).toEqual([
        {
          method: 'POST',
          path: '/api/projects/canonical-project-id/infra/runtime/ensure',
        },
      ]);
      expect(await readFile(harness.adbRecordPath, 'utf8')).toBe(
        `reverse\ntcp:${gatewayPort}\ntcp:${gatewayPort}\n`,
      );
      expect(await readFile(harness.expoRecordPath, 'utf8')).toBe('run:android\n');
    } finally {
      await studio.stop(true);
      if (gateway) await gateway.stop(true);
    }
  });

  it('fails actionably before Expo when Studio runtime recovery fails', async () => {
    const gatewayPort = await reserveUnavailablePort();
    const studio = Bun.serve({
      port: 0,
      fetch: () =>
        Response.json(
          { error: 'runtime group is unavailable; regenerate infrastructure' },
          { status: 500 },
        ),
    });

    try {
      const harness = await createHarness({
        supabaseUrl: `http://127.0.0.1:${gatewayPort}`,
        studioHostUrl: studio.url.origin,
      });
      const result = await runHarness(harness, []);

      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toContain('runtime group is unavailable; regenerate infrastructure');
      expect(result.stderr).toContain('Run Infrastructure Up and try again');
      expect(await exists(harness.adbRecordPath)).toBe(false);
      expect(await exists(harness.expoRecordPath)).toBe(false);
    } finally {
      await studio.stop(true);
    }
  });

  it('fails actionably before Expo when Studio is unreachable', async () => {
    const gatewayPort = await reserveUnavailablePort();
    const studioPort = await reserveUnavailablePort();
    const harness = await createHarness({
      supabaseUrl: `http://127.0.0.1:${gatewayPort}`,
      studioHostUrl: `http://127.0.0.1:${studioPort}`,
    });
    const result = await runHarness(harness, []);

    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toContain('Could not ask the Studio host');
    expect(result.stderr).toContain('Start the Studio host');
    expect(await exists(harness.adbRecordPath)).toBe(false);
    expect(await exists(harness.expoRecordPath)).toBe(false);
  });

  it('fails before Expo when recovery succeeds but the gateway remains unreachable', async () => {
    const gatewayPort = await reserveUnavailablePort();
    const studio = Bun.serve({
      port: 0,
      fetch: () => Response.json({ success: true }),
    });

    try {
      const harness = await createHarness({
        supabaseUrl: `http://127.0.0.1:${gatewayPort}`,
        studioHostUrl: studio.url.origin,
      });
      const result = await runHarness(harness, []);

      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toContain(
        'Studio reported that infrastructure runtime recovery succeeded',
      );
      expect(result.stderr).toContain('Run Infrastructure Up and try again');
      expect(await exists(harness.adbRecordPath)).toBe(false);
      expect(await exists(harness.expoRecordPath)).toBe(false);
    } finally {
      await studio.stop(true);
    }
  });

  it('runs Expo normally without a Supabase URL', async () => {
    const harness = await createHarness({});
    const result = await runHarness(harness, []);

    expect(result.exitCode).toBe(0);
    expect(await exists(harness.adbRecordPath)).toBe(false);
    expect(await readFile(harness.expoRecordPath, 'utf8')).toBe('run:android\n');
  });

  it('writes the launcher only while the Android target is enabled', async () => {
    const rootPath = await mkdtemp(path.join(os.tmpdir(), 'ankh-android-scaffold-'));
    temporaryDirectories.push(rootPath);
    const projectPath = path.join(rootPath, 'apps', 'fixture');
    const scaffolder = new ProjectScaffolder(rootPath);

    await scaffolder.syncProjectScaffold(projectPath, 'Fixture', 'fixture', {
      targets: {
        android: {
          enabled: true,
          package: 'com.example.fixture',
          scheme: 'fixture',
        },
      },
    });

    const launcherPath = path.join(projectPath, 'scripts', 'ankh-android.ts');
    expect(await readFile(launcherPath, 'utf8')).toBe(getAndroidRunTs({ projectId: 'fixture' }));

    await scaffolder.syncProjectScaffold(projectPath, 'Fixture', 'fixture', {
      targets: { web: { enabled: true } },
    });

    expect(await exists(launcherPath)).toBe(false);
  });
});

interface Harness {
  readonly rootPath: string;
  readonly scriptPath: string;
  readonly adbRecordPath: string;
  readonly expoRecordPath: string;
  readonly toolBinPath: string;
  readonly studioHostUrl?: string;
}

async function createHarness(args: {
  readonly projectId?: string;
  readonly studioHostUrl?: string;
  readonly supabaseUrl?: string;
}): Promise<Harness> {
  const rootPath = await mkdtemp(path.join(os.tmpdir(), 'ankh-android-run-'));
  temporaryDirectories.push(rootPath);

  const scriptPath = path.join(rootPath, 'scripts', 'ankh-android.ts');
  const toolBinPath = path.join(rootPath, 'test-bin');
  const expoPath = path.join(rootPath, 'node_modules', '.bin', 'expo');
  const adbPath = path.join(toolBinPath, 'adb');
  const adbRecordPath = path.join(rootPath, 'adb-args.txt');
  const expoRecordPath = path.join(rootPath, 'expo-args.txt');

  await mkdir(path.dirname(scriptPath), { recursive: true });
  await mkdir(path.dirname(expoPath), { recursive: true });
  await mkdir(toolBinPath, { recursive: true });
  await writeFile(
    scriptPath,
    getAndroidRunTs({ projectId: args.projectId ?? 'project-one' }),
    'utf8',
  );
  await writeFile(
    path.join(rootPath, '.env.local'),
    [
      ...(args.supabaseUrl ? [`EXPO_PUBLIC_SUPABASE_URL=${args.supabaseUrl}`] : []),
      'EXPO_PUBLIC_SUPABASE_ANON_KEY=public-anon-key-must-stay-private',
      '',
    ].join('\n'),
    'utf8',
  );
  await writeExecutable(adbPath, 'ADB_RECORD_PATH');
  await writeExecutable(expoPath, 'EXPO_RECORD_PATH');

  return {
    rootPath,
    scriptPath,
    adbRecordPath,
    expoRecordPath,
    toolBinPath,
    ...(args.studioHostUrl ? { studioHostUrl: args.studioHostUrl } : {}),
  };
}

async function writeExecutable(filePath: string, recordEnvironmentKey: string): Promise<void> {
  await writeFile(
    filePath,
    `#!/usr/bin/env bash\nset -euo pipefail\nprintf '%s\\n' "$@" > "\${${recordEnvironmentKey}:?}"\n`,
    'utf8',
  );
  await chmod(filePath, 0o755);
}

async function runHarness(
  harness: Harness,
  args: readonly string[],
): Promise<{ readonly exitCode: number; readonly stderr: string }> {
  const child = Bun.spawn({
    cmd: [process.execPath, harness.scriptPath, ...args],
    cwd: harness.rootPath,
    env: {
      ...process.env,
      PATH: `${harness.toolBinPath}:${process.env.PATH ?? ''}`,
      ADB_RECORD_PATH: harness.adbRecordPath,
      EXPO_RECORD_PATH: harness.expoRecordPath,
      ...(harness.studioHostUrl ? { ANKH_STUDIO_HOST_URL: harness.studioHostUrl } : {}),
    },
    stderr: 'pipe',
    stdout: 'ignore',
  });
  const [exitCode, stderr] = await Promise.all([child.exited, new Response(child.stderr).text()]);
  return { exitCode, stderr };
}

async function reserveUnavailablePort(): Promise<number> {
  const reservation = Bun.serve({ port: 0, fetch: () => new Response(null) });
  const { port } = reservation;
  await reservation.stop(true);
  if (port === undefined) throw new Error('Expected Bun to reserve a local port.');
  return port;
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await readFile(filePath);
    return true;
  } catch (error) {
    if ((error as { code?: unknown }).code === 'ENOENT') return false;
    throw error;
  }
}
