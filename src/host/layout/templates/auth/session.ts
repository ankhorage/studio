export function getAuthSessionTs() {
  return `import type { AuthAdapter, AuthSession, AuthUser } from '@ankhorage/contracts/auth';

export const AUTH_SESSION_STORAGE_KEY = 'ankh.auth.session';

const AUTH_REFRESH_THRESHOLD_MS = 60_000;
const AUTH_EXPIRY_SKEW_MS = 5_000;

let memorySession: AuthSession | null = null;
const authSessionListeners = new Set<() => void>();

interface AuthStorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export const authSessionStorage = {
  getItem(key: string): string | null {
    return readLocalStorage(key);
  },

  setItem(key: string, value: string): void {
    writeLocalStorage(key, value);
  },

  removeItem(key: string): void {
    removeLocalStorage(key);
  },
};

function notifyAuthSessionChanged(): void {
  for (const listener of authSessionListeners) {
    try {
      listener();
    } catch {
      // Listener errors must not break session persistence.
    }
  }
}

export function subscribeToAuthSessionChanges(listener: () => void): () => void {
  authSessionListeners.add(listener);
  return () => {
    authSessionListeners.delete(listener);
  };
}

export function getStoredAuthSession(): AuthSession | null {
  if (memorySession) {
    if (isAuthSessionExpired(memorySession)) {
      clearStoredAuthSession();
      return null;
    }

    return memorySession;
  }

  const stored = readLocalStorage(AUTH_SESSION_STORAGE_KEY);
  if (!stored) {
    return null;
  }

  const parsed = parseStoredAuthSession(stored);
  if (!parsed) {
    clearStoredAuthSession();
    return null;
  }

  if (isAuthSessionExpired(parsed)) {
    clearStoredAuthSession();
    return null;
  }

  memorySession = parsed;
  return parsed;
}

export function setStoredAuthSession(session: AuthSession): void {
  const nextSession = normalizeAuthSession(session);
  if (!nextSession) {
    clearStoredAuthSession();
    return;
  }

  const currentSession = readStoredAuthSessionSnapshot();
  const changed = !areAuthSessionsEqual(currentSession, nextSession);
  memorySession = nextSession;
  writeLocalStorage(AUTH_SESSION_STORAGE_KEY, JSON.stringify(nextSession));
  if (changed) {
    notifyAuthSessionChanged();
  }
}

export function clearStoredAuthSession(): void {
  const hadStoredSession = memorySession !== null || readLocalStorage(AUTH_SESSION_STORAGE_KEY) !== null;
  if (!hadStoredSession) {
    return;
  }

  memorySession = null;
  removeLocalStorage(AUTH_SESSION_STORAGE_KEY);
  notifyAuthSessionChanged();
}

export function isAuthSessionExpired(session: AuthSession | null | undefined): boolean {
  const expiresAt = session?.expiresAt;
  if (typeof expiresAt !== 'number' || !Number.isFinite(expiresAt)) {
    return false;
  }

  return expiresAt <= Date.now() + AUTH_EXPIRY_SKEW_MS;
}

export function isAuthenticated(): boolean {
  return getStoredAuthSession() !== null;
}

export function bootstrapAuthSession(): void {
  void getStoredAuthSession();
}

export async function refreshAuthSessionIfNeeded(
  authAdapter: Pick<AuthAdapter, 'refreshSession'>,
): Promise<AuthSession | null> {
  const session = getStoredAuthSession();
  if (!session) {
    return null;
  }

  if (!shouldRefreshAuthSession(session)) {
    return session;
  }

  if (!authAdapter.refreshSession) {
    return handleRefreshFailure(session);
  }

  try {
    const result = await authAdapter.refreshSession();
    if (!result.ok) {
      return handleRefreshFailure(session);
    }

    const nextSession = normalizeAuthSession(result.data);
    if (!nextSession) {
      return handleRefreshFailure(session);
    }

    setStoredAuthSession(nextSession);
    return nextSession;
  } catch {
    return handleRefreshFailure(session);
  }
}

function handleRefreshFailure(session: AuthSession): AuthSession | null {
  if (isAuthSessionExpired(session)) {
    clearStoredAuthSession();
    return null;
  }

  return session;
}

function parseStoredAuthSession(raw: string): AuthSession | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    return normalizeAuthSession(parsed);
  } catch {
    return null;
  }
}

function readStoredAuthSessionSnapshot(): AuthSession | null {
  if (memorySession) {
    return memorySession;
  }

  const stored = readLocalStorage(AUTH_SESSION_STORAGE_KEY);
  if (!stored) {
    return null;
  }

  return parseStoredAuthSession(stored);
}

function areAuthSessionsEqual(left: AuthSession | null, right: AuthSession | null): boolean {
  if (left === right) {
    return true;
  }

  if (!left || !right) {
    return false;
  }

  return JSON.stringify(left) === JSON.stringify(right);
}

function normalizeAuthSession(value: unknown): AuthSession | null {
  if (typeof value !== 'object' || value === null) {
    return null;
  }

  const accessToken = normalizeRequiredString(Reflect.get(value, 'accessToken'));
  const user = normalizeAuthUser(Reflect.get(value, 'user'));
  if (!accessToken || !user) {
    return null;
  }

  const refreshToken = normalizeOptionalString(Reflect.get(value, 'refreshToken')) ?? undefined;
  const tokenType = normalizeOptionalString(Reflect.get(value, 'tokenType')) ?? undefined;
  const expiresAt = normalizeOptionalNumber(Reflect.get(value, 'expiresAt')) ?? undefined;

  return {
    accessToken,
    ...(refreshToken ? { refreshToken } : {}),
    ...(typeof expiresAt === 'number' ? { expiresAt } : {}),
    ...(tokenType ? { tokenType } : {}),
    user,
  };
}

function normalizeAuthUser(value: unknown): AuthUser | null {
  if (typeof value !== 'object' || value === null) {
    return null;
  }

  const id = normalizeRequiredString(Reflect.get(value, 'id'));
  if (!id) {
    return null;
  }

  const email = normalizeOptionalString(Reflect.get(value, 'email')) ?? undefined;
  const phone = normalizeOptionalString(Reflect.get(value, 'phone')) ?? undefined;
  const username = normalizeOptionalString(Reflect.get(value, 'username')) ?? undefined;
  const displayName = normalizeOptionalString(Reflect.get(value, 'displayName')) ?? undefined;
  const avatarUrl = normalizeOptionalString(Reflect.get(value, 'avatarUrl')) ?? undefined;
  const metadata = normalizeMetadata(Reflect.get(value, 'metadata'));

  return {
    id,
    ...(email ? { email } : {}),
    ...(phone ? { phone } : {}),
    ...(username ? { username } : {}),
    ...(displayName ? { displayName } : {}),
    ...(avatarUrl ? { avatarUrl } : {}),
    ...(metadata ? { metadata } : {}),
  };
}

function shouldRefreshAuthSession(session: AuthSession): boolean {
  const { expiresAt } = session;
  if (typeof expiresAt !== 'number' || !Number.isFinite(expiresAt)) {
    return false;
  }

  return expiresAt - Date.now() <= AUTH_REFRESH_THRESHOLD_MS;
}

function normalizeRequiredString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function normalizeOptionalString(value: unknown): string | null {
  return normalizeRequiredString(value);
}

function normalizeOptionalNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function normalizeMetadata(value: unknown): Record<string, unknown> | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return null;
  }

  const metadata: Record<string, unknown> = {};
  for (const key of Object.keys(value)) {
    metadata[key] = Reflect.get(value, key);
  }

  return metadata;
}

function getLocalStorage(): AuthStorageLike | null {
  const storage: unknown = Reflect.get(globalThis, 'localStorage');
  return isAuthStorageLike(storage) ? storage : null;
}

function isAuthStorageLike(value: unknown): value is AuthStorageLike {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof Reflect.get(value, 'getItem') === 'function' &&
    typeof Reflect.get(value, 'setItem') === 'function' &&
    typeof Reflect.get(value, 'removeItem') === 'function'
  );
}

function readLocalStorage(key: string): string | null {
  try {
    return getLocalStorage()?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

function writeLocalStorage(key: string, value: string): void {
  try {
    getLocalStorage()?.setItem(key, value);
  } catch {
    // Best effort only; in-memory session is still set.
  }
}

function removeLocalStorage(key: string): void {
  try {
    getLocalStorage()?.removeItem(key);
  } catch {
    // Best effort only.
  }
}
`;
}
