import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { readOwnProperty } from '../utils/readOwnProperty';
import { resolveStudioApiBase } from './apiBase';

const getApiBase = (): string => {
  return resolveStudioApiBase({
    explicitApiBase: readEnvString('EXPO_PUBLIC_API_URL'),
    expoHostUri: readExpoHostUri(),
    platform: Platform.OS,
  });
};

function readEnvString(name: string): string | undefined {
  const value = readOwnProperty<unknown>(process.env, name);
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function readExpoHostUri(): string | null {
  const expoConfig = Constants.expoConfig as { hostUri?: unknown } | null | undefined;
  const hostUri = expoConfig?.hostUri;
  return typeof hostUri === 'string' && hostUri.length > 0 ? hostUri : null;
}

export const API_BASE = getApiBase();
