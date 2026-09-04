/*** Create the generated scenario-execution source used by the native capability evidence fixture app.
 * @todo Move this acceptance-fixture source generator from src/host/smoke to test/smoke/nativeCapabilityEvidence.
 */
export function createNativeEvidenceScenariosSource(): string {
  return `import { createExpoMediaPickerAdapter } from '@ankhorage/expo-runtime/media-picker';
import { type Permission, type PermissionState } from '@ankhorage/permissions';
import { createPermissionClient } from '@ankhorage/permissions/expo';
import { CameraView } from 'expo-camera';
import type { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';

import { authAdapter } from '@/auth/adapter';
import { startOAuthAuthorization } from '@/auth/oauth';
import { resolveOAuthRedirectUri } from '@/auth/oauth-completion';
import {
  clearTransportAttempt,
  readTransportAttempt,
  writeTransportAttempt,
} from '@/auth/oauth-state';
import { bootstrapAuthSession, clearStoredAuthSession, getStoredAuthSession } from '@/auth/session';
import {
  configureNativeEvidenceScenarioAsync,
  reportNativeEvidenceAsync,
} from '@/native-evidence/native-evidence-client';

const mediaPicker = createExpoMediaPickerAdapter();
const permissionClient = createPermissionClient();
const OAUTH_ERROR_CATEGORIES = [
  ['unexpected parameters', 'callback-unexpected-parameters'],
  ['already consumed', 'callback-consumed'],
  ['already handled', 'callback-already-handled'],
  ['callback could not be completed', 'callback-completion'],
  ['does not match the expected redirect URI', 'callback-location'],
  ['does not contain one authorization code', 'callback-code-missing'],
  ['authorization attempt was not found', 'attempt-missing'],
  ['authorization attempt is already active', 'attempt-active'],
  ['PKCE verifier', 'pkce'],
  ['exchanging the OAuth code', 'exchange-network'],
  ['exchange the OAuth authorization code', 'exchange-response'],
  ['invalid OAuth session', 'session-invalid'],
  ['session could not be persisted', 'session-persistence'],
  ['browser', 'browser'],
  ['redirect URI', 'redirect-uri'],
  ['provider', 'provider'],
  ['callback', 'callback'],
  ['authorization', 'authorization'],
] as const;

type EvidenceScenario =
  | 'oauth-success'
  | 'oauth-cancel'
  | 'oauth-malformed'
  | 'oauth-provider-denied'
  | 'prepare-deep-link'
  | 'session-restored'
  | 'permission-status'
  | 'permission-request'
  | 'open-settings'
  | 'pick-document'
  | 'pick-image'
  | 'camera-availability'
  | 'reset-auth'
  | 'scanner';

type Router = ReturnType<typeof useRouter>;

export async function executeNativeEvidenceScenarioAsync(args: {
  permission: Permission | null;
  router: Router;
  scenario: EvidenceScenario;
}): Promise<string> {
  switch (args.scenario) {
    case 'oauth-success':
      return runOAuthTransportAsync('success', args.router);
    case 'oauth-cancel':
      return runOAuthTransportAsync('hold', args.router);
    case 'oauth-malformed':
      return runOAuthTransportAsync('malformed', args.router);
    case 'oauth-provider-denied':
      return runOAuthTransportAsync('provider-denied', args.router);
    case 'prepare-deep-link':
      return prepareDeepLinkAsync();
    case 'session-restored':
      return inspectRestoredSessionAsync();
    case 'permission-status':
      return inspectPermissionAsync(args.permission, false);
    case 'permission-request':
      return inspectPermissionAsync(args.permission, true);
    case 'open-settings':
      await permissionClient.openSettings?.();
      await reportNativeEvidenceAsync({ scenario: args.scenario, result: 'opened' });
      return 'Application settings opened.';
    case 'pick-document':
      return pickMediaAsync('file', 'file');
    case 'pick-image':
      return pickMediaAsync('photo-library', 'image');
    case 'camera-availability':
      return inspectCameraAvailabilityAsync();
    case 'reset-auth':
      await resetAuthStateAsync();
      await reportNativeEvidenceAsync({ scenario: args.scenario, result: 'cleared' });
      return 'Auth session and active transport were cleared.';
    case 'scanner':
      args.router.replace('/');
      await reportNativeEvidenceAsync({ scenario: args.scenario, result: 'opened' });
      return 'Opening the generated application route.';
  }
}

async function inspectCameraAvailabilityAsync(): Promise<string> {
  const available = await CameraView.isAvailableAsync().catch(() => false);
  await reportNativeEvidenceAsync({
    scenario: 'camera-availability',
    result: available ? 'available' : 'unavailable',
  });
  return available
    ? 'A camera is available; preview and scanning require physical-device evidence.'
    : 'Camera hardware is unavailable in this runtime; no preview or scan is attempted.';
}

async function inspectPermissionAsync(
  permission: Permission | null,
  request: boolean,
): Promise<string> {
  if (!permission) throw new Error('A valid permission query parameter is required.');
  const state = request
    ? await permissionClient.request(permission)
    : await permissionClient.getStatus(permission);
  await reportPermissionAsync(request ? 'permission-request' : 'permission-status', state);
  return \`Permission \${permission}: \${state.status}; can ask again: \${String(state.canAskAgain)}.\`;
}

async function inspectRestoredSessionAsync(): Promise<string> {
  await bootstrapAuthSession();
  const sessionPresent = getStoredAuthSession() !== null;
  await reportNativeEvidenceAsync({
    scenario: 'session-restored',
    result: sessionPresent ? 'authenticated' : 'missing',
  });
  return sessionPresent
    ? 'Authenticated session restored from native storage.'
    : 'No authenticated session was restored.';
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

async function pickMediaAsync(
  source: 'file' | 'photo-library',
  kind: 'file' | 'image',
): Promise<string> {
  const result = await mediaPicker.pick({ source, mediaKinds: [kind] });
  const outcome = result.ok ? 'selected' : result.reason;
  await reportNativeEvidenceAsync({
    scenario: source === 'file' ? 'pick-document' : 'pick-image',
    result: outcome,
    ...(result.ok ? { details: { kind: result.selection.kind } } : {}),
  });
  return result.ok
    ? \`\${kind === 'image' ? 'Image' : 'Document'} selected without retaining its name or bytes.\`
    : \`Picker result: \${result.reason}.\`;
}

async function prepareDeepLinkAsync(): Promise<string> {
  await resetAuthStateAsync();
  const { oauth } = authAdapter;
  if (!oauth) throw new Error('OAuth is unavailable.');
  const started = await oauth.startAuthorization({
    provider: 'google',
    redirectUri: resolveOAuthRedirectUri(),
    scopes: ['openid', 'email', 'profile'],
    queryParams: { prompt: 'select_account' },
  });
  if (!started.ok) throw new Error('OAuth preparation failed.');
  await writeTransportAttempt({ attemptId: started.data.attemptId });
  await reportNativeEvidenceAsync({ scenario: 'prepare-deep-link', result: 'ready' });
  return 'Pending OAuth attempt ready for a synthetic configured-scheme callback.';
}

function readCryptoRuntimeEvidence(): Readonly<Record<string, boolean>> {
  const root: unknown = globalThis;
  const cryptoValue = isRecord(root) ? Reflect.get(root, 'crypto') : undefined;
  const cryptoPresent = isRecord(cryptoValue);
  const subtleValue = cryptoPresent ? Reflect.get(cryptoValue, 'subtle') : undefined;
  return {
    cryptoPresent,
    getRandomValuesPresent:
      cryptoPresent && typeof Reflect.get(cryptoValue, 'getRandomValues') === 'function',
    subtlePresent: isRecord(subtleValue),
  };
}

async function reportPermissionAsync(scenario: string, state: PermissionState): Promise<void> {
  await reportNativeEvidenceAsync({
    scenario,
    result: state.status,
    details: {
      canAskAgain: state.canAskAgain ?? false,
      granted: state.granted,
      permission: state.permission,
    },
  });
}

async function resetAuthStateAsync(): Promise<void> {
  const attempt = await readTransportAttempt();
  if (attempt && authAdapter.oauth) {
    await authAdapter.oauth.completeAuthorization({
      attemptId: attempt.attemptId,
      response: { type: 'cancelled', reason: 'user_cancelled' },
    });
  }
  await clearTransportAttempt();
  await clearStoredAuthSession();
}

async function runOAuthTransportAsync(
  fixtureScenario: 'hold' | 'malformed' | 'provider-denied' | 'success',
  router: Router,
): Promise<string> {
  await resetAuthStateAsync();
  await configureNativeEvidenceScenarioAsync(fixtureScenario);
  if (fixtureScenario === 'hold') scheduleAuthSessionDismissal();
  const outcome = await startOAuthAuthorization('google');
  const details = {
    sessionPresent: getStoredAuthSession() !== null,
    correlationMarkerPresent: (await readTransportAttempt()) !== null,
    ...readCryptoRuntimeEvidence(),
    pkceInitializationFailed:
      outcome.status === 'error' &&
      outcome.message === 'Unable to initialize the OAuth PKCE authorization attempt.',
    ...(outcome.status === 'error' ? { errorCategory: classifyOAuthError(outcome.message) } : {}),
    ...(outcome.status === 'authenticated' ? { completion: outcome.completion } : {}),
  };
  await reportNativeEvidenceAsync({
    scenario: fixtureScenario === 'hold' ? 'oauth-cancel' : \`oauth-\${fixtureScenario}\`,
    result: outcome.status,
    details,
  });
  if (outcome.status === 'authenticated') {
    router.replace('/');
    return \`OAuth authenticated (\${outcome.completion}); opening the protected app route.\`;
  }
  return \`OAuth result: \${outcome.status}.\`;
}

function classifyOAuthError(message: string): string {
  return OAUTH_ERROR_CATEGORIES.find(([marker]) => message.includes(marker))?.[1] ?? 'other';
}

function scheduleAuthSessionDismissal(): void {
  setTimeout(() => {
    try {
      WebBrowser.dismissAuthSession();
    } catch {
      // Android does not support programmatic auth-session dismissal.
    }
  }, 750);
}
`;
}
