import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Alert } from 'react-native';

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
        alert: (message) => Alert.alert(message),
        navigate: (input) => {
          const { params, route } = input as NavigatorNavigateInput;
          router.navigate({ params, pathname: route });
        },
        setThemeMode: (input) => setThemeMode((input as ThemeSetModeInput).mode),
      }),
    [router, setThemeMode],
  );

  return { executeCapability };
}
