/*** Create the generated client source used by the native capability evidence fixture app.
 * @todo Move this acceptance-fixture source generator from src/host/smoke to test/smoke/nativeCapabilityEvidence.
 */
export function createNativeEvidenceClientSource(): string {
  return `import { Platform } from 'react-native';

type NativeEvidenceScenario = 'hold' | 'malformed' | 'provider-denied' | 'success';

interface NativeEvidenceRecord {
  readonly scenario: string;
  readonly result: string;
  readonly details?: Readonly<Record<string, boolean | number | string>>;
}

export interface NativeEvidenceCommand {
  readonly permission?: string;
  readonly revision: number;
  readonly scenario: string;
}

const serverUrl = readPublicEnvironmentVariable('EXPO_PUBLIC_NATIVE_EVIDENCE_URL');

export async function configureNativeEvidenceScenarioAsync(
  scenario: NativeEvidenceScenario,
): Promise<void> {
  await postJsonAsync('/scenario', { scenario });
}

export async function reportNativeEvidenceAsync(record: NativeEvidenceRecord): Promise<void> {
  await postJsonAsync('/evidence', {
    ...record,
    details: {
      platform: Platform.OS,
      ...(record.details ?? {}),
    },
  });
}

export async function readNativeEvidenceCommandAsync(
  signal?: AbortSignal,
): Promise<NativeEvidenceCommand> {
  if (!serverUrl) throw new Error('EXPO_PUBLIC_NATIVE_EVIDENCE_URL is missing.');
  const response = await fetch(new URL('/command', serverUrl), { signal });
  if (!response.ok) throw new Error(\`Native evidence fixture returned HTTP \${response.status}.\`);
  const command: unknown = await response.json();
  if (
    typeof command !== 'object' ||
    command === null ||
    !('scenario' in command) ||
    typeof command.scenario !== 'string' ||
    !('revision' in command) ||
    typeof command.revision !== 'number' ||
    !Number.isSafeInteger(command.revision) ||
    command.revision < 0
  ) {
    throw new Error('Native evidence fixture returned an invalid command.');
  }
  return {
    revision: command.revision,
    scenario: command.scenario,
    ...('permission' in command && typeof command.permission === 'string'
      ? { permission: command.permission }
      : {}),
  };
}

async function postJsonAsync(path: string, body: unknown): Promise<void> {
  if (!serverUrl) throw new Error('EXPO_PUBLIC_NATIVE_EVIDENCE_URL is missing.');
  const response = await fetch(new URL(path, serverUrl), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(\`Native evidence fixture returned HTTP \${response.status}.\`);
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readPublicEnvironmentVariable(name: string): string {
  const processValue: unknown = Reflect.get(globalThis, 'process');
  const environment = isRecord(processValue) ? Reflect.get(processValue, 'env') : undefined;
  const value = isRecord(environment) ? Reflect.get(environment, name) : undefined;
  return typeof value === 'string' ? value.trim() : '';
}
`;
}
