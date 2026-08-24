import type { SplashScreenSpec } from '@ankhorage/contracts';
import type {
  AppDeployAndroidTargetConfig,
  AppDeployIosTargetConfig,
  AppDeployTargets,
} from '@ankhorage/contracts/deploy';
import {
  type ExpoRuntimeConfigPluginOutput,
  type ExpoRuntimePlan,
  resolveExpoRuntimeDependencyMap,
  resolveExpoRuntimeNativeOutput,
  resolveExpoRuntimeNativeSchemeMap,
} from '@ankhorage/expo-runtime/planning';
import { EXPO_PLATFORM, type ExpoPlatformPackage } from '@ankhorage/expo-runtime/platform';

export type GeneratedAuthProvider = 'supabase' | null;
export type GeneratedStorageProvider = 'supabase' | null;
const CONTRACTS_VERSION = '^8.0.0';
const DATA_SOURCES_VERSION = '^2.0.0';
const RUNTIME_VERSION = '^2.2.0';
const STUDIO_VERSION = '^2.0.1';
const UTILITY_VERSION = '^0.2.0';
const SUPABASE_AUTH_VERSION = '^1.2.2';
const SUPABASE_STORAGE_VERSION = '^0.2.0';
const ZORA_VERSION = '^3.0.0';
const EXPO_RUNTIME_VERSION = '^3.0.3';
const DEVTOOLS_VERSION = '^1.6.0';
const LEGACY_WEB_ONLY_TARGETS: AppDeployTargets = { web: { enabled: true } };

function serializeStringLiteral(value: string): string {
  return `'${value
    .replaceAll('\\', '\\\\')
    .replaceAll("'", "\\'")
    .replaceAll('\n', '\\n')
    .replaceAll('\r', '\\r')}'`;
}

function serializeJsValue(value: unknown, indentLevel = 0): string {
  const indent = '  '.repeat(indentLevel);
  const nextIndent = '  '.repeat(indentLevel + 1);

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return '[]';
    }

    if (
      value.every((entry) => ['string', 'number', 'boolean'].includes(typeof entry)) &&
      value.length <= 3
    ) {
      return `[${value.map((entry) => serializeJsValue(entry)).join(', ')}]`;
    }

    return `[\n${value
      .map((entry) => `${nextIndent}${serializeJsValue(entry, indentLevel + 1)}`)
      .join(',\n')},\n${indent}]`;
  }

  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) {
      return '{}';
    }

    return `{\n${entries
      .map(([key, entryValue]) => {
        const serializedKey = /^[A-Za-z_$][A-Za-z0-9_$]*$/u.test(key) ? key : JSON.stringify(key);
        return `${nextIndent}${serializedKey}: ${serializeJsValue(entryValue, indentLevel + 1)}`;
      })
      .join(',\n')},\n${indent}}`;
  }

  if (typeof value === 'string') {
    return serializeStringLiteral(value);
  }

  return String(value);
}

function serializeSplashScreenPlugin(
  splashScreen: SplashScreenSpec | null | undefined,
): string | null {
  if (splashScreen == null) {
    return null;
  }

  return serializeJsValue(['expo-splash-screen', splashScreen], 3);
}

function serializeRuntimePlugin(plugin: ExpoRuntimeConfigPluginOutput): string {
  return serializeJsValue(plugin, 3);
}

function serializePluginsWithRuntimePlan(args: {
  splashScreen: SplashScreenSpec | null | undefined;
  runtimePlan?: ExpoRuntimePlan;
}): string {
  const entries = [
    serializeStringLiteral(EXPO_PLATFORM.navigation.expoRouter.name),
    ...resolveExpoRuntimeNativeOutput(args.runtimePlan).configPlugins.map(serializeRuntimePlugin),
  ];
  const splashPlugin = serializeSplashScreenPlugin(args.splashScreen);
  if (splashPlugin !== null) {
    entries.push(splashPlugin);
  }

  if (entries.length === 0) {
    return '[...(config.plugins ?? [])]';
  }

  return `[
      ...(config.plugins ?? []),
      ${entries.join(',\n      ')},
    ]`;
}

function serializeAndroidConfig(args: {
  target: AppDeployAndroidTargetConfig;
  scheme?: string;
  runtimePlan?: ExpoRuntimePlan;
}): string {
  const permissions = resolveExpoRuntimeNativeOutput(args.runtimePlan).androidPermissions;
  const extraLines =
    permissions.length > 0
      ? `
      permissions: ${serializeJsValue(permissions, 3)},`
      : '';
  const schemeLine = args.scheme
    ? `
      scheme: ${serializeStringLiteral(args.scheme)},`
    : '';

  return `{
      ...config.android,${extraLines}
      package: ${serializeStringLiteral(args.target.package)},${schemeLine}
    }`;
}

