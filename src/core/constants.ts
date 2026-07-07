import Constants from 'expo-constants';

const DEFAULT_API_BASE = 'http://localhost:3000/api';

const getApiBase = (): string => {
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }

  const hostUri = readExpoHostUri();
  if (hostUri !== null) {
    const [ip] = hostUri.split(':');
    return `http://${ip}:3000/api`;
  }

  return DEFAULT_API_BASE;
};

function readExpoHostUri(): string | null {
  const expoConfig = Constants.expoConfig as { hostUri?: unknown } | null | undefined;
  const hostUri = expoConfig?.hostUri;
  return typeof hostUri === 'string' && hostUri.length > 0 ? hostUri : null;
}

export const API_BASE = getApiBase();
