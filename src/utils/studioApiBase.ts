import { readExpoHostUri } from '@ankhorage/utility/expo';
import { readEnvString } from '@ankhorage/utility/node/env';
import { isRecord } from '@ankhorage/utility/object';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { resolveStudioApiBase } from './resolveStudioApiBase';

export const studioApiBase = resolveStudioApiBase({
  configuredApiBase: readConfiguredStudioApiBase(),
  explicitApiBase: readEnvString('EXPO_PUBLIC_API_URL', process.env),
  expoHostUri: readExpoHostUri(Constants),
  platform: Platform.OS,
});

/*** Read the app-owned Studio API base embedded in the Expo manifest at build time. */
function readConfiguredStudioApiBase(): string | undefined {
  const extra: unknown = Constants.expoConfig?.extra;
  const configuredApiBase = isRecord(extra) ? extra.studioApiBase : undefined;
  return typeof configuredApiBase === 'string' && configuredApiBase.length > 0
    ? configuredApiBase
    : undefined;
}
