import Constants from 'expo-constants';

const DEFAULT_API_BASE = 'http://localhost:3000/api';

const getApiBase = (): string => {
  const envApiBase = readEnvString('EXPO_PUBLIC_API_URL');
  if (envApiBase !== undefined) {
    return envApiBase;
  }

  const hostUri = readExpoHostUri();
  if (hostUri !== null) {
    const [ip] = hostUri.split(':');
    return `http://${ip}:3000/api`;
  }

  return DEFAULT_API_BASE;
};

function readEnvString(name: string): string | undefined {
  const value: unknown = process.env[name];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function readExpoHostUri(): string | null {
  const expoConfig = Constants.expoConfig as { hostUri?: unknown } | null | undefined;
  const hostUri = expoConfig?.hostUri;
  return typeof hostUri === 'string' && hostUri.length > 0 ? hostUri : null;
}

export const API_BASE = getApiBase();
