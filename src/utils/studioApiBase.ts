import { readExpoHostUri } from '@ankhorage/utility/expo';
import { readEnvString } from '@ankhorage/utility/node/env';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { resolveStudioApiBase } from './resolveStudioApiBase';

export const studioApiBase = resolveStudioApiBase({
  explicitApiBase: readEnvString('EXPO_PUBLIC_API_URL', process.env),
  expoHostUri: readExpoHostUri(Constants),
  platform: Platform.OS,
});
