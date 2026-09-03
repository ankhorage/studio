import { executeExpoRuntimeAction } from '@ankhorage/expo-runtime/action-bridge';
import type { RuntimeActionHandlers } from '@ankhorage/runtime';

interface RouterLike {
  push: (args: { pathname: string; params: Record<string, number | string> }) => void;
}

/***
 * Forward Studio runtime actions directly to the canonical Expo runtime action bridge.
 * @todo Remove or justify this pass-through wrapper; the implementation is already owned by `@ankhorage/expo-runtime/action-bridge` and should not be duplicated behind a Studio runtime facade without a Studio-specific contract.
 */
export async function executeRuntimeAction(args: {
  action: unknown;
  router: RouterLike;
  mode: 'light' | 'dark';
  setMode: (mode: 'light' | 'dark') => void;
  actionHandlers?: RuntimeActionHandlers;
  requestAnimationFrameImpl?: typeof requestAnimationFrame;
  alertImpl?: typeof alert;
  consoleImpl?: Pick<typeof console, 'log'>;
}): Promise<void> {
  return executeExpoRuntimeAction(args);
}
