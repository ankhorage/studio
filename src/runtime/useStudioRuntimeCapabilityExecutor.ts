import { useZoraTheme } from '@ankhorage/zora';
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
export function useStudioRuntimeCapabilityExecutor() {
  const router = useRouter();
  const { setMode } = useZoraTheme();
  const executeCapability = useMemo(
    () =>
      createStudioRuntimeCapabilityExecutor({
        alert: (message) => Alert.alert(message),
        navigate: (input) => {
          const { params, route } = input as NavigatorNavigateInput;
          router.navigate({ params, pathname: route });
        },
        setThemeMode: (input) => setMode((input as ThemeSetModeInput).mode),
      }),
    [router, setMode],
  );

  return { executeCapability };
}
