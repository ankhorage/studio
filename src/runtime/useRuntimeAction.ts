import {
  createDbPersistActionHandler,
  type RuntimeActionExecutor,
  type RuntimeActionHandlers,
  type RuntimeRendererConfig,
} from '@ankhorage/runtime';
import { useZoraTheme } from '@ankhorage/zora';
import { useRouter } from 'expo-router';
import { useCallback, useMemo } from 'react';

import { executeRuntimeAction } from './runtimeActions.js';

export interface UseRuntimeActionOptions {
  actionHandlers?: RuntimeActionHandlers;
  dbAdapter?: RuntimeRendererConfig['dbAdapter'];
  consoleImpl?: Pick<typeof console, 'log'>;
}

/***
 * Compose Expo Router, ZORA theme state, optional DB persistence, and custom runtime handlers into a React runtime-action executor.
 * @todo Keep this React/Expo/ZORA composition at the Studio app/runtime edge rather than generic runtime ownership.
 */
export function useRuntimeAction(options: UseRuntimeActionOptions = {}) {
  const router = useRouter();
  const { mode, setMode } = useZoraTheme();
  const { actionHandlers, dbAdapter, consoleImpl = console } = options;

  const effectiveActionHandlers = useMemo(() => {
    if (!dbAdapter) return actionHandlers;

    return {
      'db.persist': createDbPersistActionHandler({ dbAdapter }),
      ...(actionHandlers ?? {}),
    } satisfies RuntimeActionHandlers;
  }, [actionHandlers, dbAdapter]);

  const executeAction = useCallback<RuntimeActionExecutor>(
    async ({ action }) => {
      await executeRuntimeAction({
        action,
        actionHandlers: effectiveActionHandlers,
        consoleImpl,
        mode,
        router,
        setMode,
      });
    },
    [consoleImpl, effectiveActionHandlers, mode, router, setMode],
  );

  return { executeAction };
}
