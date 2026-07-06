import Constants from 'expo-constants';

export const getApiBase = () => {
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }

  const debuggerHost = Constants.expoConfig?.hostUri;
  if (debuggerHost) {
    const [ip] = debuggerHost.split(':');
    return `http://${ip}:3000/api`;
  }

  return 'http://localhost:3000/api';
};

export const API_BASE = getApiBase();