function serializeIosConfig(args: { target: AppDeployIosTargetConfig; scheme?: string }): string {
  const schemeLine = args.scheme
    ? `
      scheme: ${serializeStringLiteral(args.scheme)},`
    : '';

  return `{
      ...config.ios,
      bundleIdentifier: ${serializeStringLiteral(args.target.bundleIdentifier)},${schemeLine}
    }`;
}

function serializeTargetSections(args: {
  targets: AppDeployTargets;
  runtimePlan?: ExpoRuntimePlan;
}): string {
  const sections: string[] = [];
  const nativeSchemes = resolveExpoRuntimeNativeSchemeMap(args.targets);
  if (args.targets.android?.enabled) {
    sections.push(
      `    android: ${serializeAndroidConfig({ target: args.targets.android, scheme: nativeSchemes.android, runtimePlan: args.runtimePlan })},`,
    );
  }
  if (args.targets.ios?.enabled) {
    sections.push(
      `    ios: ${serializeIosConfig({ target: args.targets.ios, scheme: nativeSchemes.ios })},`,
    );
  }
  if (args.targets.web?.enabled) {
    sections.push(`    web: {
      ...config.web,
      output: 'static',
      favicon: './assets/favicon.png',
    },`);
  }
  return sections.length > 0
    ? String.fromCharCode(10) + sections.join(String.fromCharCode(10))
    : '';
}

export function getAppConfigTs({
  name,
  slug,
  targets,
  splashScreen = null,
  runtimePlan,
}: {
  name: string;
  slug: string;
  targets: AppDeployTargets;
  splashScreen?: SplashScreenSpec | null;
  runtimePlan?: ExpoRuntimePlan;
}) {
  const targetSections = serializeTargetSections({ targets, runtimePlan });
  return `import type { ConfigContext, ExpoConfig } from 'expo/config';

function omitManagedTargetConfig(config: ConfigContext['config']) {
  const baseConfig = { ...config };
  delete baseConfig.scheme;
  delete baseConfig.android;
  delete baseConfig.ios;
  delete baseConfig.web;
  return baseConfig;
}

export default ({ config }: ConfigContext): ExpoConfig => {
  const baseConfig = omitManagedTargetConfig(config);

  return {
    ...baseConfig,
    name: ${serializeStringLiteral(name)},
    slug: ${serializeStringLiteral(slug)},
    plugins: ${serializePluginsWithRuntimePlan({ splashScreen, runtimePlan })},
    experiments: {
      ...config.experiments,
      reactCompiler: true,
      typedRoutes: true,
    },${targetSections}
  };
};
`;
}

