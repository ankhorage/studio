import type { AuthOAuthProviderId } from '@ankhorage/contracts';
import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';

import type { StoredOAuthCredentialLink } from './pages/adminAuthCredentialFlow';
import {
  AuthAdminProjectSession,
  type AuthAdminProjectSessionSnapshot,
  type AuthAdminWriteResult,
} from './pages/adminAuthSessionModel';

export interface AuthAdminSessionValue {
  readonly projectId: string;
  readonly pendingCredentialLinks: readonly StoredOAuthCredentialLink[];
  readonly busyCredentialProviderIds: ReadonlySet<AuthOAuthProviderId>;
  readonly busyCredentialRefs: ReadonlySet<string>;
  readonly busyCredentialSecretCleanupRefs: ReadonlySet<string>;
  readonly fullAuthSaveBusy: boolean;
  readonly authWriteBusy: boolean;
  readonly setPendingCredentialLink: (link: StoredOAuthCredentialLink) => void;
  readonly clearPendingCredentialLink: (providerId: AuthOAuthProviderId) => void;
  readonly clearPendingCredentialLinksByCredentialsRef: (
    credentialsRef: string,
  ) => readonly StoredOAuthCredentialLink[];
  readonly runFullAuthSave: <T>(operation: () => Promise<T>) => Promise<AuthAdminWriteResult<T>>;
  readonly runCredentialTransaction: <T>(
    providerId: AuthOAuthProviderId,
    credentialsRef: string,
    operation: () => Promise<T>,
  ) => Promise<AuthAdminWriteResult<T>>;
  readonly runCredentialSecretCleanup: <T>(
    credentialsRef: string,
    operation: () => Promise<T>,
  ) => Promise<AuthAdminWriteResult<T>>;
}

const AuthAdminSessionContext = createContext<AuthAdminSessionValue | null>(null);

/***
 * Bridge the imperative auth-admin project session model into React context and keep its snapshot synchronized around every write transaction.
 * @todo Keep this React context adapter at the auth/admin UI edge; durable transaction/busy-state rules belong to the auth application model.
 */
export function AuthAdminSessionProvider(props: {
  readonly projectId: string;
  readonly children: React.ReactNode;
}) {
  const sessionRef = useRef(new AuthAdminProjectSession(props.projectId));
  const [snapshot, setSnapshot] = useState<AuthAdminProjectSessionSnapshot>(() =>
    sessionRef.current.getSnapshot(),
  );

  /*** Refresh React state from the current imperative auth-admin session snapshot. */
  const syncSnapshot = useCallback(() => {
    setSnapshot(sessionRef.current.getSnapshot());
  }, []);

  /*** Store or replace one pending OAuth credential link and publish the updated session snapshot. */
  const setPendingCredentialLink = useCallback(
    (link: StoredOAuthCredentialLink) => {
      sessionRef.current.setPendingCredentialLink(link);
      syncSnapshot();
    },
    [syncSnapshot],
  );

  /*** Remove the pending credential link for one provider and publish the updated session snapshot. */
  const clearPendingCredentialLink = useCallback(
    (providerId: AuthOAuthProviderId) => {
      sessionRef.current.clearPendingCredentialLink(providerId);
      syncSnapshot();
    },
    [syncSnapshot],
  );

  /*** Remove all pending credential links matching one credential reference and return the cleared links. */
  const clearPendingCredentialLinksByCredentialsRef = useCallback(
    (credentialsRef: string) => {
      const cleared =
        sessionRef.current.clearPendingCredentialLinksByCredentialsRef(credentialsRef);
      syncSnapshot();
      return cleared;
    },
    [syncSnapshot],
  );

  /*** Execute one full-auth save transaction while keeping React busy/snapshot state synchronized before and after the operation. */
  const runFullAuthSave = useCallback(
    async <T,>(operation: () => Promise<T>): Promise<AuthAdminWriteResult<T>> => {
      try {
        return await sessionRef.current.runFullAuthSave(async () => {
          syncSnapshot();
          return await operation();
        });
      } finally {
        syncSnapshot();
      }
    },
    [syncSnapshot],
  );

  /*** Execute one provider/credential transaction while reflecting its busy state into React context. */
  const runCredentialTransaction = useCallback(
    async <T,>(
      providerId: AuthOAuthProviderId,
      credentialsRef: string,
      operation: () => Promise<T>,
    ): Promise<AuthAdminWriteResult<T>> => {
      try {
        return await sessionRef.current.runCredentialTransaction(
          providerId,
          credentialsRef,
          async () => {
            syncSnapshot();
            return await operation();
          },
        );
      } finally {
        syncSnapshot();
      }
    },
    [syncSnapshot],
  );

  /*** Execute cleanup for one credential secret while reflecting its busy state into React context. */
  const runCredentialSecretCleanup = useCallback(
    async <T,>(credentialsRef: string, operation: () => Promise<T>) => {
      try {
        return await sessionRef.current.runCredentialSecretCleanup(credentialsRef, async () => {
          syncSnapshot();
          return await operation();
        });
      } finally {
        syncSnapshot();
      }
    },
    [syncSnapshot],
  );

  const value = useMemo<AuthAdminSessionValue>(
    () => ({
      projectId: props.projectId,
      pendingCredentialLinks: snapshot.pendingCredentialLinks,
      busyCredentialProviderIds: snapshot.busyCredentialProviderIds,
      busyCredentialRefs: snapshot.busyCredentialRefs,
      busyCredentialSecretCleanupRefs: snapshot.busyCredentialSecretCleanupRefs,
      fullAuthSaveBusy: snapshot.fullAuthSaveBusy,
      authWriteBusy:
        snapshot.fullAuthSaveBusy ||
        snapshot.busyCredentialProviderIds.size > 0 ||
        snapshot.busyCredentialSecretCleanupRefs.size > 0,
      setPendingCredentialLink,
      clearPendingCredentialLink,
      clearPendingCredentialLinksByCredentialsRef,
      runFullAuthSave,
      runCredentialTransaction,
      runCredentialSecretCleanup,
    }),
    [
      clearPendingCredentialLink,
      clearPendingCredentialLinksByCredentialsRef,
      props.projectId,
      runCredentialSecretCleanup,
      runCredentialTransaction,
      runFullAuthSave,
      setPendingCredentialLink,
      snapshot.busyCredentialRefs,
      snapshot.busyCredentialProviderIds,
      snapshot.busyCredentialSecretCleanupRefs,
      snapshot.fullAuthSaveBusy,
      snapshot.pendingCredentialLinks,
    ],
  );

  return (
    <AuthAdminSessionContext.Provider value={value}>
      {props.children}
    </AuthAdminSessionContext.Provider>
  );
}

/*** Read the auth-admin React session and reject usage outside its provider boundary. */
export function useAuthAdminSession(): AuthAdminSessionValue {
  const value = useContext(AuthAdminSessionContext);
  if (!value) {
    throw new Error('useAuthAdminSession must be used within an AuthAdminSessionProvider');
  }
  return value;
}
