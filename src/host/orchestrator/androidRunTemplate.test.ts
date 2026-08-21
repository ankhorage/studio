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
  it('checks and reverses the exact local Supabase gateway before Expo', async () => {
    const requests: string[] = [];
    const server = Bun.serve({
      port: 0,
      fetch(request) {
        requests.push(new URL(request.url).pathname);
        return Response.json({ message: 'missing API key' }, { status: 401 });
      },
    });

    try {
      const harness = await createHarness(`http://127.0.0.1:${server.port}`);
      const exitCode = await runHarness(harness, ['--device', 'emulator-5554']);

      expect(exitCode).toBe(0);
      expect(requests).toEqual(['/auth/v1/health']);
      expect(await readFile(harness.adbRecordPath, 'utf8')).toBe(
        `reverse\ntcp:${server.port}\ntcp:${server.port}\n`,
      );
      expect(await readFile(harness.expoRecordPath, 'utf8')).toBe(
        'run:android\n--device\nemulator-5554\n',
      );
    } finally {
      await server.stop(true);
    }
  });

  it('leaves hosted Supabase URLs unchanged', async () => {
    const harness = await createHarness('https://project.supabase.co');
    const exitCode = await runHarness(harness, []);

    expect(exitCode).toBe(0);
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
    expect(await readFile(launcherPath, 'utf8')).toBe(getAndroidRunTs());

    await scaffolder.syncProjectScaffold(projectPath, 'Fixture', 'fixture', {
      targets: { web: { enabled: true } },
    });

    expect(await exists(launcherPath)).toBe(false);
  });

  it('fails before Expo when generated local Infra is unavailable', async () => {
    const portReservation = Bun.serve({ port: 0, fetch: () => new Response(null) });
    const unavailablePort = portReservation.port;
    await portReservation.stop(true);

    const harness = await createHarness(`http://127.0.0.1:${unavailablePort}`);
    const exitCode = await runHarness(harness, []);

    expect(exitCode).not.toBe(0);
    expect(await exists(harness.adbRecordPath)).toBe(false);
    expect(await exists(harness.expoRecordPath)).toBe(false);
  });
});

interface Harness {
  readonly rootPath: string;
  readonly scriptPath: string;
  readonly adbRecordPath: string;
  readonly expoRecordPath: string;
  readonly toolBinPath: string;
}

async function createHarness(supabaseUrl: string): Promise<Harness> {
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
  await writeFile(scriptPath, getAndroidRunTs(), 'utf8');
  await writeFile(
    path.join(rootPath, '.env.local'),
    [
      `EXPO_PUBLIC_SUPABASE_URL=${supabaseUrl}`,
      'EXPO_PUBLIC_SUPABASE_ANON_KEY=public-anon-key-must-stay-private',
      '',
    ].join('\n'),
    'utf8',
  );
  await writeExecutable(adbPath, 'ADB_RECORD_PATH');
  await writeExecutable(expoPath, 'EXPO_RECORD_PATH');

  return { rootPath, scriptPath, adbRecordPath, expoRecordPath, toolBinPath };
}

async function writeExecutable(filePath: string, recordEnvironmentKey: string): Promise<void> {
  await writeFile(
    filePath,
    `#!/usr/bin/env bash\nset -euo pipefail\nprintf '%s\\n' "$@" > "\${${recordEnvironmentKey}:?}"\n`,
    'utf8',
  );
  await chmod(filePath, 0o755);
}

async function runHarness(harness: Harness, args: readonly string[]): Promise<number> {
  const child = Bun.spawn({
    cmd: [process.execPath, harness.scriptPath, ...args],
    cwd: harness.rootPath,
    env: {
      ...process.env,
      PATH: `${harness.toolBinPath}:${process.env.PATH ?? ''}`,
      ADB_RECORD_PATH: harness.adbRecordPath,
      EXPO_RECORD_PATH: harness.expoRecordPath,
    },
    stderr: 'ignore',
    stdout: 'ignore',
  });
  return child.exited;
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