export function getAndroidRunTs(args: {
  readonly projectId: string;
  readonly includeStudio: boolean;
}) {
  return `import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const PUBLIC_SUPABASE_URL = 'EXPO_PUBLIC_SUPABASE_URL';
const PUBLIC_STUDIO_API_URL = 'EXPO_PUBLIC_API_URL';
const STUDIO_HOST_URL = 'ANKH_STUDIO_HOST_URL';
const DEFAULT_STUDIO_HOST_URL = 'http://127.0.0.1:3000';
const DEFAULT_STUDIO_API_URL = 'http://127.0.0.1:3000/api';
const LOOPBACK_HOSTNAMES = new Set(['127.0.0.1', '::1', '[::1]', 'localhost']);
const ADB_TRACK_READY_TIMEOUT_MS = 5_000;
const ADB_REVERSE_ATTEMPTS = 5;
const ADB_REVERSE_RETRY_DELAY_MS = 100;
const projectId = ${serializeStringLiteral(args.projectId)};
const includeStudio = ${JSON.stringify(args.includeStudio)};
const projectRoot = process.cwd();

const environmentPath = path.join(projectRoot, '.env.local');
const supabaseUrl = await readEffectiveEnvValue(environmentPath, PUBLIC_SUPABASE_URL);
const studioApiUrl = includeStudio
  ? await readEffectiveEnvValue(environmentPath, PUBLIC_STUDIO_API_URL)
  : undefined;
const supabaseMapping = supabaseUrl ? await prepareAndroidLoopbackBridge(supabaseUrl) : undefined;
const studioApiMapping = includeStudio
  ? await prepareStudioApiBridge(studioApiUrl ?? DEFAULT_STUDIO_API_URL)
  : undefined;
const reverseMappings = deduplicateReverseMappings([supabaseMapping, studioApiMapping]);
const expoArgs = process.argv.slice(2);

const expoExecutable = path.join(
  projectRoot,
  'node_modules',
  '.bin',
  process.platform === 'win32' ? 'expo.cmd' : 'expo',
);
const androidBridge =
  reverseMappings.length > 0
    ? await startAndroidBridgeSupervisor(reverseMappings, expoArgs)
    : undefined;
await runExpoCommand(expoExecutable, ['run:android', ...expoArgs], androidBridge);

interface AndroidReverseMapping {
  readonly local: string;
  readonly remote: string;
}

async function prepareAndroidLoopbackBridge(
  value: string,
): Promise<AndroidReverseMapping | undefined> {
  let url: URL;
  try {
    url = new URL(value);
  } catch (error) {
    throw new Error(\`\${PUBLIC_SUPABASE_URL} is not a valid URL. Run Infrastructure Up again.\`, {
      cause: error,
    });
  }

  if (!LOOPBACK_HOSTNAMES.has(url.hostname)) return undefined;

  const port = resolveUrlPort(url, PUBLIC_SUPABASE_URL);
  if (!(await isLocalGatewayReachable(url))) {
    await ensureStudioInfrastructureRuntime();
    if (!(await isLocalGatewayReachable(url))) {
      throw new Error(
        \`Studio reported that infrastructure runtime recovery succeeded, but the local Supabase gateway is still unavailable at \${url.origin}. Run Infrastructure Up and try again.\`,
      );
    }
  }
  return createTcpReverseMapping(port);
}

async function prepareStudioApiBridge(value: string): Promise<AndroidReverseMapping | undefined> {
  let url: URL;
  try {
    url = new URL(value);
  } catch (error) {
    throw new Error(\`\${PUBLIC_STUDIO_API_URL} is not a valid URL: \${value}\`, {
      cause: error,
    });
  }

  if (!LOOPBACK_HOSTNAMES.has(url.hostname)) return undefined;
  const port = resolveUrlPort(url, PUBLIC_STUDIO_API_URL);

  if (!(await isStudioHostReachable(url))) {
    throw new Error(
      \`Studio Host is unavailable at \${url.origin}. Start \\\`bun run dev:host\\\` and try again.\`,
    );
  }
  return createTcpReverseMapping(port);
}

function createTcpReverseMapping(port: string): AndroidReverseMapping {
  return { local: \`tcp:\${port}\`, remote: \`tcp:\${port}\` };
}

function deduplicateReverseMappings(
  mappings: readonly (AndroidReverseMapping | undefined)[],
): readonly AndroidReverseMapping[] {
  const unique = new Map<string, AndroidReverseMapping>();
  for (const mapping of mappings) {
    if (mapping) unique.set(\`\${mapping.local}:\${mapping.remote}\`, mapping);
  }
  return [...unique.values()];
}

interface AndroidTransport {
  readonly key: string;
  readonly model: string | undefined;
  readonly serial: string;
  readonly transportId: string;
}

interface AndroidBridgeSupervisor {
  readonly failure: Promise<never>;
  stop(): Promise<void>;
}

async function startAndroidBridgeSupervisor(
  mappings: readonly AndroidReverseMapping[],
  expoArgs: readonly string[],
): Promise<AndroidBridgeSupervisor> {
  const requestedDevice = resolveRequestedAndroidDevice(expoArgs);
  const tracker = spawn('adb', ['track-devices', '-l'], {
    cwd: projectRoot,
    env: process.env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let bufferedOutput: Buffer = Buffer.alloc(0);
  let latestTransports = new Map<string, AndroidTransport>();
  let selectedSerial: string | undefined;
  const verifiedTransports = new Set<string>();
  let trackerStderr = '';
  let stopping = false;
  let failed = false;
  let readySettled = false;
  let stopPromise: Promise<void> | undefined;
  let processing = Promise.resolve();
  let resolveReady!: () => void;
  let rejectReady!: (error: Error) => void;
  let rejectFailure!: (error: Error) => void;

  const ready = new Promise<void>((resolve, reject) => {
    resolveReady = resolve;
    rejectReady = reject;
  });
  const failure = new Promise<never>((_resolve, reject) => {
    rejectFailure = reject;
  });
  void failure.catch(() => undefined);
  const trackerExit = new Promise<void>((resolve) => {
    tracker.once('close', (code, signal) => {
      resolve();
      if (stopping || failed) return;
      const detail = trackerStderr.trim();
      failSupervisor(
        new Error(
          \`ADB transport tracking stopped unexpectedly\${signal ? \` from signal \${signal}\` : \` with code \${code ?? 1}\`}\${detail ? \`: \${detail}\` : '.'}\`,
        ),
      );
    });
  });

  tracker.once('error', failSupervisor);
  tracker.stderr?.setEncoding('utf8');
  tracker.stderr?.on('data', (chunk: string) => {
    trackerStderr = (trackerStderr + chunk).slice(-4_096);
  });
  tracker.stdout?.on('data', (chunk: Buffer | string) => {
    if (stopping || failed) return;
    bufferedOutput = Buffer.concat([
      bufferedOutput,
      Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk),
    ]);
    let frames: readonly string[];
    try {
      const parsed = readAdbTrackFrames(bufferedOutput);
      bufferedOutput = parsed.remaining;
      frames = parsed.frames;
    } catch (error) {
      failSupervisor(error);
      return;
    }

    for (const frame of frames) {
      let transports: readonly AndroidTransport[];
      try {
        transports = parseAndroidTransports(frame);
      } catch (error) {
        failSupervisor(error);
        return;
      }
      latestTransports = new Map(transports.map((transport) => [transport.key, transport]));
      processing = processing.then(async () => {
        const currentTransports = [...latestTransports.values()];
        selectedSerial ??= await resolveAndroidTargetSerial(currentTransports, requestedDevice);
        for (const key of verifiedTransports) {
          if (!latestTransports.has(key)) verifiedTransports.delete(key);
        }
        for (const transport of currentTransports) {
          if (transport.serial !== selectedSerial) continue;
          if (latestTransports.get(transport.key) !== transport) continue;
          if (verifiedTransports.has(transport.key)) continue;
          if (await ensureTransportReverses(transport, mappings, () => latestTransports)) {
            verifiedTransports.add(transport.key);
            console.info(
              \`[android-dev] Bridged Android transport \${transport.serial} (transport_id \${transport.transportId}) \${mappings.map((mapping) => \`\${mapping.local} -> \${mapping.remote}\`).join(', ')}.\`,
            );
          }
        }
        settleReady();
      });
      void processing.catch(failSupervisor);
    }
  });

  const readyTimeout = setTimeout(() => {
    failSupervisor(
      new Error(
        \`ADB did not provide an initial transport snapshot within \${ADB_TRACK_READY_TIMEOUT_MS}ms. Ensure adb is installed and try again.\`,
      ),
    );
  }, ADB_TRACK_READY_TIMEOUT_MS);
  try {
    await ready;
  } catch (error) {
    await stop();
    throw error;
  } finally {
    clearTimeout(readyTimeout);
  }

  return { failure, stop };

  function settleReady(): void {
    if (readySettled) return;
    readySettled = true;
    resolveReady();
  }

  function failSupervisor(error: unknown): void {
    if (stopping || failed) return;
    failed = true;
    const resolvedError = toError(error);
    if (!readySettled) {
      readySettled = true;
      rejectReady(resolvedError);
    }
    rejectFailure(resolvedError);
    if (tracker.exitCode === null && tracker.signalCode === null) tracker.kill('SIGTERM');
  }

  function stop(): Promise<void> {
    stopPromise ??= (async () => {
      stopping = true;
      if (tracker.exitCode === null && tracker.signalCode === null) tracker.kill('SIGTERM');
      await trackerExit;
      await processing.catch(() => undefined);
    })();
    return stopPromise;
  }
}

function resolveRequestedAndroidDevice(args: readonly string[]): string | undefined {
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === undefined) continue;
    const assignment = /^(?:--device|-d)=(.*)$/u.exec(argument);
    if (assignment) {
      const value = assignment[1];
      if (value) return value;
      throw new Error(
        'Android bridge supervision requires a device value. Use --device <device-name>.',
      );
    }
    if (argument !== '--device' && argument !== '-d') continue;
    const value = args[index + 1];
    if (value && !value.startsWith('-')) return value;
    throw new Error(
      'Interactive Expo device selection cannot be supervised safely. Use --device <device-name>.',
    );
  }
  return undefined;
}

async function resolveAndroidTargetSerial(
  transports: readonly AndroidTransport[],
  requestedDevice: string | undefined,
): Promise<string | undefined> {
  if (!requestedDevice) {
    // Expo CLI selects the first attached device when --device is omitted.
    return transports[0]?.serial;
  }

  const directMatch = transports.find(
    (transport) =>
      transport.serial === requestedDevice ||
      (!transport.serial.startsWith('emulator-') && transport.model === requestedDevice),
  );
  if (directMatch) return directMatch.serial;

  for (const transport of transports) {
    if (!transport.serial.startsWith('emulator-')) continue;
    const result = await runCapturedCommand('adb', ['-s', transport.serial, 'emu', 'avd', 'name']);
    const avdName = result.stdout
      .split(/\\r?\\n/u)
      .find((line) => line.trim())
      ?.trim();
    if (avdName === requestedDevice) return transport.serial;
  }

  return undefined;
}

function readAdbTrackFrames(buffer: Buffer): {
  readonly frames: readonly string[];
  readonly remaining: Buffer;
} {
  const frames: string[] = [];
  let offset = 0;
  while (buffer.length - offset >= 4) {
    const header = buffer.subarray(offset, offset + 4).toString('ascii');
    if (!/^[0-9a-f]{4}$/iu.test(header)) {
      throw new Error(\`ADB transport tracking returned an invalid frame header: \${header}.\`);
    }
    const length = Number.parseInt(header, 16);
    if (buffer.length - offset - 4 < length) break;
    const start = offset + 4;
    frames.push(buffer.subarray(start, start + length).toString('utf8'));
    offset = start + length;
  }
  return { frames, remaining: buffer.subarray(offset) };
}

function parseAndroidTransports(snapshot: string): readonly AndroidTransport[] {
  const transports: AndroidTransport[] = [];
  for (const line of snapshot.split(/\\r?\\n/u)) {
    const fields = line.trim().split(/\\s+/u);
    if (fields.length < 2 || fields[1] !== 'device') continue;
    const serial = fields[0];
    const modelField = fields.find((field) => field.startsWith('model:'));
    const model = modelField?.slice('model:'.length);
    const transportField = fields.find((field) => field.startsWith('transport_id:'));
    const transportId = transportField?.slice('transport_id:'.length);
    if (!serial || !transportId || !/^\\d+$/u.test(transportId)) {
      throw new Error(
        \`ADB did not report a transport_id for authorized Android device '\${serial ?? 'unknown'}'. Update Android platform-tools and try again.\`,
      );
    }
    transports.push({ key: \`\${serial}:\${transportId}\`, model, serial, transportId });
  }
  return transports;
}

async function ensureTransportReverses(
  transport: AndroidTransport,
  mappings: readonly AndroidReverseMapping[],
  getLatestTransports: () => ReadonlyMap<string, AndroidTransport>,
): Promise<boolean> {
  for (const mapping of mappings) {
    if (!(await ensureTransportReverse(transport, mapping, getLatestTransports))) return false;
  }
  return true;
}

async function ensureTransportReverse(
  transport: AndroidTransport,
  mapping: AndroidReverseMapping,
  getLatestTransports: () => ReadonlyMap<string, AndroidTransport>,
): Promise<boolean> {
  let lastError: Error | undefined;
  for (let attempt = 1; attempt <= ADB_REVERSE_ATTEMPTS; attempt += 1) {
    if (!getLatestTransports().has(transport.key)) return false;
    try {
      if (!(await hasTransportReverse(transport.serial, mapping))) {
        await runCapturedCommand('adb', [
          '-s',
          transport.serial,
          'reverse',
          mapping.local,
          mapping.remote,
        ]);
      }
      if (await hasTransportReverse(transport.serial, mapping)) return true;
      throw new Error(\`adb reverse --list did not contain \${mapping.local} -> \${mapping.remote}.\`);
    } catch (error) {
      lastError = toError(error);
      if (!getLatestTransports().has(transport.key)) return false;
      if (attempt < ADB_REVERSE_ATTEMPTS) await delay(ADB_REVERSE_RETRY_DELAY_MS);
    }
  }
  throw new Error(
    \`Could not bridge Android device \${transport.serial} (transport_id \${transport.transportId}) after \${ADB_REVERSE_ATTEMPTS} attempts: \${lastError?.message ?? 'unknown ADB error'}\`,
    { cause: lastError },
  );
}

async function hasTransportReverse(
  serial: string,
  mapping: AndroidReverseMapping,
): Promise<boolean> {
  const result = await runCapturedCommand('adb', ['-s', serial, 'reverse', '--list']);
  return result.stdout.split(/\\r?\\n/u).some((line) => {
    const fields = line.trim().split(/\\s+/u);
    return fields.at(-2) === mapping.local && fields.at(-1) === mapping.remote;
  });
}

interface CapturedCommandResult {
  readonly stdout: string;
  readonly stderr: string;
}

async function runCapturedCommand(
  command: string,
  args: readonly string[],
): Promise<CapturedCommandResult> {
  const child = spawn(command, args, {
    cwd: projectRoot,
    env: process.env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let stdout = '';
  let stderr = '';
  child.stdout?.setEncoding('utf8');
  child.stderr?.setEncoding('utf8');
  child.stdout?.on('data', (chunk: string) => {
    stdout += chunk;
  });
  child.stderr?.on('data', (chunk: string) => {
    stderr += chunk;
  });
  const exitCode = await new Promise<number>((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', (code, signal) => {
      if (signal) {
        reject(new Error(\`\${command} exited from signal \${signal}.\`));
        return;
      }
      resolve(code ?? 1);
    });
  });
  if (exitCode !== 0) {
    const detail = stderr.trim() || stdout.trim();
    throw new Error(
      \`\${command} \${args.join(' ')} exited with code \${exitCode}\${detail ? \`: \${detail}\` : '.'}\`,
    );
  }
  return { stdout, stderr };
}

function resolveUrlPort(url: URL, environmentKey: string): string {
  if (url.port) return url.port;
  if (url.protocol === 'http:') return '80';
  if (url.protocol === 'https:') return '443';
  throw new Error(\`\${environmentKey} must use HTTP or HTTPS.\`);
}

async function isLocalGatewayReachable(url: URL): Promise<boolean> {
  const healthUrl = new URL('/auth/v1/health', url.origin);
  try {
    await fetch(healthUrl, { signal: AbortSignal.timeout(5_000) });
    return true;
  } catch {
    return false;
  }
}

async function isStudioHostReachable(url: URL): Promise<boolean> {
  const healthUrl = new URL('/health', url.origin);
  try {
    const response = await fetch(healthUrl, { signal: AbortSignal.timeout(5_000) });
    return response.ok;
  } catch {
    return false;
  }
}

async function ensureStudioInfrastructureRuntime(): Promise<void> {
  const studioHostValue = process.env[STUDIO_HOST_URL] ?? DEFAULT_STUDIO_HOST_URL;
  let endpoint: URL;
  try {
    endpoint = new URL(
      \`/api/projects/\${encodeURIComponent(projectId)}/infra/runtime/ensure\`,
      studioHostValue,
    );
  } catch (error) {
    throw new Error(\`\${STUDIO_HOST_URL} is not a valid URL: \${studioHostValue}\`, {
      cause: error,
    });
  }

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      signal: AbortSignal.timeout(30_000),
    });
  } catch (error) {
    throw new Error(
      \`Could not ask the Studio host at \${endpoint.origin} to restore project '\${projectId}' infrastructure runtime. Start the Studio host, run Infrastructure Up if needed, and try again.\`,
      { cause: error },
    );
  }

  if (response.ok) return;

  const detail = await readErrorDetail(response);
  throw new Error(
    \`Studio could not restore project '\${projectId}' infrastructure runtime (HTTP \${response.status})\${detail ? \`: \${detail}\` : '.'} Run Infrastructure Up and try again.\`,
  );
}

async function readErrorDetail(response: Response): Promise<string | undefined> {
  try {
    const body: unknown = await response.json();
    if (typeof body !== 'object' || body === null || Array.isArray(body)) return undefined;
    const error = Reflect.get(body, 'error');
    return typeof error === 'string' && error.trim() ? error.trim() : undefined;
  } catch {
    return undefined;
  }
}

async function readEnvValue(filePath: string, key: string): Promise<string | undefined> {
  let content: string;
  try {
    content = await readFile(filePath, 'utf8');
  } catch (error) {
    if ((error as { code?: unknown }).code === 'ENOENT') return undefined;
    throw error;
  }

  for (const line of content.split(/\\r?\\n/u)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const separator = trimmed.indexOf('=');
    if (separator < 1) continue;
    const candidateKey = trimmed
      .slice(0, separator)
      .replace(/^export\\s+/u, '')
      .trim();
    if (candidateKey !== key) continue;
    return stripMatchingQuotes(trimmed.slice(separator + 1).trim());
  }

  return undefined;
}

async function readEffectiveEnvValue(filePath: string, key: string): Promise<string | undefined> {
  const processValue = process.env[key];
  if (typeof processValue === 'string' && processValue.length > 0) return processValue;
  return readEnvValue(filePath, key);
}

function stripMatchingQuotes(value: string): string {
  const first = value.at(0);
  const last = value.at(-1);
  return value.length >= 2 && first === last && (first === "'" || first === '"')
    ? value.slice(1, -1)
    : value;
}

async function runExpoCommand(
  command: string,
  args: readonly string[],
  androidBridge?: AndroidBridgeSupervisor,
): Promise<void> {
  const child = spawn(command, args, {
    cwd: projectRoot,
    env: process.env,
    stdio: 'inherit',
  });
  const exit = new Promise<{ readonly code: number; readonly signal?: NodeJS.Signals }>(
    (resolve, reject) => {
      child.once('error', reject);
      child.once('exit', (code, signal) => {
        if (signal) {
          resolve({ code: code ?? 1, signal });
          return;
        }
        resolve({ code: code ?? 1 });
      });
    },
  );
  const stopFromSignal = (signal: NodeJS.Signals) => {
    void androidBridge?.stop();
    if (child.exitCode === null && child.signalCode === null) child.kill(signal);
  };
  const onSigint = () => stopFromSignal('SIGINT');
  const onSigterm = () => stopFromSignal('SIGTERM');
  process.once('SIGINT', onSigint);
  process.once('SIGTERM', onSigterm);

  try {
    const expoOutcome = exit.then((result) => ({ kind: 'expo' as const, result }));
    const outcome = androidBridge
      ? await Promise.race([
          expoOutcome,
          androidBridge.failure.catch((error: unknown) => ({
            kind: 'bridge' as const,
            error: toError(error),
          })),
        ])
      : await expoOutcome;

    if (outcome.kind === 'bridge') {
      if (child.exitCode === null && child.signalCode === null) child.kill('SIGTERM');
      await exit;
      throw outcome.error;
    }
    if (outcome.result.signal) {
      throw new Error(\`\${command} exited from signal \${outcome.result.signal}.\`);
    }
    if (outcome.result.code !== 0) {
      throw new Error(\`\${command} exited with code \${outcome.result.code}.\`);
    }
  } finally {
    process.off('SIGINT', onSigint);
    process.off('SIGTERM', onSigterm);
    await androidBridge?.stop();
  }
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}
`;
}

