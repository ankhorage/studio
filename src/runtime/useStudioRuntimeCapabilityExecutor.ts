import { resolveExpoRuntimeRoutePath } from '@ankhorage/expo-runtime/capability-bridge';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Alert, Platform } from 'react-native';

import { createStudioRuntimeCapabilityExecutor } from './executeStudioRuntimeCapabilityAsync.js';

interface NavigatorNavigateInput {
  readonly route: string;
  readonly params?: Record<string, string>;
}

interface ThemeSetModeInput {
  readonly mode: 'dark' | 'light';
}

/***
 * Expose Studio's runtime-host capability executor to generated Studio applications.
 */
export function useStudioRuntimeCapabilityExecutor(args: {
  readonly setThemeMode: (mode: ThemeSetModeInput['mode']) => void;
}) {
  const router = useRouter();
  const { setThemeMode } = args;
  const executeCapability = useMemo(
    () =>
      createStudioRuntimeCapabilityExecutor({
        alert: showRuntimeAlert,
        navigate: (input) => {
          const { params, route } = input as NavigatorNavigateInput;
          const { resolvedPath, unusedParams } = resolveExpoRuntimeRoutePath(route, params);
          router.navigate({ params: unusedParams, pathname: resolvedPath });
        },
        setThemeMode: (input) => setThemeMode((input as ThemeSetModeInput).mode),
      }),
    [router, setThemeMode],
  );

  return { executeCapability };
}

/*** Present Runtime alerts through the browser dialog host on Web and React Native on native targets. */
function showRuntimeAlert(message: string): void {
  if (Platform.OS === 'web') {
    globalThis.alert(message);
    return;
  }
  Alert.alert(message);
}
