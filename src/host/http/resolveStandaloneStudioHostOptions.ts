import { parseTcpPort } from '@ankhorage/utility/number';

const DEFAULT_STUDIO_HOST_PORT = 3000;
const DEVELOPMENT_STUDIO_HOST = '0.0.0.0';

/***
 * Parse a raw optional port value, validate TCP port bounds, and combine it with a default development host.
 */
export function resolveStandaloneStudioHostOptions(rawPortValue: unknown) {
  const portValue = typeof rawPortValue === 'string' ? rawPortValue : undefined;
  const port = portValue === undefined ? DEFAULT_STUDIO_HOST_PORT : parseTcpPort(portValue);

  if (port === null) {
    throw new Error(`Invalid ANKHORAGE_STUDIO_HOST_PORT: ${portValue}`);
  }

  return { port, host: DEVELOPMENT_STUDIO_HOST };
}
