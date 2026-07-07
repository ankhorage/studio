import { executeExpoRuntimeAction } from '@ankhorage/expo-runtime';
import type { RuntimeActionHandlers } from '@ankhorage/runtime';

interface RouterLike {
  push: (args: { pathname: string; params: Record<string, number | string> }) => void;
}

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
