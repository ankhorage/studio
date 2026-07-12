export function getAuthSessionTs() {
  return `import type { AuthAdapter, AuthSession, AuthUser } from '@ankhorage/contracts/auth';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

export const AUTH_SESSION_STORAGE_KEY = 'ankh.auth.session.v1';

const AUTH_REFRESH_THRESHOLD_MS = 60_000;
const AUTH_EXPIRY_SKEW_MS = 5_000;
const nonPersistentRuntimeStorage = new Map<string, string>();
const authSessionListeners = new Set<() => void>();

let memorySession: AuthSession | null = null;
let bootstrapPromise: Promise<AuthSession | null> | null = null;
let refreshPromise: Promise<AuthSession | null> | null = null;

interface WebStorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export const authSessionStorage = {
  async getItem(key: string): Promise<string | null> {
    return readPlatformStorage(key);
  },

  async setItem(key: string, value: string): Promise<void> {
    await writePlatformStorage(key, value);
    if (key === AUTH_SESSION_STORAGE_KEY) {
      const nextSession = parseStoredAuthSession(value);
      updateMemorySession(nextSession);
    }
  },

  async removeItem(key: string): Promise<void> {
    await removePlatformStorage(key);
    if (key === AUTH_SESSION_STORAGE_KEY) {
      updateMemorySession(null);
    }
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

function updateMemorySession(session: AuthSession | null): void {
  if (areAuthSessionsEqual(memorySession, session)) return;
  memorySession = session;
  notifyAuthSessionChanged();
}

export function subscribeToAuthSessionChanges(listener: () => void): () => void {
  authSessionListeners.add(listener);
  return () => {
    authSessionListeners.delete(listener);
  };
}

export function getStoredAuthSession(): AuthSession | null {
  return memorySession;
}

export async function setStoredAuthSession(session: AuthSession): Promise<void> {
  const nextSession = normalizeAuthSession(session);
  if (!nextSession) {
    await clearStoredAuthSession();
    return;
  }

  await authSessionStorage.setItem(AUTH_SESSION_STORAGE_KEY, JSON.stringify(nextSession));
}

export async function clearStoredAuthSession(): Promise<void> {
  await authSessionStorage.removeItem(AUTH_SESSION_STORAGE_KEY);
}

export function isAuthSessionExpired(session: AuthSession | null | undefined): boolean {
  const expiresAt = session?.expiresAt;
  if (typeof expiresAt !== 'number' || !Number.isFinite(expiresAt)) {
    return false;
  }

  return expiresAt <= Date.now() + AUTH_EXPIRY_SKEW_MS;
}

export function isAuthenticated(): boolean {
  return memorySession !== null && !isAuthSessionExpired(memorySession);
}

export function bootstrapAuthSession(): Promise<AuthSession | null> {
  bootstrapPromise ??= (async () => {
    const stored = await authSessionStorage.getItem(AUTH_SESSION_STORAGE_KEY);
    const session = stored ? parseStoredAuthSession(stored) : null;
    updateMemorySession(session);
    return session;
  })();
  return bootstrapPromise;
}

export function refreshAuthSessionIfNeeded(
  authAdapter: Pick<AuthAdapter, 'refreshSession'>,
): Promise<AuthSession | null> {
  refreshPromise ??= refreshAuthSession(authAdapter).finally(() => {
    refreshPromise = null;
  });
  return refreshPromise;
}

async function refreshAuthSession(
  authAdapter: Pick<AuthAdapter, 'refreshSession'>,
): Promise<AuthSession | null> {
  const session = memorySession ?? (await bootstrapAuthSession());
  if (!session) return null;

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

    await setStoredAuthSession(nextSession);
    return nextSession;
  } catch {
    return handleRefreshFailure(session);
  }
}

async function handleRefreshFailure(session: AuthSession): Promise<AuthSession | null> {
  if (isAuthSessionExpired(session)) {
    await clearStoredAuthSession();
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

function areAuthSessionsEqual(left: AuthSession | null, right: AuthSession | null): boolean {
  if (left === right) return true;
  if (!left || !right) return false;
  return JSON.stringify(left) === JSON.stringify(right);
}

function normalizeAuthSession(value: unknown): AuthSession | null {
  if (typeof value !== 'object' || value === null) return null;

  const accessToken = normalizeRequiredString(Reflect.get(value, 'accessToken'));
  const user = normalizeAuthUser(Reflect.get(value, 'user'));
  if (!accessToken || !user) return null;

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
  if (typeof value !== 'object' || value === null) return null;

  const id = normalizeRequiredString(Reflect.get(value, 'id'));
  if (!id) return null;

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

async function readPlatformStorage(key: string): Promise<string | null> {
  if (Platform.OS === 'ios' || Platform.OS === 'android') {
    await assertNativeSecureStoreAvailable();
    return SecureStore.getItemAsync(key);
  }

  if (Platform.OS === 'web') {
    const storage = getWebStorage();
    return storage ? storage.getItem(key) : nonPersistentRuntimeStorage.get(key) ?? null;
  }

  return nonPersistentRuntimeStorage.get(key) ?? null;
}

async function writePlatformStorage(key: string, value: string): Promise<void> {
  if (Platform.OS === 'ios' || Platform.OS === 'android') {
    await assertNativeSecureStoreAvailable();
    await SecureStore.setItemAsync(key, value);
    return;
  }

  if (Platform.OS === 'web') {
    const storage = getWebStorage();
    if (storage) {
      storage.setItem(key, value);
      return;
    }
  }

  nonPersistentRuntimeStorage.set(key, value);
}

async function removePlatformStorage(key: string): Promise<void> {
  if (Platform.OS === 'ios' || Platform.OS === 'android') {
    await assertNativeSecureStoreAvailable();
    await SecureStore.deleteItemAsync(key);
    return;
  }

  if (Platform.OS === 'web') {
    const storage = getWebStorage();
    if (storage) {
      storage.removeItem(key);
      return;
    }
  }

  nonPersistentRuntimeStorage.delete(key);
}

async function assertNativeSecureStoreAvailable(): Promise<void> {
  if (!(await SecureStore.isAvailableAsync())) {
    throw new Error(
      'Native auth persistence requires expo-secure-store in an installed development or production build.',
    );
  }
}

function getWebStorage(): WebStorageLike | null {
  if (Platform.OS !== 'web') return null;
  const storage: unknown = Reflect.get(globalThis, 'localStorage');
  return isWebStorageLike(storage) ? storage : null;
}

function isWebStorageLike(value: unknown): value is WebStorageLike {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof Reflect.get(value, 'getItem') === 'function' &&
    typeof Reflect.get(value, 'setItem') === 'function' &&
    typeof Reflect.get(value, 'removeItem') === 'function'
  );
}
`;
}
