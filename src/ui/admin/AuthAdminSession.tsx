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
    operation: () => Promise<T>,
  ) => Promise<AuthAdminWriteResult<T>>;
}

const AuthAdminSessionContext = createContext<AuthAdminSessionValue | null>(null);

export function AuthAdminSessionProvider(props: {
  readonly projectId: string;
  readonly children: React.ReactNode;
}) {
  const sessionRef = useRef(new AuthAdminProjectSession(props.projectId));
  const [snapshot, setSnapshot] = useState<AuthAdminProjectSessionSnapshot>(() =>
    sessionRef.current.getSnapshot(),
  );

  const syncSnapshot = useCallback(() => {
    setSnapshot(sessionRef.current.getSnapshot());
  }, []);

  const setPendingCredentialLink = useCallback(
    (link: StoredOAuthCredentialLink) => {
      sessionRef.current.setPendingCredentialLink(link);
      syncSnapshot();
    },
    [syncSnapshot],
  );

  const clearPendingCredentialLink = useCallback(
    (providerId: AuthOAuthProviderId) => {
      sessionRef.current.clearPendingCredentialLink(providerId);
      syncSnapshot();
    },
    [syncSnapshot],
  );

  const clearPendingCredentialLinksByCredentialsRef = useCallback(
    (credentialsRef: string) => {
      const cleared =
        sessionRef.current.clearPendingCredentialLinksByCredentialsRef(credentialsRef);
      syncSnapshot();
      return cleared;
    },
    [syncSnapshot],
  );

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

  const runCredentialTransaction = useCallback(
    async <T,>(
      providerId: AuthOAuthProviderId,
      operation: () => Promise<T>,
    ): Promise<AuthAdminWriteResult<T>> => {
      try {
        return await sessionRef.current.runCredentialTransaction(providerId, async () => {
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
      fullAuthSaveBusy: snapshot.fullAuthSaveBusy,
      authWriteBusy: snapshot.fullAuthSaveBusy || snapshot.busyCredentialProviderIds.size > 0,
      setPendingCredentialLink,
      clearPendingCredentialLink,
      clearPendingCredentialLinksByCredentialsRef,
      runFullAuthSave,
      runCredentialTransaction,
    }),
    [
      clearPendingCredentialLink,
      clearPendingCredentialLinksByCredentialsRef,
      props.projectId,
      runCredentialTransaction,
      runFullAuthSave,
      setPendingCredentialLink,
      snapshot.busyCredentialProviderIds,
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

export function useAuthAdminSession(): AuthAdminSessionValue {
  const value = useContext(AuthAdminSessionContext);
  if (!value) {
    throw new Error('useAuthAdminSession must be used within an AuthAdminSessionProvider');
  }
  return value;
}
