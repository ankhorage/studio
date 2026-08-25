export function createNativeEvidenceControllerSource(): string {
  return `import { isPermission, type Permission } from '@ankhorage/permissions';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import {
  readNativeEvidenceCommandAsync,
  reportNativeEvidenceAsync,
} from '@/native-evidence/native-evidence-client';
import { executeNativeEvidenceScenarioAsync } from '@/native-evidence/native-evidence-scenarios';

type EvidenceScenario = Parameters<typeof executeNativeEvidenceScenarioAsync>[0]['scenario'];
const claimedEvidenceCommandRevisions = new Set<number>();

interface ScenarioExecution {
  readonly permission: Permission | null;
  readonly router: ReturnType<typeof useRouter>;
  readonly scenario: EvidenceScenario;
  readonly setResult: Dispatch<SetStateAction<string>>;
  readonly setRunning: Dispatch<SetStateAction<boolean>>;
  readonly signal?: AbortSignal;
}

export function useNativeEvidenceController() {
  const router = useRouter();
  const params = useLocalSearchParams<Record<string, string | string[]>>();
  const requestedScenario = parseScenario(params.scenario);
  const startedRef = useRef(false);
  const [scenario, setScenario] = useState<EvidenceScenario>(
    requestedScenario ?? 'session-restored',
  );
  const [permission, setPermission] = useState<Permission | null>(
    normalizePermission(params.permission),
  );
  const [result, setResult] = useState('Ready.');
  const [running, setRunning] = useState(false);
  const runScenarioAsync = useCallback(
    () => executeAndUpdateAsync({ permission, router, scenario, setResult, setRunning }),
    [permission, router, scenario],
  );

  useCommandedScenario({
    requestedScenario,
    router,
    setPermission,
    setResult,
    setRunning,
    setScenario,
  });
  useAutomaticScenario(firstValue(params.auto) === '1', startedRef, runScenarioAsync);
  return { permission, result, runScenarioAsync, running, scenario };
}

async function executeAndUpdateAsync(execution: ScenarioExecution): Promise<void> {
  if (execution.signal?.aborted) return;
  execution.setRunning(true);
  execution.setResult(\`Running \${execution.scenario}…\`);
  try {
    const message = await executeNativeEvidenceScenarioAsync(execution);
    if (!execution.signal?.aborted) execution.setResult(message);
  } catch (error) {
    if (isAbortError(error) || execution.signal?.aborted) return;
    execution.setResult('Scenario failed without exposing its payload.');
    await reportNativeEvidenceAsync({
      scenario: execution.scenario,
      result: 'error',
    }).catch(() => undefined);
  } finally {
    if (!execution.signal?.aborted) execution.setRunning(false);
  }
}

function firstValue(value: string | string[] | undefined): string | undefined {
  if (!Array.isArray(value)) return value;
  const [first] = value;
  return first;
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}

function normalizePermission(value: string | string[] | undefined): Permission | null {
  const candidate = firstValue(value);
  return candidate && isPermission(candidate) ? candidate : null;
}

function parseScenario(value: string | string[] | undefined): EvidenceScenario | null {
  const candidate = firstValue(value);
  switch (candidate) {
    case 'oauth-success':
    case 'oauth-cancel':
    case 'oauth-malformed':
    case 'oauth-provider-denied':
    case 'prepare-deep-link':
    case 'session-restored':
    case 'permission-status':
    case 'permission-request':
    case 'open-settings':
    case 'pick-document':
    case 'pick-image':
    case 'camera-availability':
    case 'reset-auth':
    case 'scanner':
      return candidate;
    default:
      return null;
  }
}

function useAutomaticScenario(
  automatic: boolean,
  startedRef: MutableRefObject<boolean>,
  runScenarioAsync: () => Promise<void>,
): void {
  useEffect(() => {
    if (!automatic || startedRef.current) return;
    startedRef.current = true;
    void runScenarioAsync();
  }, [automatic, runScenarioAsync, startedRef]);
}

function useCommandedScenario(args: {
  readonly requestedScenario: EvidenceScenario | null;
  readonly router: ReturnType<typeof useRouter>;
  readonly setPermission: Dispatch<SetStateAction<Permission | null>>;
  readonly setResult: Dispatch<SetStateAction<string>>;
  readonly setRunning: Dispatch<SetStateAction<boolean>>;
  readonly setScenario: Dispatch<SetStateAction<EvidenceScenario>>;
}): void {
  const { requestedScenario, router, setPermission, setResult, setRunning, setScenario } = args;
  useEffect(() => {
    if (requestedScenario) return;
    const controller = new AbortController();
    void readNativeEvidenceCommandAsync(controller.signal)
      .then(async (command) => {
        const scenario = parseScenario(command.scenario);
        if (
          !scenario ||
          controller.signal.aborted ||
          claimedEvidenceCommandRevisions.has(command.revision)
        ) {
          return;
        }
        claimedEvidenceCommandRevisions.add(command.revision);
        const permission = normalizePermission(command.permission);
        setScenario(scenario);
        setPermission(permission);
        await executeAndUpdateAsync({
          permission,
          router,
          scenario,
          setResult,
          setRunning,
          signal: controller.signal,
        });
      })
      .catch((error: unknown) => {
        if (!isAbortError(error)) {
          setResult('Unable to read the redacted native evidence command.');
        }
      });
    return () => controller.abort();
  }, [requestedScenario, router, setPermission, setResult, setRunning, setScenario]);
}
`;
}