export function getPackageJson(args: {
  name: string;
  includeStudio?: boolean;
  authProvider?: GeneratedAuthProvider;
  storageProvider?: GeneratedStorageProvider;
  runtimePlan?: ExpoRuntimePlan;
  targets?: AppDeployTargets;
}) {
  const {
    name,
    includeStudio = false,
    authProvider = null,
    storageProvider = null,
    runtimePlan,
    targets = LEGACY_WEB_ONLY_TARGETS,
  } = args;
  const runtimeDependencies = resolveExpoRuntimeDependencyMap(runtimePlan);
  const pkgJson = {
    name,
    main: `${EXPO_PLATFORM.navigation.expoRouter.name}/entry`,
    engines: {
      node: EXPO_PLATFORM.tooling.node.version,
    },
    packageManager: 'bun@1.3.14',
    version: '1.0.0',
    scripts: {
      start: 'expo start',
      ...(targets.android?.enabled ? { android: 'bun scripts/ankh-android.ts' } : {}),
      ...(targets.ios?.enabled ? { ios: 'expo run:ios' } : {}),
      ...(targets.web?.enabled ? { web: 'expo start --web' } : {}),
      ...(targets.web?.enabled
        ? { 'export:web': 'expo export --platform web --output-dir dist-web' }
        : {}),
      doctor: 'expo-doctor',
      typecheck: 'tsc --noEmit',
      lint: 'ankhorage-eslint . --max-warnings=0',
      'lint:fix': 'ankhorage-eslint . --fix --max-warnings=0',
      format: 'ankhorage-prettier --write .',
      'format:check': 'ankhorage-prettier --check .',
    },
    dependencies: {
      '@ankhorage/contracts': CONTRACTS_VERSION,
      '@ankhorage/data-sources': DATA_SOURCES_VERSION,
      '@ankhorage/expo-runtime': EXPO_RUNTIME_VERSION,
      '@ankhorage/runtime': RUNTIME_VERSION,
      ...(includeStudio ? { '@ankhorage/studio': STUDIO_VERSION } : {}),
      ...(authProvider !== null ? { '@ankhorage/utility': UTILITY_VERSION } : {}),
      ...(authProvider === 'supabase'
        ? {
            '@ankhorage/supabase-auth': SUPABASE_AUTH_VERSION,
            ...createPlatformDependencyMap([
              EXPO_PLATFORM.packages.secureStore,
              EXPO_PLATFORM.packages.webBrowser,
            ]),
          }
        : {}),
      ...(storageProvider === 'supabase'
        ? { '@ankhorage/supabase-storage': SUPABASE_STORAGE_VERSION }
        : {}),
      '@ankhorage/zora': ZORA_VERSION,
      '@react-native-picker/picker': '2.11.4',
      '@react-native-vector-icons/fontawesome': '^13.1.3',
      '@react-native-vector-icons/fontawesome5': '^13.1.3',
      '@react-native-vector-icons/fontawesome6': '^13.1.3',
      '@react-native-vector-icons/ionicons': '^13.1.3',
      ...runtimeDependencies,
      ...(includeStudio
        ? createPlatformDependencyMap([
            EXPO_PLATFORM.packages.documentPicker,
            EXPO_PLATFORM.packages.fileSystem,
            EXPO_PLATFORM.packages.imagePicker,
          ])
        : {}),
      ...createPlatformDependencyMap([
        EXPO_PLATFORM.runtime.expo,
        EXPO_PLATFORM.runtime.react,
        EXPO_PLATFORM.runtime.reactDom,
        EXPO_PLATFORM.runtime.reactNative,
        EXPO_PLATFORM.runtime.reactNativeWeb,
        EXPO_PLATFORM.navigation.expoRouter,
        EXPO_PLATFORM.navigation.safeArea,
        EXPO_PLATFORM.navigation.screens,
        EXPO_PLATFORM.animation.gestureHandler,
        EXPO_PLATFORM.animation.reanimated,
        EXPO_PLATFORM.animation.worklets,
        EXPO_PLATFORM.ui.svg,
        EXPO_PLATFORM.packages.constants,
        EXPO_PLATFORM.packages.linking,
        EXPO_PLATFORM.packages.splashScreen,
        EXPO_PLATFORM.packages.statusBar,
      ]),
    },
    devDependencies: {
      '@ankhorage/devtools': DEVTOOLS_VERSION,
      [EXPO_PLATFORM.tooling.expoDoctor.name]: EXPO_PLATFORM.tooling.expoDoctor.version,
      [EXPO_PLATFORM.tooling.nodeTypes.name]: EXPO_PLATFORM.tooling.nodeTypes.version,
      '@types/react': '~19.2.2',
      '@types/culori': '^4.0.1',
      [EXPO_PLATFORM.tooling.typescript.name]: EXPO_PLATFORM.tooling.typescript.version,
    },
  };

  return pkgJson;
}

