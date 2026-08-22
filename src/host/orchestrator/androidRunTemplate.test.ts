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
        `-s\nemulator-5554\nreverse\ntcp:${gateway.port}\ntcp:${gateway.port}\n`,
      );
      expect(await readFile(harness.expoRecordPath, 'utf8')).toBe(
        'run:android\n--device\nemulator-5554\n',
      );
    } finally {
      await Promise.all([gateway.stop(true), studio.stop(true)]);
    }
  });

  it('bridges only an explicit target when an unrelated device would reject reverse', async () => {
    const gateway = Bun.serve({
      port: 0,
      fetch: () => Response.json({ message: 'missing API key' }, { status: 401 }),
    });

    try {
      const harness = await createHarness({
        supabaseUrl: `http://127.0.0.1:${gateway.port}`,
      });
      await writeMultipleDeviceAdb(path.join(harness.toolBinPath, 'adb'));
      const result = await runHarness(harness, ['--device', 'emulator-5554']);

      expect(result.exitCode).toBe(0);
      expect(await readFile(harness.adbRecordPath, 'utf8')).toBe('emulator-5554:41\n');
      expect(await readFile(harness.expoRecordPath, 'utf8')).toBe(
        'run:android\n--device\nemulator-5554\n',
      );
    } finally {
      await gateway.stop(true);
    }
  });

  it('resolves Expo emulator names to their ADB serials', async () => {
    const gateway = Bun.serve({
      port: 0,
      fetch: () => Response.json({ message: 'missing API key' }, { status: 401 }),
    });

    try {
      const harness = await createHarness({
        supabaseUrl: `http://127.0.0.1:${gateway.port}`,
      });
      await writeMultipleDeviceAdb(path.join(harness.toolBinPath, 'adb'));
      const result = await runHarness(harness, ['--device=target_avd']);

      expect(result.exitCode).toBe(0);
      expect(await readFile(harness.adbRecordPath, 'utf8')).toBe('emulator-5554:41\n');
      expect(await readFile(harness.expoRecordPath, 'utf8')).toBe(
        'run:android\n--device=target_avd\n',
      );
    } finally {
      await gateway.stop(true);
    }
  });

  it('bridges the only authorized device when no target is explicit', async () => {
    const gateway = Bun.serve({
      port: 0,
      fetch: () => Response.json({ message: 'missing API key' }, { status: 401 }),
    });

    try {
      const harness = await createHarness({
        supabaseUrl: `http://127.0.0.1:${gateway.port}`,
      });
      const result = await runHarness(harness, []);

      expect(result.exitCode).toBe(0);
      expect(await readFile(harness.adbRecordPath, 'utf8')).toBe(
        `-s\nemulator-5554\nreverse\ntcp:${gateway.port}\ntcp:${gateway.port}\n`,
      );
      expect(await readFile(harness.expoRecordPath, 'utf8')).toBe('run:android\n');
    } finally {
      await gateway.stop(true);
    }
  });

  it('matches Expo by selecting the first attached device when no target is explicit', async () => {
    const gateway = Bun.serve({
      port: 0,
      fetch: () => Response.json({ message: 'missing API key' }, { status: 401 }),
    });

    try {
      const harness = await createHarness({
        supabaseUrl: `http://127.0.0.1:${gateway.port}`,
      });
      await writeMultipleDeviceAdb(path.join(harness.toolBinPath, 'adb'));
      const result = await runHarness(harness, []);

      expect(result.exitCode).toBe(0);
      expect(await readFile(harness.adbRecordPath, 'utf8')).toBe('emulator-5554:41\n');
      expect(await readFile(harness.expoRecordPath, 'utf8')).toBe('run:android\n');
    } finally {
      await gateway.stop(true);
    }
  });

  it('rejects interactive Expo device selection before starting ADB or Expo', async () => {
    const gateway = Bun.serve({
      port: 0,
      fetch: () => Response.json({ message: 'missing API key' }, { status: 401 }),
    });

    try {
      const harness = await createHarness({
        supabaseUrl: `http://127.0.0.1:${gateway.port}`,
      });
      const result = await runHarness(harness, ['--device']);

      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toContain(
        'Interactive Expo device selection cannot be supervised safely',
      );
      expect(await exists(harness.adbRecordPath)).toBe(false);
      expect(await exists(harness.expoRecordPath)).toBe(false);
    } finally {
      await gateway.stop(true);
    }
  });

  it('bridges a replacement transport with the same serial before Expo opens the app', async () => {
    const gateway = Bun.serve({
      port: 0,
      fetch: () => Response.json({ message: 'missing API key' }, { status: 401 }),
    });

    try {
      const harness = await createTransportReplacementHarness({
        supabaseUrl: `http://127.0.0.1:${gateway.port}`,
      });
      const result = await runHarness(harness, ['--device', 'emulator-5554']);

      expect(result.exitCode).toBe(0);
      expect(await readFile(harness.mappingPath, 'utf8')).toBe(
        `42\ntcp:${gateway.port}\ntcp:${gateway.port}\n`,
      );
      expect((await readFile(harness.eventsPath, 'utf8')).trim().split('\n')).toEqual([
        'reverse:41',
        'expo:start',
        'transport:42',
        'reverse:42',
        'expo:open',
      ]);
    } finally {
      await gateway.stop(true);
    }
  });

  it('fails actionably and stops tracking when a device reverse cannot be established', async () => {
    const gateway = Bun.serve({
      port: 0,
      fetch: () => Response.json({ message: 'missing API key' }, { status: 401 }),
    });

    try {
      const harness = await createHarness({
        supabaseUrl: `http://127.0.0.1:${gateway.port}`,
      });
      const trackerPidPath = path.join(harness.rootPath, 'adb-tracker.pid');
      await writeFailingAdb(path.join(harness.toolBinPath, 'adb'));
      const result = await runHarness(
        {
          ...harness,
          additionalEnv: {
            ...harness.additionalEnv,
            ADB_TRACKER_PID_PATH: trackerPidPath,
          },
        },
        [],
      );

      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toContain(
        'Could not bridge Android device emulator-5554 (transport_id 7) after 5 attempts',
      );
      expect(result.stderr).toContain('reverse unavailable');
      const trackerPid = Number.parseInt(await readFile(trackerPidPath, 'utf8'), 10);
      expect(isProcessAlive(trackerPid)).toBe(false);
      expect(await exists(harness.expoRecordPath)).toBe(false);
    } finally {
      await gateway.stop(true);
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
        `-s\nemulator-5554\nreverse\ntcp:${gatewayPort}\ntcp:${gatewayPort}\n`,
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
  readonly additionalEnv?: Readonly<Record<string, string>>;
}

interface TransportReplacementHarness extends Harness {
  readonly eventsPath: string;
  readonly mappingPath: string;
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
  const adbMappingPath = path.join(rootPath, 'adb-mapping.txt');
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
  await writeFile(adbMappingPath, '', 'utf8');
  await writeBasicAdb(adbPath);
  await writeExecutable(expoPath, 'EXPO_RECORD_PATH');

  return {
    rootPath,
    scriptPath,
    adbRecordPath,
    expoRecordPath,
    toolBinPath,
    additionalEnv: { ADB_MAPPING_PATH: adbMappingPath },
    ...(args.studioHostUrl ? { studioHostUrl: args.studioHostUrl } : {}),
  };
}

async function writeBasicAdb(filePath: string): Promise<void> {
  await writeFile(
    filePath,
    `#!/usr/bin/env bun
import { readFileSync, writeFileSync } from 'node:fs';

const args = process.argv.slice(2);
const mappingPath = requiredEnv('ADB_MAPPING_PATH');
const recordPath = requiredEnv('ADB_RECORD_PATH');

if (args[0] === 'track-devices' && args[1] === '-l') {
  const payload = 'emulator-5554 device product:test model:test device:test transport_id:1\\n';
  const bytes = Buffer.from(payload, 'utf8');
  process.stdout.write(bytes.length.toString(16).padStart(4, '0'));
  process.stdout.write(bytes);
  const stop = () => process.exit(0);
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
  setInterval(() => undefined, 60_000);
} else if (args[0] === '-s' && args[2] === 'emu' && args[3] === 'avd' && args[4] === 'name') {
  if (args[1] === 'emulator-5554') process.stdout.write('target_avd\\nOK\\n');
  else process.exit(1);
} else if (args[0] === '-s' && args[2] === 'reverse' && args[3] === '--list') {
  const mapping = readFileSync(mappingPath, 'utf8');
  if (mapping) process.stdout.write(\`host-1 \${mapping}\`);
} else if (args[0] === '-s' && args[2] === 'reverse') {
  writeFileSync(recordPath, args.join('\\n') + '\\n');
  writeFileSync(mappingPath, \`\${args[3]} \${args[4]}\\n\`);
  process.stdout.write(args[3].replace('tcp:', '') + '\\n');
} else {
  process.exit(2);
}

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(\`Missing \${name}.\`);
  return value;
}
`,
    'utf8',
  );
  await chmod(filePath, 0o755);
}

async function writeFailingAdb(filePath: string): Promise<void> {
  await writeFile(
    filePath,
    `#!/usr/bin/env node
import { writeFileSync } from 'node:fs';

const args = process.argv.slice(2);
if (args[0] === 'track-devices' && args[1] === '-l') {
  writeFileSync(requiredEnv('ADB_TRACKER_PID_PATH'), String(process.pid));
  const payload = 'emulator-5554 device product:test model:test device:test transport_id:7\\n';
  const bytes = Buffer.from(payload, 'utf8');
  process.stdout.write(bytes.length.toString(16).padStart(4, '0'));
  process.stdout.write(bytes);
  const stop = () => {
    process.exit(0);
  };
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
  setInterval(() => undefined, 60_000);
} else if (args[0] === '-s' && args[2] === 'reverse' && args[3] === '--list') {
  process.exit(0);
} else if (args[0] === '-s' && args[2] === 'reverse') {
  process.stderr.write('reverse unavailable\\n');
  process.exit(1);
} else {
  process.exit(2);
}

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(\`Missing \${name}.\`);
  return value;
}
`,
    'utf8',
  );
  await chmod(filePath, 0o755);
}

async function writeMultipleDeviceAdb(filePath: string): Promise<void> {
  await writeFile(
    filePath,
    `#!/usr/bin/env bun
import { readFileSync, writeFileSync } from 'node:fs';

const args = process.argv.slice(2);
const mappingPath = requiredEnv('ADB_MAPPING_PATH');
const recordPath = requiredEnv('ADB_RECORD_PATH');

if (args[0] === 'track-devices' && args[1] === '-l') {
  const payload = [
    'emulator-5554 device product:test model:target_emulator device:test transport_id:41',
    'usb-phone-1 device usb:1 product:test model:unrelated_phone device:test transport_id:55',
    '',
  ].join('\\n');
  const bytes = Buffer.from(payload, 'utf8');
  process.stdout.write(bytes.length.toString(16).padStart(4, '0'));
  process.stdout.write(bytes);
  const stop = () => process.exit(0);
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
  setInterval(() => undefined, 60_000);
} else if (args[0] === '-s' && args[2] === 'emu' && args[3] === 'avd' && args[4] === 'name') {
  if (args[1] === 'emulator-5554') process.stdout.write('target_avd\\nOK\\n');
  else process.exit(1);
} else if (args[0] === '-s' && args[2] === 'reverse' && args[3] === '--list') {
  const mapping = readFileSync(mappingPath, 'utf8');
  if (mapping.startsWith(args[1] + '\\n')) {
    process.stdout.write(\`host-1 \${mapping.split('\\n').slice(1).join(' ')}\`);
  }
} else if (args[0] === '-s' && args[2] === 'reverse') {
  if (args[1] === 'usb-phone-1') {
    writeFileSync(recordPath, 'UNRELATED REVERSE INVOKED\\n');
    process.stderr.write('reverse unavailable on unrelated device\\n');
    process.exit(1);
  }
  const transport = args[1] === 'emulator-5554' ? '41' : '55';
  writeFileSync(recordPath, args[1] + ':' + transport + '\\n');
  writeFileSync(mappingPath, [args[1], args[3], args[4], ''].join('\\n'));
  process.stdout.write(args[3].replace('tcp:', '') + '\\n');
} else {
  process.exit(2);
}

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(\`Missing \${name}.\`);
  return value;
}
`,
    'utf8',
  );
  await chmod(filePath, 0o755);
}

async function writeExecutable(filePath: string, recordEnvironmentKey: string): Promise<void> {
  await writeFile(
    filePath,
    `#!/usr/bin/env bash\nset -euo pipefail\nprintf '%s\\n' "$@" > "\${${recordEnvironmentKey}:?}"\n`,
    'utf8',
  );
  await chmod(filePath, 0o755);
}

async function createTransportReplacementHarness(args: {
  readonly supabaseUrl: string;
}): Promise<TransportReplacementHarness> {
  const harness = await createHarness(args);
  const transportPath = path.join(harness.rootPath, 'adb-transport.txt');
  const mappingPath = path.join(harness.rootPath, 'adb-mapping.txt');
  const eventsPath = path.join(harness.rootPath, 'android-events.txt');
  await Promise.all([
    writeFile(transportPath, '41\n', 'utf8'),
    writeFile(mappingPath, '', 'utf8'),
    writeFile(eventsPath, '', 'utf8'),
  ]);
  await writeStatefulAdb(path.join(harness.toolBinPath, 'adb'));
  await writeReplacementExpo(path.join(harness.rootPath, 'node_modules', '.bin', 'expo'));
  return {
    ...harness,
    eventsPath,
    mappingPath,
    additionalEnv: {
      ...harness.additionalEnv,
      ADB_EVENTS_PATH: eventsPath,
      ADB_MAPPING_PATH: mappingPath,
      ADB_TRANSPORT_PATH: transportPath,
    },
  };
}

async function writeStatefulAdb(filePath: string): Promise<void> {
  await writeFile(
    filePath,
    `#!/usr/bin/env bun
import { appendFileSync, readFileSync, writeFileSync } from 'node:fs';

const args = process.argv.slice(2);
const transportPath = requiredEnv('ADB_TRANSPORT_PATH');
const mappingPath = requiredEnv('ADB_MAPPING_PATH');
const eventsPath = requiredEnv('ADB_EVENTS_PATH');

if (args[0] === 'track-devices' && args[1] === '-l') {
  let previous;
  const emitCurrentTransport = () => {
    const transport = readFileSync(transportPath, 'utf8').trim();
    if (transport === previous) return;
    previous = transport;
    const payload = transport
      ? \`emulator-5554 device product:test model:test device:test transport_id:\${transport}\\n\`
      : '';
    const bytes = Buffer.from(payload, 'utf8');
    process.stdout.write(bytes.length.toString(16).padStart(4, '0'));
    process.stdout.write(bytes);
  };
  emitCurrentTransport();
  const timer = setInterval(emitCurrentTransport, 10);
  const stop = () => {
    clearInterval(timer);
    process.exit(0);
  };
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
} else {
  const command = args[0] === '-s' ? args.slice(2) : args;
  const transport = readFileSync(transportPath, 'utf8').trim();
  if (command[0] !== 'reverse') process.exit(2);
  if (command[1] === '--list') {
    const mapping = readFileSync(mappingPath, 'utf8').trim().split('\\n');
    if (mapping[0] === transport && mapping.length === 3) {
      process.stdout.write(\`host-\${transport} \${mapping[1]} \${mapping[2]}\\n\`);
    }
  } else {
    writeFileSync(mappingPath, [transport, command[1], command[2], ''].join('\\n'));
    appendFileSync(eventsPath, \`reverse:\${transport}\\n\`);
    process.stdout.write(command[1].replace('tcp:', '') + '\\n');
  }
}

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(\`Missing \${name}.\`);
  return value;
}
`,
    'utf8',
  );
  await chmod(filePath, 0o755);
}

async function writeReplacementExpo(filePath: string): Promise<void> {
  await writeFile(
    filePath,
    `#!/usr/bin/env bun
import { appendFileSync, readFileSync, writeFileSync } from 'node:fs';

const transportPath = requiredEnv('ADB_TRANSPORT_PATH');
const mappingPath = requiredEnv('ADB_MAPPING_PATH');
const eventsPath = requiredEnv('ADB_EVENTS_PATH');
const expoRecordPath = requiredEnv('EXPO_RECORD_PATH');

writeFileSync(expoRecordPath, process.argv.slice(2).join('\\n') + '\\n');
appendFileSync(eventsPath, 'expo:start\\n');
await waitForMapping('41');
writeFileSync(mappingPath, '');
writeFileSync(transportPath, '42\\n');
appendFileSync(eventsPath, 'transport:42\\n');
await waitForMapping('42');
appendFileSync(eventsPath, 'expo:open\\n');

async function waitForMapping(transport) {
  const deadline = Date.now() + 2_000;
  while (Date.now() < deadline) {
    if (readFileSync(mappingPath, 'utf8').startsWith(transport + '\\n')) return;
    await Bun.sleep(10);
  }
  throw new Error(\`Reverse mapping was not installed on transport \${transport}.\`);
}

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(\`Missing \${name}.\`);
  return value;
}
`,
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
      ...harness.additionalEnv,
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

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    if ((error as { code?: unknown }).code === 'ESRCH') return false;
    throw error;
  }
}
