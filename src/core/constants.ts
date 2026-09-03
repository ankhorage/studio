import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { readOwnProperty } from '../utils/readOwnProperty';
import { resolveStudioApiBase } from './apiBase';

/*** Resolve the Studio API base URL from explicit environment, Expo host, and platform inputs. */
const getApiBase = (): string => {
  return resolveStudioApiBase({
    explicitApiBase: readEnvString('EXPO_PUBLIC_API_URL'),
    expoHostUri: readExpoHostUri(),
    platform: Platform.OS,
  });
};

/*** Read a non-empty string environment variable without traversing inherited properties. */
function readEnvString(name: string): string | undefined {
  const value = readOwnProperty<unknown>(process.env, name);
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

/*** Read the current Expo development host URI when Expo exposes a non-empty value. */
function readExpoHostUri(): string | null {
  const expoConfig = Constants.expoConfig as { hostUri?: unknown } | null | undefined;
  const hostUri = expoConfig?.hostUri;
  return typeof hostUri === 'string' && hostUri.length > 0 ? hostUri : null;
}

export const API_BASE = getApiBase();
