import { readExpoHostUri } from '@ankhorage/utility/expo';
import { readEnvString } from '@ankhorage/utility/node/env';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { resolveStudioApiBase } from './resolveStudioApiBase';

/***
 * Resolve the Studio API base URL from explicit environment, Expo host, and platform inputs.
 */
const getApiBase = (): string => {
  return resolveStudioApiBase({
    explicitApiBase: readEnvString('EXPO_PUBLIC_API_URL', process.env),
    expoHostUri: readExpoHostUri(Constants),
    platform: Platform.OS,
  });
};

export const API_BASE = getApiBase();
