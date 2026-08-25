import { appendFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

import {
  NATIVE_EVIDENCE_ANDROID_SCHEME,
  NATIVE_EVIDENCE_IOS_SCHEME,
  NATIVE_EVIDENCE_SERVER_PORT,
  NATIVE_EVIDENCE_SYNTHETIC_CALLBACK_CODE,
} from './constants';

type FixtureScenario = 'hold' | 'malformed' | 'provider-denied' | 'success';
type EvidenceScenario =
  | 'camera-availability'
  | 'oauth-cancel'
  | 'oauth-malformed'
  | 'oauth-provider-denied'
  | 'oauth-success'
  | 'open-settings'
  | 'permission-request'
  | 'permission-status'
  | 'pick-document'
  | 'pick-image'
  | 'prepare-deep-link'
  | 'reset-auth'
  | 'scanner'
  | 'session-restored';

interface EvidenceCommand {
  readonly permission?: string;
  readonly revision: number;
  readonly scenario: EvidenceScenario;
}

interface EvidenceRecord {
  readonly scenario: string;
  readonly result: string;
  readonly details?: Readonly<Record<string, boolean | number | string>>;
}

const EVIDENCE_DETAIL_KEYS = new Set([
  'canAskAgain',
  'completion',
  'correlationMarkerPresent',
  'cryptoPresent',
  'errorCategory',
  'getRandomValuesPresent',
  'granted',
  'kind',
  'pkceInitializationFailed',
  'platform',
  'permission',
  'sessionPresent',
  'subtlePresent',
]);

const EVIDENCE_RESULTS = new Set([
  'authenticated',
  'available',
  'blocked',
  'cancelled',
  'cleared',
  'denied',
  'empty-selection',
  'error',
  'granted',
  'missing',
  'opened',
  'picker-failed',
  'read-failed',
  'ready',
  'selected',
  'unavailable',
  'unknown',
  'unsupported-kind',
]);

export function createNativeEvidenceServer(options: {
  readonly port?: number;
  readonly workspaceRoot: string;
}): ReturnType<typeof Bun.serve> {
  const port = options.port ?? NATIVE_EVIDENCE_SERVER_PORT;
  const evidence: EvidenceRecord[] = [];
  const resultsPath = path.join(options.workspaceRoot, 'evidence', 'native-results.ndjson');
  let authorizationCount = 0;
  let command: EvidenceCommand = { revision: 0, scenario: 'session-restored' };
  let commandRevision = 0;
  let completedCallback: string | null = null;
  let refreshTokenRequestCount = 0;
  let scenario: FixtureScenario = 'success';
  let tokenExchangeCount = 0;
  let unknownTokenRequestCount = 0;

  return Bun.serve({
    hostname: '127.0.0.1',
    port,
    async fetch(request) {
      const url = new URL(request.url);
      if (request.method === 'GET' && url.pathname === '/health') {
        return Response.json({ ok: true, service: 'expo57-native-evidence' });
      }
      if (request.method === 'GET' && url.pathname === '/state') {
        return Response.json({
          authorizationCount,
          command,
          evidence,
          refreshTokenRequestCount,
          scenario,
          tokenExchangeCount,
          unknownTokenRequestCount,
        });
      }
      if (request.method === 'GET' && url.pathname === '/command') {
        return Response.json(command);
      }
      if (request.method === 'POST' && url.pathname === '/command') {
        const nextCommand = normalizeEvidenceCommand(await readJsonRecordAsync(request));
        if (!nextCommand) {
          return Response.json({ error: 'Unknown evidence command.' }, { status: 400 });
        }
        commandRevision += 1;
        command = { ...nextCommand, revision: commandRevision };
        return Response.json({ ok: true });
      }
      if (request.method === 'GET' && url.pathname === '/fixture.txt') {
        return new Response('Synthetic Expo 57 native document picker fixture.\n', {
          headers: { 'content-disposition': 'attachment; filename="native-evidence.txt"' },
        });
      }
      if (request.method === 'POST' && url.pathname === '/scenario') {
        const body = await readJsonRecordAsync(request);
        const requestedScenario = body.scenario;
        if (!isFixtureScenario(requestedScenario)) {
          return Response.json({ error: 'Unknown evidence scenario.' }, { status: 400 });
        }
        scenario = requestedScenario;
        return Response.json({ ok: true });
      }
      if (request.method === 'POST' && url.pathname === '/evidence') {
        const record = normalizeEvidenceRecord(await readJsonRecordAsync(request));
        if (!record) {
          return Response.json({ error: 'Unsafe or invalid evidence record.' }, { status: 400 });
        }
        if (record.scenario === command.scenario) {
          command = { revision: command.revision, scenario: 'session-restored' };
        }
        evidence.push(record);
        await mkdir(path.dirname(resultsPath), { recursive: true });
        await appendFile(resultsPath, `${JSON.stringify(record)}\n`, 'utf8');
        console.log(`[native-evidence] ${record.scenario}: ${record.result}`);
        return Response.json({ ok: true });
      }
      if (request.method === 'GET' && url.pathname === '/auth/v1/authorize') {
        authorizationCount += 1;
        const response = createAuthorizationResponse(url, scenario);
        if (scenario === 'success') {
          completedCallback = response.headers.get('location');
        }
        return response;
      }
      if (
        request.method === 'GET' &&
        (url.pathname === '/auth/replay' || url.pathname === '/auth/mismatch')
      ) {
        if (!completedCallback) {
          return Response.json({ error: 'No completed callback is available.' }, { status: 409 });
        }
        const callback = new URL(completedCallback);
        if (url.pathname === '/auth/mismatch') {
          callback.searchParams.set('code', `${NATIVE_EVIDENCE_SYNTHETIC_CALLBACK_CODE}-mismatch`);
        }
        return Response.redirect(callback, 302);
      }
      if (request.method === 'POST' && url.pathname === '/auth/v1/token') {
        const grantType = url.searchParams.get('grant_type');
        if (grantType === 'pkce') tokenExchangeCount += 1;
        else if (grantType === 'refresh_token') refreshTokenRequestCount += 1;
        else unknownTokenRequestCount += 1;
        return createTokenResponse();
      }
      return Response.json({ error: 'Unknown deterministic fixture route.' }, { status: 404 });
    },
  });
}

function createAuthorizationResponse(url: URL, scenario: FixtureScenario): Response {
  const redirectTo = url.searchParams.get('redirect_to');
  if (!redirectTo || !isAllowedCallback(redirectTo)) {
    return Response.json({ error: 'The callback scheme is not allowlisted.' }, { status: 400 });
  }
  if (scenario === 'hold') {
    return new Response(
      '<!doctype html><meta name="viewport" content="width=device-width"><title>Native evidence cancellation</title><main><h1>Cancellation fixture</h1><p>Dismiss this authentication session to record cancellation.</p></main>',
      { headers: { 'content-type': 'text/html; charset=utf-8' } },
    );
  }
  const callback = new URL(redirectTo);
  if (scenario === 'malformed') callback.searchParams.set('unexpected', 'synthetic');
  if (scenario === 'provider-denied') callback.searchParams.set('error', 'access_denied');
  if (scenario === 'success') {
    callback.searchParams.set('code', NATIVE_EVIDENCE_SYNTHETIC_CALLBACK_CODE);
  }
  return Response.redirect(callback, 302);
}

function createTokenResponse(): Response {
  return Response.json({
    access_token: crypto.randomUUID(),
    expires_in: 3600,
    refresh_token: crypto.randomUUID(),
    token_type: 'bearer',
    user: {
      app_metadata: {},
      aud: 'authenticated',
      email: 'native-evidence@example.invalid',
      id: 'native-evidence-user',
      user_metadata: {},
    },
  });
}

function isAllowedCallback(value: string): boolean {
  try {
    const callback = new URL(value);
    return (
      (callback.protocol === `${NATIVE_EVIDENCE_IOS_SCHEME}:` ||
        callback.protocol === `${NATIVE_EVIDENCE_ANDROID_SCHEME}:`) &&
      callback.hostname === 'auth' &&
      callback.pathname === '/callback' &&
      callback.search.length === 0 &&
      callback.hash.length === 0
    );
  } catch {
    return false;
  }
}

function isFixtureScenario(value: unknown): value is FixtureScenario {
  return (
    value === 'hold' || value === 'malformed' || value === 'provider-denied' || value === 'success'
  );
}

function normalizeEvidenceCommand(
  value: Readonly<Record<string, unknown>>,
): Omit<EvidenceCommand, 'revision'> | null {
  if (!isEvidenceScenario(value.scenario)) return null;
  if (value.permission === undefined) return { scenario: value.scenario };
  if (typeof value.permission !== 'string' || !isEvidencePermission(value.permission)) return null;
  return { permission: value.permission, scenario: value.scenario };
}

function isEvidenceScenario(value: unknown): value is EvidenceScenario {
  return (
    value === 'camera-availability' ||
    value === 'oauth-cancel' ||
    value === 'oauth-malformed' ||
    value === 'oauth-provider-denied' ||
    value === 'oauth-success' ||
    value === 'open-settings' ||
    value === 'permission-request' ||
    value === 'permission-status' ||
    value === 'pick-document' ||
    value === 'pick-image' ||
    value === 'prepare-deep-link' ||
    value === 'reset-auth' ||
    value === 'scanner' ||
    value === 'session-restored'
  );
}

function isEvidencePermission(value: string): boolean {
  return [
    'camera',
    'clipboard',
    'locationBackground',
    'locationForeground',
    'mediaLibrary',
    'mediaLibraryWrite',
    'microphone',
    'notifications',
  ].includes(value);
}

function normalizeEvidenceRecord(value: Readonly<Record<string, unknown>>): EvidenceRecord | null {
  if (!isEvidenceScenario(value.scenario) || !isEvidenceResult(value.result)) return null;
  if (containsSensitiveText(value.scenario) || containsSensitiveText(value.result)) return null;
  const detailsValue = value.details;
  if (detailsValue === undefined) return { scenario: value.scenario, result: value.result };
  if (!isRecord(detailsValue)) return null;
  const details: [string, boolean | number | string][] = [];
  for (const [key, detail] of Object.entries(detailsValue)) {
    if (!EVIDENCE_DETAIL_KEYS.has(key) || containsSensitiveKey(key)) return null;
    if (typeof detail !== 'boolean' && typeof detail !== 'number' && typeof detail !== 'string') {
      return null;
    }
    if (typeof detail === 'string' && containsSensitiveText(detail)) return null;
    details.push([key, detail]);
  }
  return { details: Object.fromEntries(details), scenario: value.scenario, result: value.result };
}

function isEvidenceResult(value: unknown): value is string {
  return typeof value === 'string' && EVIDENCE_RESULTS.has(value);
}

async function readJsonRecordAsync(request: Request): Promise<Readonly<Record<string, unknown>>> {
  try {
    const value: unknown = await request.json();
    return isRecord(value) ? value : {};
  } catch {
    return {};
  }
}

function containsSensitiveKey(value: string): boolean {
  return /authorization|body|code|credential|media|name|secret|token|uri/iu.test(value);
}

function containsSensitiveText(value: string): boolean {
  return /access_token|authorization:|code=|refresh_token|secret=/iu.test(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
