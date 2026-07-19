import type { AuthOAuthProviderId } from '@ankhorage/contracts';
import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';

import type { StoredOAuthCredentialLink } from './pages/adminAuthCredentialFlow';
import {
  AuthAdminPendingCredentialRecoveryStore,
  AuthAdminWriteCoordinator,
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
  readonly runFullAuthSave: <T>(operation: () => Promise<T>) => Promise<AuthAdminWriteResult<T>>;
  readonly runCredentialTransaction: <T>(
    providerId: AuthOAuthProviderId,
    operation: () => Promise<T>,
  ) => Promise<AuthAdminWriteResult<T>>;
}

interface AuthAdminSessionSnapshot {
  readonly pendingCredentialLinks: readonly StoredOAuthCredentialLink[];
  readonly busyCredentialProviderIds: ReadonlySet<AuthOAuthProviderId>;
  readonly fullAuthSaveBusy: boolean;
}

const AuthAdminSessionContext = createContext<AuthAdminSessionValue | null>(null);

export function AuthAdminSessionProvider(props: {
  readonly projectId: string;
  readonly children: React.ReactNode;
}) {
  const writeCoordinatorRef = useRef(new AuthAdminWriteCoordinator());
  const pendingRecoveryRef = useRef(new AuthAdminPendingCredentialRecoveryStore());
  const [snapshot, setSnapshot] = useState<AuthAdminSessionSnapshot>(() =>
    createSnapshot({
      writeCoordinator: writeCoordinatorRef.current,
      pendingRecovery: pendingRecoveryRef.current,
    }),
  );

  const syncSnapshot = useCallback(() => {
    setSnapshot(
      createSnapshot({
        writeCoordinator: writeCoordinatorRef.current,
        pendingRecovery: pendingRecoveryRef.current,
      }),
    );
  }, []);

  const setPendingCredentialLink = useCallback(
    (link: StoredOAuthCredentialLink) => {
      pendingRecoveryRef.current.set(link);
      syncSnapshot();
    },
    [syncSnapshot],
  );

  const clearPendingCredentialLink = useCallback(
    (providerId: AuthOAuthProviderId) => {
      pendingRecoveryRef.current.clear(providerId);
      syncSnapshot();
    },
    [syncSnapshot],
  );

  const runFullAuthSave = useCallback(
    async <T,>(operation: () => Promise<T>): Promise<AuthAdminWriteResult<T>> => {
      try {
        return await writeCoordinatorRef.current.runFullAuthSave(async () => {
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
        return await writeCoordinatorRef.current.runCredentialTransaction(providerId, async () => {
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
      runFullAuthSave,
      runCredentialTransaction,
    }),
    [
      clearPendingCredentialLink,
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

function createSnapshot(args: {
  readonly writeCoordinator: AuthAdminWriteCoordinator;
  readonly pendingRecovery: AuthAdminPendingCredentialRecoveryStore;
}): AuthAdminSessionSnapshot {
  return {
    pendingCredentialLinks: args.pendingRecovery.list(),
    busyCredentialProviderIds: args.writeCoordinator.getBusyProviderIds(),
    fullAuthSaveBusy: args.writeCoordinator.isFullAuthSaveActive(),
  };
}
