export function getAuthOAuthStateTs() {
  return `import { authSessionStorage } from './session';

const OAUTH_TRANSPORT_ATTEMPT_KEY = 'ankh.auth.oauth.transport';

interface StoredTransportAttempt {
  attemptId: string;
}

export async function clearTransportAttempt(): Promise<void> {
  try {
    await authSessionStorage.removeItem(OAUTH_TRANSPORT_ATTEMPT_KEY);
  } catch {
    // Cleanup failures are intentionally not surfaced with persisted state.
  }
}

export async function readTransportAttempt(): Promise<StoredTransportAttempt | null> {
  const raw = await authSessionStorage.getItem(OAUTH_TRANSPORT_ATTEMPT_KEY);
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (isRecord(value)) {
      const attemptId: unknown = Reflect.get(value, 'attemptId');
      if (typeof attemptId === 'string' && attemptId.trim().length > 0) {
        return { attemptId };
      }
    }
  } catch {
    // Invalid transport state is cleaned below without exposing its contents.
  }
  await clearTransportAttempt();
  return null;
}

export async function writeTransportAttempt(attempt: StoredTransportAttempt): Promise<void> {
  await authSessionStorage.setItem(OAUTH_TRANSPORT_ATTEMPT_KEY, JSON.stringify(attempt));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
`;
}