export function getEslintConfigMjs() {
  return `import { createConfig } from '@ankhorage/devtools/eslint';

export default createConfig({
  tsconfigRootDir: import.meta.dirname,
  project: ['./tsconfig.json'],
  files: [
    'app.config.ts',
    'src/app/**/*.{ts,tsx}',
    'src/auth/**/*.{ts,tsx}',
    'src/generated/**/*.{ts,tsx}',
    'src/modules/**/*.{ts,tsx}',
  ],
  additionalIgnores: ['**/*.js', '**/*.cjs', '**/*.mjs', 'dist/**', '.expo/**'],
  overrides: [
    {
      files: ['src/app/_layout.tsx'],
      rules: {
        '@typescript-eslint/no-unnecessary-type-assertion': ['error', { typesToIgnore: ['Href'] }],
      },
    },
  ],
});
`;
}

export function getPrettierRcJs() {
  return `const sharedConfig = require('@ankhorage/devtools/prettier');

module.exports = {
  ...sharedConfig,
  overrides: [
    ...(sharedConfig.overrides ?? []),
    { files: '**/*.json', options: { printWidth: 1 } },
    { files: '**/*.{yaml,yml}', options: { singleQuote: false } },
  ],
};
`;
}

export function getTsConfigJson() {
  const tsConfigJson = `{
  "extends": "expo/tsconfig.base",
  "compilerOptions": {
    "forceConsistentCasingInFileNames": true,
    "outDir": "dist",
    "module": "esnext",
    "moduleResolution": "bundler",
    "strict": true,
    "types": [
      "node"
    ],
    "noUncheckedIndexedAccess": true,
    "paths": {
      "@root/*": [
        "./*"
      ],
      "@/*": [
        "./src/*"
      ]
    }
  },
  "include": [
    "**/*.ts",
    "**/*.tsx",
    ".expo/types/**/*.ts",
    "expo-env.d.ts"
  ]
}
`;
  return tsConfigJson;
}

function createPlatformDependencyMap(
  packages: readonly ExpoPlatformPackage[],
): Readonly<Record<string, string>> {
  return Object.fromEntries(packages.map(({ name, version }) => [name, version]));
}
